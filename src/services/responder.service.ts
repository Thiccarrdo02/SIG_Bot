/**
 * Responder Service
 * Handles conversation generation using OpenAI GPT-4o (temporary) or Gemini
 */

import OpenAI from 'openai';
import { config, MODEL_CONFIG, BANNED_PATTERNS, REFUSAL_RESPONSES, INTENT_PATTERNS } from '../config';
import { buildSystemPrompt } from '../prompts';
import { logger } from '../utils';
import { SessionData } from './session.service';

export interface ResponderResult {
    reply: string;
    detectedPath: string | null;
    intents: {
        readyToPay: boolean;
        wantsCall: boolean;
        complianceRisk: boolean;
    };
}

export class ResponderService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: config.openai.apiKey,
        });
    }

    /**
     * Generate a response for the user message
     */
    async generateResponse(
        userMessage: string,
        session: SessionData
    ): Promise<ResponderResult> {

        // Pre-check for banned content
        const bannedCheck = this.checkBannedContent(userMessage);
        if (bannedCheck.isBanned) {
            return {
                reply: bannedCheck.refusalMessage,
                detectedPath: session.currentPath,
                intents: {
                    readyToPay: false,
                    wantsCall: false,
                    complianceRisk: true,
                },
            };
        }

        try {
            // Get lead data for context
            const leadData = await this.getLeadData(session.manychatId);

            // Extract user info from conversation for context
            const extractedInfo = this.extractUserInfo(session.messages);

            // Build conversation summary with extracted info
            let conversationSummary = 'New conversation';
            if (session.messages.length > 0) {
                const parts = [];
                if (extractedInfo.name) parts.push(`User name: ${extractedInfo.name}`);
                if (extractedInfo.location) parts.push(`Location: ${extractedInfo.location}`);
                if (extractedInfo.phone) parts.push(`Phone: ${extractedInfo.phone}`);
                if (extractedInfo.occupation) parts.push(`Occupation: ${extractedInfo.occupation}`);
                parts.push(`Messages: ${session.messages.length}`);
                parts.push(`Topics: ${this.summarizeTopics(session.messages)}`);
                conversationSummary = parts.join('. ');
            }

            // Build system prompt
            const systemPrompt = buildSystemPrompt(session.currentPath, {
                name: extractedInfo.name || leadData?.name,
                budget: leadData?.budget,
                location: extractedInfo.location || leadData?.location,
                conversationSummary,
            });

            // Build conversation history for OpenAI format
            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
                { role: 'system', content: systemPrompt },
            ];

            // Add conversation history - configurable via CHAT_HISTORY_LIMIT env var
            const historyLimit = config.session.historyLimit;
            for (const msg of session.messages.slice(-historyLimit)) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                });
            }

            // Add current user message
            messages.push({ role: 'user', content: userMessage });

            // Generate response using configured model
            const response = await this.openai.chat.completions.create({
                model: MODEL_CONFIG.responder.model,
                messages,
                max_tokens: MODEL_CONFIG.responder.maxOutputTokens,
                temperature: MODEL_CONFIG.responder.temperature,
            });

            let reply = response.choices[0]?.message?.content || '';

            // Extract path from response
            const detectedPath = this.extractPath(reply);

            // Remove path tag from reply
            reply = this.cleanReply(reply);

            // Post-process for safety
            reply = this.postProcess(reply);

            // Detect intents
            const intents = this.detectIntents(userMessage, reply);

            return {
                reply,
                detectedPath,
                intents,
            };

        } catch (error) {
            logger.error('Responder error:', error);
            return {
                reply: "I apologize, I'm experiencing a brief delay. Please try again, or reach out to our team at +91 8828888664 for immediate assistance.",
                detectedPath: session.currentPath,
                intents: {
                    readyToPay: false,
                    wantsCall: false,
                    complianceRisk: false,
                },
            };
        }
    }

    /**
     * Check for banned content
     */
    private checkBannedContent(message: string): { isBanned: boolean; refusalMessage: string } {
        for (const pattern of BANNED_PATTERNS) {
            if (pattern.test(message)) {
                // Determine which type of refusal
                if (/replica|copy|fake|counterfeit/i.test(message)) {
                    return { isBanned: true, refusalMessage: REFUSAL_RESPONSES.replica };
                }
                if (/stock|invest|tip|call/i.test(message)) {
                    return { isBanned: true, refusalMessage: REFUSAL_RESPONSES.tradingTip };
                }
            }
        }
        return { isBanned: false, refusalMessage: '' };
    }

    /**
     * Extract path from LLM response
     */
    private extractPath(reply: string): string | null {
        const pathMatch = reply.match(/\[PATH:\s*([A-E])\]/i);
        return pathMatch ? pathMatch[1].toUpperCase() : null;
    }

    /**
     * Clean reply by removing internal tags
     */
    private cleanReply(reply: string): string {
        // Remove path tag
        reply = reply.replace(/\[PATH:\s*[A-E]\]/gi, '').trim();
        // Remove any other internal tags
        reply = reply.replace(/\[SWITCH:\s*PATH_[A-E]\]/gi, '').trim();
        return reply;
    }

    /**
     * Post-process reply for safety
     */
    private postProcess(reply: string): string {
        // Remove any staff names that might have slipped through
        const staffNames = ['Anwar', 'Moiz', 'Fatima', 'Ahmed'];
        for (const name of staffNames) {
            reply = reply.replace(new RegExp(`\\b${name}\\b`, 'gi'), 'our team');
        }

        // Ensure only official phone number
        reply = reply.replace(/\+91\s*\d{10}/g, '+91 8828888664');
        reply = reply.replace(/\d{10,}/g, (match) => {
            if (match !== '8828888664' && match.length >= 10) {
                return '+91 8828888664';
            }
            return match;
        });

        return reply;
    }

    /**
     * Detect user intents
     */
    private detectIntents(userMessage: string, _botReply: string): {
        readyToPay: boolean;
        wantsCall: boolean;
        complianceRisk: boolean;
    } {
        const readyToPay = INTENT_PATTERNS.readyToPay.some(p => p.test(userMessage));
        const wantsCall = INTENT_PATTERNS.wantsCall.some(p => p.test(userMessage));
        const complianceRisk = BANNED_PATTERNS.some(p => p.test(userMessage));

        return { readyToPay, wantsCall, complianceRisk };
    }

    /**
     * Get lead data from database (optional)
     */
    private async getLeadData(manychatId: string) {
        // Skip if database not configured
        if (!process.env.DATABASE_URL || process.env.DATABASE_URL.length < 10 || process.env.DATABASE_URL.includes('your_project')) {
            return null;
        }

        try {
            const { prisma } = await import('./db');
            return await prisma.lead.findUnique({
                where: { manychat_id: manychatId },
                select: { name: true, budget: true, location: true },
            });
        } catch (error) {
            return null;
        }
    }

    /**
     * Summarize conversation topics
     */
    private summarizeTopics(messages: { content: string }[]): string {
        const topics: string[] = [];
        const text = messages.map(m => m.content).join(' ').toLowerCase();

        if (/sourc|import|china|factory|t-?shirt|product/i.test(text)) topics.push('Sourcing');
        if (/amazon|fba|private label|brand/i.test(text)) topics.push('FBA');
        if (/trad|stock|crypto|invest|mentor/i.test(text)) topics.push('Trading');
        if (/halal|haram|hudood/i.test(text)) topics.push('Hudood');
        if (/book|guide/i.test(text)) topics.push('Book');

        return topics.length > 0 ? topics.join(', ') : 'General inquiry';
    }

    /**
     * Extract user info from conversation history
     */
    private extractUserInfo(messages: { role: string; content: string }[]): {
        name: string | null;
        location: string | null;
        phone: string | null;
        occupation: string | null;
    } {
        const allText = messages.map(m => m.content).join(' ');

        let name: string | null = null;
        let location: string | null = null;
        let phone: string | null = null;
        let occupation: string | null = null;

        // Extract name - patterns like "mera naam X hai", "my name is X", "I am X"
        const namePatterns = [
            /(?:mera naam|my name is|i am|i'm|naam)\s+([a-zA-Z]+)/i,
            /(?:naam|name)\s*:?\s*([a-zA-Z]+)/i,
        ];
        for (const pattern of namePatterns) {
            const match = allText.match(pattern);
            if (match && match[1] && match[1].length > 1) {
                name = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
                break;
            }
        }

        // Extract location - city names
        const cities = ['delhi', 'mumbai', 'bangalore', 'hyderabad', 'chennai', 'kolkata', 'pune', 'indore', 'ahmedabad', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'patna', 'bhopal', 'ludhiana', 'agra', 'vadodara', 'coimbatore', 'madurai'];
        for (const city of cities) {
            if (allText.toLowerCase().includes(city)) {
                location = city.charAt(0).toUpperCase() + city.slice(1);
                break;
            }
        }

        // Extract phone - 10 digit numbers
        const phoneMatch = allText.match(/(\+91\s*)?[6-9]\d{9}/g);
        if (phoneMatch && phoneMatch.length > 0) {
            phone = phoneMatch[phoneMatch.length - 1].replace(/\s/g, '');
            if (!phone.startsWith('+91')) phone = '+91' + phone;
        }

        // Extract occupation
        if (/student/i.test(allText)) occupation = 'Student';
        else if (/business|businessman|entrepreneur|online sell|seller/i.test(allText)) occupation = 'Business';
        else if (/salaried|job|employee|working/i.test(allText)) occupation = 'Salaried';
        else if (/investor/i.test(allText)) occupation = 'Investor';

        return { name, location, phone, occupation };
    }
}

export const responderService = new ResponderService();
export default responderService;

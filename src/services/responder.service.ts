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
            // Get lead data for context (includes all previously extracted info)
            const leadData = await this.getLeadData(session.manychatId);

            // Extract user info from current conversation
            const extractedInfo = this.extractUserInfo(session.messages);

            // Build comprehensive context memory block
            // This ensures the bot NEVER forgets important user information
            const contextMemory = this.buildContextMemory(leadData, extractedInfo, session);

            // Build system prompt with context memory
            const systemPrompt = buildSystemPrompt(session.currentPath, {
                name: extractedInfo.name || leadData?.name,
                budget: leadData?.budget,
                location: extractedInfo.location || leadData?.location,
                conversationSummary: contextMemory,
            });

            // Build conversation history for OpenAI format
            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
                { role: 'system', content: systemPrompt },
            ];

            // Add conversation history - only last N messages for token efficiency
            // Full history stored in DB (historyLimit=100), but only send contextLimit to LLM
            const contextLimit = config.session.contextLimit;
            for (const msg of session.messages.slice(-contextLimit)) {
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
     * Get lead data from database (ALL fields for context memory)
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
                select: {
                    name: true,
                    location: true,
                    phone: true,
                    path: true,
                    interest: true,
                    niche: true,
                    budget: true,
                    budget_tier: true,
                    age: true,
                    age_bracket: true,
                    gender: true,
                    occupation: true,
                    experience_level: true,
                    product_category: true,
                    request_type: true,
                    ai_context: true,
                },
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
     * Build context memory block with known user information
     * CRITICAL: Explicitly tell LLM not to ask for info we already have
     */
    private buildContextMemory(
        leadData: Awaited<ReturnType<typeof this.getLeadData>>,
        extractedInfo: ReturnType<typeof this.extractUserInfo>,
        session: { messages: { content: string }[]; currentPath: string | null }
    ): string {
        const collected: string[] = [];
        const doNotAsk: string[] = [];

        // Core identity - only add if we have values
        const name = extractedInfo.name || leadData?.name;
        const location = extractedInfo.location || leadData?.location;
        const phone = extractedInfo.phone || leadData?.phone;
        const occupation = extractedInfo.occupation || leadData?.occupation;
        const age = leadData?.age;
        const budget = leadData?.budget;

        // Build collected info AND do-not-ask list
        if (name) {
            collected.push(`Name: ${name}`);
            doNotAsk.push('name');
        }
        if (location) {
            collected.push(`Location: ${location}`);
            doNotAsk.push('location');
        }
        if (phone) {
            collected.push(`Phone: ${phone}`);
            doNotAsk.push('phone');
        }
        if (occupation) {
            collected.push(`Occupation: ${occupation}`);
            doNotAsk.push('occupation');
        }
        if (age) collected.push(`Age: ${age}`);
        if (budget) collected.push(`Budget: ₹${budget.toLocaleString()}`);

        // Build context with explicit instruction not to re-ask
        if (collected.length > 0) {
            let context = `KNOWN USER INFO: ${collected.join(', ')}.`;
            if (doNotAsk.length > 0) {
                context += ` CRITICAL: Do NOT ask for ${doNotAsk.join(', ')} again - we already have this info.`;
            }
            context += ` Messages: ${session.messages.length}. Topics: ${this.summarizeTopics(session.messages)}`;
            return context;
        }

        return `New user (no info collected yet). Messages: ${session.messages.length}. Topics: ${this.summarizeTopics(session.messages)}`;
    }

    /**
     * Extract user info from conversation history
     * IMPROVED: Better patterns for detecting name+location in one line
     */
    private extractUserInfo(messages: { role: string; content: string }[]): {
        name: string | null;
        location: string | null;
        phone: string | null;
        occupation: string | null;
    } {
        // Only look at user messages
        const userMessages = messages.filter(m => m.role === 'user');
        const allText = userMessages.map(m => m.content).join(' ');

        let name: string | null = null;
        let location: string | null = null;
        let phone: string | null = null;
        let occupation: string | null = null;

        // Expanded city list (80+ cities including Kashmir region)
        const cities = [
            // Major metros
            'delhi', 'mumbai', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad',
            // Tier 2 cities
            'jaipur', 'lucknow', 'kanpur', 'nagpur', 'patna', 'bhopal', 'ludhiana', 'agra', 'vadodara', 'coimbatore',
            'madurai', 'indore', 'thane', 'surat', 'nashik', 'rajkot', 'varanasi', 'chandigarh', 'guwahati', 'mysore',
            'ranchi', 'jodhpur', 'raipur', 'kochi', 'visakhapatnam', 'bhubaneswar', 'thiruvananthapuram', 'gurgaon', 'noida', 'faridabad',
            // Kashmir & North India
            'srinagar', 'kashmir', 'jammu', 'hyderpora', 'leh', 'ladakh', 'shimla', 'manali', 'dehradun', 'rishikesh',
            'haridwar', 'mussoorie', 'amritsar', 'jalandhar', 'pathankot', 'dharamshala', 'kullu', 'pahalgam', 'gulmarg',
            // South India  
            'mangalore', 'hubli', 'belgaum', 'trivandrum', 'calicut', 'kozhikode', 'thrissur', 'palakkad', 'ernakulam',
            // East India
            'siliguri', 'durgapur', 'asansol', 'cuttack', 'rourkela',
            // West India
            'navi mumbai', 'aurangabad', 'solapur', 'kolhapur', 'sangli', 'jamnagar', 'bhavnagar', 'junagadh',
            // Central India
            'jabalpur', 'gwalior', 'ujjain', 'rewa',
            // Gulf countries (many users from there)
            'dubai', 'sharjah', 'abu dhabi', 'riyadh', 'jeddah', 'dammam', 'doha', 'muscat', 'kuwait', 'bahrain', 'medina', 'mecca'
        ];

        // Extract phone first - 10 digit numbers
        const phoneMatch = allText.match(/(\+91\s*)?[6-9]\d{9}/g);
        if (phoneMatch && phoneMatch.length > 0) {
            phone = phoneMatch[phoneMatch.length - 1].replace(/\s/g, '');
            if (!phone.startsWith('+91')) phone = '+91' + phone;
        }

        // Extract location - check for city names
        for (const city of cities) {
            const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
            if (cityRegex.test(allText)) {
                location = city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                break;
            }
        }

        // Extract name - multiple patterns
        const namePatterns = [
            /(?:mera naam|my name is|i am|i'm|naam)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
            /(?:naam|name)\s*:?\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
        ];
        for (const pattern of namePatterns) {
            const match = allText.match(pattern);
            if (match && match[1] && match[1].length > 1) {
                name = match[1].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                break;
            }
        }

        // FALLBACK: If location found but no name, check for "Name Location" pattern
        // This handles cases like "Malik N Marof Hyderpora Srinagar Kashmir"
        if (location && !name) {
            for (const msg of userMessages) {
                const content = msg.content.trim();
                // Check if message contains a city name
                for (const city of cities) {
                    const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
                    if (cityRegex.test(content)) {
                        // Extract everything before the city as potential name
                        const cityIndex = content.toLowerCase().indexOf(city.toLowerCase());
                        if (cityIndex > 2) {
                            const potentialName = content.substring(0, cityIndex).trim();
                            // Validate: should be 2-4 words, all alphabetic
                            const words = potentialName.split(/\s+/).filter(w => /^[a-zA-Z]+$/.test(w));
                            if (words.length >= 1 && words.length <= 4) {
                                name = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                                break;
                            }
                        }
                    }
                }
                if (name) break;
            }
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

/**
 * Extractor Service
 * Extracts structured data from conversations using GPT-4o-mini
 */

import OpenAI from 'openai';
import { config, MODEL_CONFIG } from '../config';
import { EXTRACTOR_PROMPT } from '../prompts';
import { logger } from '../utils';
import { prisma } from './db';
import { SessionData, Message } from './session.service';

export interface ExtractedData {
    name: string | null;
    location: string | null;
    phone: string | null;
    instagram_handle: string | null;  // Instagram username
    is_important: boolean;            // True when phone collected (high-value lead)
    path: string;
    interest: string | null;
    niche: string | null;
    budget: number | null;
    budget_tier: string | null;
    age: number | null;
    age_bracket: string | null;
    gender: string | null;
    occupation: string | null;
    experience_level: string | null;
    product_category: string | null;
    request_type: string | null;
    target_price: number | null;
    status: string;
    wants_call: boolean;
    ready_to_pay: boolean;
    compliance_risk: boolean;
    ai_context: string;
    bot_score: number;
}

export class ExtractorService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: config.openai.apiKey,
        });
    }

    /**
     * Extract structured data from a conversation
     */
    async extractData(session: SessionData): Promise<ExtractedData | null> {
        if (session.messages.length === 0) {
            logger.info(`Skipping extraction for ${session.manychatId}: no messages`);
            return null;
        }

        try {
            // Format conversation history
            const conversationHistory = this.formatConversation(session.messages);

            // Build prompt
            const prompt = EXTRACTOR_PROMPT.replace('{{conversation_history}}', conversationHistory);

            const response = await this.openai.chat.completions.create({
                model: MODEL_CONFIG.extractor.model,
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: 'Extract the data from the conversation above.' },
                ],
                temperature: MODEL_CONFIG.extractor.temperature,
                max_tokens: MODEL_CONFIG.extractor.maxTokens,
                response_format: { type: 'json_object' },
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('Empty response from extractor');
            }

            const extracted = JSON.parse(content) as ExtractedData;

            // Validate and clean
            return this.validateAndClean(extracted);

        } catch (error) {
            logger.error('Extraction error:', error);
            return null;
        }
    }

    /**
     * Save extracted data to database (upsert - create if not exists)
     */
    async saveToDatabase(manychatId: string, data: ExtractedData): Promise<void> {
        try {
            await prisma.lead.upsert({
                where: { manychat_id: manychatId },
                update: {
                    name: data.name,
                    location: data.location,
                    phone: data.phone,
                    instagram_handle: data.instagram_handle,
                    is_important: data.is_important,
                    path: data.path,
                    interest: data.interest,
                    niche: data.niche,
                    budget: data.budget,
                    budget_tier: data.budget_tier,
                    age: data.age,
                    age_bracket: data.age_bracket,
                    gender: data.gender,
                    occupation: data.occupation,
                    experience_level: data.experience_level,
                    product_category: data.product_category,
                    request_type: data.request_type,
                    target_price: data.target_price,
                    status: data.status,
                    wants_call: data.wants_call,
                    ready_to_pay: data.ready_to_pay,
                    compliance_risk: data.compliance_risk,
                    ai_context: data.ai_context,
                    bot_score: data.bot_score,
                    updated_at: new Date(),
                },
                create: {
                    manychat_id: manychatId,
                    name: data.name,
                    location: data.location,
                    phone: data.phone,
                    instagram_handle: data.instagram_handle,
                    is_important: data.is_important,
                    path: data.path,
                    interest: data.interest,
                    niche: data.niche,
                    budget: data.budget,
                    budget_tier: data.budget_tier,
                    age: data.age,
                    age_bracket: data.age_bracket,
                    gender: data.gender,
                    occupation: data.occupation,
                    experience_level: data.experience_level,
                    product_category: data.product_category,
                    request_type: data.request_type,
                    target_price: data.target_price,
                    status: data.status,
                    wants_call: data.wants_call,
                    ready_to_pay: data.ready_to_pay,
                    compliance_risk: data.compliance_risk,
                    ai_context: data.ai_context,
                    bot_score: data.bot_score,
                },
            });

            logger.info(`Upserted lead ${manychatId} with extracted data`);

        } catch (error) {
            logger.error(`Failed to save extracted data for ${manychatId}:`, error);
            throw error;
        }
    }

    /**
     * Format conversation for prompt
     */
    private formatConversation(messages: Message[]): string {
        return messages
            .map(m => `${m.role.toUpperCase()}: ${m.content}`)
            .join('\n\n');
    }

    /**
     * Validate and clean extracted data
     */
    private validateAndClean(data: ExtractedData): ExtractedData {
        const phone = this.cleanPhone(data.phone);

        return {
            name: data.name || null,
            location: data.location || null,
            phone: phone,
            instagram_handle: this.cleanInstagram(data.instagram_handle),
            is_important: phone !== null, // Important if phone was collected
            path: this.validatePath(data.path),
            interest: data.interest || null,
            niche: data.niche || null,
            budget: this.validateBudget(data.budget),
            budget_tier: data.budget_tier || null,
            age: typeof data.age === 'number' ? data.age : null,
            age_bracket: data.age_bracket || null,
            gender: data.gender || null,
            occupation: data.occupation || null,
            experience_level: data.experience_level || null,
            product_category: data.product_category || null,
            request_type: data.request_type || null,
            target_price: typeof data.target_price === 'number' ? data.target_price : null,
            status: data.status || 'New',
            wants_call: Boolean(data.wants_call),
            ready_to_pay: Boolean(data.ready_to_pay),
            compliance_risk: Boolean(data.compliance_risk),
            ai_context: data.ai_context || 'No summary available',
            bot_score: Math.min(100, Math.max(0, data.bot_score || 0)),
        };
    }

    /**
     * Clean phone number
     */
    private cleanPhone(phone: string | null): string | null {
        if (!phone) return null;
        // Remove non-digits except +
        const cleaned = phone.replace(/[^\d+]/g, '');
        // Ensure starts with +
        if (cleaned && !cleaned.startsWith('+')) {
            return '+91' + cleaned;
        }
        return cleaned || null;
    }

    /**
     * Clean Instagram handle
     */
    private cleanInstagram(handle: string | null | undefined): string | null {
        if (!handle) return null;
        // Remove @ if present and clean
        let cleaned = handle.trim().replace(/^@/, '');
        // Remove URLs
        cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '');
        return cleaned || null;
    }

    /**
     * Validate path
     */
    private validatePath(path: string): string {
        const validPaths = ['Path A', 'Path B', 'Path C', 'Path D', 'Path E'];
        if (validPaths.includes(path)) return path;

        // Try to fix common variations
        const letter = path?.match(/[A-E]/i)?.[0]?.toUpperCase();
        return letter ? `Path ${letter}` : 'Path E';
    }

    /**
     * Validate budget
     */
    private validateBudget(budget: number | null): number | null {
        if (typeof budget !== 'number') return null;
        // Convert lakh notation if needed (e.g., 8 -> 800000)
        if (budget < 1000 && budget > 0) {
            return budget * 100000; // Assume it's in lakhs
        }
        return budget;
    }
}

export const extractorService = new ExtractorService();
export default extractorService;

/**
 * Webhook Controller
 * Handles ManyChat webhooks for the chatbot
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { sessionService, responderService, leadService } from '../services';
import { logger } from '../utils';
import { OFFICIAL_CONTACT } from '../config';

// ManyChat webhook payload schema - flexible to handle various payload formats
const ManyChatPayloadSchema = z.object({
    // Accept both field names
    subscriber_id: z.string().optional(),
    manychat_id: z.string().optional(),
    message: z.string().optional().default(''),
    user_message: z.string().optional(),
    message_id: z.string().optional(),
    user_name: z.string().optional(),
    contact_info: z.object({
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        phone: z.string().optional(),
    }).optional(),
    trigger: z.string().optional(),
}).refine(data => data.subscriber_id || data.manychat_id, {
    message: "Either subscriber_id or manychat_id is required"
});

export type ManyChatPayload = z.infer<typeof ManyChatPayloadSchema>;

/**
 * Main webhook handler for ManyChat
 */
export async function handleManyChatWebhook(req: Request, res: Response) {
    const startTime = Date.now();

    try {
        // Parse and validate payload
        const payload = ManyChatPayloadSchema.parse(req.body);

        // Handle both field name variants
        const userId = payload.subscriber_id || payload.manychat_id!;
        const userMessage = payload.user_message || payload.message || '';
        const { message_id, contact_info, user_name } = payload;

        logger.info(`Webhook received from ${userId}: "${userMessage.slice(0, 50)}..."`);

        // Check for duplicate
        if (message_id && await sessionService.isDuplicate(message_id)) {
            logger.info(`Duplicate message ${message_id}, skipping`);
            return res.status(200).json({ status: 'duplicate' });
        }

        // Handle empty message
        if (!userMessage.trim()) {
            return res.status(200).json({
                response: {
                    reply: "Assalamu Alaikum! I'm here to help. What would you like to know about China Sourcing, Amazon FBA, or Halal Trading?",
                    quick_replies: ['Sourcing Help', 'Amazon FBA', 'Trading Mentorship', 'Hudood App'],
                },
            });
        }

        // Get or create session
        const session = await sessionService.getSession(userId);

        // Update lead with contact info if available
        if (contact_info?.first_name || contact_info?.phone) {
            try {
                await leadService.updateLead(session.leadId, {
                    name: contact_info.first_name || undefined,
                    phone: contact_info.phone || undefined,
                });
            } catch (e) {
                // Ignore update errors
            }
        }

        // Generate response
        const result = await responderService.generateResponse(userMessage, session);

        // Update session with new messages
        await sessionService.updateSession(
            userId,
            userMessage,
            result.reply,
            result.detectedPath
        );

        // Update lead intents if detected
        if (result.intents.readyToPay || result.intents.wantsCall || result.intents.complianceRisk) {
            try {
                await leadService.updateLead(session.leadId, {
                    ready_to_pay: result.intents.readyToPay,
                    wants_call: result.intents.wantsCall,
                });
            } catch (e) {
                // Ignore update errors
            }
        }

        // Log Hudood query if Path D
        if (result.detectedPath === 'D' && userMessage.toLowerCase().includes('halal')) {
            try {
                await leadService.logHudoodQuery(session.leadId, userMessage, 'Stock Screening');
            } catch (e) {
                // Ignore
            }
        }

        const latency = Date.now() - startTime;
        logger.info(`Response generated in ${latency}ms for ${userId}`);

        // Build quick replies based on path
        const quickReplies = getQuickReplies(result.detectedPath);

        return res.status(200).json({
            response: {
                reply: result.reply,
                quick_replies: quickReplies,
                metadata: {
                    session_id: session.leadId,
                    path: result.detectedPath,
                    latency_ms: latency,
                },
            },
        });

    } catch (error) {
        logger.error('Webhook error:', error);

        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid payload', details: error.errors });
        }

        return res.status(200).json({
            response: {
                reply: `I apologize for the inconvenience. Please reach out to our team at ${OFFICIAL_CONTACT} for immediate assistance.`,
                quick_replies: ['Contact Support'],
            },
        });
    }
}

/**
 * Get quick replies based on path
 */
function getQuickReplies(path: string | null): string[] {
    switch (path) {
        case 'A':
            return ['Check Broadcast Channel', 'Custom Sourcing', 'Pricing Info', 'Talk to Team'];
        case 'B':
            return ['Watch Video', 'Course Details', 'Check My Budget', 'Ready to Enroll'];
        case 'C':
            return ['Watch Roadmap', 'Course Details', 'Buy the Book', 'Start Learning'];
        case 'D':
            return ['Open Hudood App', 'Learn Trading', 'Check Another Stock'];
        default:
            return ['Sourcing Help', 'Amazon FBA', 'Trading Mentorship', 'Hudood App'];
    }
}

/**
 * Health check endpoint
 */
export function healthCheck(req: Request, res: Response) {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
    });
}

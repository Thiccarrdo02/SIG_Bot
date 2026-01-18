/**
 * Session Service
 * Manages conversation state in Redis/Memory
 * Works in pure memory mode for local testing
 */

import { cache, logger } from '../utils';
import { config } from '../config';

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
}

export interface SessionData {
    leadId: string;
    manychatId: string;
    currentPath: string | null;
    messages: Message[];
    lastActivity: Date;
    isProcessed: boolean;
}

const SESSION_PREFIX = 'session:';
const DEDUP_PREFIX = 'dedup:';

// Check if database is configured
function isDatabaseConfigured(): boolean {
    return !!(process.env.DATABASE_URL &&
        process.env.DATABASE_URL.length > 10 &&
        !process.env.DATABASE_URL.includes('your_project'));
}

export class SessionService {

    /**
     * Get or create a session for a user
     */
    async getSession(manychatId: string): Promise<SessionData> {
        const cacheKey = `${SESSION_PREFIX}${manychatId}`;

        try {
            // Try cache first
            const cached = await cache.get(cacheKey);
            if (cached) {
                const session = JSON.parse(cached);
                return {
                    ...session,
                    lastActivity: new Date(session.lastActivity),
                };
            }

            // If database is configured, try it
            if (isDatabaseConfigured()) {
                try {
                    const { prisma } = await import('./db');
                    const lead = await prisma.lead.findUnique({
                        where: { manychat_id: manychatId },
                        include: {
                            sessions: {
                                orderBy: { updated_at: 'desc' },
                                take: 1,
                            },
                        },
                    });

                    if (lead && lead.sessions.length > 0) {
                        const dbSession = lead.sessions[0];
                        const sessionData: SessionData = {
                            leadId: lead.id,
                            manychatId: manychatId,
                            currentPath: dbSession.current_path,
                            messages: (dbSession.messages as unknown as Message[]) || [],
                            lastActivity: dbSession.last_activity,
                            isProcessed: dbSession.is_processed,
                        };

                        await this.cacheSession(sessionData);
                        return sessionData;
                    }

                    // Create new lead and session
                    const newLead = await prisma.lead.create({
                        data: {
                            manychat_id: manychatId,
                            sessions: {
                                create: {
                                    messages: [],
                                    current_path: null,
                                },
                            },
                        },
                        include: { sessions: true },
                    });

                    const sessionData: SessionData = {
                        leadId: newLead.id,
                        manychatId: manychatId,
                        currentPath: null,
                        messages: [],
                        lastActivity: new Date(),
                        isProcessed: false,
                    };

                    await this.cacheSession(sessionData);
                    return sessionData;
                } catch (dbError) {
                    logger.warn('Database unavailable, using memory-only mode');
                }
            }

            // Create memory-only session
            const sessionData: SessionData = {
                leadId: 'local-' + manychatId,
                manychatId: manychatId,
                currentPath: null,
                messages: [],
                lastActivity: new Date(),
                isProcessed: false,
            };

            await this.cacheSession(sessionData);
            return sessionData;

        } catch (error) {
            logger.error('Error getting session:', error);
            return {
                leadId: 'temp-' + manychatId,
                manychatId: manychatId,
                currentPath: null,
                messages: [],
                lastActivity: new Date(),
                isProcessed: false,
            };
        }
    }

    /**
     * Add messages to session and update path
     */
    async updateSession(
        manychatId: string,
        userMessage: string,
        botResponse: string,
        detectedPath: string | null
    ): Promise<void> {
        try {
            const session = await this.getSession(manychatId);

            // Add new messages
            const newMessages: Message[] = [
                ...session.messages,
                { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
                { role: 'assistant', content: botResponse, timestamp: new Date().toISOString() },
            ];

            // Keep only last N messages
            const trimmedMessages = newMessages.slice(-config.session.historyLimit);

            const updatedSession: SessionData = {
                ...session,
                currentPath: detectedPath || session.currentPath,
                messages: trimmedMessages,
                lastActivity: new Date(),
                isProcessed: false,
            };

            // Update cache
            await this.cacheSession(updatedSession);

            // Optionally sync to database (non-blocking)
            if (isDatabaseConfigured() && !session.leadId.startsWith('local-') && !session.leadId.startsWith('temp-')) {
                this.syncToDatabase(session.leadId, updatedSession).catch(() => { });
            }

        } catch (error) {
            logger.error('Error updating session:', error);
        }
    }

    /**
     * Cache session
     */
    private async cacheSession(session: SessionData): Promise<void> {
        const cacheKey = `${SESSION_PREFIX}${session.manychatId}`;
        await cache.set(
            cacheKey,
            JSON.stringify(session),
            config.session.ttlSeconds
        );
    }

    /**
     * Sync session to database (optional, non-blocking)
     */
    private async syncToDatabase(leadId: string, session: SessionData): Promise<void> {
        if (!isDatabaseConfigured()) return;

        try {
            const { prisma } = await import('./db');

            const existingSession = await prisma.session.findFirst({
                where: { lead_id: leadId },
                orderBy: { updated_at: 'desc' },
            });

            const messagesJson = JSON.parse(JSON.stringify(session.messages));

            if (existingSession) {
                await prisma.session.update({
                    where: { id: existingSession.id },
                    data: {
                        messages: messagesJson,
                        current_path: session.currentPath,
                        last_activity: session.lastActivity,
                        is_processed: false,
                    },
                });
            } else {
                await prisma.session.create({
                    data: {
                        lead_id: leadId,
                        messages: messagesJson,
                        current_path: session.currentPath,
                        last_activity: session.lastActivity,
                    },
                });
            }
        } catch (error) {
            // Silent fail - database sync is optional
        }
    }

    /**
     * Check for duplicate message (using message_id OR content hash)
     * This prevents the same response from being sent twice
     */
    async isDuplicate(messageId: string, userId?: string, content?: string): Promise<boolean> {
        // Check by message_id if provided
        if (messageId) {
            const key = `${DEDUP_PREFIX}${messageId}`;
            const exists = await cache.exists(key);
            if (exists) return true;
            await cache.set(key, '1', 300);
        }

        // Also check by content hash (fallback for when message_id is missing)
        if (userId && content) {
            const contentKey = `${DEDUP_PREFIX}content:${userId}:${this.hashContent(content)}`;
            const exists = await cache.exists(contentKey);
            if (exists) return true;
            await cache.set(contentKey, '1', 60); // 60 second window for content-based dedup
        }

        return false;
    }

    /**
     * Simple hash for content-based deduplication
     */
    private hashContent(content: string): string {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Get conversation history for LLM context
     */
    getHistoryForPrompt(session: SessionData, limit: number = 5): string {
        const recentMessages = session.messages.slice(-limit);
        return recentMessages
            .map(m => `${m.role.toUpperCase()}: ${m.content}`)
            .join('\n');
    }

    /**
     * Get inactive sessions for extraction
     */
    async getInactiveSessions(): Promise<SessionData[]> {
        try {
            const keys = await cache.scan(`${SESSION_PREFIX}*`);
            const inactiveSessions: SessionData[] = [];
            const cutoffTime = Date.now() - (config.session.inactivityMinutes * 60 * 1000);

            for (const key of keys) {
                const data = await cache.get(key);
                if (data) {
                    const session = JSON.parse(data) as SessionData;
                    const lastActivity = new Date(session.lastActivity).getTime();

                    if (lastActivity < cutoffTime && !session.isProcessed) {
                        inactiveSessions.push(session);
                    }
                }
            }

            return inactiveSessions;
        } catch (error) {
            logger.error('Error getting inactive sessions:', error);
            return [];
        }
    }

    /**
     * Mark session as processed
     */
    async markAsProcessed(manychatId: string): Promise<void> {
        const session = await this.getSession(manychatId);
        session.isProcessed = true;
        await this.cacheSession(session);
    }
}

export const sessionService = new SessionService();
export default sessionService;

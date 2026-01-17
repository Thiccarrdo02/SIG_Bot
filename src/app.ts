/**
 * SIG Chatbot - Main Application
 * Dual Agent Architecture with Gemini 2.5 Flash + GPT-4o-mini
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import { config, validateConfig } from './config';
import { apiRoutes } from './routes';
import { logger } from './utils';
import { sessionService, extractorService } from './services';

// Validate environment
try {
    validateConfig();
} catch (error) {
    logger.warn('Config validation warning:', error);
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
}));

// Serve static files (frontend)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// API routes
app.use('/api', apiRoutes);

// Serve frontend for non-API routes
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        const indexPath = path.join(publicPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(200).send(`
                <html>
                <head><title>SIG Chatbot API</title></head>
                <body style="font-family: sans-serif; padding: 20px;">
                    <h1>🤖 SIG Chatbot API</h1>
                    <p>API is running. Frontend not found.</p>
                    <ul>
                        <li><a href="/api/health">Health Check</a></li>
                        <li><a href="/api/stats">Dashboard Stats</a></li>
                    </ul>
                </body>
                </html>
            `);
        }
    }
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Session extraction cron job - runs every 5 minutes
async function processInactiveSessions() {
    try {
        const inactiveSessions = await sessionService.getInactiveSessions();
        if (inactiveSessions.length === 0) return;

        logger.info(`[CRON] Processing ${inactiveSessions.length} inactive sessions...`);

        for (const session of inactiveSessions) {
            try {
                const extractedData = await extractorService.extractData(session);

                if (extractedData) {
                    await extractorService.saveToDatabase(session.manychatId, extractedData);
                    logger.info(`[CRON] Extracted data for ${session.manychatId}: ${extractedData.name || 'Unknown'}`);
                }

                await sessionService.markAsProcessed(session.manychatId);
            } catch (error) {
                logger.error(`[CRON] Error processing session ${session.manychatId}:`, error);
            }
        }

        logger.info('[CRON] Session processing complete');
    } catch (error) {
        logger.error('[CRON] Session processing failed:', error);
    }
}

// Start server
const PORT = config.port;
app.listen(PORT, () => {
    logger.info(`🚀 SIG Chatbot server running on port ${PORT}`);
    logger.info(`📊 Dashboard: http://localhost:${PORT}`);
    logger.info(`🔗 Webhook: http://localhost:${PORT}/api/webhook/manychat`);
    logger.info(`💚 Health: http://localhost:${PORT}/api/health`);

    // Start cron job for session extraction (every 5 minutes)
    cron.schedule('*/5 * * * *', () => {
        processInactiveSessions().catch(err => logger.error('Cron error:', err));
    });
    logger.info('⏰ Extraction cron job scheduled (every 5 minutes)');

    // Run once on startup after 30 seconds
    setTimeout(() => {
        processInactiveSessions().catch(err => logger.error('Initial extraction error:', err));
    }, 30000);
});

export default app;

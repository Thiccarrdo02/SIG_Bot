/**
 * Session Processor
 * Background job to extract data from inactive sessions
 * Run with: npm run process:sessions
 * Or set up as cron job every 5 minutes
 */

import dotenv from 'dotenv';
dotenv.config();

import { sessionService, extractorService } from '../src/services';
import { logger } from '../src/utils';

async function processInactiveSessions() {
    logger.info('Starting session processing...');

    try {
        const inactiveSessions = await sessionService.getInactiveSessions();
        logger.info(`Found ${inactiveSessions.length} inactive sessions to process`);

        for (const session of inactiveSessions) {
            try {
                logger.info(`Processing session for ${session.manychatId}...`);

                // Extract data
                const extractedData = await extractorService.extractData(session);

                if (extractedData) {
                    // Save to database
                    await extractorService.saveToDatabase(session.manychatId, extractedData);
                    logger.info(`Extracted and saved data for ${session.manychatId}`);
                }

                // Mark as processed
                await sessionService.markAsProcessed(session.manychatId);

            } catch (error) {
                logger.error(`Error processing session ${session.manychatId}:`, error);
            }
        }

        logger.info('Session processing complete');
    } catch (error) {
        logger.error('Session processing failed:', error);
    }
}

// Run immediately if called directly
if (require.main === module) {
    processInactiveSessions()
        .then(() => process.exit(0))
        .catch((error) => {
            logger.error('Fatal error:', error);
            process.exit(1);
        });
}

export { processInactiveSessions };

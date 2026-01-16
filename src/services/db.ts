import { PrismaClient } from '@prisma/client';
import { logger } from '../utils';

const prisma = new PrismaClient({
    log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
    ],
});

// Log slow queries in development
if (process.env.NODE_ENV !== 'production') {
    prisma.$on('query', (e) => {
        if (e.duration > 100) {
            logger.warn(`Slow query (${e.duration}ms):`, e.query);
        }
    });
}

prisma.$on('error', (e) => {
    logger.error('Prisma error:', e);
});

export { prisma };
export default prisma;

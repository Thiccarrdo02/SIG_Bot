/**
 * API Routes
 * All endpoints for the SIG Chatbot
 */

import { Router } from 'express';
import {
    handleManyChatWebhook,
    healthCheck,
    getLeads,
    getLeadById,
    createLead,
    updateLead,
    getStats,
    getDemographics,
    exportLeadsCSV,
    getHudoodQueries,
    calcLandedCost,
    calcFbaProfit,
    createSourcingInquiry,
    resetLeads,
    deleteLead,
} from '../controllers';

const router = Router();

// Health check
router.get('/health', healthCheck);

// Webhook (main chatbot endpoint)
router.post('/webhook/manychat', handleManyChatWebhook);

// Leads CRUD
router.get('/leads', getLeads);
router.get('/leads/:id', getLeadById);
router.post('/leads', createLead);
router.patch('/leads/:id', updateLead);

// Dashboard data
router.get('/stats', getStats);
router.get('/demographics', getDemographics);

// Export
router.get('/export/leads.csv', exportLeadsCSV);

// Hudood
router.get('/hudood/queries', getHudoodQueries);

// Calculators
router.post('/calc/landed-cost', calcLandedCost);
router.post('/calc/fba-profit', calcFbaProfit);

// Sourcing inquiries
// Sourcing inquiries
router.post('/inquiries/sourcing', createSourcingInquiry);

// Data Reset and Delete
router.delete('/leads/reset', resetLeads);
router.delete('/leads/:id', deleteLead);

export default router;

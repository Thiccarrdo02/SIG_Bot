/**
 * Leads Controller
 * API endpoints for dashboard
 */

import { Request, Response } from 'express';
import { leadService } from '../services';
import { logger } from '../utils';

/**
 * GET /api/leads
 * List leads with filters
 */
export async function getLeads(req: Request, res: Response) {
    try {
        const { path, status, budget_tier, page, limit } = req.query;

        const result = await leadService.getLeads({
            path: path as string,
            status: status as string,
            budgetTier: budget_tier as string,
            page: page ? parseInt(page as string) : 1,
            limit: limit ? parseInt(limit as string) : 20,
        });

        res.json(result);
    } catch (error) {
        logger.error('Error getting leads:', error);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
}

/**
 * GET /api/leads/:id
 * Get single lead
 */
export async function getLeadById(req: Request, res: Response) {
    try {
        const lead = await leadService.getLeadById(req.params.id as string);

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.json(lead);
    } catch (error) {
        logger.error('Error getting lead:', error);
        res.status(500).json({ error: 'Failed to fetch lead' });
    }
}

/**
 * POST /api/leads
 * Create a new lead manually
 */
export async function createLead(req: Request, res: Response) {
    try {
        const { name, location, phone, budget, path, niche } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const lead = await leadService.createLead({
            name,
            location,
            phone,
            budget: budget ? parseInt(budget) : undefined,
            path,
            niche,
        });

        res.status(201).json(lead);
    } catch (error) {
        logger.error('Error creating lead:', error);
        res.status(500).json({ error: 'Failed to create lead' });
    }
}

/**
 * PATCH /api/leads/:id
 * Update lead status or data
 */
export async function updateLead(req: Request, res: Response) {
    try {
        const { status, name, location, phone, budget, path, niche } = req.body;

        const lead = await leadService.updateLead(req.params.id as string, {
            status,
            name,
            location,
            phone,
            budget: budget ? parseInt(budget) : undefined,
            path,
            niche,
        });

        res.json(lead);
    } catch (error) {
        logger.error('Error updating lead:', error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
}

/**
 * GET /api/stats
 * Dashboard statistics
 */
export async function getStats(req: Request, res: Response) {
    try {
        const stats = await leadService.getDashboardStats();
        res.json(stats);
    } catch (error) {
        logger.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
}

/**
 * GET /api/demographics
 * Demographics data
 */
export async function getDemographics(req: Request, res: Response) {
    try {
        const demographics = await leadService.getDemographics();
        res.json(demographics);
    } catch (error) {
        logger.error('Error getting demographics:', error);
        res.status(500).json({ error: 'Failed to fetch demographics' });
    }
}

/**
 * GET /api/export/leads.csv
 * Export leads as CSV
 */
export async function exportLeadsCSV(req: Request, res: Response) {
    try {
        const csv = await leadService.exportLeadsCSV();

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=sig_leads_export.csv');
        res.send(csv);
    } catch (error) {
        logger.error('Error exporting leads:', error);
        res.status(500).json({ error: 'Failed to export leads' });
    }
}

/**
 * GET /api/hudood/queries
 * Hudood query logs
 */
export async function getHudoodQueries(req: Request, res: Response) {
    try {
        const queries = await leadService.getHudoodQueries();
        res.json(queries);
    } catch (error) {
        logger.error('Error getting Hudood queries:', error);
        res.status(500).json({ error: 'Failed to fetch queries' });
    }
}

/**
 * POST /api/calc/landed-cost
 * Calculate landed cost for sourcing
 */
export async function calcLandedCost(req: Request, res: Response) {
    try {
        const { product_cost, shipping, customs_percent = 10, gst_percent = 18 } = req.body;

        if (!product_cost || !shipping) {
            return res.status(400).json({ error: 'product_cost and shipping are required' });
        }

        const subtotal = product_cost + shipping;
        const customs = subtotal * (customs_percent / 100);
        const gst = (subtotal + customs) * (gst_percent / 100);
        const totalLandedCost = subtotal + customs + gst;

        res.json({
            product_cost,
            shipping,
            customs,
            gst,
            total_landed_cost: Math.round(totalLandedCost),
            breakdown: {
                customs_percent,
                gst_percent,
            },
        });
    } catch (error) {
        logger.error('Error calculating landed cost:', error);
        res.status(500).json({ error: 'Failed to calculate' });
    }
}

/**
 * POST /api/calc/fba-profit
 * Calculate FBA profit margin
 */
export async function calcFbaProfit(req: Request, res: Response) {
    try {
        const { selling_price, landed_cost, fba_fees = 5, ppc_per_unit = 3 } = req.body;

        if (!selling_price || !landed_cost) {
            return res.status(400).json({ error: 'selling_price and landed_cost are required' });
        }

        const totalCost = landed_cost + fba_fees + ppc_per_unit;
        const profit = selling_price - totalCost;
        const marginPercent = (profit / selling_price) * 100;

        res.json({
            selling_price,
            landed_cost,
            fba_fees,
            ppc_per_unit,
            total_cost: totalCost,
            profit_per_unit: Math.round(profit * 100) / 100,
            margin_percent: Math.round(marginPercent * 100) / 100,
        });
    } catch (error) {
        logger.error('Error calculating FBA profit:', error);
        res.status(500).json({ error: 'Failed to calculate' });
    }
}

/**
 * POST /api/inquiries/sourcing
 * Log a sourcing inquiry
 */
export async function createSourcingInquiry(req: Request, res: Response) {
    try {
        const { client_name, product_category, request_type, compliance_confirmed, target_price } = req.body;

        if (!client_name || !product_category) {
            return res.status(400).json({ error: 'client_name and product_category are required' });
        }

        // For now, just return success - can be expanded to save to DB
        res.status(201).json({
            success: true,
            inquiry: {
                client_name,
                product_category,
                request_type: request_type || 'Custom Search',
                compliance_confirmed: Boolean(compliance_confirmed),
                target_price,
                status: 'Inquiry',
                created_at: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error('Error creating sourcing inquiry:', error);
        res.status(500).json({ error: 'Failed to create inquiry' });
    }
}

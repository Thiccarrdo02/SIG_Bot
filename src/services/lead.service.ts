/**
 * Lead Service
 * CRUD operations for leads and dashboard data
 */

import { prisma } from './db';
import { logger } from '../utils';

export interface LeadFilters {
    path?: string;
    status?: string;
    budgetTier?: string;
    page?: number;
    limit?: number;
}

export interface DashboardStats {
    totalLeads: number;
    activeBookLeads: number;
    activeSourcingLeads: number;
    activeFbaLeads: number;
    activeTradingLeads: number;
    vipCount: number;
    pendingPayment: number;
    enrolledStudents: number;
}

export interface DemographicsData {
    age: { bracket: string; count: number; percentage: number }[];
    gender: { type: string; count: number; percentage: number }[];
    occupation: { type: string; count: number; percentage: number }[];
    locations: { location: string; count: number }[];
}

export class LeadService {

    /**
     * Get leads with filters and pagination
     */
    async getLeads(filters: LeadFilters = {}) {
        const { path, status, budgetTier, page = 1, limit = 20 } = filters;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (path) where.path = path;
        if (status) where.status = status;
        if (budgetTier) where.budget_tier = budgetTier;

        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                orderBy: { updated_at: 'desc' },
                skip,
                take: limit,
            }),
            prisma.lead.count({ where }),
        ]);

        return {
            leads,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get single lead by ID
     */
    async getLeadById(id: string) {
        return prisma.lead.findUnique({
            where: { id },
            include: {
                sessions: {
                    orderBy: { updated_at: 'desc' },
                    take: 1,
                },
                hudood_queries: {
                    orderBy: { created_at: 'desc' },
                    take: 5,
                },
            },
        });
    }

    /**
     * Get lead by ManyChat ID
     */
    async getLeadByManychatId(manychatId: string) {
        return prisma.lead.findUnique({
            where: { manychat_id: manychatId },
        });
    }

    /**
     * Create a new lead manually
     */
    async createLead(data: {
        name: string;
        location?: string;
        phone?: string;
        budget?: number;
        path?: string;
        niche?: string;
    }) {
        const manychatId = `manual-${Date.now()}`;

        return prisma.lead.create({
            data: {
                manychat_id: manychatId,
                name: data.name,
                location: data.location,
                phone: data.phone,
                budget: data.budget,
                path: data.path,
                niche: data.niche,
                budget_tier: data.budget ? this.getBudgetTier(data.budget) : null,
            },
        });
    }

    /**
     * Update lead status
     */
    async updateLeadStatus(id: string, status: string) {
        return prisma.lead.update({
            where: { id },
            data: {
                status,
                updated_at: new Date(),
            },
        });
    }

    /**
     * Update lead data
     */
    async updateLead(id: string, data: Partial<{
        name: string;
        location: string;
        phone: string;
        budget: number;
        path: string;
        niche: string;
        status: string;
        wants_call: boolean;
        ready_to_pay: boolean;
    }>) {
        if (data.budget) {
            (data as any).budget_tier = this.getBudgetTier(data.budget);
        }

        return prisma.lead.update({
            where: { id },
            data: {
                ...data,
                updated_at: new Date(),
            },
        });
    }

    /**
     * Get dashboard statistics
     */
    async getDashboardStats(): Promise<DashboardStats> {
        const [
            totalLeads,
            pathCounts,
            vipCount,
            pendingPayment,
            enrolledStudents,
        ] = await Promise.all([
            prisma.lead.count(),
            prisma.lead.groupBy({
                by: ['path'],
                _count: { id: true },
            }),
            prisma.lead.count({ where: { budget_tier: 'VIP' } }),
            prisma.lead.count({ where: { status: 'Pending Fee' } }),
            prisma.lead.count({ where: { status: 'Enrolled' } }),
        ]);

        const pathMap = Object.fromEntries(
            pathCounts.map(p => [p.path, p._count.id])
        );

        return {
            totalLeads,
            activeBookLeads: pathMap['Path C'] || 0, // Trading/Book leads
            activeSourcingLeads: pathMap['Path A'] || 0,
            activeFbaLeads: pathMap['Path B'] || 0,
            activeTradingLeads: pathMap['Path C'] || 0,
            vipCount,
            pendingPayment,
            enrolledStudents,
        };
    }

    /**
     * Get demographics data
     */
    async getDemographics(): Promise<DemographicsData> {
        const leads = await prisma.lead.findMany({
            select: {
                age_bracket: true,
                gender: true,
                occupation: true,
                location: true,
            },
        });

        const total = leads.length || 1;

        // Age distribution
        const ageGroups = this.groupBy(leads, 'age_bracket');
        const age = Object.entries(ageGroups).map(([bracket, items]) => ({
            bracket: bracket || 'Unknown',
            count: items.length,
            percentage: Math.round((items.length / total) * 100),
        }));

        // Gender distribution
        const genderGroups = this.groupBy(leads, 'gender');
        const gender = Object.entries(genderGroups).map(([type, items]) => ({
            type: type || 'Unknown',
            count: items.length,
            percentage: Math.round((items.length / total) * 100),
        }));

        // Occupation distribution
        const occGroups = this.groupBy(leads, 'occupation');
        const occupation = Object.entries(occGroups).map(([type, items]) => ({
            type: type || 'Unknown',
            count: items.length,
            percentage: Math.round((items.length / total) * 100),
        }));

        // Top locations
        const locGroups = this.groupBy(leads.filter(l => l.location), 'location');
        const locations = Object.entries(locGroups)
            .map(([location, items]) => ({ location, count: items.length }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return { age, gender, occupation, locations };
    }

    /**
     * Export leads to CSV format
     */
    async exportLeadsCSV(): Promise<string> {
        const leads = await prisma.lead.findMany({
            orderBy: { created_at: 'desc' },
        });

        const header = 'Name,Location,Niche,Budget,Path,Status,Phone\n';
        const rows = leads.map(l =>
            `"${l.name || ''}","${l.location || ''}","${l.niche || ''}",${l.budget || ''},"${l.path || ''}","${l.status}","${l.phone || ''}"`
        ).join('\n');

        return header + rows;
    }

    /**
     * Get Hudood queries
     */
    async getHudoodQueries(limit: number = 50) {
        return prisma.hudoodQuery.findMany({
            orderBy: { created_at: 'desc' },
            take: limit,
            include: {
                lead: {
                    select: { name: true },
                },
            },
        });
    }

    /**
     * Log a Hudood query
     */
    async logHudoodQuery(leadId: string, query: string, topic: string) {
        return prisma.hudoodQuery.create({
            data: {
                lead_id: leadId,
                query,
                topic,
                status: 'Redirected',
            },
        });
    }

    /**
     * Helper: Get budget tier
     */
    private getBudgetTier(budget: number): string {
        if (budget >= 800000) return 'VIP';
        if (budget >= 100000) return 'Mid';
        return 'Low Cap';
    }

    /**
     * Helper: Group by field
     */
    private groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
        return items.reduce((acc, item) => {
            const groupKey = String(item[key] || 'Unknown');
            if (!acc[groupKey]) acc[groupKey] = [];
            acc[groupKey].push(item);
            return acc;
        }, {} as Record<string, T[]>);
    }
}

export const leadService = new LeadService();
export default leadService;

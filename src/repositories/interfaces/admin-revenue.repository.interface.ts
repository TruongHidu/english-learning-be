import type { AdminRevenueRecentPayment } from "../../types/admin-revenue.types.js";

export interface RevenueSummaryRaw {
    totalRevenue: number;
    currentMonthRevenue: number;
    totalPayments: number;
    successfulPayments: number;
    pendingPayments: number;
    failedPayments: number;
    cancelledPayments: number;
    expiredPayments: number;
}

export interface TopPackageRaw {
    packageCode: string;
    packageName: string;
    successfulPayments: number;
    totalRevenue: number;
    totalDiamonds: number;
}

export interface IAdminRevenueRepository {
    getSummary(monthStartUtc: Date, nextMonthStartUtc: Date): Promise<RevenueSummaryRaw>;
    getTopPackages(limit?: number): Promise<TopPackageRaw[]>;
    getRecentPayments(limit?: number): Promise<AdminRevenueRecentPayment[]>;
}

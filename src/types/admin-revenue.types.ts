export interface AdminRevenueSummary {
    totalRevenue: number;
    currentMonthRevenue: number;

    totalPayments: number;
    successfulPayments: number;
    pendingPayments: number;
    failedPayments: number;
    cancelledPayments: number;
    expiredPayments: number;

    completionRate: number;
}

export interface AdminRevenueRecentPayment {
    id: string;
    transactionCode: string;

    user: {
        id: string;
        displayName: string;
        email: string;
    } | null;

    packageName: string;
    diamondAmount: number;

    amount: number;
    currency: "VND";

    status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED";

    createdAt: string;
    paidAt: string | null;
}

export interface AdminRevenueTopPackage {
    packageCode: string;
    packageName: string;

    successfulPayments: number;
    totalRevenue: number;
    totalDiamonds: number;

    revenueShare: number;
}

export interface AdminRevenueAnalytics {
    summary: AdminRevenueSummary;
    recentPayments: AdminRevenueRecentPayment[];
    topPackages: AdminRevenueTopPackage[];
}

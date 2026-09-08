import type { IAdminRevenueRepository } from "../repositories/interfaces/admin-revenue.repository.interface.js";
import type { AdminRevenueAnalytics } from "../types/admin-revenue.types.js";
import { getVietnamMonthRangeUtc } from "../utils/vietnam-date.js";

export class AdminRevenueService {
    constructor(
        private readonly revenueRepository: IAdminRevenueRepository,
        private readonly nowSupplier: () => Date = () => new Date(),
    ) {}

    async getAnalytics(): Promise<AdminRevenueAnalytics> {
        const now = this.nowSupplier();
        const { monthStartUtc, nextMonthStartUtc } = getVietnamMonthRangeUtc(now);

        const [summaryRaw, topPackagesRaw, recentPayments] = await Promise.all([
            this.revenueRepository.getSummary(monthStartUtc, nextMonthStartUtc),
            this.revenueRepository.getTopPackages(5),
            this.revenueRepository.getRecentPayments(10),
        ]);

        const totalPayments = summaryRaw.totalPayments;
        const completionRate =
            totalPayments === 0
                ? 0
                : Number(((summaryRaw.successfulPayments / totalPayments) * 100).toFixed(1));

        const totalRevenue = summaryRaw.totalRevenue;

        const topPackages = topPackagesRaw.map((pkg) => {
            const revenueShare =
                totalRevenue === 0
                    ? 0
                    : Number(((pkg.totalRevenue / totalRevenue) * 100).toFixed(1));

            return {
                packageCode: pkg.packageCode,
                packageName: pkg.packageName,
                successfulPayments: pkg.successfulPayments,
                totalRevenue: pkg.totalRevenue,
                totalDiamonds: pkg.totalDiamonds,
                revenueShare,
            };
        });

        return {
            summary: {
                totalRevenue: summaryRaw.totalRevenue,
                currentMonthRevenue: summaryRaw.currentMonthRevenue,
                totalPayments: summaryRaw.totalPayments,
                successfulPayments: summaryRaw.successfulPayments,
                pendingPayments: summaryRaw.pendingPayments,
                failedPayments: summaryRaw.failedPayments,
                cancelledPayments: summaryRaw.cancelledPayments,
                expiredPayments: summaryRaw.expiredPayments,
                completionRate,
            },
            recentPayments,
            topPackages,
        };
    }
}

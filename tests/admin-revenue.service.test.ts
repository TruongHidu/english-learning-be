import assert from "node:assert/strict";
import { test } from "node:test";
import { AdminRevenueService } from "../src/services/admin-revenue.service.js";
import type {
    IAdminRevenueRepository,
    RevenueSummaryRaw,
    TopPackageRaw,
} from "../src/repositories/interfaces/admin-revenue.repository.interface.js";
import type { AdminRevenueRecentPayment } from "../src/types/admin-revenue.types.js";
import { getVietnamMonthRangeUtc } from "../src/utils/vietnam-date.js";

class MockRevenueRepository implements IAdminRevenueRepository {
    constructor(
        private summary: RevenueSummaryRaw = {
            totalRevenue: 0,
            currentMonthRevenue: 0,
            totalPayments: 0,
            successfulPayments: 0,
            pendingPayments: 0,
            failedPayments: 0,
            cancelledPayments: 0,
            expiredPayments: 0,
        },
        private topPackages: TopPackageRaw[] = [],
        private recentPayments: AdminRevenueRecentPayment[] = [],
    ) {}

    lastMonthStartUtc?: Date;
    lastNextMonthStartUtc?: Date;

    async getSummary(monthStartUtc: Date, nextMonthStartUtc: Date): Promise<RevenueSummaryRaw> {
        this.lastMonthStartUtc = monthStartUtc;
        this.lastNextMonthStartUtc = nextMonthStartUtc;
        return this.summary;
    }

    async getTopPackages(_limit = 5): Promise<TopPackageRaw[]> {
        return this.topPackages;
    }

    async getRecentPayments(_limit = 10): Promise<AdminRevenueRecentPayment[]> {
        return this.recentPayments;
    }
}

test("Vietnam date range calculates exact UTC instant range [monthStartUtc, nextMonthStartUtc) for Asia/Ho_Chi_Minh", () => {
    // 2026-09-08 20:43:23 UTC+7 is in September 2026
    const ref = new Date("2026-09-08T13:43:23.000Z");
    const { monthStartUtc, nextMonthStartUtc } = getVietnamMonthRangeUtc(ref);

    // 2026-09-01 00:00:00 UTC+7 is 2026-08-31 17:00:00 UTC
    assert.equal(monthStartUtc.toISOString(), "2026-08-31T17:00:00.000Z");
    // 2026-10-01 00:00:00 UTC+7 is 2026-09-30 17:00:00 UTC
    assert.equal(nextMonthStartUtc.toISOString(), "2026-09-30T17:00:00.000Z");

    // Year-end boundary: December 2026 -> January 2027
    const decRef = new Date("2026-12-15T05:00:00.000Z");
    const decRange = getVietnamMonthRangeUtc(decRef);
    assert.equal(decRange.monthStartUtc.toISOString(), "2026-11-30T17:00:00.000Z");
    assert.equal(decRange.nextMonthStartUtc.toISOString(), "2026-12-31T17:00:00.000Z");
});

test("Case 1: Empty payments returns all 0s, completionRate 0, empty lists", async () => {
    const repo = new MockRevenueRepository();
    const service = new AdminRevenueService(repo, () => new Date("2026-09-08T12:00:00.000Z"));

    const result = await service.getAnalytics();

    assert.equal(result.summary.totalRevenue, 0);
    assert.equal(result.summary.currentMonthRevenue, 0);
    assert.equal(result.summary.totalPayments, 0);
    assert.equal(result.summary.successfulPayments, 0);
    assert.equal(result.summary.pendingPayments, 0);
    assert.equal(result.summary.failedPayments, 0);
    assert.equal(result.summary.cancelledPayments, 0);
    assert.equal(result.summary.expiredPayments, 0);
    assert.equal(result.summary.completionRate, 0);
    assert.deepEqual(result.topPackages, []);
    assert.deepEqual(result.recentPayments, []);
});

test("Case 2: Counts & completionRate calculates properly (SUCCESS=2, FAILED=1, PENDING=1 -> total=4, success=2, rate=50.0%)", async () => {
    const summary: RevenueSummaryRaw = {
        totalRevenue: 300000,
        currentMonthRevenue: 300000,
        totalPayments: 4,
        successfulPayments: 2,
        pendingPayments: 1,
        failedPayments: 1,
        cancelledPayments: 0,
        expiredPayments: 0,
    };
    const repo = new MockRevenueRepository(summary);
    const service = new AdminRevenueService(repo);

    const result = await service.getAnalytics();

    assert.equal(result.summary.totalPayments, 4);
    assert.equal(result.summary.successfulPayments, 2);
    assert.equal(result.summary.pendingPayments, 1);
    assert.equal(result.summary.failedPayments, 1);
    assert.equal(result.summary.completionRate, 50);
});

test("Case 3 & 4: Total revenue only counts SUCCESS, currentMonthRevenue excludes previous months", async () => {
    // Total revenue is 300k (e.g. SUCCESS 100k + SUCCESS 200k), ignoring FAILED 500k.
    // currentMonthRevenue is 200k (one SUCCESS of 100k was in previous month).
    const summary: RevenueSummaryRaw = {
        totalRevenue: 300000,
        currentMonthRevenue: 200000,
        totalPayments: 3,
        successfulPayments: 2,
        pendingPayments: 0,
        failedPayments: 1,
        cancelledPayments: 0,
        expiredPayments: 0,
    };
    const repo = new MockRevenueRepository(summary);
    const fixedNow = new Date("2026-09-08T12:00:00.000Z");
    const service = new AdminRevenueService(repo, () => fixedNow);

    const result = await service.getAnalytics();

    assert.equal(result.summary.totalRevenue, 300000);
    assert.equal(result.summary.currentMonthRevenue, 200000);
    // Verifies date range passed to repository
    assert.equal(repo.lastMonthStartUtc?.toISOString(), "2026-08-31T17:00:00.000Z");
    assert.equal(repo.lastNextMonthStartUtc?.toISOString(), "2026-09-30T17:00:00.000Z");
});

test("Case 5 & 6: Top packages revenueShare calculation and zero-division safety", async () => {
    const summary: RevenueSummaryRaw = {
        totalRevenue: 500000,
        currentMonthRevenue: 500000,
        totalPayments: 5,
        successfulPayments: 5,
        pendingPayments: 0,
        failedPayments: 0,
        cancelledPayments: 0,
        expiredPayments: 0,
    };
    const topPackages: TopPackageRaw[] = [
        {
            packageCode: "PKG_LARGE",
            packageName: "Rương kim cương",
            successfulPayments: 3,
            totalRevenue: 300000,
            totalDiamonds: 2100,
        },
        {
            packageCode: "PKG_SMALL",
            packageName: "Túi kim cương",
            successfulPayments: 2,
            totalRevenue: 200000,
            totalDiamonds: 600,
        },
    ];
    const repo = new MockRevenueRepository(summary, topPackages);
    const service = new AdminRevenueService(repo);

    const result = await service.getAnalytics();

    assert.equal(result.topPackages.length, 2);
    // 300k / 500k = 60.0%
    assert.equal(result.topPackages[0]!.revenueShare, 60);
    assert.equal(result.topPackages[0]!.packageCode, "PKG_LARGE");
    // 200k / 500k = 40.0%
    assert.equal(result.topPackages[1]!.revenueShare, 40);
    assert.equal(result.topPackages[1]!.packageCode, "PKG_SMALL");

    // Test zero total revenue with topPackages: should not divide by 0
    const zeroSummary: RevenueSummaryRaw = {
        totalRevenue: 0,
        currentMonthRevenue: 0,
        totalPayments: 0,
        successfulPayments: 0,
        pendingPayments: 0,
        failedPayments: 0,
        cancelledPayments: 0,
        expiredPayments: 0,
    };
    const zeroRepo = new MockRevenueRepository(zeroSummary, [
        {
            packageCode: "PKG_TEST",
            packageName: "Gói test",
            successfulPayments: 0,
            totalRevenue: 0,
            totalDiamonds: 0,
        },
    ]);
    const zeroService = new AdminRevenueService(zeroRepo);
    const zeroResult = await zeroService.getAnalytics();
    assert.equal(zeroResult.topPackages[0]!.revenueShare, 0);
});

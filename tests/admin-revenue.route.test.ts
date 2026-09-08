import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import express from "express";
import { createServer } from "node:net";
import { JwtTokenService } from "../src/security/jwt-token-service.js";
import { createAuthenticate } from "../src/middlewares/authenticate.middleware.js";
import { authorize } from "../src/middlewares/authorize.middleware.js";
import { errorHandler } from "../src/middlewares/error.middleware.js";
import { AdminRevenueController } from "../src/controllers/admin-revenue.controller.js";
import { AdminRevenueService } from "../src/services/admin-revenue.service.js";
import { createAdminRevenueRouter } from "../src/routes/admin-revenue.routes.js";
import type { IAdminRevenueRepository } from "../src/repositories/interfaces/admin-revenue.repository.interface.js";

const fakeRepository: IAdminRevenueRepository = {
    async getSummary() {
        return {
            totalRevenue: 1000000,
            currentMonthRevenue: 500000,
            totalPayments: 10,
            successfulPayments: 8,
            pendingPayments: 1,
            failedPayments: 1,
            cancelledPayments: 0,
            expiredPayments: 0,
        };
    },
    async getTopPackages() {
        return [
            {
                packageCode: "PKG_1",
                packageName: "Gói Kim Cương 1",
                successfulPayments: 5,
                totalRevenue: 500000,
                totalDiamonds: 500,
            },
        ];
    },
    async getRecentPayments() {
        return [
            {
                id: "pay_1",
                transactionCode: "TX123",
                user: { id: "u1", displayName: "Nguyễn Văn A", email: "a@example.com" },
                packageName: "Gói Kim Cương 1",
                diamondAmount: 100,
                amount: 100000,
                currency: "VND",
                status: "SUCCESS",
                createdAt: "2026-09-08T10:00:00.000Z",
                paidAt: "2026-09-08T10:05:00.000Z",
            },
        ];
    },
};

test("Route /api/v1/admin/revenue/analytics enforces authentication and ADMIN authorization", async () => {
    const tokenService = new JwtTokenService("test-secret-32-characters-minimum-for-security!");
    const authenticate = createAuthenticate(tokenService);
    const authorizeAdmin = authorize("ADMIN");

    const service = new AdminRevenueService(fakeRepository);
    const controller = new AdminRevenueController(service);
    const router = createAdminRevenueRouter(controller, authenticate);

    const app = express();
    app.use(express.json());
    app.use("/api/v1/admin/revenue", router);
    app.use(errorHandler);

    const server = app.listen(0);
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/admin/revenue/analytics`;

    try {
        // Case 7: Unauthenticated request -> 401
        const noAuthRes = await fetch(baseUrl);
        assert.equal(noAuthRes.status, 401);
        const noAuthBody = await noAuthRes.json();
        assert.equal(noAuthBody.success, false);
        assert.equal(noAuthBody.code, "UNAUTHORIZED");

        // Case 8: Authenticated as USER -> 403
        const userToken = tokenService.generateAccessToken("user-123", "USER");
        const userRes = await fetch(baseUrl, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        assert.equal(userRes.status, 403);
        const userBody = await userRes.json();
        assert.equal(userBody.success, false);
        assert.equal(userBody.code, "FORBIDDEN");

        // Case 9: Authenticated as ADMIN -> 200
        const adminToken = tokenService.generateAccessToken("admin-456", "ADMIN");
        const adminRes = await fetch(baseUrl, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(adminRes.status, 200);
        const adminBody = await adminRes.json();
        assert.equal(adminBody.success, true);
        assert.equal(adminBody.data.summary.totalRevenue, 1000000);
        assert.equal(adminBody.data.summary.completionRate, 80);
        assert.equal(adminBody.data.topPackages.length, 1);
        assert.equal(adminBody.data.topPackages[0].revenueShare, 50);
        assert.equal(adminBody.data.recentPayments.length, 1);
    } finally {
        await new Promise<void>((resolve, reject) =>
            server.close((err) => (err ? reject(err) : resolve())),
        );
    }
});

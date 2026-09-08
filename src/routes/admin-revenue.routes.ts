import { Router, type RequestHandler } from "express";
import { authorize } from "../middlewares/authorize.middleware.js";
import type { AdminRevenueController } from "../controllers/admin-revenue.controller.js";

export function createAdminRevenueRouter(
    controller: AdminRevenueController,
    authenticate: RequestHandler,
): Router {
    const router = Router();
    router.use(authenticate, authorize("ADMIN"));
    router.get("/analytics", controller.getAnalytics);
    return router;
}

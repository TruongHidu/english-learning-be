import { Router, type RequestHandler } from "express";
import { authorize } from "../middlewares/authorize.middleware.js";
import type { AdminLearningStatsController } from "../controllers/admin-learning-stats.controller.js";

export function createAdminLearningStatsRouter(
    controller: AdminLearningStatsController,
    authenticate: RequestHandler,
): Router {
    const router = Router();
    router.use(authenticate, authorize("ADMIN"));
    router.get("/analytics", controller.getAnalytics);
    return router;
}

import type { NextFunction, Request, Response } from "express";
import type { AdminRevenueService } from "../services/admin-revenue.service.js";

export class AdminRevenueController {
    constructor(private readonly adminRevenueService: AdminRevenueService) {}

    getAnalytics = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = await this.adminRevenueService.getAnalytics();
            res.status(200).json({
                success: true,
                message: "Lấy thống kê doanh thu thành công",
                data,
            });
        } catch (error) {
            next(error);
        }
    };
}

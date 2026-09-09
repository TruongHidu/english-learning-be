import type { NextFunction, Request, Response } from "express";
import type { AdminLearningStatsService } from "../services/admin-learning-stats.service.js";
import { AppError } from "../errors/app-error.js";

function parseLimit(value: unknown, defaultValue: number, paramName: string): number {
    if (value === undefined || value === null || value === "") {
        return defaultValue;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || isNaN(parsed)) {
        throw new AppError(
            "VALIDATION_ERROR",
            `Tham số ${paramName} phải là số nguyên`,
            400,
        );
    }
    if (parsed < 1 || parsed > 50) {
        throw new AppError(
            "VALIDATION_ERROR",
            `Tham số ${paramName} phải nằm trong khoảng từ 1 đến 50`,
            400,
        );
    }
    return parsed;
}

export class AdminLearningStatsController {
    constructor(private readonly learningStatsService: AdminLearningStatsService) {}

    getAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const wrongQuestionLimit = parseLimit(req.query.wrongQuestionLimit, 10, "wrongQuestionLimit");
            const topicLimit = parseLimit(req.query.topicLimit, 5, "topicLimit");
            const learnerLimit = parseLimit(req.query.learnerLimit, 10, "learnerLimit");

            const data = await this.learningStatsService.getAnalytics({
                wrongQuestionLimit,
                topicLimit,
                learnerLimit,
            });

            res.status(200).json({
                success: true,
                message: "Lấy thống kê học tập thành công",
                data,
            });
        } catch (error) {
            next(error);
        }
    };
}

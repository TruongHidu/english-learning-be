import type { Request, Response, NextFunction } from "express";
import type { VocabularyReviewService } from "../services/vocabulary-review.service.js";
import type { ReviewResultInput } from "../services/vocabulary-review.service.js";

export class VocabularyReviewController {
    constructor(private readonly vocabularyReviewService: VocabularyReviewService) {}

    getSession = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id;
            const limit = parseInt(req.query.limit as string) || 20;
            const forceAll = req.query.forceAll === "true" || req.query.forceAll === true;

            const items = await this.vocabularyReviewService.getReviewSession(userId!, { limit, forceAll });
            res.status(200).json({
                success: true,
                message: items.length > 0 ? "Lấy phiên ôn tập thành công" : "Bạn chưa học từ nào, hãy bắt đầu học ngay!",
                data: { items },
            });
        } catch (error) {
            next(error);
        }
    };

    submitResults = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id;
            const results = req.body.results as ReviewResultInput[];

            const data = await this.vocabularyReviewService.submitReviewResults(userId!, results);
            res.status(200).json({
                success: true,
                message: "Đã cập nhật kết quả ôn tập",
                data,
            });
        } catch (error) {
            next(error);
        }
    };

    getStats = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id;
            const data = await this.vocabularyReviewService.getReviewStats(userId!);
            res.status(200).json({
                success: true,
                message: "Lấy thống kê thành công",
                data,
            });
        } catch (error) {
            next(error);
        }
    };
}

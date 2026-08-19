import type { NextFunction, Request, Response } from "express";
import type { LearningService } from "../services/learning.service.js";

export class LearningController {
    constructor(private readonly learningService: LearningService) {}

    startLesson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { lessonId } = (res.locals.validatedParams ?? req.params) as { lessonId: string };
            const result = await this.learningService.startLesson(req.user!.id, lessonId);
            res.status(201).json({
                success: true,
                message: "Bắt đầu bài học thành công",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };
}

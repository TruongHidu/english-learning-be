import type { NextFunction, Request, Response } from "express";
import type { LearningService } from "../services/learning.service.js";
import type { SubmitAnswerRequest } from "../types/learning.types.js";

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

    submitAnswer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { sessionId } = (res.locals.validatedParams ?? req.params) as { sessionId: string };
            const body = req.body as SubmitAnswerRequest;
            const result = await this.learningService.submitAnswer(req.user!.id, sessionId, body);
            res.status(200).json({
                success: true,
                message: "Kiểm tra đáp án thành công",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };
}

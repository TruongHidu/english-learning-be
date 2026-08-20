import type { NextFunction, Request, Response } from "express";
import type { LearningPathService } from "../services/learning-path.service.js";

export class LearningPathController {
    constructor(private readonly learningPathService: LearningPathService) { }

    /**
     * GET /api/v1/courses/:courseId/sections
     * Lấy section PUBLISHED kèm trạng thái khóa theo tiến độ user.
     */
    getSectionsByCourse = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { courseId } = (res.locals.validatedParams ?? req.params) as {
                courseId: string;
            };
            const result = await this.learningPathService.getPublishedSectionsByCourse(
                req.user!.id,
                courseId,
            );
            res.status(200).json({
                success: true,
                message: "Lấy danh sách phần học thành công",
                data: result,
            });
        } catch (error: unknown) {
            next(error);
        }
    };

    /**
     * GET /api/v1/sections/:sectionId/topics
     */
    getTopicsBySection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { sectionId } = (res.locals.validatedParams ?? req.params) as { sectionId: string };
            const result = await this.learningPathService.getPublishedTopicsBySection(
                req.user!.id,
                sectionId,
            );
            res.status(200).json({
                success: true,
                message: "Lấy danh sách chủ đề thành công",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/topics/:topicId/lessons
     * Lấy lộ trình học của topic (Duolingo style) dành cho user.
     */
    getLessonsByTopic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { topicId } = (res.locals.validatedParams ?? req.params) as { topicId: string };
            const result = await this.learningPathService.getTopicLearningPath(
                req.user!.id,
                topicId,
            );
            res.status(200).json({
                success: true,
                message: "Lấy lộ trình bài học thành công",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };
}

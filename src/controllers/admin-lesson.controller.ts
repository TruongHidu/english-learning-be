import type { Request, Response, NextFunction } from "express";
import type { AdminLessonService } from "../services/admin-lesson.service.js";

export class AdminLessonController {
    constructor(private readonly lessonService: AdminLessonService) {}

    getByTopic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { topicId } = (res.locals.validatedParams ?? req.params) as { topicId: string };
            const lessons = await this.lessonService.getLessonsByTopic(topicId);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách màn học thành công",
                data: { lessons },
            });
        } catch (error) {
            next(error);
        }
    };

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { lessonId } = (res.locals.validatedParams ?? req.params) as { lessonId: string };
            const lesson = await this.lessonService.getLessonById(lessonId);
            res.status(200).json({
                success: true,
                message: "Lấy thông tin màn học thành công",
                data: { lesson },
            });
        } catch (error) {
            next(error);
        }
    };

    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { topicId } = (res.locals.validatedParams ?? req.params) as { topicId: string };
            const lesson = await this.lessonService.createLesson(topicId, req.body);
            res.status(201).json({
                success: true,
                message: "Tạo màn học thành công",
                data: { lesson },
            });
        } catch (error) {
            next(error);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { lessonId } = (res.locals.validatedParams ?? req.params) as { lessonId: string };
            const lesson = await this.lessonService.updateLesson(lessonId, req.body);
            res.status(200).json({
                success: true,
                message: "Cập nhật màn học thành công",
                data: { lesson },
            });
        } catch (error) {
            next(error);
        }
    };

    updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { lessonId } = (res.locals.validatedParams ?? req.params) as { lessonId: string };
            const { status } = req.body;
            const lesson = await this.lessonService.updateLessonStatus(lessonId, status);
            res.status(200).json({
                success: true,
                message: "Cập nhật trạng thái màn học thành công",
                data: { lesson },
            });
        } catch (error) {
            next(error);
        }
    };

    remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { lessonId } = (res.locals.validatedParams ?? req.params) as { lessonId: string };
            await this.lessonService.deleteLesson(lessonId);
            res.status(200).json({
                success: true,
                message: "Xóa màn học thành công",
                data: null,
            });
        } catch (error) {
            next(error);
        }
    };

    reorder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { topicId } = (res.locals.validatedParams ?? req.params) as { topicId: string };
            const { lessonIds } = req.body;
            await this.lessonService.reorderLessons(topicId, lessonIds);
            res.status(200).json({
                success: true,
                message: "Sắp xếp màn học thành công",
                data: null,
            });
        } catch (error) {
            next(error);
        }
    };
}

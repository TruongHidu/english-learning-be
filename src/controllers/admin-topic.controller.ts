import type { Request, Response, NextFunction } from "express";
import type { AdminTopicService } from "../services/admin-topic.service.js";

export class AdminTopicController {
    constructor(private readonly topicService: AdminTopicService) {}

    getBySection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { sectionId } = (res.locals.validatedParams ?? req.params) as { sectionId: string };
            const topics = await this.topicService.getTopicsBySection(sectionId);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách chủ đề thành công",
                data: { topics },
            });
        } catch (error) {
            next(error);
        }
    };

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { topicId } = (res.locals.validatedParams ?? req.params) as { topicId: string };
            const topic = await this.topicService.getTopicById(topicId);
            res.status(200).json({
                success: true,
                message: "Lấy thông tin chủ đề thành công",
                data: { topic },
            });
        } catch (error) {
            next(error);
        }
    };

    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { sectionId } = (res.locals.validatedParams ?? req.params) as { sectionId: string };
            const topic = await this.topicService.createTopic(sectionId, req.body);
            res.status(201).json({
                success: true,
                message: "Tạo chủ đề thành công",
                data: { topic },
            });
        } catch (error) {
            next(error);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { topicId } = (res.locals.validatedParams ?? req.params) as { topicId: string };
            const topic = await this.topicService.updateTopic(topicId, req.body);
            res.status(200).json({
                success: true,
                message: "Cập nhật chủ đề thành công",
                data: { topic },
            });
        } catch (error) {
            next(error);
        }
    };

    updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { topicId } = (res.locals.validatedParams ?? req.params) as { topicId: string };
            const { status } = req.body;
            const topic = await this.topicService.updateTopicStatus(topicId, status);
            res.status(200).json({
                success: true,
                message: "Cập nhật trạng thái chủ đề thành công",
                data: { topic },
            });
        } catch (error) {
            next(error);
        }
    };

    remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { topicId } = (res.locals.validatedParams ?? req.params) as { topicId: string };
            await this.topicService.deleteTopic(topicId);
            res.status(200).json({
                success: true,
                message: "Xóa chủ đề thành công",
                data: null,
            });
        } catch (error) {
            next(error);
        }
    };

    reorder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { sectionId } = (res.locals.validatedParams ?? req.params) as { sectionId: string };
            const { topicIds } = req.body;
            await this.topicService.reorderTopics(sectionId, topicIds);
            res.status(200).json({
                success: true,
                message: "Sắp xếp chủ đề thành công",
                data: null,
            });
        } catch (error) {
            next(error);
        }
    };
}

import type { Request, Response, NextFunction } from "express";
import type { AdminVocabularyService } from "../services/admin-vocabulary.service.js";
import type { VocabularyListQuery } from "../types/vocabulary.types.js";

export class AdminVocabularyController {
    constructor(private readonly vocabularyService: AdminVocabularyService) {}

    getByTopic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { topicId } = (res.locals.validatedParams ?? req.params) as { topicId: string };
            const query = (res.locals.validatedQuery ?? req.query) as VocabularyListQuery;
            const result = await this.vocabularyService.getVocabulariesByTopic(topicId, query);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách từ vựng theo chủ đề thành công",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const query = (res.locals.validatedQuery ?? req.query) as VocabularyListQuery;
            const result = await this.vocabularyService.getAllVocabularies(query);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách từ vựng thành công",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { vocabularyId } = (res.locals.validatedParams ?? req.params) as {
                vocabularyId: string;
            };
            const vocabulary = await this.vocabularyService.getVocabularyById(vocabularyId);
            res.status(200).json({
                success: true,
                message: "Lấy thông tin từ vựng thành công",
                data: { vocabulary },
            });
        } catch (error) {
            next(error);
        }
    };

    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { topicId } = (res.locals.validatedParams ?? req.params) as { topicId: string };
            const vocabulary = await this.vocabularyService.createVocabulary(topicId, req.body);
            res.status(201).json({
                success: true,
                message: "Tạo từ vựng thành công",
                data: { vocabulary },
            });
        } catch (error) {
            next(error);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { vocabularyId } = (res.locals.validatedParams ?? req.params) as {
                vocabularyId: string;
            };
            const vocabulary = await this.vocabularyService.updateVocabulary(vocabularyId, req.body);
            res.status(200).json({
                success: true,
                message: "Cập nhật từ vựng thành công",
                data: { vocabulary },
            });
        } catch (error) {
            next(error);
        }
    };

    updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { vocabularyId } = (res.locals.validatedParams ?? req.params) as {
                vocabularyId: string;
            };
            const { status } = req.body;
            const vocabulary = await this.vocabularyService.updateVocabularyStatus(
                vocabularyId,
                status,
            );
            res.status(200).json({
                success: true,
                message: "Cập nhật trạng thái từ vựng thành công",
                data: { vocabulary },
            });
        } catch (error) {
            next(error);
        }
    };

    remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { vocabularyId } = (res.locals.validatedParams ?? req.params) as {
                vocabularyId: string;
            };
            await this.vocabularyService.deleteVocabulary(vocabularyId);
            res.status(200).json({
                success: true,
                message: "Xóa từ vựng thành công",
                data: null,
            });
        } catch (error) {
            next(error);
        }
    };
}

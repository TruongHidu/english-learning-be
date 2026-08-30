import type { Request, Response, NextFunction } from "express";
import type { AiVocabularyService } from "../services/ai-vocabulary.service.js";
import type { AiQuestionService } from "../services/ai-question.service.js";

export class AdminAiController {
    constructor(
        private readonly aiVocabularyService: AiVocabularyService,
        private readonly aiQuestionService: AiQuestionService
    ) {}

    generateVocabularies = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { topicId, lessonId, level, quantity } = req.body;
            const result = await this.aiVocabularyService.generateVocabularies({ topicId, lessonId, level, quantity });
            res.status(201).json({
                success: true,
                message: `AI đã khởi tạo thành công ${result.count} từ vựng dạng DRAFT`,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    generateQuestions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { topicId, lessonId, vocabularyId, vocabularyIds, questionTypes, quantity, difficulty } = req.body;
            const result = await this.aiQuestionService.generateQuestions({
                topicId,
                lessonId,
                vocabularyId,
                vocabularyIds,
                questionTypes,
                quantity,
                difficulty,
            });
            res.status(201).json({
                success: true,
                message: `AI đã khởi tạo thành công ${result.count} câu hỏi dạng DRAFT`,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    bulkPublishVocabularies = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { ids } = req.body;
            const result = await this.aiVocabularyService.bulkPublishVocabularies(ids);
            res.status(200).json({
                success: true,
                message: `Đã phát hành ${result.modifiedCount} từ vựng sang trạng thái PUBLISHED`,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    bulkPublishQuestions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { ids } = req.body;
            const result = await this.aiQuestionService.bulkPublishQuestions(ids);
            res.status(200).json({
                success: true,
                message: `Đã phát hành ${result.modifiedCount} câu hỏi sang trạng thái PUBLISHED`,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    bulkDeleteVocabularies = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { ids } = req.body;
            const result = await this.aiVocabularyService.bulkDeleteVocabularies(ids);
            res.status(200).json({
                success: true,
                message: `Đã xóa thành công ${result.deletedCount} từ vựng`,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    bulkDeleteQuestions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { ids } = req.body;
            const result = await this.aiQuestionService.bulkDeleteQuestions(ids);
            res.status(200).json({
                success: true,
                message: `Đã xóa thành công ${result.deletedCount} câu hỏi`,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };
}

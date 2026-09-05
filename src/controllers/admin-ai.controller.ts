import type { Request, Response, NextFunction } from "express";
import type { AiVocabularyService } from "../services/ai-vocabulary.service.js";
import type { AiQuestionService } from "../services/ai-question.service.js";
import type { AiGenerationService } from "../services/ai-generation.service.js";
import type { AIGenerationListQuery } from "../types/ai-generation.types.js";

export class AdminAiController {
    constructor(
        private readonly aiVocabularyService: AiVocabularyService,
        private readonly aiQuestionService: AiQuestionService,
        private readonly aiGenerationService: AiGenerationService,
    ) {}

    generateVocabularies = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { topicId, lessonId, level, quantity } = req.body;
            const result = await this.aiVocabularyService.generateVocabularies(req.user!.id, { topicId, lessonId, level, quantity });
            res.set("Deprecation", "true");
            res.set(
                "Link",
                `</api/v1/admin/topics/${topicId}/ai/vocabularies/generate>; rel="successor-version"`,
            );
            res.status(200).json({
                success: true,
                message: `AI đã tạo ${result.generatedCount} ứng viên từ vựng để xem trước`,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    generateVocabularyPreview = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { topicId } = (res.locals.validatedParams ?? req.params) as {
                topicId: string;
            };
            const result = await this.aiVocabularyService.generatePreview(
                req.user!.id,
                topicId,
                req.body,
            );
            res.status(200).json({
                success: true,
                message: `AI đã tạo ${result.generatedCount} ứng viên từ vựng để xem trước`,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    commitVocabularies = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { generationId } = (res.locals.validatedParams ?? req.params) as {
                generationId: string;
            };
            const result = await this.aiVocabularyService.commit(
                req.user!.id,
                generationId,
                req.body,
            );
            res.status(result.alreadyCommitted ? 200 : 201).json({
                success: true,
                message: result.alreadyCommitted
                    ? "AI generation đã được commit trước đó"
                    : `Đã lưu ${result.committedCount} từ vựng ở trạng thái DRAFT`,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    generateQuestions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { topicId, lessonId, vocabularyId, vocabularyIds, questionTypes, quantity, difficulty } = req.body;
            const result = await this.aiQuestionService.generateQuestions(req.user!.id, {
                topicId,
                lessonId,
                vocabularyId,
                vocabularyIds,
                questionTypes,
                quantity,
                difficulty,
            });
            res.set("Deprecation", "true");
            res.set(
                "Link",
                `</api/v1/admin/topics/${topicId}/ai/questions/generate>; rel="successor-version"`,
            );
            res.status(200).json({
                success: true,
                message: "Endpoint cũ chỉ còn trả preview; chưa lưu Question vào database",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    bulkPublishVocabularies = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { ids } = req.body;
            const result = await this.aiVocabularyService.bulkPublishVocabularies(req.user!.id, ids);
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
            const result = await this.aiQuestionService.bulkPublishQuestions(req.user!.id, ids);
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
            const result = await this.aiVocabularyService.bulkDeleteVocabularies(req.user!.id, ids);
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
            const result = await this.aiQuestionService.bulkDeleteQuestions(req.user!.id, ids);
            res.status(200).json({
                success: true,
                message: `Đã xóa thành công ${result.deletedCount} câu hỏi`,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    generateQuestionPreview = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        const controller = new AbortController();
        const handleAbort = (): void => controller.abort();
        req.once("aborted", handleAbort);
        try {
            const { topicId } = (res.locals.validatedParams ?? req.params) as {
                topicId: string;
            };
            const result = await this.aiQuestionService.generatePreview(
                req.user!.id,
                topicId,
                req.body,
                controller.signal,
            );
            res.status(200).json({
                success: true,
                message: "AI đã tạo danh sách câu hỏi đề xuất, vui lòng kiểm tra trước khi lưu",
                data: result,
            });
        } catch (error) {
            next(error);
        } finally {
            req.removeListener("aborted", handleAbort);
        }
    };

    commitQuestions = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { generationId } = (res.locals.validatedParams ?? req.params) as {
                generationId: string;
            };
            const result = await this.aiQuestionService.commit(
                req.user!.id,
                generationId,
                req.body,
            );
            res.status(result.alreadyCommitted ? 200 : 201).json({
                success: true,
                message: result.alreadyCommitted
                    ? "AI generation đã được commit trước đó"
                    : `Đã lưu ${result.committedCount} câu hỏi ở trạng thái DRAFT`,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    getGeneration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { generationId } = (res.locals.validatedParams ?? req.params) as { generationId: string };
            const result = await this.aiGenerationService.getGeneration(req.user!.id, generationId);
            res.status(200).json({
                success: true,
                message: "Lấy AI generation thành công",
                data: { generation: result },
            });
        } catch (error) {
            next(error);
        }
    };

    listGenerations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const query = (res.locals.validatedQuery ?? req.query) as AIGenerationListQuery;
            const result = await this.aiGenerationService.listGenerations(req.user!.id, query);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách AI generation thành công",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };
}

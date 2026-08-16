import type { Request, Response, NextFunction } from "express";
import type { AdminQuestionService } from "../services/admin-question.service.js";
import type { QuestionListQuery } from "../types/question.types.js";

export class AdminQuestionController {
    constructor(private readonly questionService: AdminQuestionService) {}

    getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const query = (res.locals.validatedQuery ?? req.query) as QuestionListQuery;
            const result = await this.questionService.getQuestions(query);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách câu hỏi thành công",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    getByTopic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { topicId } = (res.locals.validatedParams ?? req.params) as { topicId: string };
            const query = (res.locals.validatedQuery ?? req.query) as QuestionListQuery;
            const result = await this.questionService.getQuestionsByTopic(topicId, query);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách câu hỏi theo chủ đề thành công",
                data: result,
            });
        } catch (error) {
            next(error);
        }
    };

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { questionId } = (res.locals.validatedParams ?? req.params) as {
                questionId: string;
            };
            const question = await this.questionService.getQuestionById(questionId);
            res.status(200).json({
                success: true,
                message: "Lấy chi tiết câu hỏi thành công",
                data: { question },
            });
        } catch (error) {
            next(error);
        }
    };

    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const question = await this.questionService.createQuestion(req.body);
            res.status(201).json({
                success: true,
                message: "Tạo câu hỏi thành công",
                data: { question },
            });
        } catch (error) {
            next(error);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { questionId } = (res.locals.validatedParams ?? req.params) as {
                questionId: string;
            };
            const question = await this.questionService.updateQuestion(questionId, req.body);
            res.status(200).json({
                success: true,
                message: "Cập nhật câu hỏi thành công",
                data: { question },
            });
        } catch (error) {
            next(error);
        }
    };

    updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { questionId } = (res.locals.validatedParams ?? req.params) as {
                questionId: string;
            };
            const { status } = req.body;
            const question = await this.questionService.updateQuestionStatus(questionId, status);
            res.status(200).json({
                success: true,
                message: "Cập nhật trạng thái câu hỏi thành công",
                data: { question },
            });
        } catch (error) {
            next(error);
        }
    };

    remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { questionId } = (res.locals.validatedParams ?? req.params) as {
                questionId: string;
            };
            await this.questionService.deleteQuestion(questionId);
            res.status(200).json({
                success: true,
                message: "Xóa câu hỏi thành công",
                data: null,
            });
        } catch (error) {
            next(error);
        }
    };

    getByLesson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { lessonId } = (res.locals.validatedParams ?? req.params) as { lessonId: string };
            const questions = await this.questionService.getLessonQuestions(lessonId);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách câu hỏi của bài học thành công",
                data: { questions },
            });
        } catch (error) {
            next(error);
        }
    };

    assignToLesson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { lessonId } = (res.locals.validatedParams ?? req.params) as { lessonId: string };
            const { questionIds } = req.body;
            const questions = await this.questionService.assignQuestionsToLesson(
                lessonId,
                questionIds,
            );
            res.status(201).json({
                success: true,
                message: "Gán câu hỏi vào bài học thành công",
                data: { questions },
            });
        } catch (error) {
            next(error);
        }
    };

    removeFromLesson = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const { lessonId, questionId } = (res.locals.validatedParams ?? req.params) as {
                lessonId: string;
                questionId: string;
            };
            await this.questionService.removeQuestionFromLesson(lessonId, questionId);
            res.status(200).json({
                success: true,
                message: "Gỡ câu hỏi khỏi bài học thành công",
                data: null,
            });
        } catch (error) {
            next(error);
        }
    };

    reorderInLesson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { lessonId } = (res.locals.validatedParams ?? req.params) as { lessonId: string };
            const { questionIds } = req.body;
            await this.questionService.reorderLessonQuestions(lessonId, questionIds);
            res.status(200).json({
                success: true,
                message: "Sắp xếp câu hỏi trong bài học thành công",
                data: null,
            });
        } catch (error) {
            next(error);
        }
    };
}

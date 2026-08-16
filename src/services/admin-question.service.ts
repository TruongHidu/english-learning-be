import { AppError } from "../errors/app-error.js";
import {
    mapQuestionToListItemResponse,
    mapQuestionToResponse,
} from "../mappers/question.mapper.js";
import type { ILessonQuestionRepository } from "../repositories/interfaces/lesson-question.repository.interface.js";
import type { ILessonRepository } from "../repositories/interfaces/lesson.repository.interface.js";
import type { IQuestionRepository } from "../repositories/interfaces/question.repository.interface.js";
import type { IVocabularyRepository } from "../repositories/interfaces/vocabulary.repository.interface.js";
import type {
    CreateQuestionInput,
    LessonQuestionResponse,
    PaginatedQuestionResult,
    QuestionResponse,
    QuestionStatus,
    QuestionListQuery,
    UpdateQuestionInput,
} from "../types/question.types.js";

export class AdminQuestionService {
    constructor(
        private readonly questionRepository: IQuestionRepository,
        private readonly vocabularyRepository: IVocabularyRepository,
        private readonly lessonRepository: ILessonRepository,
        private readonly lessonQuestionRepository: ILessonQuestionRepository,
    ) {}

    public async getQuestions(query: QuestionListQuery): Promise<PaginatedQuestionResult> {
        const { questions, total } = await this.questionRepository.findAll(query);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const totalPages = Math.ceil(total / limit) || 1;

        return {
            questions: questions.map(mapQuestionToListItemResponse),
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
        };
    }

    public async getQuestionsByTopic(
        topicId: string,
        query: QuestionListQuery,
    ): Promise<PaginatedQuestionResult> {
        const { vocabularies } = await this.vocabularyRepository.findByTopicId(topicId, {
            limit: 100,
        });
        const vocabularyIds = vocabularies.map((v) => v._id.toString());

        if (vocabularyIds.length === 0) {
            return {
                questions: [],
                pagination: {
                    page: query.page ?? 1,
                    limit: query.limit ?? 20,
                    total: 0,
                    totalPages: 1,
                },
            };
        }

        const { questions, total } = await this.questionRepository.findAll({
            ...query,
            vocabularyId: vocabularyIds[0], // primary fallback
        });
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const totalPages = Math.ceil(total / limit) || 1;

        return {
            questions: questions.map(mapQuestionToListItemResponse),
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
        };
    }

    public async getQuestionById(questionId: string): Promise<QuestionResponse> {
        const question = await this.questionRepository.findById(questionId);
        if (!question) {
            throw new AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi", 404);
        }
        return mapQuestionToResponse(question);
    }

    public async createQuestion(input: CreateQuestionInput): Promise<QuestionResponse> {
        if (input.vocabularyId) {
            const vocab = await this.vocabularyRepository.findById(input.vocabularyId);
            if (!vocab) {
                throw new AppError("VOCABULARY_NOT_FOUND", "Không tìm thấy từ vựng liên quan", 404);
            }
        }

        const question = await this.questionRepository.create(input);
        return mapQuestionToResponse(question);
    }

    public async updateQuestion(
        questionId: string,
        input: UpdateQuestionInput,
    ): Promise<QuestionResponse> {
        const existingQuestion = await this.questionRepository.findById(questionId);
        if (!existingQuestion) {
            throw new AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi", 404);
        }

        if (input.vocabularyId) {
            const vocab = await this.vocabularyRepository.findById(input.vocabularyId);
            if (!vocab) {
                throw new AppError("VOCABULARY_NOT_FOUND", "Không tìm thấy từ vựng liên quan", 404);
            }
        }

        const updated = await this.questionRepository.update(questionId, input);
        if (!updated) {
            throw new AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi", 404);
        }
        return mapQuestionToResponse(updated);
    }

    public async updateQuestionStatus(
        questionId: string,
        status: QuestionStatus,
    ): Promise<QuestionResponse> {
        const question = await this.questionRepository.findById(questionId);
        if (!question) {
            throw new AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi", 404);
        }

        if (status === "PUBLISHED") {
            this.validatePublishReadiness(question);
        }

        const updated = await this.questionRepository.updateStatus(questionId, status);
        if (!updated) {
            throw new AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi", 404);
        }
        return mapQuestionToResponse(updated);
    }

    public async deleteQuestion(questionId: string): Promise<void> {
        const question = await this.questionRepository.findById(questionId);
        if (!question) {
            throw new AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi", 404);
        }

        const lessonUsageCount = await this.lessonQuestionRepository.countByQuestionId(questionId);
        if (lessonUsageCount > 0) {
            throw new AppError(
                "QUESTION_IS_USED_BY_LESSON",
                "Không thể xóa câu hỏi vì đang được sử dụng trong bài học",
                409,
            );
        }

        await this.questionRepository.deleteById(questionId);
    }

    public async getLessonQuestions(lessonId: string): Promise<LessonQuestionResponse[]> {
        const lesson = await this.lessonRepository.findById(lessonId);
        if (!lesson) {
            throw new AppError("LESSON_NOT_FOUND", "Không tìm thấy bài học", 404);
        }

        const lessonQuestions = await this.lessonQuestionRepository.findByLessonId(lessonId);
        if (lessonQuestions.length === 0) {
            return [];
        }

        const questionIds = lessonQuestions.map((lq) => lq.questionId.toString());
        const questions = await this.questionRepository.findByIds(questionIds);
        const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

        return lessonQuestions
            .map((lq) => {
                const questionDoc = questionMap.get(lq.questionId.toString());
                if (!questionDoc) return null;
                return {
                    id: lq._id.toString(),
                    lessonId: lq.lessonId.toString(),
                    questionId: lq.questionId.toString(),
                    orderIndex: lq.orderIndex,
                    question: mapQuestionToResponse(questionDoc),
                };
            })
            .filter((item): item is LessonQuestionResponse => item !== null);
    }

    public async assignQuestionsToLesson(
        lessonId: string,
        questionIds: string[],
    ): Promise<LessonQuestionResponse[]> {
        const lesson = await this.lessonRepository.findById(lessonId);
        if (!lesson) {
            throw new AppError("LESSON_NOT_FOUND", "Không tìm thấy bài học", 404);
        }

        const allExist = await this.questionRepository.existsByIds(questionIds);
        if (!allExist) {
            throw new AppError(
                "QUESTION_NOT_FOUND",
                "Một hoặc nhiều ID câu hỏi không tồn tại",
                404,
            );
        }

        const existingAssignments = await this.lessonQuestionRepository.findByLessonId(lessonId);
        const existingQIds = new Set(existingAssignments.map((lq) => lq.questionId.toString()));

        const newQuestionIds = questionIds.filter((qId) => !existingQIds.has(qId));
        if (newQuestionIds.length === 0) {
            throw new AppError(
                "QUESTION_ALREADY_ASSIGNED_TO_LESSON",
                "Tất cả các câu hỏi này đã được gán vào bài học",
                409,
            );
        }

        await this.lessonQuestionRepository.createMany(lessonId, newQuestionIds);

        // Update questionCount in Lesson
        const totalCount = await this.lessonQuestionRepository.countByLessonId(lessonId);
        await this.lessonRepository.update(lessonId, { questionCount: totalCount });

        return this.getLessonQuestions(lessonId);
    }

    public async removeQuestionFromLesson(
        lessonId: string,
        questionId: string,
    ): Promise<void> {
        const lesson = await this.lessonRepository.findById(lessonId);
        if (!lesson) {
            throw new AppError("LESSON_NOT_FOUND", "Không tìm thấy bài học", 404);
        }

        const existing = await this.lessonQuestionRepository.findByLessonIdAndQuestionId(
            lessonId,
            questionId,
        );
        if (!existing) {
            throw new AppError(
                "QUESTION_NOT_ASSIGNED_TO_LESSON",
                "Câu hỏi không thuộc bài học này",
                404,
            );
        }

        await this.lessonQuestionRepository.deleteByLessonIdAndQuestionId(lessonId, questionId);

        // Update questionCount in Lesson
        const totalCount = await this.lessonQuestionRepository.countByLessonId(lessonId);
        await this.lessonRepository.update(lessonId, { questionCount: totalCount });
    }

    public async reorderLessonQuestions(
        lessonId: string,
        questionIds: string[],
    ): Promise<void> {
        const lesson = await this.lessonRepository.findById(lessonId);
        if (!lesson) {
            throw new AppError("LESSON_NOT_FOUND", "Không tìm thấy bài học", 404);
        }

        const existingAssignments = await this.lessonQuestionRepository.findByLessonId(lessonId);
        const validQuestionIds = existingAssignments.map((lq) => lq.questionId.toString());

        for (const qId of questionIds) {
            if (!validQuestionIds.includes(qId)) {
                throw new AppError(
                    "INVALID_QUESTION_ORDER",
                    "Danh sách ID câu hỏi để sắp xếp không hợp lệ",
                    400,
                );
            }
        }

        await this.lessonQuestionRepository.reorder(lessonId, questionIds);
    }

    private validatePublishReadiness(question: {
        type: string;
        options?: Array<{ isCorrect: boolean }>;
        matchingPairs?: unknown[];
        correctAnswer?: unknown;
        audioUrl?: string;
    }): void {
        if (question.type === "MULTIPLE_CHOICE") {
            if (!question.options || question.options.length < 2) {

                throw new AppError(
                    "QUESTION_NOT_READY_TO_PUBLISH",
                    "Câu hỏi trắc nghiệm chưa đủ tối thiểu 2 lựa chọn để xuất bản",
                    400,
                );
            }
            const correctCount = question.options.filter((o) => o.isCorrect).length;
            if (correctCount !== 1) {
                throw new AppError(
                    "QUESTION_NOT_READY_TO_PUBLISH",
                    "Câu hỏi trắc nghiệm phải có đúng 1 đáp án chính xác",
                    400,
                );
            }
        } else if (question.type === "MATCHING") {
            if (!question.matchingPairs || question.matchingPairs.length < 2) {
                throw new AppError(
                    "QUESTION_NOT_READY_TO_PUBLISH",
                    "Câu hỏi ghép đôi chưa đủ tối thiểu 2 cặp từ để xuất bản",
                    400,
                );
            }
        } else if (
            question.type === "FILL_BLANK" ||
            question.type === "TRANSLATION" ||
            question.type === "ORDER_SENTENCE"
        ) {
            if (question.correctAnswer === undefined || question.correctAnswer === null || question.correctAnswer === "") {
                throw new AppError(
                    "QUESTION_NOT_READY_TO_PUBLISH",
                    "Câu hỏi chưa có đáp án đúng để xuất bản",
                    400,
                );
            }
        } else if (question.type === "LISTENING") {
            if (!question.audioUrl) {
                throw new AppError(
                    "QUESTION_NOT_READY_TO_PUBLISH",
                    "Câu hỏi nghe chưa có file âm thanh audioUrl để xuất bản",
                    400,
                );
            }
        }
    }
}

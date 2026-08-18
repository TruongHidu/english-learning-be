import { AppError } from "../errors/app-error.js";
import {
    mapQuestionToListItemResponse,
    mapQuestionToResponse,
} from "../mappers/question.mapper.js";
import type { ILessonQuestionRepository } from "../repositories/interfaces/lesson-question.repository.interface.js";
import type { ILessonRepository } from "../repositories/interfaces/lesson.repository.interface.js";
import type {
    CreateQuestionData,
    IQuestionRepository,
    UpdateQuestionData,
} from "../repositories/interfaces/question.repository.interface.js";
import type { IVocabularyRepository } from "../repositories/interfaces/vocabulary.repository.interface.js";
import type {
    IMediaStorage,
    MediaKind,
    QuestionMediaFiles,
    StoredMedia,
} from "../storage/media-storage.interface.js";
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
        private readonly mediaStorage: IMediaStorage,
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

    public async createQuestion(
        input: CreateQuestionInput,
        mediaFiles: QuestionMediaFiles = {},
    ): Promise<QuestionResponse> {
        if (input.vocabularyId) {
            const vocab = await this.vocabularyRepository.findById(input.vocabularyId);
            if (!vocab) {
                throw new AppError("VOCABULARY_NOT_FOUND", "Không tìm thấy từ vựng liên quan", 404);
            }
        }

        this.ensureListeningHasAudio(
            input.type,
            Boolean(mediaFiles.audio) || Boolean(this.normalizeMediaUrl(input.audioUrl)),
        );

        const uploadedMedia = await this.uploadMediaFiles(mediaFiles);
        const createData: CreateQuestionData = {
            ...input,
            ...(uploadedMedia.image && {
                imageUrl: uploadedMedia.image.url,
                imagePublicId: uploadedMedia.image.publicId,
            }),
            ...(uploadedMedia.audio && {
                audioUrl: uploadedMedia.audio.url,
                audioPublicId: uploadedMedia.audio.publicId,
            }),
        };

        let question: Awaited<ReturnType<IQuestionRepository["create"]>>;
        try {
            question = await this.questionRepository.create(createData);
        } catch (error: unknown) {
            await this.cleanupUploadedMedia(uploadedMedia);
            throw error;
        }
        return mapQuestionToResponse(question);
    }

    public async updateQuestion(
        questionId: string,
        input: UpdateQuestionInput,
        mediaFiles: QuestionMediaFiles = {},
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

        const resultingType = input.type ?? existingQuestion.type;
        const resultingAudioUrl = mediaFiles.audio
            ? "pending-upload"
            : input.audioUrl !== undefined
                ? this.normalizeMediaUrl(input.audioUrl)
                : existingQuestion.audioUrl;
        this.ensureListeningHasAudio(resultingType, Boolean(resultingAudioUrl));

        const uploadedMedia = await this.uploadMediaFiles(mediaFiles);
        const updateData: UpdateQuestionData = { ...input };
        const replacedMedia: Array<{ publicId: string; kind: MediaKind }> = [];

        if (uploadedMedia.image) {
            updateData.imageUrl = uploadedMedia.image.url;
            updateData.imagePublicId = uploadedMedia.image.publicId;
            if (existingQuestion.imagePublicId) {
                replacedMedia.push({ publicId: existingQuestion.imagePublicId, kind: "image" });
            }
        } else if (
            input.imageUrl !== undefined &&
            this.normalizeMediaUrl(input.imageUrl) !== this.normalizeMediaUrl(existingQuestion.imageUrl)
        ) {
            updateData.imagePublicId = null;
            if (existingQuestion.imagePublicId) {
                replacedMedia.push({ publicId: existingQuestion.imagePublicId, kind: "image" });
            }
        }

        if (uploadedMedia.audio) {
            updateData.audioUrl = uploadedMedia.audio.url;
            updateData.audioPublicId = uploadedMedia.audio.publicId;
            if (existingQuestion.audioPublicId) {
                replacedMedia.push({ publicId: existingQuestion.audioPublicId, kind: "audio" });
            }
        } else if (
            input.audioUrl !== undefined &&
            this.normalizeMediaUrl(input.audioUrl) !== this.normalizeMediaUrl(existingQuestion.audioUrl)
        ) {
            updateData.audioPublicId = null;
            if (existingQuestion.audioPublicId) {
                replacedMedia.push({ publicId: existingQuestion.audioPublicId, kind: "audio" });
            }
        }

        let updated: Awaited<ReturnType<IQuestionRepository["update"]>>;
        try {
            updated = await this.questionRepository.update(questionId, updateData);
        } catch (error: unknown) {
            await this.cleanupUploadedMedia(uploadedMedia);
            throw error;
        }

        if (!updated) {
            await this.cleanupUploadedMedia(uploadedMedia);
            throw new AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi", 404);
        }

        await Promise.all(
            replacedMedia.map((media) => this.safeDeleteMedia(media.publicId, media.kind)),
        );
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
        await Promise.all([
            ...(question.imagePublicId
                ? [this.safeDeleteMedia(question.imagePublicId, "image")]
                : []),
            ...(question.audioPublicId
                ? [this.safeDeleteMedia(question.audioPublicId, "audio")]
                : []),
        ]);
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

    private ensureListeningHasAudio(type: string, hasAudio: boolean): void {
        if (type === "LISTENING" && !hasAudio) {
            throw new AppError(
                "VALIDATION_ERROR",
                "Dữ liệu không hợp lệ",
                400,
                [{ field: "audio", message: "File âm thanh là bắt buộc cho câu hỏi nghe LISTENING" }],
            );
        }
    }

    private normalizeMediaUrl(value: string | null | undefined): string | null {
        if (typeof value !== "string") return null;
        return value.trim() || null;
    }

    private async uploadMediaFiles(files: QuestionMediaFiles): Promise<{
        image?: StoredMedia;
        audio?: StoredMedia;
    }> {
        const uploaded: { image?: StoredMedia; audio?: StoredMedia } = {};

        try {
            if (files.image) {
                uploaded.image = await this.mediaStorage.upload(files.image, "image");
            }
            if (files.audio) {
                uploaded.audio = await this.mediaStorage.upload(files.audio, "audio");
            }
            return uploaded;
        } catch (_error: unknown) {
            await this.cleanupUploadedMedia(uploaded);
            throw new AppError(
                "MEDIA_UPLOAD_FAILED",
                "Không thể tải file lên hệ thống lưu trữ",
                502,
            );
        }
    }

    private async cleanupUploadedMedia(media: {
        image?: StoredMedia;
        audio?: StoredMedia;
    }): Promise<void> {
        await Promise.all([
            ...(media.image
                ? [this.safeDeleteMedia(media.image.publicId, "image")]
                : []),
            ...(media.audio
                ? [this.safeDeleteMedia(media.audio.publicId, "audio")]
                : []),
        ]);
    }

    private async safeDeleteMedia(publicId: string, kind: MediaKind): Promise<void> {
        try {
            await this.mediaStorage.delete(publicId, kind);
        } catch (_error: unknown) {
            // A cleanup failure must not turn an already committed database update into an API failure.
            console.warn("Unable to clean up a question media asset");
        }
    }
}

import { AppError } from "../errors/app-error.js";
import { deferUntilCurriculumCommit } from "../utils/curriculum-transaction.js";
import {
    mapQuestionToListItemResponse,
    mapQuestionToResponse,
} from "../mappers/question.mapper.js";
import { mapLessonToResponse } from "../mappers/lesson.mapper.js";
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
    AssignQuestionsResult,
    PaginatedQuestionResult,
    QuestionResponse,
    QuestionStatus,
    QuestionListQuery,
    UpdateQuestionInput,
} from "../types/question.types.js";
import {
    haveSameTokenMultiset,
    normalizeQuestionContent,
} from "../utils/question-normalization.utils.js";

interface DuplicateKeyErrorLike {
    code?: number;
}

const isDuplicateKeyError = (error: unknown): error is DuplicateKeyErrorLike =>
    typeof error === "object" && error !== null && "code" in error && error.code === 11000;

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
            limit: 500,
        });
        const vocabularyIds = vocabularies.map((v) => v._id.toString());

        if (vocabularyIds.length === 0) {
            const { questions, total } = await this.questionRepository.findAll({
                ...query,
                topicId,
            });
            const page = query.page ?? 1;
            const limit = query.limit ?? 20;
            const totalPages = Math.ceil(total / limit) || 1;

            return {
                questions: questions.map(mapQuestionToListItemResponse),
                pagination: { page, limit, total, totalPages },
            };
        }

        const { questions, total } = await this.questionRepository.findAll({
            ...query,
            vocabularyIds,
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
        const topicId = await this.resolveTopicIdForQuestionInput(input);

        this.ensureListeningHasAudio(
            input.type,
            Boolean(mediaFiles.audio) || Boolean(this.normalizeMediaUrl(input.audioUrl)),
        );

        const uploadedMedia = await this.uploadMediaFiles(mediaFiles);
        const createData: CreateQuestionData = {
            ...input,
            ...(topicId && { topicId }),
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
            if (isDuplicateKeyError(error)) {
                throw new AppError(
                    "QUESTION_ALREADY_EXISTS",
                    "Câu hỏi cùng loại và nội dung đã tồn tại trong chủ đề",
                    409,
                );
            }
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

        const hasVocabularyChanges = input.vocabularyId !== undefined
            || input.vocabularyIds !== undefined
            || input.matchingPairs !== undefined;
        const topicId = hasVocabularyChanges
            ? await this.resolveTopicIdForQuestionInput(input)
            : existingQuestion.topicId?.toString();

        const resultingType = input.type ?? existingQuestion.type;
        const resultingAudioUrl = mediaFiles.audio
            ? "pending-upload"
            : input.audioUrl !== undefined
                ? this.normalizeMediaUrl(input.audioUrl)
                : existingQuestion.audioUrl;
        this.ensureListeningHasAudio(resultingType, Boolean(resultingAudioUrl));

        const uploadedMedia = await this.uploadMediaFiles(mediaFiles);
        const updateData: UpdateQuestionData = {
            ...input,
            ...(topicId && { topicId }),
        };
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
            if (isDuplicateKeyError(error)) {
                throw new AppError(
                    "QUESTION_ALREADY_EXISTS",
                    "Câu hỏi cùng loại và nội dung đã tồn tại trong chủ đề",
                    409,
                );
            }
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
        } else if (question.status === "PUBLISHED") {
            await this.assertPublishedLessonsRemainReady(questionId);
        }

        const updated = await this.questionRepository.updateStatus(questionId, status);
        if (!updated) {
            throw new AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi", 404);
        }
        return mapQuestionToResponse(updated);
    }

    public async bulkPublishQuestions(
        questionIds: string[],
    ): Promise<{ modifiedCount: number; publishedIds: string[] }> {
        const uniqueIds = Array.from(new Set(questionIds));
        const questions = await this.questionRepository.findByIds(uniqueIds);
        if (questions.length !== uniqueIds.length) {
            throw new AppError(
                "QUESTION_NOT_FOUND",
                "Một hoặc nhiều câu hỏi không tồn tại",
                404,
            );
        }
        for (const question of questions) this.validatePublishReadiness(question);
        const modifiedCount = await this.questionRepository.bulkUpdateStatus(
            uniqueIds,
            "PUBLISHED",
        );
        if ((await this.questionRepository.findByIds(uniqueIds)).some(question => question.status !== "PUBLISHED")) {
            throw new AppError(
                "QUESTION_BULK_PUBLISH_FAILED",
                "Không thể phát hành đầy đủ danh sách câu hỏi",
                409,
            );
        }
        return { modifiedCount, publishedIds: uniqueIds };
    }

    public async deleteQuestion(questionId: string): Promise<void> {
        const question = await this.questionRepository.findById(questionId);
        if (!question) {
            throw new AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi", 404);
        }

        if (question.status === "PUBLISHED") {
            await this.assertPublishedLessonsRemainReady(questionId);
        }

        // Remove any lesson question associations before deleting
        await this.lessonQuestionRepository.deleteByQuestionId(questionId);

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
    ): Promise<AssignQuestionsResult> {
        const lesson = await this.lessonRepository.findById(lessonId);
        if (!lesson) {
            throw new AppError("LESSON_NOT_FOUND", "Không tìm thấy bài học", 404);
        }

        const uniqueQuestionIds = Array.from(new Set(questionIds));
        const questions = await this.questionRepository.findByIdsForAssignment(uniqueQuestionIds);
        if (questions.length !== uniqueQuestionIds.length) {
            throw new AppError(
                "QUESTION_NOT_FOUND",
                "Một hoặc nhiều ID câu hỏi không tồn tại",
                404,
            );
        }

        // Question currently derives its Topic from linked Vocabulary. Questions without
        // linked Vocabulary are intentionally treated as global question-bank records.
        const vocabularyIds = new Set<string>();
        for (const question of questions) {
            if (question.vocabularyId) vocabularyIds.add(question.vocabularyId.toString());
            for (const vocabularyId of question.vocabularyIds ?? []) {
                vocabularyIds.add(vocabularyId.toString());
            }
            for (const pair of question.matchingPairs ?? []) {
                if (pair.vocabularyId) vocabularyIds.add(pair.vocabularyId.toString());
            }
        }

        if (vocabularyIds.size > 0) {
            const vocabularies = await this.vocabularyRepository.findByIds(Array.from(vocabularyIds));
            const vocabularyTopicById = new Map(
                vocabularies.map((vocabulary) => [
                    vocabulary._id.toString(),
                    vocabulary.topicId.toString(),
                ]),
            );
            const lessonTopicId = lesson.topicId.toString();
            const hasTopicMismatch = Array.from(vocabularyIds).some(
                (vocabularyId) => vocabularyTopicById.get(vocabularyId) !== lessonTopicId,
            );
            if (hasTopicMismatch) {
                throw new AppError(
                    "QUESTION_TOPIC_MISMATCH",
                    "Không thể gán câu hỏi thuộc chủ đề khác vào bài học này",
                    400,
                );
            }
        }

        const existingAssignments = await this.lessonQuestionRepository.findByLessonId(lessonId);
        const existingQIds = new Set(existingAssignments.map((lq) => lq.questionId.toString()));

        const newQuestionIds = uniqueQuestionIds.filter((qId) => !existingQIds.has(qId));
        if (newQuestionIds.length > 0) {
            try {
                await this.lessonQuestionRepository.createMany(lessonId, newQuestionIds);
            } catch (error: unknown) {
                if (!isDuplicateKeyError(error)) throw error;

                // Another request may have inserted one of the same assignments. Re-read
                // and retry only IDs still missing; the unique index remains the final guard.
                const afterRace = await this.lessonQuestionRepository.findByLessonId(lessonId);
                const stillMissing = newQuestionIds.filter(
                    (questionId) => !afterRace.some((item) => item.questionId.toString() === questionId),
                );
                if (stillMissing.length > 0) {
                    try {
                        await this.lessonQuestionRepository.createMany(lessonId, stillMissing);
                    } catch (retryError: unknown) {
                        if (!isDuplicateKeyError(retryError)) throw retryError;
                        throw new AppError(
                            "QUESTION_ALREADY_ASSIGNED_TO_LESSON",
                            "Một hoặc nhiều câu hỏi đã được gán vào bài học",
                            409,
                        );
                    }
                }
            }
        }

        // Update questionCount in Lesson
        const totalCount = await this.lessonQuestionRepository.countByLessonId(lessonId);
        const updatedLesson = await this.lessonRepository.update(lessonId, { questionCount: totalCount });
        if (!updatedLesson) {
            throw new AppError("LESSON_NOT_FOUND", "Không tìm thấy bài học", 404);
        }

        const currentAssignments = await this.lessonQuestionRepository.findByLessonId(lessonId);
        const assignedCount = uniqueQuestionIds.filter((questionId) =>
            !existingQIds.has(questionId) &&
            currentAssignments.some((item) => item.questionId.toString() === questionId),
        ).length;

        return {
            lesson: mapLessonToResponse(updatedLesson),
            questions: await this.getLessonQuestions(lessonId),
            assignedCount,
            skippedCount: Math.max(0, uniqueQuestionIds.length - assignedCount),
        };
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

        const question = await this.questionRepository.findById(questionId);
        if (!question) {
            throw new AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi", 404);
        }
        if (question.status === "PUBLISHED") {
            await this.assertPublishedLessonsRemainReady(questionId, lessonId);
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

        if (new Set(questionIds).size !== questionIds.length || questionIds.length !== validQuestionIds.length) {
            throw new AppError("INVALID_QUESTION_ORDER", "Danh sách phải chứa đủ câu hỏi, không trùng lặp", 400);
        }
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
        options?: Array<{ content: string; isCorrect: boolean }>;
        matchingPairs?: unknown[];
        correctAnswer?: unknown;
        content: string;
    }): void {
        if (!["MULTIPLE_CHOICE", "MATCHING", "FILL_BLANK", "ORDER_SENTENCE", "TRANSLATION"].includes(question.type)) {
            throw new AppError(
                "QUESTION_TYPE_NOT_LEARNABLE",
                "Loại câu hỏi này chưa được trang học hỗ trợ",
                400,
            );
        }
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
            const correctOption = question.options.find((option) => option.isCorrect);
            if (typeof question.correctAnswer !== "string"
                || !correctOption
                || normalizeQuestionContent(question.correctAnswer)
                    !== normalizeQuestionContent((correctOption as { content?: string }).content ?? "")) {
                throw new AppError(
                    "QUESTION_NOT_READY_TO_PUBLISH",
                    "correctAnswer phải trùng với lựa chọn đúng",
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
            const pairs = question.matchingPairs as Array<{ leftValue?: string; rightValue?: string }>;
            const leftValues = pairs.map((pair) => normalizeQuestionContent(pair.leftValue ?? ""));
            const rightValues = pairs.map((pair) => normalizeQuestionContent(pair.rightValue ?? ""));
            if (leftValues.some((value) => !value)
                || rightValues.some((value) => !value)
                || new Set(leftValues).size !== leftValues.length
                || new Set(rightValues).size !== rightValues.length) {
                throw new AppError(
                    "QUESTION_NOT_READY_TO_PUBLISH",
                    "Các cặp ghép phải có nội dung và không được trùng",
                    400,
                );
            }
        } else if (question.type === "TRANSLATION") {
            if (typeof question.correctAnswer !== "string" || !question.correctAnswer.trim()) {
                throw new AppError(
                    "QUESTION_NOT_READY_TO_PUBLISH",
                    "Câu hỏi dịch chưa có đáp án đúng để xuất bản",
                    400,
                );
            }
        } else if (question.type === "FILL_BLANK" || question.type === "ORDER_SENTENCE") {
            if (question.correctAnswer === undefined || question.correctAnswer === null || question.correctAnswer === "") {
                throw new AppError(
                    "QUESTION_NOT_READY_TO_PUBLISH",
                    "Câu hỏi chưa có đáp án đúng để xuất bản",
                    400,
                );
            }
            if (question.type === "FILL_BLANK" && !/(?:_{3,}|\[\s*blank\s*\]|\.\.\.)/i.test(question.content)) {
                throw new AppError(
                    "QUESTION_NOT_READY_TO_PUBLISH",
                    "Câu hỏi điền từ phải có vị trí trống",
                    400,
                );
            }
            if (question.type === "ORDER_SENTENCE") {
                const answer = typeof question.correctAnswer === "string"
                    ? question.correctAnswer
                    : Array.isArray(question.correctAnswer)
                        ? question.correctAnswer.filter((item): item is string => typeof item === "string")
                        : [];
                const optionContents = (question.options ?? [])
                    .map((option) => (option as { content?: string }).content ?? "");
                if (optionContents.length < 2 || !haveSameTokenMultiset(answer, optionContents)) {
                    throw new AppError(
                        "QUESTION_NOT_READY_TO_PUBLISH",
                        "Các word chip phải khớp với đáp án của câu sắp xếp",
                        400,
                    );
                }
            }
        }
    }

    private async assertPublishedLessonsRemainReady(
        questionId: string,
        onlyLessonId?: string,
    ): Promise<void> {
        const lessonIds = onlyLessonId
            ? [onlyLessonId]
            : Array.from(new Set(
                  (await this.lessonQuestionRepository.findByQuestionId(questionId))
                      .map((assignment) => assignment.lessonId.toString()),
              ));

        for (const lessonId of lessonIds) {
            const lesson = await this.lessonRepository.findById(lessonId);
            if (lesson?.status === "PUBLISHED" && (lesson.publishedQuestionCount ?? 0) <= 1) {
                throw new AppError(
                    "LESSON_REQUIRES_PUBLISHED_QUESTION",
                    `Không thể gỡ câu hỏi đã xuất bản cuối cùng khỏi bài học “${lesson.name}”`,
                    409,
                );
            }
        }
    }

    private async resolveTopicIdForQuestionInput(
        input: Pick<CreateQuestionInput, "vocabularyId" | "vocabularyIds" | "matchingPairs">,
    ): Promise<string | undefined> {
        const vocabularyIds = new Set<string>();
        if (input.vocabularyId) vocabularyIds.add(input.vocabularyId);
        for (const id of input.vocabularyIds ?? []) vocabularyIds.add(id);
        for (const pair of input.matchingPairs ?? []) {
            if (pair.vocabularyId) vocabularyIds.add(pair.vocabularyId);
        }
        if (vocabularyIds.size === 0) return undefined;

        const vocabularies = await this.vocabularyRepository.findByIds(Array.from(vocabularyIds));
        if (vocabularies.length !== vocabularyIds.size) {
            throw new AppError(
                "VOCABULARY_NOT_FOUND",
                "Một hoặc nhiều từ vựng liên quan không tồn tại",
                404,
            );
        }
        const topicIds = new Set(vocabularies.map((vocabulary) => vocabulary.topicId.toString()));
        if (topicIds.size !== 1) {
            throw new AppError(
                "QUESTION_TOPIC_MISMATCH",
                "Các từ vựng của câu hỏi phải thuộc cùng một chủ đề",
                400,
            );
        }
        return topicIds.values().next().value;
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
        if (deferUntilCurriculumCommit(() => this.safeDeleteMedia(publicId, kind))) return;
        try {
            await this.mediaStorage.delete(publicId, kind);
        } catch (_error: unknown) {
            // A cleanup failure must not turn an already committed database update into an API failure.
            console.warn("Unable to clean up a question media asset");
        }
    }
}

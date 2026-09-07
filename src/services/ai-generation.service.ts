import { AppError } from "../errors/app-error.js";
import {
    commitVocabularyItemsSchema,
    commitQuestionItemsSchema,
    generatedQuestionCandidateSchema,
    generatedVocabularyCandidatesSchema,
    questionPreviewCandidatesSchema,
    vocabularyPreviewCandidatesSchema,
    type CommitVocabularyItem,
    type GeneratedQuestionCandidate,
    type GeneratedVocabularyCandidate,
} from "../ai/schemas/generated-content.schema.js";
import type { IAiContentGenerator } from "../ai/interfaces/ai-content-generator.interface.js";
import { mapQuestionToResponse } from "../mappers/question.mapper.js";
import { mapVocabularyToResponse } from "../mappers/vocabulary.mapper.js";
import { mapAIGenerationToResponse } from "../mappers/ai-generation.mapper.js";
import type { AIGenerationDocument } from "../models/ai-generation.model.js";
import type { LessonDocument } from "../models/lesson.model.js";
import type { VocabularyDocument } from "../models/vocabulary.model.js";
import type { IAIGenerationRepository } from "../repositories/interfaces/ai-generation.repository.interface.js";
import type { IAiVocabularyCommitRepository } from "../repositories/interfaces/ai-vocabulary-commit.repository.interface.js";
import type { IAiQuestionCommitRepository } from "../repositories/interfaces/ai-question-commit.repository.interface.js";
import type { ICourseRepository } from "../repositories/interfaces/course.repository.interface.js";
import type { ILessonQuestionRepository } from "../repositories/interfaces/lesson-question.repository.interface.js";
import type { ILessonRepository } from "../repositories/interfaces/lesson.repository.interface.js";
import type { IQuestionRepository } from "../repositories/interfaces/question.repository.interface.js";
import type { ITopicRepository } from "../repositories/interfaces/topic.repository.interface.js";
import type { ISectionRepository } from "../repositories/interfaces/section.repository.interface.js";
import type { IVocabularyRepository } from "../repositories/interfaces/vocabulary.repository.interface.js";
import type {
    AIGenerationListQuery,
    AIGenerationResponse,
} from "../types/ai-generation.types.js";
import type {
    CreateQuestionsGenerationInput,
    CommitQuestionGenerationInput,
    CommitQuestionGenerationResult,
    CommitVocabularyGenerationInput,
    CommitVocabularyGenerationResult,
    GenerateVocabularyPreviewInput,
    GenerateVocabularyPreviewResult,
    GenerateQuestionsResult,
    GenerateQuestionPreviewInput,
    GenerateQuestionPreviewResult,
    GenerateVocabulariesInput,
    GenerateVocabulariesResult,
} from "../types/ai.types.js";
import { AI_SUPPORTED_QUESTION_TYPES } from "../types/ai.types.js";
import type { VocabularyDifficulty } from "../types/vocabulary.types.js";
import { mapLevelToDifficulty, normalizeQuestionType } from "../utils/ai-helper.utils.js";
import {
    buildQuestionDedupeKey,
} from "../utils/question-normalization.utils.js";
import {
    normalizeUnicodeSpacing,
    normalizeVocabularyWord,
} from "../utils/vocabulary-normalization.utils.js";

export interface AiGenerationServiceOptions {
    provider: string;
    modelName: string;
    promptVersion: string;
    maxVocabularies: number;
    maxQuestions: number;
}

interface GenerationContext {
    topic: { id: string; name: string };
    lesson?: LessonDocument;
}

interface QuestionVocabularyReferences {
    vocabularyId?: string;
    vocabularyIds?: string[];
    matchingPairs?: Array<{ vocabularyId?: string }>;
}

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;
const isValidObjectId = (value: string): boolean => OBJECT_ID_REGEX.test(value);

export class AiGenerationService {
    constructor(
        private readonly aiContentGenerator: IAiContentGenerator,
        private readonly aiGenerationRepository: IAIGenerationRepository,
        private readonly topicRepository: ITopicRepository,
        private readonly sectionRepository: ISectionRepository,
        private readonly courseRepository: ICourseRepository,
        private readonly lessonRepository: ILessonRepository,
        private readonly vocabularyRepository: IVocabularyRepository,
        private readonly aiVocabularyCommitRepository: IAiVocabularyCommitRepository,
        private readonly aiQuestionCommitRepository: IAiQuestionCommitRepository,
        private readonly questionRepository: IQuestionRepository,
        private readonly lessonQuestionRepository: ILessonQuestionRepository,
        private readonly options: AiGenerationServiceOptions,
    ) {}

    async generateVocabularies(
        adminId: string,
        input: GenerateVocabulariesInput,
    ): Promise<GenerateVocabulariesResult> {
        return this.generateVocabularyPreview(adminId, input.topicId, {
            count: Math.min(input.quantity, 20),
        });
    }

    async generateVocabularyPreview(
        adminId: string,
        topicId: string,
        input: GenerateVocabularyPreviewInput,
    ): Promise<GenerateVocabularyPreviewResult> {
        this.assertObjectId(topicId, "INVALID_TOPIC_ID", "ID chủ đề không hợp lệ");
        this.assertQuantity(input.count, 20);
        const context = await this.resolveVocabularyPreviewContext(topicId);
        const existingRecords = await this.vocabularyRepository.findWordsByTopicId(topicId);
        const existingWords = new Set(
            existingRecords.map((item) =>
                item.normalizedWord ?? normalizeVocabularyWord(item.word),
            ),
        );
        const requirements = input.requirements
            ? normalizeUnicodeSpacing(input.requirements)
            : undefined;
        const generation = await this.createGeneration(adminId, topicId, undefined, {
            generationType: "VOCABULARY",
            requestedCount: input.count,
            inputSnapshot: {
                topicId,
                topicName: context.topic.name,
                sectionId: context.sectionId,
                courseId: context.courseId,
                level: context.level,
                count: input.count,
                requirements: requirements ?? null,
                existingWords: Array.from(existingWords).slice(0, 100),
            },
        });

        try {
            const rawOutput = await this.aiContentGenerator.generateVocabularies({
                topicName: context.topic.name,
                level: context.level,
                quantity: Math.min(input.count * 2, 40),
                excludeWords: Array.from(existingWords),
                requirements,
            });
            const parsed = this.parseVocabularyOutput(rawOutput);
            const uniqueCandidates = this.uniqueVocabularyCandidates(parsed, existingWords)
                .slice(0, input.count);
            const candidates = uniqueCandidates.map((candidate, index) => ({
                ...candidate,
                candidateKey: `v${index + 1}`,
            }));
            const status = candidates.length >= input.count ? "COMPLETED" : "PARTIAL";
            const updated = await this.aiGenerationRepository.markCompleted(
                generation._id.toString(),
                adminId,
                {
                    status,
                    generatedCount: candidates.length,
                    acceptedCount: 0,
                    candidates,
                    result: [],
                    resultIds: [],
                },
            );
            if (!updated) {
                throw new AppError(
                    "AI_GENERATION_STATE_CONFLICT",
                    "Không thể hoàn tất AI generation",
                    409,
                );
            }

            return {
                generationId: generation._id.toString(),
                topicId,
                requestedCount: input.count,
                generatedCount: candidates.length,
                candidates,
            };
        } catch (error: unknown) {
            await this.failGeneration(generation, error);
            throw this.toPublicError(error);
        }
    }

    async commitVocabularyGeneration(
        adminId: string,
        generationId: string,
        input: CommitVocabularyGenerationInput,
    ): Promise<CommitVocabularyGenerationResult> {
        this.assertObjectId(generationId, "INVALID_GENERATION_ID", "ID generation không hợp lệ");
        const parsedItems = commitVocabularyItemsSchema.safeParse(input.items);
        if (!parsedItems.success) {
            throw new AppError("VALIDATION_ERROR", "Dữ liệu từ vựng commit không hợp lệ", 400);
        }

        const generation = await this.aiGenerationRepository.findByIdForAdmin(generationId, adminId);
        if (!generation) {
            throw new AppError("AI_GENERATION_NOT_FOUND", "Không tìm thấy AI generation", 404);
        }
        if (generation.generationType !== "VOCABULARY") {
            throw new AppError(
                "AI_GENERATION_TYPE_MISMATCH",
                "AI generation không thuộc loại VOCABULARY",
                400,
            );
        }
        if (!["COMPLETED", "PARTIAL", "COMMITTED"].includes(generation.status)) {
            throw new AppError(
                "AI_GENERATION_NOT_COMMITTABLE",
                "AI generation không ở trạng thái có thể commit",
                409,
            );
        }

        const storedCandidates = vocabularyPreviewCandidatesSchema.safeParse(generation.candidates);
        if (!storedCandidates.success) {
            throw new AppError(
                "AI_GENERATION_DATA_INVALID",
                "Candidates của AI generation không hợp lệ",
                500,
            );
        }
        const candidateKeys = new Set(storedCandidates.data.map((item) => item.candidateKey));
        if (parsedItems.data.some((item) => !candidateKeys.has(item.candidateKey))) {
            throw new AppError(
                "AI_CANDIDATE_NOT_FOUND",
                "candidateKey không thuộc AI generation",
                400,
            );
        }

        const items = parsedItems.data.map((item) => this.normalizeCommitItem(item));
        const normalizedWords = items.map((item) => item.normalizedWord);
        if (new Set(normalizedWords).size !== normalizedWords.length) {
            throw new AppError(
                "DUPLICATE_VOCABULARIES",
                "Danh sách commit có từ vựng trùng nhau",
                409,
            );
        }

        const level = typeof generation.inputSnapshot.level === "string"
            ? generation.inputSnapshot.level
            : "A1";
        const committed = await this.aiVocabularyCommitRepository.commit({
            generationId,
            adminId,
            topicId: generation.topicId.toString(),
            difficulty: mapLevelToDifficulty(level),
            items,
        });

        return {
            generationId,
            status: "COMMITTED",
            committedCount: committed.vocabularies.length,
            alreadyCommitted: committed.alreadyCommitted,
            vocabularies: committed.vocabularies.map(mapVocabularyToResponse),
        };
    }

    async generateQuestions(
        adminId: string,
        input: CreateQuestionsGenerationInput,
    ): Promise<GenerateQuestionsResult> {
        const normalizedTypes = Array.from(new Set(input.questionTypes.map(normalizeQuestionType)));
        const aiSupportedTypes = new Set<string>(AI_SUPPORTED_QUESTION_TYPES);
        const supportedTypes = normalizedTypes.filter((type) =>
            aiSupportedTypes.has(type),
        ) as GenerateQuestionPreviewInput["questionTypes"];
        if (supportedTypes.length !== normalizedTypes.length || supportedTypes.length === 0) {
            throw new AppError(
                "AI_QUESTION_TYPE_NOT_SUPPORTED",
                `AI Question chỉ hỗ trợ ${AI_SUPPORTED_QUESTION_TYPES.join(", ")}`,
                400,
            );
        }
        return this.generateQuestionPreview(adminId, input.topicId, {
            lessonId: input.lessonId,
            vocabularyIds: input.vocabularyIds
                ?? (input.vocabularyId ? [input.vocabularyId] : undefined),
            questionTypes: supportedTypes,
            count: input.quantity,
            difficulty: input.difficulty ?? "EASY",
        });
    }

    async generateQuestionPreview(
        adminId: string,
        topicId: string,
        input: GenerateQuestionPreviewInput,
        signal?: AbortSignal,
    ): Promise<GenerateQuestionPreviewResult> {
        this.assertObjectId(topicId, "INVALID_TOPIC_ID", "ID chủ đề không hợp lệ");
        this.assertQuantity(input.count, this.options.maxQuestions);
        if (signal?.aborted) {
            throw new AppError("AI_GENERATION_CANCELED", "Yêu cầu tạo câu hỏi AI đã bị hủy", 499);
        }
        const context = await this.resolveContext(topicId, input.lessonId);
        const vocabularies = await this.resolveQuestionVocabularies(topicId, input.vocabularyIds);
        if (vocabularies.length === 0) {
            throw new AppError(
                "VOCABULARY_NOT_FOUND",
                "Không tìm thấy từ vựng hợp lệ để tạo câu hỏi",
                404,
            );
        }
        const allTopicVocabularies = await this.vocabularyRepository.findByTopicId(topicId, {
            limit: 500,
        });
        const topicVocabularyIds = allTopicVocabularies.vocabularies.map(
            (vocabulary) => vocabulary._id.toString(),
        );
        const existingQuestions = await this.questionRepository.findDedupeRecordsByTopic(
            topicId,
            topicVocabularyIds,
        );
        const existingKeys = new Set(existingQuestions.map((question) =>
            question.dedupeKey
            ?? buildQuestionDedupeKey(topicId, question.type, question.content),
        ));
        const requirements = input.requirements
            ? normalizeUnicodeSpacing(input.requirements)
            : undefined;
        const generation = await this.createGeneration(adminId, topicId, input.lessonId, {
            generationType: "QUESTION",
            requestedCount: input.count,
            inputSnapshot: {
                topicId,
                topicName: context.topic.name,
                lessonId: input.lessonId ?? null,
                lessonName: context.lesson?.name ?? null,
                vocabularyIds: vocabularies.map((vocabulary) => vocabulary._id.toString()),
                questionTypes: input.questionTypes,
                count: input.count,
                difficulty: input.difficulty,
                requirements: requirements ?? null,
            },
        });

        try {
            const rawOutput = await this.aiContentGenerator.generateQuestions(
                {
                    topicName: context.topic.name,
                    lessonName: context.lesson?.name,
                    vocabularies: vocabularies.map((vocabulary) => ({
                        id: vocabulary._id.toString(),
                        word: vocabulary.word,
                        meaning: vocabulary.meaning,
                        example: vocabulary.example,
                        exampleMeaning: vocabulary.exampleMeaning,
                    })),
                    questionTypes: input.questionTypes,
                    quantity: Math.min(input.count * 2, this.options.maxQuestions * 2),
                    difficulty: input.difficulty,
                    requirements,
                },
                { signal },
            );
            if (signal?.aborted) {
                throw new AppError("AI_GENERATION_CANCELED", "Yêu cầu tạo câu hỏi AI đã bị hủy", 499);
            }
            const parsed = this.parseQuestionCandidatesIndividually(
                rawOutput,
                new Set(input.questionTypes),
                new Set(vocabularies.map((vocabulary) => vocabulary._id.toString())),
            );
            const seen = new Set<string>();
            const uniqueCandidates = parsed.candidates.filter((candidate) => {
                const key = buildQuestionDedupeKey(topicId, candidate.type, candidate.content);
                if (existingKeys.has(key) || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            const selected = uniqueCandidates.slice(0, input.count);
            if (selected.length === 0) {
                throw new AppError(
                    parsed.invalidCount > 0 ? "AI_OUTPUT_INVALID" : "DUPLICATE_QUESTIONS",
                    parsed.invalidCount > 0
                        ? "AI không trả về câu hỏi hợp lệ"
                        : "Tất cả câu hỏi AI trả về đã tồn tại",
                    parsed.invalidCount > 0 ? 502 : 409,
                );
            }
            const candidates = selected.map((candidate, index) => ({
                ...candidate,
                candidateKey: `q${index + 1}`,
                difficulty: input.difficulty,
            }));
            const status = parsed.invalidCount > 0 || candidates.length < input.count
                ? "PARTIAL"
                : "COMPLETED";
            const updated = await this.aiGenerationRepository.markCompleted(
                generation._id.toString(),
                adminId,
                {
                    status,
                    generatedCount: parsed.generatedCount,
                    acceptedCount: candidates.length,
                    candidates,
                    result: [],
                    resultIds: [],
                },
            );
            if (!updated) {
                throw new AppError(
                    "AI_GENERATION_STATE_CONFLICT",
                    "Không thể hoàn tất AI generation",
                    409,
                );
            }
            return {
                generationId: generation._id.toString(),
                topicId,
                lessonId: input.lessonId ?? null,
                requestedCount: input.count,
                generatedCount: parsed.generatedCount,
                acceptedCount: candidates.length,
                status,
                candidates,
            };
        } catch (error: unknown) {
            await this.failGeneration(generation, error);
            throw this.toPublicError(error);
        }
    }

    async commitQuestionGeneration(
        adminId: string,
        generationId: string,
        input: CommitQuestionGenerationInput,
    ): Promise<CommitQuestionGenerationResult> {
        this.assertObjectId(generationId, "INVALID_GENERATION_ID", "ID generation không hợp lệ");
        const parsedItems = commitQuestionItemsSchema.safeParse(input.items);
        if (!parsedItems.success) {
            throw new AppError("VALIDATION_ERROR", "Dữ liệu câu hỏi commit không hợp lệ", 400);
        }
        const generation = await this.aiGenerationRepository.findByIdForAdmin(generationId, adminId);
        if (!generation) {
            throw new AppError("AI_GENERATION_NOT_FOUND", "Không tìm thấy AI generation", 404);
        }
        if (generation.generationType !== "QUESTION") {
            throw new AppError(
                "AI_GENERATION_TYPE_MISMATCH",
                "AI generation không thuộc loại QUESTION",
                400,
            );
        }
        if (!["COMPLETED", "PARTIAL", "COMMITTED"].includes(generation.status)) {
            throw new AppError(
                "AI_GENERATION_NOT_COMMITTABLE",
                "AI generation không ở trạng thái có thể commit",
                409,
            );
        }
        const storedCandidates = questionPreviewCandidatesSchema.safeParse(generation.candidates);
        if (!storedCandidates.success) {
            throw new AppError(
                "AI_GENERATION_DATA_INVALID",
                "Candidates của AI generation không hợp lệ",
                500,
            );
        }
        const candidateKeys = new Set(storedCandidates.data.map((candidate) => candidate.candidateKey));
        if (parsedItems.data.some((candidate) => !candidateKeys.has(candidate.candidateKey))) {
            throw new AppError(
                "AI_CANDIDATE_NOT_FOUND",
                "candidateKey không thuộc AI generation",
                400,
            );
        }
        const scopedVocabularyIds = this.readSnapshotStringArray(
            generation.inputSnapshot.vocabularyIds,
        );
        const scopedVocabularySet = new Set(scopedVocabularyIds);
        for (const candidate of parsedItems.data) {
            if (!this.hasValidVocabularyReferences(candidate, scopedVocabularySet)) {
                throw new AppError(
                    "AI_VOCABULARY_REFERENCE_INVALID",
                    "Câu hỏi tham chiếu từ vựng ngoài phạm vi generation",
                    400,
                );
            }
        }
        const topicId = generation.topicId.toString();
        const dedupeKeys = parsedItems.data.map((candidate) =>
            buildQuestionDedupeKey(topicId, candidate.type, candidate.content),
        );
        if (new Set(dedupeKeys).size !== dedupeKeys.length) {
            throw new AppError(
                "DUPLICATE_QUESTIONS",
                "Danh sách commit có câu hỏi trùng nhau",
                409,
            );
        }
        const topicVocabularies = await this.vocabularyRepository.findByTopicId(topicId, {
            limit: 500,
        });
        const committed = await this.aiQuestionCommitRepository.commit({
            generationId,
            adminId,
            topicId,
            topicVocabularyIds: topicVocabularies.vocabularies.map(
                (vocabulary) => vocabulary._id.toString(),
            ),
            items: parsedItems.data.map((candidate, index) => ({
                candidate,
                dedupeKey: dedupeKeys[index]!,
            })),
        });
        return {
            generationId,
            status: "COMMITTED",
            committedCount: committed.questions.length,
            alreadyCommitted: committed.alreadyCommitted,
            questions: committed.questions.map(mapQuestionToResponse),
        };
    }

    async getGeneration(adminId: string, generationId: string): Promise<AIGenerationResponse> {
        this.assertObjectId(generationId, "INVALID_GENERATION_ID", "ID generation không hợp lệ");
        const generation = await this.aiGenerationRepository.findByIdForAdmin(generationId, adminId);
        if (!generation) {
            throw new AppError("AI_GENERATION_NOT_FOUND", "Không tìm thấy AI generation", 404);
        }
        return mapAIGenerationToResponse(generation);
    }

    async listGenerations(
        adminId: string,
        query: AIGenerationListQuery,
    ): Promise<{ generations: AIGenerationResponse[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
        const { generations, total } = await this.aiGenerationRepository.listForAdmin(adminId, query);
        return {
            generations: generations.map(mapAIGenerationToResponse),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
        };
    }

    async bulkPublishVocabularies(ids: string[]): Promise<{ modifiedCount: number }> {
        const validIds = ids.filter(isValidObjectId);
        const updated = await Promise.all(validIds.map((id) => this.vocabularyRepository.updateStatus(id, "PUBLISHED")));
        return { modifiedCount: updated.filter((item) => item !== null).length };
    }

    async bulkDeleteVocabularies(ids: string[]): Promise<{ deletedCount: number }> {
        const validIds = ids.filter(isValidObjectId);
        const deleted = await Promise.all(validIds.map((id) => this.vocabularyRepository.deleteById(id)));
        return { deletedCount: deleted.filter(Boolean).length };
    }

    async bulkDeleteQuestions(ids: string[]): Promise<{ deletedCount: number }> {
        const validIds = ids.filter(isValidObjectId);
        const deleted = await Promise.all(validIds.map(async (id) => {
            await this.lessonQuestionRepository.deleteByQuestionId(id);
            return this.questionRepository.deleteById(id);
        }));
        return { deletedCount: deleted.filter(Boolean).length };
    }

    private async resolveContext(topicId: string, lessonId?: string): Promise<GenerationContext> {
        const topic = await this.topicRepository.findById(topicId);
        if (!topic) throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);

        let lesson: LessonDocument | undefined;
        if (lessonId) {
            this.assertObjectId(lessonId, "INVALID_LESSON_ID", "ID bài học không hợp lệ");
            const foundLesson = await this.lessonRepository.findById(lessonId);
            if (!foundLesson || foundLesson.topicId.toString() !== topicId) {
                throw new AppError("LESSON_NOT_FOUND", "Không tìm thấy bài học thuộc chủ đề", 404);
            }
            lesson = foundLesson;
        }
        return { topic: { id: topic._id.toString(), name: topic.name }, lesson };
    }

    private async resolveVocabularyPreviewContext(topicId: string): Promise<{
        topic: { id: string; name: string };
        sectionId: string;
        courseId: string;
        level: string;
    }> {
        const topic = await this.topicRepository.findById(topicId);
        if (!topic) {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }
        const sectionId = topic.sectionId.toString();
        const section = await this.sectionRepository.findById(sectionId);
        if (!section) {
            throw new AppError("SECTION_NOT_FOUND", "Không tìm thấy phần học của chủ đề", 404);
        }
        const course = await this.courseRepository.findById(section.courseId);
        if (!course) {
            throw new AppError("COURSE_NOT_FOUND", "Không tìm thấy khóa học của chủ đề", 404);
        }
        return {
            topic: { id: topic._id.toString(), name: topic.name },
            sectionId,
            courseId: course.id,
            level: course.level,
        };
    }

    private async resolveQuestionVocabularies(
        topicId: string,
        requestedIds?: string[],
    ): Promise<VocabularyDocument[]> {
        if (requestedIds && requestedIds.length > 0) {
            const ids = Array.from(new Set(requestedIds));
            if (ids.some((id) => !isValidObjectId(id))) {
                throw new AppError("INVALID_VOCABULARY_ID", "ID từ vựng không hợp lệ", 400);
            }
            const found = await this.vocabularyRepository.findByIds(ids);
            const byId = new Map(found.map((vocabulary) => [vocabulary._id.toString(), vocabulary]));
            const ordered = ids
                .map((id) => byId.get(id))
                .filter((vocabulary): vocabulary is VocabularyDocument => vocabulary !== undefined);
            if (ordered.length !== ids.length
                || ordered.some((vocabulary) =>
                    vocabulary.topicId.toString() !== topicId || vocabulary.status === "INACTIVE")) {
                throw new AppError(
                    "VOCABULARY_NOT_FOUND",
                    "Một hoặc nhiều từ vựng không hợp lệ hoặc không thuộc chủ đề",
                    404,
                );
            }
            return ordered;
        }
        const result = await this.vocabularyRepository.findByTopicId(topicId, { limit: 500 });
        return result.vocabularies.filter((vocabulary) => vocabulary.status !== "INACTIVE");
    }

    private async createGeneration(
        adminId: string,
        topicId: string,
        lessonId: string | undefined,
        data: {
            generationType: "VOCABULARY" | "QUESTION";
            requestedCount: number;
            inputSnapshot: Record<string, unknown>;
        },
    ): Promise<AIGenerationDocument> {
        const generation = await this.aiGenerationRepository.create({
            adminId,
            topicId,
            lessonId,
            generationType: data.generationType,
            provider: this.options.provider,
            modelName: this.options.modelName,
            promptVersion: this.options.promptVersion,
            requestedCount: data.requestedCount,
            inputSnapshot: data.inputSnapshot,
        });
        const processing = await this.aiGenerationRepository.markProcessing(generation._id.toString(), adminId);
        if (!processing) {
            throw new AppError("AI_GENERATION_STATE_CONFLICT", "Không thể chuyển AI generation sang PROCESSING", 409);
        }
        return processing;
    }

    private async failGeneration(generation: AIGenerationDocument, error: unknown): Promise<void> {
        const publicError = this.toPublicError(error);
        if (publicError.code === "AI_GENERATION_CANCELED") {
            await this.aiGenerationRepository.markCanceled(
                generation._id.toString(),
                generation.adminId.toString(),
                publicError.code,
                publicError.message,
            );
            return;
        }
        await this.aiGenerationRepository.markFailed(
            generation._id.toString(),
            generation.adminId.toString(),
            publicError.code,
            publicError.message,
        );
    }

    private parseVocabularyOutput(output: unknown): GeneratedVocabularyCandidate[] {
        const parsed = generatedVocabularyCandidatesSchema.safeParse(output);
        if (!parsed.success) {
            throw new AppError("AI_OUTPUT_INVALID", "AI output từ vựng không đúng schema", 502);
        }
        return parsed.data;
    }

    private parseQuestionCandidatesIndividually(
        output: unknown,
        requestedTypes: Set<string>,
        allowedVocabularyIds: Set<string>,
    ): { candidates: GeneratedQuestionCandidate[]; invalidCount: number; generatedCount: number } {
        if (!Array.isArray(output)) {
            throw new AppError("AI_OUTPUT_INVALID", "AI output câu hỏi phải là JSON array", 502);
        }
        const candidates: GeneratedQuestionCandidate[] = [];
        let invalidCount = 0;
        for (const rawCandidate of output) {
            const parsed = generatedQuestionCandidateSchema.safeParse(rawCandidate);
            if (!parsed.success
                || !requestedTypes.has(parsed.data.type)
                || !this.hasValidVocabularyReferences(parsed.data, allowedVocabularyIds)) {
                invalidCount += 1;
                continue;
            }
            candidates.push(parsed.data);
        }
        if (candidates.length === 0) {
            throw new AppError(
                "AI_OUTPUT_INVALID",
                "AI không trả về candidate câu hỏi hợp lệ",
                502,
            );
        }
        return { candidates, invalidCount, generatedCount: output.length };
    }

    private hasValidVocabularyReferences(
        candidate: QuestionVocabularyReferences,
        allowedVocabularyIds: Set<string>,
    ): boolean {
        const references = new Set<string>();
        if (candidate.vocabularyId) references.add(candidate.vocabularyId);
        for (const vocabularyId of candidate.vocabularyIds ?? []) references.add(vocabularyId);
        for (const pair of candidate.matchingPairs ?? []) {
            if (pair.vocabularyId) references.add(pair.vocabularyId);
        }
        return references.size > 0
            && Array.from(references).every((id) => allowedVocabularyIds.has(id));
    }

    private readSnapshotStringArray(value: unknown): string[] {
        if (!Array.isArray(value)
            || value.some((item) => typeof item !== "string" || !isValidObjectId(item))) {
            throw new AppError(
                "AI_GENERATION_DATA_INVALID",
                "Snapshot từ vựng của AI generation không hợp lệ",
                500,
            );
        }
        return value;
    }

    private uniqueVocabularyCandidates(
        candidates: GeneratedVocabularyCandidate[],
        existingWords: Set<string>,
    ): GeneratedVocabularyCandidate[] {
        const seen = new Set<string>();
        return candidates.flatMap((candidate) => {
            const normalizedCandidate = this.normalizeVocabularyCandidate(candidate);
            const key = normalizedCandidate.word;
            if (existingWords.has(key) || seen.has(key)) return [];
            seen.add(key);
            return [normalizedCandidate];
        });
    }

    private normalizeVocabularyCandidate(
        candidate: GeneratedVocabularyCandidate,
    ): GeneratedVocabularyCandidate {
        return {
            word: normalizeVocabularyWord(candidate.word),
            meaning: normalizeUnicodeSpacing(candidate.meaning),
            ...(candidate.phonetic && {
                phonetic: normalizeUnicodeSpacing(candidate.phonetic),
            }),
            ...(candidate.partOfSpeech && {
                partOfSpeech: normalizeUnicodeSpacing(candidate.partOfSpeech),
            }),
            ...(candidate.example && {
                example: normalizeUnicodeSpacing(candidate.example),
            }),
            ...(candidate.exampleMeaning && {
                exampleMeaning: normalizeUnicodeSpacing(candidate.exampleMeaning),
            }),
        };
    }

    private normalizeCommitItem(item: CommitVocabularyItem): {
        candidateKey: string;
        word: string;
        normalizedWord: string;
        meaning: string;
        phonetic?: string;
        partOfSpeech?: string;
        example?: string;
        exampleMeaning?: string;
    } {
        const normalized = this.normalizeVocabularyCandidate(item);
        return {
            candidateKey: item.candidateKey,
            ...normalized,
            normalizedWord: normalizeVocabularyWord(normalized.word),
        };
    }

    private assertObjectId(value: string, code: string, message: string): void {
        if (!isValidObjectId(value)) throw new AppError(code, message, 400);
    }

    private assertQuantity(quantity: number, max: number): void {
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) {
            throw new AppError("VALIDATION_ERROR", `Số lượng phải từ 1 đến ${max}`, 400);
        }
    }

    private toPublicError(error: unknown): AppError {
        if (error instanceof AppError) {
            const safeMessages: Record<string, string> = {
                AI_PROVIDER_NOT_CONFIGURED: "AI provider chưa được cấu hình API key",
                AI_PROVIDER_TIMEOUT: "AI provider phản hồi quá thời gian cho phép",
                AI_PROVIDER_ERROR: "Không thể kết nối AI provider",
                AI_PROVIDER_INVALID_RESPONSE: "AI provider trả về dữ liệu không hợp lệ",
                AI_OUTPUT_INVALID: "AI output không đúng schema",
                AI_GENERATION_CANCELED: "Yêu cầu tạo nội dung AI đã bị hủy",
                DUPLICATE_VOCABULARIES: "Tất cả từ vựng AI trả về đã tồn tại trong chủ đề",
                DUPLICATE_QUESTIONS: "Tất cả câu hỏi AI trả về đã tồn tại",
                AI_VOCABULARY_REFERENCE_INVALID: "AI tham chiếu từ vựng không hợp lệ",
                AI_GENERATION_STATE_CONFLICT: "AI generation đang ở trạng thái không hợp lệ",
            };
            const safeMessage = safeMessages[error.code];
            return safeMessage
                ? new AppError(error.code, safeMessage, error.statusCode)
                : new AppError("AI_GENERATION_FAILED", "AI generation thất bại", 502);
        }
        return new AppError("AI_GENERATION_FAILED", "AI generation thất bại", 502);
    }
}

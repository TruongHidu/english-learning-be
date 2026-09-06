import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";

import { GeminiContentGenerator } from "../src/ai/providers/gemini-content-generator.js";
import {
    commitVocabularyItemsSchema,
    generatedFillBlankSchema,
    generatedMatchingSchema,
    generatedMultipleChoiceSchema,
    generatedOrderSentenceSchema,
    generatedQuestionCandidatesSchema,
    generatedTranslationSchema,
    generatedVocabularyCandidatesSchema,
} from "../src/ai/schemas/generated-content.schema.js";
import { AppError } from "../src/errors/app-error.js";
import { authorize } from "../src/middlewares/authorize.middleware.js";
import type { AIGenerationDocument } from "../src/models/ai-generation.model.js";
import { QuestionModel, type QuestionDocument } from "../src/models/question.model.js";
import type { LessonDocument } from "../src/models/lesson.model.js";
import type { TopicDocument } from "../src/models/topic.model.js";
import { VocabularyModel, type VocabularyDocument } from "../src/models/vocabulary.model.js";
import type { IAIGenerationRepository } from "../src/repositories/interfaces/ai-generation.repository.interface.js";
import type {
    CommitAiVocabularyGenerationData,
    CommitAiVocabularyGenerationResult,
    IAiVocabularyCommitRepository,
} from "../src/repositories/interfaces/ai-vocabulary-commit.repository.interface.js";
import type { ICourseRepository } from "../src/repositories/interfaces/course.repository.interface.js";
import type { ILessonQuestionRepository } from "../src/repositories/interfaces/lesson-question.repository.interface.js";
import type { ILessonRepository } from "../src/repositories/interfaces/lesson.repository.interface.js";
import type {
    IQuestionRepository,
} from "../src/repositories/interfaces/question.repository.interface.js";
import type {
    CommitAiQuestionGenerationData,
    CommitAiQuestionGenerationResult,
    IAiQuestionCommitRepository,
} from "../src/repositories/interfaces/ai-question-commit.repository.interface.js";
import type { ISectionRepository } from "../src/repositories/interfaces/section.repository.interface.js";
import type { ITopicRepository } from "../src/repositories/interfaces/topic.repository.interface.js";
import type { IVocabularyRepository } from "../src/repositories/interfaces/vocabulary.repository.interface.js";
import { AiGenerationService } from "../src/services/ai-generation.service.js";
import type { AIGenerationResultData } from "../src/types/ai-generation.types.js";
import { normalizeVocabularyWord } from "../src/utils/vocabulary-normalization.utils.js";
import { buildQuestionDedupeKey } from "../src/utils/question-normalization.utils.js";
import {
    generateQuestionPreviewSchema,
    generateVocabularyPreviewSchema,
} from "../src/validators/admin-ai.validator.js";
import { FakeAiContentGenerator } from "./fakes/fake-ai-content-generator.js";

const ADMIN_ID = "64f000000000000000000001";
const TOPIC_ID = new Types.ObjectId("64f000000000000000000002");
const VOCAB_ID = new Types.ObjectId("64f000000000000000000003");
const SECTION_ID = new Types.ObjectId("64f000000000000000000004");
const COURSE_ID = "64f000000000000000000005";
const LESSON_ID = new Types.ObjectId("64f000000000000000000006");
const OTHER_TOPIC_ID = new Types.ObjectId("64f000000000000000000007");

const asDocument = <T>(value: object): T => value as T;

const validVocabulary = {
    word: "harbor",
    meaning: "bến cảng",
    phonetic: "/ˈhɑːr.bər/",
    partOfSpeech: "noun",
    example: "The ship entered the harbor.",
    exampleMeaning: "Con tàu đi vào bến cảng.",
};

const validMultipleChoice = {
    type: "MULTIPLE_CHOICE",
    vocabularyId: VOCAB_ID.toString(),
    content: "What does harbor mean?",
    instruction: "Choose one",
    correctAnswer: "bến cảng",
    options: [
        { content: "bến cảng", isCorrect: true, orderIndex: 0 },
        { content: "sân bay", isCorrect: false, orderIndex: 1 },
    ],
    explanation: "Harbor means bến cảng.",
    difficulty: "EASY",
};

const validTranslation = {
    type: "TRANSLATION",
    vocabularyId: VOCAB_ID.toString(),
    vocabularyIds: [VOCAB_ID.toString()],
    content: "The ship entered the harbor.",
    instruction: "Dịch câu sau sang tiếng Việt.",
    correctAnswer: "Con tàu đã đi vào bến cảng.",
    explanation: "Harbor có nghĩa là bến cảng.",
    difficulty: "EASY",
};

const topic = asDocument<TopicDocument>({
    _id: TOPIC_ID,
    sectionId: SECTION_ID,
    name: "Travel",
});

const makeVocabularyDocument = (
    word: string,
    options: {
        id?: Types.ObjectId;
        topicId?: Types.ObjectId;
        generationId?: string;
        createdByAi?: boolean;
        status?: "DRAFT" | "PUBLISHED" | "INACTIVE";
    } = {},
): VocabularyDocument => asDocument<VocabularyDocument>({
    _id: options.id ?? new Types.ObjectId(),
    topicId: options.topicId ?? TOPIC_ID,
    word: normalizeVocabularyWord(word),
    normalizedWord: normalizeVocabularyWord(word),
    meaning: word === "apple" ? "quả táo" : validVocabulary.meaning,
    phonetic: validVocabulary.phonetic,
    partOfSpeech: validVocabulary.partOfSpeech,
    example: validVocabulary.example,
    exampleMeaning: validVocabulary.exampleMeaning,
    difficulty: "MEDIUM",
    status: options.status ?? "DRAFT",
    createdByAi: options.createdByAi ?? false,
    ...(options.generationId && { aiGenerationId: new Types.ObjectId(options.generationId) }),
    createdAt: new Date(),
    updatedAt: new Date(),
});

const makeQuestionDocument = (
    content: string,
    type: "MULTIPLE_CHOICE" = "MULTIPLE_CHOICE",
): QuestionDocument => asDocument<QuestionDocument>({
    _id: new Types.ObjectId(),
    topicId: TOPIC_ID,
    vocabularyId: VOCAB_ID,
    vocabularyIds: [VOCAB_ID],
    type,
    content,
    correctAnswer: "bến cảng",
    options: validMultipleChoice.options,
    difficulty: "EASY",
    status: "DRAFT",
    createdByAi: false,
    dedupeKey: buildQuestionDedupeKey(TOPIC_ID.toString(), type, content),
    createdAt: new Date(),
    updatedAt: new Date(),
});

class InMemoryAIGenerationRepository implements IAIGenerationRepository {
    generation: AIGenerationDocument | null = null;

    async create(data: Parameters<IAIGenerationRepository["create"]>[0]): Promise<AIGenerationDocument> {
        this.generation = asDocument<AIGenerationDocument>({
            _id: new Types.ObjectId(),
            adminId: new Types.ObjectId(data.adminId),
            topicId: new Types.ObjectId(data.topicId),
            ...(data.lessonId && { lessonId: new Types.ObjectId(data.lessonId) }),
            generationType: data.generationType,
            status: "PENDING",
            provider: data.provider,
            modelName: data.modelName,
            promptVersion: data.promptVersion,
            requestedCount: data.requestedCount,
            generatedCount: 0,
            acceptedCount: 0,
            inputSnapshot: data.inputSnapshot,
            candidates: [],
            result: [],
            resultIds: [],
            createdAt: new Date(),
        });
        return this.generation;
    }

    async markProcessing(): Promise<AIGenerationDocument | null> {
        if (!this.generation || this.generation.status !== "PENDING") return null;
        this.generation.status = "PROCESSING";
        this.generation.startedAt = new Date();
        return this.generation;
    }

    async markCompleted(
        _id: string,
        _adminId: string,
        data: AIGenerationResultData,
    ): Promise<AIGenerationDocument | null> {
        if (!this.generation || this.generation.status !== "PROCESSING") return null;
        Object.assign(this.generation, data, {
            resultIds: data.resultIds.map((id) => new Types.ObjectId(id)),
            completedAt: new Date(),
        });
        return this.generation;
    }

    async markFailed(
        _id: string,
        _adminId: string,
        errorCode: string,
        errorMessage: string,
    ): Promise<AIGenerationDocument | null> {
        if (!this.generation || !["PENDING", "PROCESSING"].includes(this.generation.status)) {
            return null;
        }
        this.generation.status = "FAILED";
        this.generation.errorCode = errorCode;
        this.generation.errorMessage = errorMessage;
        this.generation.completedAt = new Date();
        return this.generation;
    }

    async markCanceled(
        _id: string,
        _adminId: string,
        errorCode: string,
        errorMessage: string,
    ): Promise<AIGenerationDocument | null> {
        if (!this.generation || !["PENDING", "PROCESSING"].includes(this.generation.status)) {
            return null;
        }
        this.generation.status = "CANCELED";
        this.generation.errorCode = errorCode;
        this.generation.errorMessage = errorMessage;
        this.generation.completedAt = new Date();
        return this.generation;
    }

    async findByIdForAdmin(id: string, adminId: string): Promise<AIGenerationDocument | null> {
        if (
            !this.generation
            || this.generation._id.toString() !== id
            || this.generation.adminId.toString() !== adminId
        ) {
            return null;
        }
        return this.generation;
    }

    async listForAdmin(): Promise<{ generations: AIGenerationDocument[]; total: number }> {
        return {
            generations: this.generation ? [this.generation] : [],
            total: this.generation ? 1 : 0,
        };
    }
}

class InMemoryVocabularyRepository {
    readonly documents: VocabularyDocument[];
    createCalls = 0;

    constructor(seed: VocabularyDocument[] = []) {
        this.documents = [...seed];
    }

    async findWordsByTopicId(): Promise<Array<{ id: string; word: string; normalizedWord?: string }>> {
        return this.documents.map((item) => ({
            id: item._id.toString(),
            word: item.word,
            ...(item.normalizedWord && { normalizedWord: item.normalizedWord }),
        }));
    }

    async findByTopicId(): Promise<{ vocabularies: VocabularyDocument[]; total: number }> {
        return { vocabularies: [...this.documents], total: this.documents.length };
    }

    async findByIds(ids: string[]): Promise<VocabularyDocument[]> {
        const requested = new Set(ids);
        return this.documents.filter((item) => requested.has(item._id.toString()));
    }

    async create(): Promise<VocabularyDocument> {
        this.createCalls += 1;
        throw new Error("Generate preview must not create Vocabulary");
    }
}

class InMemoryAiVocabularyCommitRepository implements IAiVocabularyCommitRepository {
    failAfterInsert = false;
    private tail: Promise<void> = Promise.resolve();

    constructor(
        private readonly generationRepository: InMemoryAIGenerationRepository,
        private readonly vocabularyRepository: InMemoryVocabularyRepository,
    ) {}

    async commit(
        data: CommitAiVocabularyGenerationData,
    ): Promise<CommitAiVocabularyGenerationResult> {
        const previous = this.tail;
        let release = (): void => undefined;
        this.tail = new Promise<void>((resolve) => {
            release = resolve;
        });
        await previous;

        try {
            const generation = this.generationRepository.generation;
            if (
                !generation
                || generation._id.toString() !== data.generationId
                || generation.adminId.toString() !== data.adminId
                || generation.topicId.toString() !== data.topicId
            ) {
                throw new AppError("AI_GENERATION_NOT_FOUND", "Không tìm thấy AI generation", 404);
            }

            if (generation.status === "COMMITTED") {
                const resultIds = new Set(generation.resultIds.map((id) => id.toString()));
                return {
                    vocabularies: this.vocabularyRepository.documents.filter((item) =>
                        resultIds.has(item._id.toString()),
                    ),
                    alreadyCommitted: true,
                };
            }
            if (!["COMPLETED", "PARTIAL"].includes(generation.status)) {
                throw new AppError(
                    "AI_GENERATION_STATE_CONFLICT",
                    "AI generation không thể commit",
                    409,
                );
            }

            const initialLength = this.vocabularyRepository.documents.length;
            const originalStatus = generation.status;
            const originalAcceptedCount = generation.acceptedCount;
            const originalResult = generation.result;
            const originalResultIds = generation.resultIds;
            generation.status = "COMMITTING";

            try {
                const existingWords = new Set(
                    this.vocabularyRepository.documents.map((item) =>
                        item.normalizedWord ?? normalizeVocabularyWord(item.word),
                    ),
                );
                if (data.items.some((item) => existingWords.has(item.normalizedWord))) {
                    throw new AppError(
                        "VOCABULARY_ALREADY_EXISTS",
                        "Từ vựng đã tồn tại",
                        409,
                    );
                }

                const created = data.items.map((item) => makeVocabularyDocument(item.word, {
                    generationId: data.generationId,
                    createdByAi: true,
                }));
                created.forEach((item, index) => {
                    const source = data.items[index]!;
                    item.meaning = source.meaning;
                    item.phonetic = source.phonetic;
                    item.partOfSpeech = source.partOfSpeech;
                    item.example = source.example;
                    item.exampleMeaning = source.exampleMeaning;
                    item.difficulty = data.difficulty;
                });
                this.vocabularyRepository.documents.push(...created);

                if (this.failAfterInsert) {
                    throw new AppError(
                        "SIMULATED_COMMIT_FAILURE",
                        "Lỗi mô phỏng sau insert",
                        500,
                    );
                }

                generation.status = "COMMITTED";
                generation.acceptedCount = created.length;
                generation.result = data.items;
                generation.resultIds = created.map((item) => item._id);
                generation.completedAt = new Date();
                return { vocabularies: created, alreadyCommitted: false };
            } catch (error: unknown) {
                this.vocabularyRepository.documents.splice(initialLength);
                generation.status = originalStatus;
                generation.acceptedCount = originalAcceptedCount;
                generation.result = originalResult;
                generation.resultIds = originalResultIds;
                throw error;
            }
        } finally {
            release();
        }
    }
}

class InMemoryQuestionRepository {
    readonly documents: QuestionDocument[] = [];
    createCalls = 0;

    async findDedupeRecordsByTopic(): Promise<Array<{ id: string; type: string; content: string; dedupeKey?: string }>> {
        return this.documents.map((question) => ({
            id: question._id.toString(),
            type: question.type,
            content: question.content,
            ...(question.dedupeKey && { dedupeKey: question.dedupeKey }),
        }));
    }

    async findByIds(ids: string[]): Promise<QuestionDocument[]> {
        const requested = new Set(ids);
        return this.documents.filter((question) => requested.has(question._id.toString()));
    }

    async create(): Promise<QuestionDocument> {
        this.createCalls += 1;
        throw new Error("Generate preview must not create Question");
    }
}

class InMemoryAiQuestionCommitRepository implements IAiQuestionCommitRepository {
    failAfterInsert = false;
    private tail: Promise<void> = Promise.resolve();

    constructor(
        private readonly generationRepository: InMemoryAIGenerationRepository,
        private readonly questionRepository: InMemoryQuestionRepository,
    ) {}

    async commit(
        data: CommitAiQuestionGenerationData,
    ): Promise<CommitAiQuestionGenerationResult> {
        const previous = this.tail;
        let release = (): void => undefined;
        this.tail = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        try {
            const generation = this.generationRepository.generation;
            if (!generation || generation.adminId.toString() !== data.adminId) {
                throw new AppError("AI_GENERATION_NOT_FOUND", "Không tìm thấy generation", 404);
            }
            if (generation.status === "COMMITTED") {
                const ids = new Set(generation.resultIds.map((id) => id.toString()));
                return {
                    questions: this.questionRepository.documents.filter((question) =>
                        ids.has(question._id.toString())),
                    alreadyCommitted: true,
                };
            }
            if (!["COMPLETED", "PARTIAL"].includes(generation.status)) {
                throw new AppError("AI_GENERATION_STATE_CONFLICT", "Không thể commit", 409);
            }

            const initialLength = this.questionRepository.documents.length;
            const originalStatus = generation.status;
            generation.status = "COMMITTING";
            try {
                const existingKeys = new Set(this.questionRepository.documents.map((question) =>
                    question.dedupeKey
                    ?? buildQuestionDedupeKey(data.topicId, question.type, question.content),
                ));
                if (data.items.some((item) => existingKeys.has(item.dedupeKey))) {
                    throw new AppError("QUESTION_ALREADY_EXISTS", "Câu hỏi đã tồn tại", 409);
                }
                const created = data.items.map(({ candidate, dedupeKey }) => {
                    const vocabularyIds = Array.from(new Set([
                        ...(candidate.vocabularyId ? [candidate.vocabularyId] : []),
                        ...(candidate.vocabularyIds ?? []),
                        ...(candidate.type === "MATCHING"
                            ? candidate.matchingPairs.flatMap((pair) =>
                                pair.vocabularyId ? [pair.vocabularyId] : [])
                            : []),
                    ]));
                    return asDocument<QuestionDocument>({
                        _id: new Types.ObjectId(),
                        topicId: new Types.ObjectId(data.topicId),
                        vocabularyId: vocabularyIds[0] ? new Types.ObjectId(vocabularyIds[0]) : undefined,
                        vocabularyIds: vocabularyIds.map((id) => new Types.ObjectId(id)),
                        type: candidate.type,
                        content: candidate.content,
                        instruction: candidate.instruction,
                        ...("correctAnswer" in candidate && { correctAnswer: candidate.correctAnswer }),
                        ...( "options" in candidate && { options: candidate.options }),
                        ...( "matchingPairs" in candidate && { matchingPairs: candidate.matchingPairs }),
                        explanation: candidate.explanation,
                        difficulty: candidate.difficulty,
                        status: "DRAFT",
                        createdByAi: true,
                        aiGenerationId: new Types.ObjectId(data.generationId),
                        dedupeKey,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        populated: () => undefined,
                    });
                });
                this.questionRepository.documents.push(...created);
                if (this.failAfterInsert) {
                    throw new AppError("SIMULATED_QUESTION_COMMIT_FAILURE", "Lỗi mô phỏng", 500);
                }
                generation.status = "COMMITTED";
                generation.acceptedCount = created.length;
                generation.result = data.items.map((item) => item.candidate);
                generation.resultIds = created.map((question) => question._id);
                return { questions: created, alreadyCommitted: false };
            } catch (error: unknown) {
                this.questionRepository.documents.splice(initialLength);
                generation.status = originalStatus;
                throw error;
            }
        } finally {
            release();
        }
    }
}

interface HarnessOptions {
    seedVocabularies?: VocabularyDocument[];
    courseLevel?: string;
    topicFound?: boolean;
    lessonFound?: boolean;
    lessonTopicId?: Types.ObjectId;
    questionRepository?: IQuestionRepository;
    lessonQuestionRepository?: ILessonQuestionRepository;
    questionCommitRepository?: IAiQuestionCommitRepository;
}

const makeHarness = (
    generator: FakeAiContentGenerator,
    options: HarnessOptions = {},
) => {
    const generationRepository = new InMemoryAIGenerationRepository();
    const vocabularyRepository = new InMemoryVocabularyRepository(options.seedVocabularies);
    const commitRepository = new InMemoryAiVocabularyCommitRepository(
        generationRepository,
        vocabularyRepository,
    );
    const questionRepository = options.questionRepository
        ?? new InMemoryQuestionRepository() as unknown as IQuestionRepository;
    const inMemoryQuestionRepository = questionRepository instanceof InMemoryQuestionRepository
        ? questionRepository
        : new InMemoryQuestionRepository();
    const defaultQuestionCommitRepository = new InMemoryAiQuestionCommitRepository(
        generationRepository,
        inMemoryQuestionRepository,
    );
    const questionCommitRepository = options.questionCommitRepository
        ?? defaultQuestionCommitRepository;
    const topicRepository = {
        findById: async () => options.topicFound === false ? null : topic,
    } as unknown as ITopicRepository;
    const sectionRepository = {
        findById: async () => ({
            id: SECTION_ID.toString(),
            courseId: COURSE_ID,
            name: "Section 1",
            orderIndex: 1,
            status: "DRAFT",
            createdAt: new Date(),
            updatedAt: new Date(),
        }),
    } as unknown as ISectionRepository;
    const courseRepository = {
        findById: async () => ({
            id: COURSE_ID,
            name: "English B1",
            level: options.courseLevel ?? "B1",
            status: "DRAFT",
            orderIndex: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        }),
    } as unknown as ICourseRepository;

    const service = new AiGenerationService(
        generator,
        generationRepository,
        topicRepository,
        sectionRepository,
        courseRepository,
        {
            findById: async () => options.lessonFound === false
                ? null
                : asDocument<LessonDocument>({
                    _id: LESSON_ID,
                    topicId: options.lessonTopicId ?? TOPIC_ID,
                    name: "Lesson context",
                    orderIndex: 0,
                    requiredScore: 70,
                    questionCount: 0,
                    xpReward: 0,
                    diamondReward: 0,
                    status: "DRAFT",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
        } as unknown as ILessonRepository,
        vocabularyRepository as unknown as IVocabularyRepository,
        commitRepository,
        questionCommitRepository,
        questionRepository,
        options.lessonQuestionRepository ?? ({} as ILessonQuestionRepository),
        {
            provider: "fake",
            modelName: "fake-model",
            promptVersion: "test-v1",
            maxVocabularies: 50,
            maxQuestions: 50,
        },
    );

    return {
        service,
        generationRepository,
        vocabularyRepository,
        commitRepository,
        questionRepository: inMemoryQuestionRepository,
        questionCommitRepository,
        defaultQuestionCommitRepository,
    };
};

const generatePreview = (harness: ReturnType<typeof makeHarness>, count = 1) =>
    harness.service.generateVocabularyPreview(ADMIN_ID, TOPIC_ID.toString(), {
        count,
        requirements: "  Ưu tiên từ thông dụng trong giao tiếp  ",
    });

const generateQuestionPreview = (
    harness: ReturnType<typeof makeHarness>,
    questions: unknown = undefined,
) => {
    void questions;
    return harness.service.generateQuestionPreview(
        ADMIN_ID,
        TOPIC_ID.toString(),
        {
            vocabularyIds: [VOCAB_ID.toString()],
            questionTypes: ["MULTIPLE_CHOICE"],
            count: 1,
            difficulty: "EASY",
        },
    );
};

test("generate returns valid preview candidates and never inserts Vocabulary", async () => {
    const generator = new FakeAiContentGenerator({ vocabularies: [validVocabulary] });
    const harness = makeHarness(generator, { courseLevel: "B2" });
    const countBefore = harness.vocabularyRepository.documents.length;

    const result = await generatePreview(harness);

    assert.equal(harness.vocabularyRepository.documents.length, countBefore);
    assert.equal(harness.vocabularyRepository.createCalls, 0);
    assert.equal(result.generatedCount, 1);
    assert.equal(result.candidates[0]?.candidateKey, "v1");
    assert.equal(harness.generationRepository.generation?.status, "COMPLETED");
    assert.equal(harness.generationRepository.generation?.acceptedCount, 0);
    assert.equal(generator.lastVocabularyInput?.level, "B2");
    assert.equal(generator.lastVocabularyInput?.requirements, "Ưu tiên từ thông dụng trong giao tiếp");
});

test("deprecated generate endpoint service delegates to preview and ignores client level", async () => {
    const generator = new FakeAiContentGenerator({ vocabularies: [validVocabulary] });
    const harness = makeHarness(generator, { courseLevel: "A2" });

    const result = await harness.service.generateVocabularies(ADMIN_ID, {
        topicId: TOPIC_ID.toString(),
        level: "C2",
        quantity: 1,
    });

    assert.equal(result.generatedCount, 1);
    assert.equal(generator.lastVocabularyInput?.level, "A2");
    assert.equal(harness.vocabularyRepository.documents.length, 0);
});

test("invalid AI output marks generation FAILED and creates no Vocabulary", async () => {
    const harness = makeHarness(new FakeAiContentGenerator({ vocabularies: "not-json" }));
    await assert.rejects(
        generatePreview(harness),
        (error: unknown) => error instanceof AppError && error.code === "AI_OUTPUT_INVALID",
    );
    assert.equal(harness.generationRepository.generation?.status, "FAILED");
    assert.equal(harness.vocabularyRepository.documents.length, 0);
});

test("strict schemas reject missing and unknown output fields", () => {
    assert.equal(generatedVocabularyCandidatesSchema.safeParse([{ word: "only-word" }]).success, false);
    assert.equal(
        generatedVocabularyCandidatesSchema.safeParse([{ ...validVocabulary, unexpected: true }]).success,
        false,
    );
    assert.equal(
        generatedQuestionCandidatesSchema.safeParse([{ ...validMultipleChoice, unexpected: true }]).success,
        false,
    );
});

test("generate request defaults count to 10 and enforces path-owned topic input", () => {
    assert.equal(generateVocabularyPreviewSchema.parse({}).count, 10);
    assert.equal(generateVocabularyPreviewSchema.safeParse({ count: 0 }).success, false);
    assert.equal(generateVocabularyPreviewSchema.safeParse({ count: 21 }).success, false);
    assert.equal(
        generateVocabularyPreviewSchema.safeParse({ count: 10, topicId: TOPIC_ID.toString() }).success,
        false,
    );
});

test("generate deduplicates Unicode/case/spacing inside one provider output", async () => {
    const harness = makeHarness(new FakeAiContentGenerator({
        vocabularies: [
            { ...validVocabulary, word: " Apple " },
            { ...validVocabulary, word: "ＡＰＰＬＥ", meaning: "quả táo" },
        ],
    }));

    const result = await generatePreview(harness, 2);

    assert.equal(result.generatedCount, 1);
    assert.equal(result.candidates[0]?.word, "apple");
    assert.equal(harness.generationRepository.generation?.status, "PARTIAL");
});

test("generate excludes words already stored in the Topic", async () => {
    const existing = makeVocabularyDocument("apple");
    const harness = makeHarness(
        new FakeAiContentGenerator({
            vocabularies: [
                { ...validVocabulary, word: "ＡＰＰＬＥ", meaning: "quả táo" },
                validVocabulary,
            ],
        }),
        { seedVocabularies: [existing] },
    );

    const result = await generatePreview(harness, 2);

    assert.deepEqual(result.candidates.map((item) => item.word), ["harbor"]);
    assert.equal(harness.vocabularyRepository.documents.length, 1);
});

test("commit saves selected and edited candidate as AI-created DRAFT", async () => {
    const harness = makeHarness(new FakeAiContentGenerator({ vocabularies: [validVocabulary] }));
    const preview = await generatePreview(harness);
    const result = await harness.service.commitVocabularyGeneration(
        ADMIN_ID,
        preview.generationId,
        {
            items: [{
                ...preview.candidates[0]!,
                word: " Port ",
                meaning: " cảng ",
            }],
        },
    );

    assert.equal(result.committedCount, 1);
    assert.equal(result.alreadyCommitted, false);
    assert.equal(result.vocabularies[0]?.word, "port");
    assert.equal(result.vocabularies[0]?.status, "DRAFT");
    assert.equal(result.vocabularies[0]?.createdByAi, true);
    assert.equal(result.vocabularies[0]?.aiGenerationId, preview.generationId);
    assert.equal(harness.generationRepository.generation?.status, "COMMITTED");
});

test("commit rejects candidateKey that is not part of the generation", async () => {
    const harness = makeHarness(new FakeAiContentGenerator({ vocabularies: [validVocabulary] }));
    const preview = await generatePreview(harness);

    await assert.rejects(
        harness.service.commitVocabularyGeneration(ADMIN_ID, preview.generationId, {
            items: [{ ...preview.candidates[0]!, candidateKey: "v999" }],
        }),
        (error: unknown) => error instanceof AppError && error.code === "AI_CANDIDATE_NOT_FOUND",
    );
    assert.equal(harness.vocabularyRepository.documents.length, 0);
});

test("commit schema rejects protected fields supplied by the client", () => {
    assert.equal(commitVocabularyItemsSchema.safeParse([{
        candidateKey: "v1",
        ...validVocabulary,
        status: "PUBLISHED",
    }]).success, false);
});

test("Vocabulary schema declares a partial unique normalizedWord index per Topic", () => {
    const index = VocabularyModel.schema.indexes().find(([fields]) =>
        fields.topicId === 1 && fields.normalizedWord === 1,
    );
    assert.ok(index);
    assert.equal(index[1].unique, true);
    assert.deepEqual(index[1].partialFilterExpression, {
        normalizedWord: { $type: "string" },
    });
});

test("FAILED generation cannot be committed", async () => {
    const harness = makeHarness(new FakeAiContentGenerator({ vocabularies: [validVocabulary] }));
    const preview = await generatePreview(harness);
    harness.generationRepository.generation!.status = "FAILED";

    await assert.rejects(
        harness.service.commitVocabularyGeneration(ADMIN_ID, preview.generationId, {
            items: [preview.candidates[0]!],
        }),
        (error: unknown) => error instanceof AppError && error.code === "AI_GENERATION_NOT_COMMITTABLE",
    );
    assert.equal(harness.vocabularyRepository.documents.length, 0);
});

test("committing the same generation twice is idempotent", async () => {
    const harness = makeHarness(new FakeAiContentGenerator({ vocabularies: [validVocabulary] }));
    const preview = await generatePreview(harness);
    const input = { items: [preview.candidates[0]!] };

    const first = await harness.service.commitVocabularyGeneration(ADMIN_ID, preview.generationId, input);
    const second = await harness.service.commitVocabularyGeneration(ADMIN_ID, preview.generationId, input);

    assert.equal(first.alreadyCommitted, false);
    assert.equal(second.alreadyCommitted, true);
    assert.equal(harness.vocabularyRepository.documents.length, 1);
    assert.equal(second.vocabularies[0]?.id, first.vocabularies[0]?.id);
});

test("two concurrent commits create only one Vocabulary", async () => {
    const harness = makeHarness(new FakeAiContentGenerator({ vocabularies: [validVocabulary] }));
    const preview = await generatePreview(harness);
    const input = { items: [preview.candidates[0]!] };

    const results = await Promise.all([
        harness.service.commitVocabularyGeneration(ADMIN_ID, preview.generationId, input),
        harness.service.commitVocabularyGeneration(ADMIN_ID, preview.generationId, input),
    ]);

    assert.equal(harness.vocabularyRepository.documents.length, 1);
    assert.deepEqual(results.map((item) => item.alreadyCommitted).sort(), [false, true]);
});

test("transaction rollback removes staged Vocabulary and restores generation status", async () => {
    const harness = makeHarness(new FakeAiContentGenerator({ vocabularies: [validVocabulary] }));
    const preview = await generatePreview(harness);
    harness.commitRepository.failAfterInsert = true;

    await assert.rejects(
        harness.service.commitVocabularyGeneration(ADMIN_ID, preview.generationId, {
            items: [preview.candidates[0]!],
        }),
        (error: unknown) => error instanceof AppError && error.code === "SIMULATED_COMMIT_FAILURE",
    );

    assert.equal(harness.vocabularyRepository.documents.length, 0);
    assert.equal(harness.generationRepository.generation?.status, "COMPLETED");
    assert.equal(harness.generationRepository.generation?.resultIds.length, 0);
});

test("commit rechecks database duplicates after admin edits a candidate", async () => {
    const existing = makeVocabularyDocument("apple");
    const harness = makeHarness(
        new FakeAiContentGenerator({ vocabularies: [validVocabulary] }),
        { seedVocabularies: [existing] },
    );
    const preview = await generatePreview(harness);

    await assert.rejects(
        harness.service.commitVocabularyGeneration(ADMIN_ID, preview.generationId, {
            items: [{ ...preview.candidates[0]!, word: "ＡＰＰＬＥ", meaning: "quả táo" }],
        }),
        (error: unknown) => error instanceof AppError && error.code === "VOCABULARY_ALREADY_EXISTS",
    );
    assert.equal(harness.vocabularyRepository.documents.length, 1);
});

test("question generation returns preview candidates and does not insert Question or assign Lesson", async () => {
    const vocabulary = makeVocabularyDocument("harbor", { id: VOCAB_ID });
    const lessonQuestionRepository = {
        createMany: async () => {
            throw new Error("Lesson assignment must not be called");
        },
        deleteByQuestionId: async () => undefined,
    } as unknown as ILessonQuestionRepository;
    const harness = makeHarness(
        new FakeAiContentGenerator({ questions: [validMultipleChoice] }),
        {
            seedVocabularies: [vocabulary],
            lessonQuestionRepository,
        },
    );

    const result = await harness.service.generateQuestionPreview(
        ADMIN_ID,
        TOPIC_ID.toString(),
        {
        vocabularyIds: [VOCAB_ID.toString()],
        questionTypes: ["MULTIPLE_CHOICE"],
        count: 1,
        difficulty: "EASY",
        },
    );

    assert.equal(result.acceptedCount, 1);
    assert.equal(result.candidates[0]?.candidateKey, "q1");
    assert.equal(harness.questionRepository.documents.length, 0);
    assert.equal(harness.questionRepository.createCalls, 0);
    assert.equal(harness.generationRepository.generation?.resultIds.length, 0);
});

test("question generation rejects a missing Topic before creating AIGeneration", async () => {
    const generator = new FakeAiContentGenerator({ questions: [validMultipleChoice] });
    const harness = makeHarness(generator, {
        topicFound: false,
        seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })],
    });

    await assert.rejects(
        generateQuestionPreview(harness),
        (error: unknown) => error instanceof AppError && error.code === "TOPIC_NOT_FOUND",
    );
    assert.equal(harness.generationRepository.generation, null);
    assert.equal(generator.questionCalls, 0);
});

test("question generation rejects a Lesson outside the Topic", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({ questions: [validMultipleChoice] }),
        {
            lessonTopicId: OTHER_TOPIC_ID,
            seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })],
        },
    );

    await assert.rejects(
        harness.service.generateQuestionPreview(ADMIN_ID, TOPIC_ID.toString(), {
            lessonId: LESSON_ID.toString(),
            vocabularyIds: [VOCAB_ID.toString()],
            questionTypes: ["MULTIPLE_CHOICE"],
            count: 1,
            difficulty: "EASY",
        }),
        (error: unknown) => error instanceof AppError && error.code === "LESSON_NOT_FOUND",
    );
    assert.equal(harness.generationRepository.generation, null);
});

test("question generation rejects missing and cross-Topic Vocabulary", async () => {
    const missingHarness = makeHarness(
        new FakeAiContentGenerator({ questions: [validMultipleChoice] }),
    );
    await assert.rejects(
        generateQuestionPreview(missingHarness),
        (error: unknown) => error instanceof AppError && error.code === "VOCABULARY_NOT_FOUND",
    );

    const crossTopicHarness = makeHarness(
        new FakeAiContentGenerator({ questions: [validMultipleChoice] }),
        {
            seedVocabularies: [makeVocabularyDocument("harbor", {
                id: VOCAB_ID,
                topicId: OTHER_TOPIC_ID,
            })],
        },
    );
    await assert.rejects(
        generateQuestionPreview(crossTopicHarness),
        (error: unknown) => error instanceof AppError && error.code === "VOCABULARY_NOT_FOUND",
    );
});

test("question generation rejects a non-array provider response and marks FAILED", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({ questions: { value: validMultipleChoice } }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );

    await assert.rejects(
        generateQuestionPreview(harness),
        (error: unknown) => error instanceof AppError && error.code === "AI_OUTPUT_INVALID",
    );
    assert.equal(harness.generationRepository.generation?.status, "FAILED");
});

test("question preview schema accepts canonical AI types including TRANSLATION", () => {
    const base = {
        questionTypes: ["FILL_BLANK"],
        count: 1,
        difficulty: "EASY",
    };
    assert.equal(generateQuestionPreviewSchema.safeParse(base).success, true);
    assert.equal(generateQuestionPreviewSchema.safeParse({
        ...base,
        questionTypes: ["FILL_IN_BLANK"],
    }).success, false);
    assert.equal(generateQuestionPreviewSchema.safeParse({
        ...base,
        questionTypes: ["TRANSLATION"],
    }).success, true);
});

test("question generation accepts a scoped TRANSLATION candidate", async () => {
    const generator = new FakeAiContentGenerator({ questions: [validTranslation] });
    const harness = makeHarness(
        generator,
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );

    const result = await harness.service.generateQuestionPreview(
        ADMIN_ID,
        TOPIC_ID.toString(),
        {
            vocabularyIds: [VOCAB_ID.toString()],
            questionTypes: ["TRANSLATION"],
            count: 1,
            difficulty: "EASY",
        },
    );

    assert.equal(result.status, "COMPLETED");
    assert.equal(result.acceptedCount, 1);
    assert.equal(result.candidates[0]?.type, "TRANSLATION");
    assert.equal(generator.lastQuestionInput?.questionTypes[0], "TRANSLATION");
});

test("deprecated question generation service accepts TRANSLATION", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({ questions: [validTranslation] }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );

    const result = await harness.service.generateQuestions(ADMIN_ID, {
        topicId: TOPIC_ID.toString(),
        vocabularyIds: [VOCAB_ID.toString()],
        questionTypes: ["TRANSLATION"],
        quantity: 1,
        difficulty: "EASY",
    });

    assert.equal(result.acceptedCount, 1);
    assert.equal(result.candidates[0]?.type, "TRANSLATION");
});

test("question generation rejects a TRANSLATION vocabulary outside the request scope", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({
            questions: [{ ...validTranslation, vocabularyId: new Types.ObjectId().toString() }],
        }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );

    await assert.rejects(
        harness.service.generateQuestionPreview(ADMIN_ID, TOPIC_ID.toString(), {
            vocabularyIds: [VOCAB_ID.toString()],
            questionTypes: ["TRANSLATION"],
            count: 1,
            difficulty: "EASY",
        }),
        (error: unknown) => error instanceof AppError && error.code === "AI_OUTPUT_INVALID",
    );
});

test("question generation keeps valid candidates and marks PARTIAL when another candidate is invalid", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({
            questions: [validMultipleChoice, { ...validMultipleChoice, unexpected: true }],
        }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );

    const result = await generateQuestionPreview(harness);

    assert.equal(result.status, "PARTIAL");
    assert.equal(result.generatedCount, 2);
    assert.equal(result.acceptedCount, 1);
    assert.equal(harness.generationRepository.generation?.status, "PARTIAL");
});

test("question generation marks FAILED when every candidate has an unknown field", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({
            questions: [{ ...validMultipleChoice, unexpected: "must be rejected" }],
        }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );

    await assert.rejects(
        generateQuestionPreview(harness),
        (error: unknown) => error instanceof AppError && error.code === "AI_OUTPUT_INVALID",
    );
    assert.equal(harness.generationRepository.generation?.status, "FAILED");
});

test("question generation deduplicates its output and existing database Questions", async () => {
    const outputHarness = makeHarness(
        new FakeAiContentGenerator({
            questions: [validMultipleChoice, { ...validMultipleChoice, content: "  What does harbor mean ?  " }],
        }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );
    const outputResult = await outputHarness.service.generateQuestionPreview(
        ADMIN_ID,
        TOPIC_ID.toString(),
        {
            vocabularyIds: [VOCAB_ID.toString()],
            questionTypes: ["MULTIPLE_CHOICE"],
            count: 2,
            difficulty: "EASY",
        },
    );
    assert.equal(outputResult.acceptedCount, 1);
    assert.equal(outputResult.status, "PARTIAL");

    const databaseHarness = makeHarness(
        new FakeAiContentGenerator({ questions: [validMultipleChoice] }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );
    databaseHarness.questionRepository.documents.push(
        makeQuestionDocument(validMultipleChoice.content),
    );
    await assert.rejects(
        generateQuestionPreview(databaseHarness),
        (error: unknown) => error instanceof AppError && error.code === "DUPLICATE_QUESTIONS",
    );
    assert.equal(databaseHarness.generationRepository.generation?.status, "FAILED");
});

test("question generation rejects a provider type outside the requested types", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({ questions: [validMultipleChoice] }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );
    await assert.rejects(
        harness.service.generateQuestionPreview(ADMIN_ID, TOPIC_ID.toString(), {
            vocabularyIds: [VOCAB_ID.toString()],
            questionTypes: ["FILL_BLANK"],
            count: 1,
            difficulty: "EASY",
        }),
        (error: unknown) => error instanceof AppError && error.code === "AI_OUTPUT_INVALID",
    );
});

test("question generation rejects provider vocabulary references outside the request scope", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({
            questions: [{ ...validMultipleChoice, vocabularyId: new Types.ObjectId().toString() }],
        }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );

    await assert.rejects(
        generateQuestionPreview(harness),
        (error: unknown) => error instanceof AppError && error.code === "AI_OUTPUT_INVALID",
    );
    assert.equal(harness.questionRepository.documents.length, 0);
    assert.equal(harness.generationRepository.generation?.status, "FAILED");
});

test("question commit creates selected AI Question as DRAFT without Lesson assignment", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({ questions: [validMultipleChoice] }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );
    const preview = await generateQuestionPreview(harness);

    const result = await harness.service.commitQuestionGeneration(
        ADMIN_ID,
        preview.generationId,
        { items: [preview.candidates[0]!] },
    );

    assert.equal(result.committedCount, 1);
    assert.equal(result.questions[0]?.status, "DRAFT");
    assert.equal(result.questions[0]?.createdByAi, true);
    assert.equal(result.questions[0]?.aiGenerationId, preview.generationId);
    assert.equal(harness.generationRepository.generation?.status, "COMMITTED");
});

test("question commit persists a TRANSLATION candidate as DRAFT", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({ questions: [validTranslation] }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );
    const preview = await harness.service.generateQuestionPreview(
        ADMIN_ID,
        TOPIC_ID.toString(),
        {
            vocabularyIds: [VOCAB_ID.toString()],
            questionTypes: ["TRANSLATION"],
            count: 1,
            difficulty: "EASY",
        },
    );

    const result = await harness.service.commitQuestionGeneration(
        ADMIN_ID,
        preview.generationId,
        { items: [preview.candidates[0]!] },
    );

    assert.equal(result.committedCount, 1);
    assert.equal(result.questions[0]?.type, "TRANSLATION");
    assert.equal(result.questions[0]?.correctAnswer, validTranslation.correctAnswer);
    assert.equal(result.questions[0]?.status, "DRAFT");
    assert.equal(result.questions[0]?.options, null);
    assert.equal(result.questions[0]?.matchingPairs, null);
});

test("question commit is idempotent and concurrent calls create one Question", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({ questions: [validMultipleChoice] }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );
    const preview = await generateQuestionPreview(harness);
    const input = { items: [preview.candidates[0]!] };

    const [first, second] = await Promise.all([
        harness.service.commitQuestionGeneration(ADMIN_ID, preview.generationId, input),
        harness.service.commitQuestionGeneration(ADMIN_ID, preview.generationId, input),
    ]);

    assert.equal(harness.questionRepository.documents.length, 1);
    assert.equal([first.alreadyCommitted, second.alreadyCommitted].filter(Boolean).length, 1);
});

test("question commit rejects unknown candidateKey and another admin", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({ questions: [validMultipleChoice] }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );
    const preview = await generateQuestionPreview(harness);
    await assert.rejects(
        harness.service.commitQuestionGeneration(ADMIN_ID, preview.generationId, {
            items: [{ ...preview.candidates[0]!, candidateKey: "q999" }],
        }),
        (error: unknown) => error instanceof AppError && error.code === "AI_CANDIDATE_NOT_FOUND",
    );
    await assert.rejects(
        harness.service.commitQuestionGeneration(
            new Types.ObjectId().toString(),
            preview.generationId,
            { items: [preview.candidates[0]!] },
        ),
        (error: unknown) => error instanceof AppError && error.code === "AI_GENERATION_NOT_FOUND",
    );
});

test("question commit rejects FAILED/CANCELED generations and invalid admin edits", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({ questions: [validMultipleChoice] }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );
    const preview = await generateQuestionPreview(harness);
    harness.generationRepository.generation!.status = "FAILED";
    await assert.rejects(
        harness.service.commitQuestionGeneration(ADMIN_ID, preview.generationId, {
            items: [preview.candidates[0]!],
        }),
        (error: unknown) => error instanceof AppError && error.code === "AI_GENERATION_NOT_COMMITTABLE",
    );
    harness.generationRepository.generation!.status = "CANCELED";
    await assert.rejects(
        harness.service.commitQuestionGeneration(ADMIN_ID, preview.generationId, {
            items: [preview.candidates[0]!],
        }),
        (error: unknown) => error instanceof AppError && error.code === "AI_GENERATION_NOT_COMMITTABLE",
    );
    harness.generationRepository.generation!.status = "COMPLETED";
    await assert.rejects(
        harness.service.commitQuestionGeneration(ADMIN_ID, preview.generationId, {
            items: [{ ...preview.candidates[0]!, content: "" }],
        }),
        (error: unknown) => error instanceof AppError && error.code === "VALIDATION_ERROR",
    );
});

test("question commit rejects edited Vocabulary scope and duplicate candidate keys", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({ questions: [validMultipleChoice] }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );
    const preview = await generateQuestionPreview(harness);
    await assert.rejects(
        harness.service.commitQuestionGeneration(ADMIN_ID, preview.generationId, {
            items: [{
                ...preview.candidates[0]!,
                vocabularyId: new Types.ObjectId().toString(),
            }],
        }),
        (error: unknown) => error instanceof AppError
            && error.code === "AI_VOCABULARY_REFERENCE_INVALID",
    );
    await assert.rejects(
        harness.service.commitQuestionGeneration(ADMIN_ID, preview.generationId, {
            items: [preview.candidates[0]!, preview.candidates[0]!],
        }),
        (error: unknown) => error instanceof AppError && error.code === "VALIDATION_ERROR",
    );
});

test("question commit rechecks duplicate content immediately before insert", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({ questions: [validMultipleChoice] }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );
    const preview = await generateQuestionPreview(harness);
    harness.questionRepository.documents.push(makeQuestionDocument(validMultipleChoice.content));

    await assert.rejects(
        harness.service.commitQuestionGeneration(ADMIN_ID, preview.generationId, {
            items: [preview.candidates[0]!],
        }),
        (error: unknown) => error instanceof AppError && error.code === "QUESTION_ALREADY_EXISTS",
    );
    assert.equal(harness.generationRepository.generation?.status, "COMPLETED");
});

test("Question schema declares the partial unique dedupe key index", () => {
    const index = QuestionModel.schema.indexes().find(([fields]) => fields.dedupeKey === 1);
    assert.ok(index);
    assert.equal(index[1]?.unique, true);
    assert.deepEqual(index[1]?.partialFilterExpression, { dedupeKey: { $type: "string" } });
});

test("question commit rollback removes staged Questions and restores generation state", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({ questions: [validMultipleChoice] }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );
    const preview = await generateQuestionPreview(harness);
    harness.defaultQuestionCommitRepository.failAfterInsert = true;

    await assert.rejects(
        harness.service.commitQuestionGeneration(ADMIN_ID, preview.generationId, {
            items: [preview.candidates[0]!],
        }),
        (error: unknown) => error instanceof AppError
            && error.code === "SIMULATED_QUESTION_COMMIT_FAILURE",
    );
    assert.equal(harness.questionRepository.documents.length, 0);
    assert.equal(harness.generationRepository.generation?.status, "COMPLETED");
});

test("aborting question generation marks AIGeneration CANCELED and creates no Question", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({ waitForQuestionAbort: true }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );
    const controller = new AbortController();
    const pending = harness.service.generateQuestionPreview(
        ADMIN_ID,
        TOPIC_ID.toString(),
        {
            vocabularyIds: [VOCAB_ID.toString()],
            questionTypes: ["MULTIPLE_CHOICE"],
            count: 1,
            difficulty: "EASY",
        },
        controller.signal,
    );
    controller.abort();

    await assert.rejects(
        pending,
        (error: unknown) => error instanceof AppError && error.code === "AI_GENERATION_CANCELED",
    );
    assert.equal(harness.generationRepository.generation?.status, "CANCELED");
    assert.equal(harness.questionRepository.documents.length, 0);
});

test("question semantic schemas still enforce correct options, pairs and blanks", () => {
    assert.equal(generatedMultipleChoiceSchema.safeParse(validMultipleChoice).success, true);
    assert.equal(generatedMultipleChoiceSchema.safeParse({
        ...validMultipleChoice,
        options: validMultipleChoice.options.map((option) => ({ ...option, isCorrect: true })),
    }).success, false);
    assert.equal(generatedFillBlankSchema.safeParse({
        type: "FILL_BLANK",
        content: "Complete this sentence",
        correctAnswer: "harbor",
    }).success, false);
    assert.equal(generatedMatchingSchema.safeParse({
        type: "MATCHING",
        content: "Match",
        matchingPairs: [
            { leftValue: "harbor", rightValue: "bến cảng", orderIndex: 0 },
            { leftValue: "harbor", rightValue: "cảng", orderIndex: 1 },
        ],
    }).success, false);
    assert.equal(generatedOrderSentenceSchema.safeParse({
        type: "ORDER_SENTENCE",
        vocabularyId: VOCAB_ID.toString(),
        content: "Arrange the words",
        correctAnswer: "I really really like apples",
        options: [
            { content: "I", isCorrect: true, orderIndex: 0 },
            { content: "really", isCorrect: true, orderIndex: 1 },
            { content: "really", isCorrect: true, orderIndex: 2 },
            { content: "like", isCorrect: true, orderIndex: 3 },
            { content: "apples", isCorrect: true, orderIndex: 4 },
        ],
        difficulty: "EASY",
    }).success, true);
    assert.equal(generatedOrderSentenceSchema.safeParse({
        type: "ORDER_SENTENCE",
        vocabularyId: VOCAB_ID.toString(),
        content: "Arrange the words",
        correctAnswer: "I really really like apples",
        options: [
            { content: "I", isCorrect: true, orderIndex: 0 },
            { content: "really", isCorrect: true, orderIndex: 1 },
            { content: "like", isCorrect: true, orderIndex: 2 },
            { content: "apples", isCorrect: true, orderIndex: 3 },
        ],
        difficulty: "EASY",
    }).success, false);
    assert.equal(generatedTranslationSchema.safeParse(validTranslation).success, true);
    assert.equal(generatedTranslationSchema.safeParse({
        ...validTranslation,
        correctAnswer: "   ",
    }).success, false);
    assert.equal(generatedTranslationSchema.safeParse({
        ...validTranslation,
        options: [],
    }).success, false);
    assert.equal(generatedTranslationSchema.safeParse({
        ...validTranslation,
        matchingPairs: [],
    }).success, false);
});

test("provider timeout transitions an AIGeneration to FAILED", async () => {
    const harness = makeHarness(new FakeAiContentGenerator({
        error: new AppError("AI_PROVIDER_TIMEOUT", "provider timed out", 504),
    }));
    await assert.rejects(
        generatePreview(harness),
        (error: unknown) => error instanceof AppError && error.code === "AI_PROVIDER_TIMEOUT",
    );
    assert.equal(harness.generationRepository.generation?.status, "FAILED");
});

test("question provider timeout marks Question AIGeneration FAILED", async () => {
    const harness = makeHarness(
        new FakeAiContentGenerator({
            error: new AppError("AI_PROVIDER_TIMEOUT", "provider timed out", 504),
        }),
        { seedVocabularies: [makeVocabularyDocument("harbor", { id: VOCAB_ID })] },
    );
    await assert.rejects(
        generateQuestionPreview(harness),
        (error: unknown) => error instanceof AppError && error.code === "AI_PROVIDER_TIMEOUT",
    );
    assert.equal(harness.generationRepository.generation?.status, "FAILED");
});

test("Gemini question prompt allows requested TRANSLATION output", async () => {
    let capturedPrompt = "";
    const provider = new GeminiContentGenerator({
        apiKey: "test-key",
        fetchImpl: async (_input, init) => {
            const request = JSON.parse(String(init?.body)) as {
                contents: Array<{ parts: Array<{ text: string }> }>;
            };
            capturedPrompt = request.contents[0]?.parts[0]?.text ?? "";
            return new Response(JSON.stringify({
                candidates: [{ content: { parts: [{ text: "[]" }] } }],
            }), { status: 200 });
        },
    });

    await provider.generateQuestions({
        topicName: "Travel",
        vocabularies: [{
            id: VOCAB_ID.toString(),
            word: "harbor",
            meaning: "bến cảng",
        }],
        questionTypes: ["TRANSLATION"],
        quantity: 1,
        difficulty: "EASY",
    });

    assert.match(capturedPrompt, /TRANSLATION:/u);
    assert.match(capturedPrompt, /Dịch câu sau sang tiếng Việt/u);
    assert.match(capturedPrompt, /không thêm options hoặc matchingPairs/u);
    assert.doesNotMatch(capturedPrompt, /Không trả TRANSLATION/u);
});

test("Gemini timeout is controlled and missing key does not call the provider", async () => {
    const fetchImpl: typeof fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
        });
    });
    const timedProvider = new GeminiContentGenerator({ apiKey: "test-key", timeoutMs: 5, fetchImpl });
    await assert.rejects(
        timedProvider.generateVocabularies({ topicName: "Travel", level: "B1", quantity: 1, excludeWords: [] }),
        (error: unknown) => error instanceof AppError && error.code === "AI_PROVIDER_TIMEOUT",
    );

    const missingKeyProvider = new GeminiContentGenerator({
        apiKey: "",
        fetchImpl: async () => {
            throw new Error("must not be called");
        },
    });
    await assert.rejects(
        missingKeyProvider.generateVocabularies({ topicName: "Travel", level: "B1", quantity: 1, excludeWords: [] }),
        (error: unknown) => error instanceof AppError && error.code === "AI_PROVIDER_NOT_CONFIGURED",
    );
});

test("AI routes reject USER and allow ADMIN authorization", () => {
    const middleware = authorize("ADMIN");
    let userError: unknown;
    let adminPassed = false;

    middleware(
        { user: { id: ADMIN_ID, role: "USER" } } as never,
        {} as never,
        (error?: unknown) => { userError = error; },
    );
    middleware(
        { user: { id: ADMIN_ID, role: "ADMIN" } } as never,
        {} as never,
        (error?: unknown) => { adminPassed = error === undefined; },
    );

    assert.equal(userError instanceof AppError && userError.code === "FORBIDDEN", true);
    assert.equal(adminPassed, true);
});

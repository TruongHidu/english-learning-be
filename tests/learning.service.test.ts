import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";

import { AppError } from "../src/errors/app-error.js";
import type {
    LearningQuestionSnapshot,
    LearningSessionDocument,
} from "../src/models/learning-session.model.js";
import type { LessonDocument } from "../src/models/lesson.model.js";
import type { QuestionDocument } from "../src/models/question.model.js";
import type { UserLessonProgressDocument } from "../src/models/user-lesson-progress.model.js";
import type {
    CreateLearningSessionData,
    ILearningSessionRepository,
    RecordAnswerData,
    UpdateSessionAfterAnswerData,
} from "../src/repositories/interfaces/learning-session.repository.interface.js";
import type {
    CompleteLessonData,
    FailedLessonAttemptData,
    IUserLessonProgressRepository,
} from "../src/repositories/interfaces/user-lesson-progress.repository.interface.js";
import type { ILessonQuestionRepository } from "../src/repositories/interfaces/lesson-question.repository.interface.js";
import type { IQuestionRepository } from "../src/repositories/interfaces/question.repository.interface.js";
import type { IUserRepository } from "../src/repositories/interfaces/user.repository.interface.js";
import type { IUserVocabularyRepository } from "../src/repositories/interfaces/user-vocabulary.repository.interface.js";
import type { LearningProgressionService } from "../src/services/learning-progression.service.js";
import type { HeartService } from "../src/services/heart.service.js";
import { UserStatsService } from "../src/services/user-stats.service.js";
import { LearningService } from "../src/services/learning.service.js";
import type { User, UserStats } from "../src/types/auth.types.js";

const USER_ID = "64f000000000000000000001";
const LESSON_ID = new Types.ObjectId("64f000000000000000000010");
const TOPIC_ID = new Types.ObjectId("64f000000000000000000020");

const asDocument = <T>(value: object): T => value as T;

const makeUser = (): User => ({
    id: USER_ID,
    email: "learner@example.com",
    displayName: "Learner",
    authProvider: "LOCAL",
    role: "USER",
    status: "ACTIVE",
    stats: {
        currentHeart: 5,
        maxHeart: 5,
        heartUpdatedAt: new Date(),
        diamond: 0,
        totalXp: 0,
        level: 1,
        currentStreak: 0,
        longestStreak: 0,
        nextHeartAt: null,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
});

const makeLesson = (requiredScore: number): LessonDocument => asDocument<LessonDocument>({
    _id: LESSON_ID,
    id: LESSON_ID.toString(),
    topicId: TOPIC_ID,
    name: "Greetings",
    description: null,
    requiredScore,
    questionCount: 2,
    orderIndex: 1,
    status: "PUBLISHED",
});

const makeQuestion = (
    questionId: Types.ObjectId,
    vocabularyId: Types.ObjectId,
    correctContent = "hello",
): QuestionDocument => {
    const correctOptionId = new Types.ObjectId();
    const wrongOptionId = new Types.ObjectId();
    return asDocument<QuestionDocument>({
        _id: questionId,
        vocabularyId,
        vocabularyIds: [vocabularyId],
        type: "MULTIPLE_CHOICE",
        content: "Choose the correct answer",
        instruction: "Choose one",
        correctAnswer: correctContent,
        options: [
            { _id: correctOptionId, content: correctContent, isCorrect: true, orderIndex: 0 },
            { _id: wrongOptionId, content: "goodbye", isCorrect: false, orderIndex: 1 },
        ],
        explanation: "The selected answer is correct.",
        difficulty: "EASY",
        status: "PUBLISHED",
        createdByAi: false,
    });
};

class InMemorySessionRepository implements ILearningSessionRepository {
    session: LearningSessionDocument | null = null;
    lastCreateData: CreateLearningSessionData | null = null;

    async findByIdAndUserId(sessionId: string, userId: string): Promise<LearningSessionDocument | null> {
        if (!this.session) return null;
        return this.session._id.toString() === sessionId && this.session.userId.toString() === userId
            ? this.session
            : null;
    }

    async abandonInProgressByUserIdAndLessonId(): Promise<void> {}

    async create(userId: string, lessonId: string, data: CreateLearningSessionData): Promise<LearningSessionDocument> {
        this.lastCreateData = data;
        this.session = asDocument<LearningSessionDocument>({
            _id: new Types.ObjectId(),
            userId: new Types.ObjectId(userId),
            lessonId: new Types.ObjectId(lessonId),
            status: "IN_PROGRESS",
            heartStart: data.heartStart,
            heartRemaining: data.heartRemaining,
            requiredScore: data.requiredScore,
            totalQuestions: data.totalQuestions,
            questionIds: data.questionIds.map((id) => new Types.ObjectId(id)),
            answeredQuestionIds: [],
            questionSnapshots: data.questionSnapshots,
            correctCount: 0,
            wrongCount: 0,
            score: 0,
            xpEarned: 0,
            diamondEarned: 0,
            startedAt: new Date(),
            terminalProcessed: false,
        });
        return this.session;
    }

    async recordAnswer(data: RecordAnswerData): Promise<LearningSessionDocument | null> {
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (!this.session
            || this.session._id.toString() !== data.sessionId
            || this.session.userId.toString() !== data.userId
            || this.session.status !== "IN_PROGRESS"
            || this.session.heartRemaining <= 0
            || !this.session.questionIds.some((id) => id.toString() === data.questionId)
            || this.session.answeredQuestionIds.some((id) => id.toString() === data.questionId)) {
            return null;
        }

        this.session.answeredQuestionIds.push(new Types.ObjectId(data.questionId));
        if (data.isCorrect) this.session.correctCount += 1;
        else {
            this.session.wrongCount += 1;
            this.session.heartRemaining = Math.max(0, this.session.heartRemaining - 1);
        }
        this.session.score = Math.round((this.session.correctCount / this.session.totalQuestions) * 100);

        const isTerminal = this.session.heartRemaining <= 0
            || this.session.answeredQuestionIds.length >= this.session.totalQuestions;
        if (isTerminal) {
            this.session.status = this.session.heartRemaining <= 0
                ? "FAILED"
                : this.session.score >= this.session.requiredScore
                    ? "COMPLETED"
                    : "FAILED";
            this.session.completedAt = new Date();
        }
        return this.session;
    }

    async claimTerminalProcessing(sessionId: string, userId: string): Promise<LearningSessionDocument | null> {
        if (!this.session
            || this.session._id.toString() !== sessionId
            || this.session.userId.toString() !== userId
            || (this.session.status !== "COMPLETED" && this.session.status !== "FAILED")
            || this.session.terminalProcessed) {
            return null;
        }
        this.session.terminalProcessed = true;
        return this.session;
    }

    async releaseTerminalProcessing(): Promise<void> {
        if (this.session) this.session.terminalProcessed = false;
    }

    async updateAfterAnswer(
        _sessionId: string,
        _data: UpdateSessionAfterAnswerData,
    ): Promise<LearningSessionDocument | null> {
        return this.session;
    }
}

class InMemoryProgressRepository implements IUserLessonProgressRepository {
    progress: UserLessonProgressDocument | null = null;
    completedCalls = 0;
    failedCalls = 0;
    unlockedLessonIds: string[] = [];

    async findByUserIdAndLessonId(): Promise<UserLessonProgressDocument | null> {
        return this.progress;
    }

    async findByUserIdAndLessonIds(): Promise<UserLessonProgressDocument[]> {
        return this.progress ? [this.progress] : [];
    }

    async create(userId: string, lessonId: string, status: "LOCKED" | "UNLOCKED" | "IN_PROGRESS" | "COMPLETED") {
        this.progress = asDocument<UserLessonProgressDocument>({
            _id: new Types.ObjectId(),
            userId: new Types.ObjectId(userId),
            lessonId: new Types.ObjectId(lessonId),
            status,
            bestScore: 0,
            totalAttempts: 0,
            correctCount: 0,
            wrongCount: 0,
        });
        return this.progress;
    }

    async upsertInProgress(_userId: string, lessonId: string): Promise<void> {
        this.unlockedLessonIds.push(lessonId);
    }

    async updateStatus(_userId: string, _lessonId: string, _status: "LOCKED" | "UNLOCKED" | "IN_PROGRESS" | "COMPLETED") {
        return this.progress;
    }

    async recordFailedAttempt(
        _userId: string,
        _lessonId: string,
        data: FailedLessonAttemptData,
    ): Promise<UserLessonProgressDocument | null> {
        this.failedCalls += 1;
        const status = this.progress?.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
        this.progress = asDocument<UserLessonProgressDocument>({
            ...(this.progress ?? {}),
            status,
            ...data,
        });
        return this.progress;
    }

    async completeLesson(
        _userId: string,
        _lessonId: string,
        data: CompleteLessonData,
    ): Promise<UserLessonProgressDocument | null> {
        this.completedCalls += 1;
        this.progress = asDocument<UserLessonProgressDocument>({
            ...(this.progress ?? {}),
            status: "COMPLETED",
            ...data,
        });
        return this.progress;
    }
}

const makeHarness = async (options?: {
    requiredScore?: number;
    questionCount?: number;
    nextLesson?: LessonDocument | null;
}) => {
    const requiredScore = options?.requiredScore ?? 70;
    const questionCount = options?.questionCount ?? 2;
    const vocabularyId = new Types.ObjectId();
    const questions = Array.from({ length: questionCount }, (_, index) =>
        makeQuestion(new Types.ObjectId(), vocabularyId, index === 0 ? "hello" : "goodbye"),
    );
    const sessionRepository = new InMemorySessionRepository();
    const progressRepository = new InMemoryProgressRepository();
    const lesson = makeLesson(requiredScore);
    const user = makeUser();
    const questionRepository = {
        findByIds: async () => questions,
        findById: async () => questions[0] ?? null,
    } as unknown as IQuestionRepository;
    const lessonQuestionRepository = {
        findByLessonId: async () => questions.map((question, orderIndex) => ({
            _id: new Types.ObjectId(),
            lessonId: LESSON_ID,
            questionId: question._id,
            orderIndex,
        })),
    } as unknown as ILessonQuestionRepository;
    const lessonRepository = {
        findById: async () => lesson,
        findNextLesson: async () => options?.nextLesson ?? null,
    } as unknown as import("../src/repositories/interfaces/lesson.repository.interface.js").ILessonRepository;
    const progressionService = {
        getLessonProgression: async () => ({
            section: { isLocked: false },
            lesson: { lesson, lockReason: null, isLocked: false, isCompleted: false },
        }),
    } as unknown as LearningProgressionService;
    const heartService = {
        syncUserHearts: async () => user,
        deductHeart: async () => ({ user, heartsRemaining: Math.max(0, user.stats.currentHeart - 1), nextHeartAt: null }),
    } as unknown as HeartService;
    const userRepository = {
        findById: async () => user,
        updateStats: async (_userId: string, stats: Partial<UserStats>) => {
            Object.assign(user.stats, stats);
            return user;
        },
    } as unknown as IUserRepository;
    const statsService = new UserStatsService(userRepository);
    const userVocabularyRepository = {
        upsertLearnedVocabularies: async () => undefined,
    } as unknown as IUserVocabularyRepository;
    const service = new LearningService(
        lessonRepository,
        lessonQuestionRepository,
        questionRepository,
        userRepository,
        progressRepository,
        sessionRepository,
        progressionService,
        heartService,
        statsService,
        userVocabularyRepository,
    );
    await service.startLesson(USER_ID, LESSON_ID.toString());
    // Starting a lesson creates its own IN_PROGRESS record. Only subsequent
    // entries represent an unlock performed after a successful completion.
    progressRepository.unlockedLessonIds = [];
    return { service, sessionRepository, progressRepository, questions, lesson, user };
};

const expectCode = async (operation: () => Promise<unknown>, code: string): Promise<void> => {
    await assert.rejects(operation, (error: unknown) => error instanceof AppError && error.code === code);
};

test("startLesson snapshots ordered questions and grading data", async () => {
    const harness = await makeHarness();
    assert.ok(harness.sessionRepository.lastCreateData);
    assert.equal(harness.sessionRepository.lastCreateData?.questionIds.length, 2);
    assert.equal(harness.sessionRepository.lastCreateData?.questionSnapshots.length, 2);
    assert.equal(
        harness.sessionRepository.lastCreateData?.questionIds[0],
        harness.questions[0]?._id.toString(),
    );
    assert.equal(harness.sessionRepository.session?.requiredScore, 70);
    assert.equal(harness.user.stats.currentStreak, 0);
    assert.equal(harness.user.stats.lastStudyDate, undefined);
});

test("rejects a Question that is not part of the session snapshot", async () => {
    const harness = await makeHarness();
    await expectCode(
        () => harness.service.submitAnswer(USER_ID, harness.sessionRepository.session!._id.toString(), {
            questionId: new Types.ObjectId().toString(),
            answer: "hello",
        }),
        "QUESTION_NOT_IN_SESSION",
    );
});

test("rejects submitting the same Question twice", async () => {
    const harness = await makeHarness();
    const sessionId = harness.sessionRepository.session!._id.toString();
    const questionId = harness.questions[0]!._id.toString();

    await harness.service.submitAnswer(USER_ID, sessionId, { questionId, answer: "hello" });
    await expectCode(
        () => harness.service.submitAnswer(USER_ID, sessionId, { questionId, answer: "hello" }),
        "QUESTION_ALREADY_ANSWERED",
    );
});

test("concurrent submissions for one Question are counted only once", async () => {
    const harness = await makeHarness();
    const sessionId = harness.sessionRepository.session!._id.toString();
    const questionId = harness.questions[0]!._id.toString();
    const results = await Promise.allSettled([
        harness.service.submitAnswer(USER_ID, sessionId, { questionId, answer: "hello" }),
        harness.service.submitAnswer(USER_ID, sessionId, { questionId, answer: "hello" }),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal(harness.sessionRepository.session?.answeredQuestionIds.length, 1);
    assert.equal(harness.sessionRepository.session?.correctCount, 1);
});

test("a score below requiredScore fails without completion, reward, learned vocabulary or unlock", async () => {
    const harness = await makeHarness({ requiredScore: 70 });
    const sessionId = harness.sessionRepository.session!._id.toString();

    await harness.service.submitAnswer(USER_ID, sessionId, {
        questionId: harness.questions[0]!._id.toString(),
        answer: "hello",
    });
    const response = await harness.service.submitAnswer(USER_ID, sessionId, {
        questionId: harness.questions[1]!._id.toString(),
        answer: "wrong",
    });

    assert.equal(response.isPassed, false);
    assert.equal(response.sessionStatus, "FAILED");
    assert.equal(response.rewards, null);
    assert.equal(harness.progressRepository.failedCalls, 1);
    assert.equal(harness.progressRepository.completedCalls, 0);
    assert.equal(harness.progressRepository.unlockedLessonIds.length, 0);
    assert.equal(harness.user.stats.currentStreak, 0);
    assert.equal(harness.user.stats.lastStudyDate, undefined);
    assert.equal(harness.user.stats.totalXp, 0);
});

test("a score equal to requiredScore passes and unlocks the next lesson", async () => {
    const nextLesson = asDocument<LessonDocument>({
        _id: new Types.ObjectId(),
        id: new Types.ObjectId().toString(),
        topicId: TOPIC_ID,
        orderIndex: 2,
        status: "PUBLISHED",
    });
    const harness = await makeHarness({ requiredScore: 50, nextLesson });
    const sessionId = harness.sessionRepository.session!._id.toString();

    await harness.service.submitAnswer(USER_ID, sessionId, {
        questionId: harness.questions[0]!._id.toString(),
        answer: "hello",
    });
    const response = await harness.service.submitAnswer(USER_ID, sessionId, {
        questionId: harness.questions[1]!._id.toString(),
        answer: "wrong",
    });

    assert.equal(response.isPassed, true);
    assert.equal(response.sessionStatus, "COMPLETED");
    assert.ok(response.rewards);
    assert.equal(response.rewards.currentStreak, 1);
    assert.equal(harness.user.stats.currentStreak, 1);
    assert.deepEqual(Object.keys(response.rewards).sort(), [
        "xpEarned", "diamondEarned", "totalXp", "level", "currentStreak", "longestStreak", "learnedVocabularyIds", "isNextLessonUnlocked",
    ].sort());
    assert.deepEqual(Object.keys(response).sort(), [
        "isCorrect", "isPassed", "correctAnswer", "explanation", "heartsRemaining", "nextHeartAt", "sessionStatus", "correctCount", "wrongCount", "score", "rewards",
    ].sort());
    assert.equal(harness.progressRepository.completedCalls, 1);
    assert.deepEqual(harness.progressRepository.unlockedLessonIds, [nextLesson.id.toString()]);
});

test("running out of hearts fails the session even when the score threshold is zero", async () => {
    const harness = await makeHarness({ requiredScore: 0 });
    harness.user.stats.currentHeart = 1;
    harness.sessionRepository.session!.heartRemaining = 1;

    const response = await harness.service.submitAnswer(USER_ID, harness.sessionRepository.session!._id.toString(), {
        questionId: harness.questions[0]!._id.toString(),
        answer: "wrong",
    });

    assert.equal(response.sessionStatus, "FAILED");
    assert.equal(response.isPassed, false);
    assert.equal(harness.progressRepository.completedCalls, 0);
    assert.equal(harness.progressRepository.failedCalls, 1);
});

test("a failed replay never downgrades an already completed progress", async () => {
    const harness = await makeHarness({ requiredScore: 70 });
    harness.progressRepository.progress = asDocument<UserLessonProgressDocument>({
        _id: new Types.ObjectId(),
        status: "COMPLETED",
        bestScore: 100,
        totalAttempts: 1,
        correctCount: 2,
        wrongCount: 0,
    });
    const sessionId = harness.sessionRepository.session!._id.toString();

    await harness.service.submitAnswer(USER_ID, sessionId, {
        questionId: harness.questions[0]!._id.toString(),
        answer: "wrong",
    });
    await harness.service.submitAnswer(USER_ID, sessionId, {
        questionId: harness.questions[1]!._id.toString(),
        answer: "wrong",
    });

    assert.equal(harness.progressRepository.progress?.status, "COMPLETED");
    assert.equal(harness.progressRepository.completedCalls, 0);
    assert.equal(harness.progressRepository.failedCalls, 1);
});

test("grading uses the session snapshot after the live Question is changed", async () => {
    const harness = await makeHarness({ requiredScore: 50 });
    const sessionId = harness.sessionRepository.session!._id.toString();
    const snapshot = harness.sessionRepository.session!.questionSnapshots[0] as LearningQuestionSnapshot;
    const liveQuestion = harness.questions[0]!;
    liveQuestion.correctAnswer = "changed-answer";
    if (liveQuestion.options?.[0]) liveQuestion.options[0].isCorrect = false;

    const response = await harness.service.submitAnswer(USER_ID, sessionId, {
        questionId: snapshot.questionId.toString(),
        answer: "hello",
    });

    assert.equal(response.isCorrect, true);
});

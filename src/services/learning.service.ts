import { Types } from "mongoose";

import { AppError } from "../errors/app-error.js";
import { effectiveCurrentStreak } from "../utils/streak.js";
import type { ITranslationEvaluator } from "../ai/interfaces/translation-evaluator.interface.js";
import { TRANSLATION_MIN_SCORE } from "../config/translation-grading.config.js";
import {
    mapLearningQuestionToResponse,
    mapLearningSessionToResponse,
} from "../mappers/learning.mapper.js";
import type {
    LearningQuestionSnapshot,
    LearningQuestionSnapshotMatchingPair,
    LearningQuestionSnapshotOption,
    LearningSessionDocument,
} from "../models/learning-session.model.js";
import type { QuestionDocument } from "../models/question.model.js";
import type { ILearningSessionRepository } from "../repositories/interfaces/learning-session.repository.interface.js";
import type { ILessonRepository } from "../repositories/interfaces/lesson.repository.interface.js";
import type { ILessonQuestionRepository } from "../repositories/interfaces/lesson-question.repository.interface.js";
import type { IQuestionRepository } from "../repositories/interfaces/question.repository.interface.js";
import type { IUserLessonProgressRepository } from "../repositories/interfaces/user-lesson-progress.repository.interface.js";
import type { IUserRepository } from "../repositories/interfaces/user.repository.interface.js";
import type { IUserVocabularyRepository } from "../repositories/interfaces/user-vocabulary.repository.interface.js";
import type {
    LessonCompletionRewards,
    StartLessonResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
} from "../types/learning.types.js";
import type { HeartService } from "./heart.service.js";
import type { LearningProgressionService } from "./learning-progression.service.js";
import type { UserStatsService } from "./user-stats.service.js";

export class LearningService {
    constructor(
        private readonly lessonRepository: ILessonRepository,
        private readonly lessonQuestionRepository: ILessonQuestionRepository,
        private readonly questionRepository: IQuestionRepository,
        private readonly userRepository: IUserRepository,
        private readonly userLessonProgressRepository: IUserLessonProgressRepository,
        private readonly learningSessionRepository: ILearningSessionRepository,
        private readonly progressionService: LearningProgressionService,
        private readonly heartService: HeartService,
        private readonly userStatsService: UserStatsService,
        private readonly userVocabularyRepository: IUserVocabularyRepository,
        private readonly translationEvaluator?: ITranslationEvaluator,
    ) {}

    async startLesson(userId: string, lessonId: string): Promise<StartLessonResponse> {
        const access = await this.progressionService.getLessonProgression(userId, lessonId);
        const lesson = access.lesson.lesson;

        if (access.section.isLocked || access.lesson.lockReason === "SECTION") {
            throw new AppError(
                "SECTION_LOCKED",
                "Bạn cần hoàn thành tất cả bài học trong phần học trước",
                403,
            );
        }
        if (access.lesson.isLocked) {
            throw new AppError("LESSON_LOCKED", "Bài học này chưa được mở khóa", 403);
        }

        const user = await this.heartService.syncUserHearts(userId);
        if (user.stats.currentHeart <= 0) {
            throw new AppError("INSUFFICIENT_HEART", "Bạn không còn tim để bắt đầu bài học", 403);
        }

        const questions = await this.getPublishedLessonQuestions(lessonId);
        if (questions.length === 0) {
            throw new AppError(
                "LESSON_HAS_NO_PUBLISHED_QUESTIONS",
                "Bài học chưa có câu hỏi đã xuất bản",
                400,
            );
        }

        const questionSnapshots = questions.map((question) => this.createQuestionSnapshot(question));

        await this.learningSessionRepository.abandonInProgressByUserIdAndLessonId(userId, lessonId);
        const session = await this.learningSessionRepository.create(userId, lessonId, {
            lessonVersion: lesson.publishedVersion ?? 1,
            heartStart: user.stats.currentHeart,
            heartRemaining: user.stats.currentHeart,
            requiredScore: lesson.requiredScore,
            totalQuestions: questionSnapshots.length,
            questionIds: questionSnapshots.map((snapshot) => snapshot.questionId.toString()),
            questionSnapshots,
        });

        if (!access.lesson.isCompleted) {
            await this.userLessonProgressRepository.upsertInProgress(userId, lessonId);
        }

        return {
            session: mapLearningSessionToResponse(session),
            lesson: {
                id: lesson._id.toString(),
                name: lesson.name,
                description: lesson.description ?? null,
                requiredScore: lesson.requiredScore,
                questionCount: questionSnapshots.length,
            },
            progress: { currentQuestionIndex: 0, totalQuestions: questionSnapshots.length },
            hearts: {
                current: user.stats.currentHeart,
                max: user.stats.maxHeart,
                nextHeartAt: user.stats.nextHeartAt ? user.stats.nextHeartAt.toISOString() : null,
            },
            questions: questions.map(mapLearningQuestionToResponse),
        };
    }

    private async getPublishedLessonQuestions(lessonId: string): Promise<QuestionDocument[]> {
        const assignments = await this.lessonQuestionRepository.findByLessonId(lessonId);
        if (assignments.length === 0) return [];

        const questions = await this.questionRepository.findByIds(
            assignments.map((assignment) => assignment.questionId.toString()),
        );
        const publishedQuestions = new Map(
            questions
                .filter((question) => question.status === "PUBLISHED")
                .map((question) => [question._id.toString(), question]),
        );

        return assignments
            .map((assignment) => publishedQuestions.get(assignment.questionId.toString()) ?? null)
            .filter((question): question is QuestionDocument => question !== null);
    }

    async submitAnswer(
        userId: string,
        sessionId: string,
        body: SubmitAnswerRequest,
    ): Promise<SubmitAnswerResponse> {
        const session = await this.learningSessionRepository.findByIdAndUserId(sessionId, userId);
        this.assertSessionCanReceiveAnswer(session);

        const snapshot = this.findQuestionSnapshot(session, body.questionId);
        if (!snapshot) {
            throw new AppError(
                "QUESTION_NOT_IN_SESSION",
                "Câu hỏi không thuộc phiên học hiện tại",
                400,
            );
        }

        if ((session.answeredQuestionIds ?? []).some((questionId) => questionId.toString() === body.questionId)) {
            throw new AppError(
                "QUESTION_ALREADY_ANSWERED",
                "Câu hỏi này đã được trả lời trong phiên học",
                409,
            );
        }

        let isCorrect = this.checkAnswer(
            snapshot.type,
            snapshot.correctAnswer,
            body.answer,
            snapshot.options,
            snapshot.matchingPairs,
        );

        if (
            !isCorrect
            && snapshot.type === "TRANSLATION"
            && typeof snapshot.correctAnswer === "string"
            && typeof body.answer === "string"
            && body.answer.trim().length > 0
            && this.translationEvaluator
        ) {
            const evaluation = await this.translationEvaluator.evaluate({
                referenceAnswer: snapshot.correctAnswer,
                userAnswer: body.answer,
            });
            isCorrect = evaluation.semanticScore >= TRANSLATION_MIN_SCORE
                && !evaluation.hasCriticalError;
        }

        const updatedSession = await this.learningSessionRepository.recordAnswer({
            sessionId,
            userId,
            questionId: body.questionId,
            isCorrect,
        });

        if (!updatedSession) {
            // A concurrent request may have answered this question between the
            // read above and the conditional update. Re-read to return the
            // correct domain error instead of silently counting twice.
            const latestSession = await this.learningSessionRepository.findByIdAndUserId(sessionId, userId);
            this.assertSessionCanReceiveAnswer(latestSession);

            const latestSnapshot = this.findQuestionSnapshot(latestSession, body.questionId);
            if (!latestSnapshot) {
                throw new AppError(
                    "QUESTION_NOT_IN_SESSION",
                    "Câu hỏi không thuộc phiên học hiện tại",
                    400,
                );
            }
            if ((latestSession.answeredQuestionIds ?? []).some((questionId) => questionId.toString() === body.questionId)) {
                throw new AppError(
                    "QUESTION_ALREADY_ANSWERED",
                    "Câu hỏi này đã được trả lời trong phiên học",
                    409,
                );
            }
            throw new AppError(
                "SESSION_UPDATE_CONFLICT",
                "Không thể cập nhật phiên học, vui lòng thử lại",
                409,
            );
        }

        let rewards: LessonCompletionRewards | null = null;
        const isTerminal = updatedSession.status === "COMPLETED" || updatedSession.status === "FAILED";
        const requiredScore = updatedSession.requiredScore ?? 80;
        const isPassed = updatedSession.status === "COMPLETED"
            && updatedSession.score >= requiredScore;

        if (isTerminal) {
            const terminalSession = await this.learningSessionRepository.claimTerminalProcessing(
                sessionId,
                userId,
            );

            if (terminalSession) {
                try {
                    if (isPassed) {
                        rewards = await this.handlePassedSession(userId, terminalSession);
                    } else {
                        await this.handleFailedSession(userId, terminalSession);
                    }
                } catch (error) {
                    await this.learningSessionRepository.releaseTerminalProcessing(sessionId, userId);
                    throw error;
                }
            }
        }

        let nextHeartAt: Date | null = null;
        if (!isCorrect) {
            const deductionResult = await this.heartService.deductHeart(userId);
            nextHeartAt = deductionResult.nextHeartAt;
        } else {
            const syncedUser = await this.heartService.syncUserHearts(userId);
            nextHeartAt = syncedUser.stats.nextHeartAt ?? null;
        }

        return {
            isCorrect,
            isPassed,
            correctAnswer: isCorrect ? null : this.getCorrectAnswer(snapshot),
            explanation: snapshot.explanation ?? null,
            heartsRemaining: updatedSession.heartRemaining,
            nextHeartAt: nextHeartAt ? nextHeartAt.toISOString() : null,
            sessionStatus: updatedSession.status,
            correctCount: updatedSession.correctCount,
            wrongCount: updatedSession.wrongCount,
            score: updatedSession.score,
            rewards,
        };
    }

    private assertSessionCanReceiveAnswer(session: LearningSessionDocument | null): asserts session is LearningSessionDocument {
        if (!session) {
            throw new AppError("SESSION_NOT_FOUND", "Không tìm thấy phiên học", 404);
        }
        if (session.status !== "IN_PROGRESS") {
            throw new AppError(
                "SESSION_NOT_IN_PROGRESS",
                "Phiên học không ở trạng thái đang học",
                409,
            );
        }
        if (session.heartRemaining <= 0) {
            throw new AppError("INSUFFICIENT_HEART", "Bạn đã hết tim", 403);
        }
    }

    private findQuestionSnapshot(
        session: LearningSessionDocument,
        questionId: string,
    ): LearningQuestionSnapshot | null {
        return (session.questionSnapshots ?? []).find(
            (snapshot) => snapshot.questionId.toString() === questionId,
        ) ?? null;
    }

    private createQuestionSnapshot(question: QuestionDocument): LearningQuestionSnapshot {
        const vocabularyIds: Types.ObjectId[] = [];
        const addVocabularyId = (value: unknown): void => {
            const vocabularyId = this.toObjectId(value);
            if (vocabularyId && !vocabularyIds.some((id) => id.equals(vocabularyId))) {
                vocabularyIds.push(vocabularyId);
            }
        };

        addVocabularyId(question.vocabularyId);
        question.vocabularyIds?.forEach(addVocabularyId);

        const matchingPairs: LearningQuestionSnapshotMatchingPair[] | undefined = question.matchingPairs?.map(
            (pair) => {
                addVocabularyId(pair.vocabularyId);
                const vocabularyId = this.toObjectId(pair.vocabularyId);
                return {
                    vocabularyId,
                    leftValue: pair.leftValue,
                    rightValue: pair.rightValue,
                    orderIndex: pair.orderIndex,
                };
            },
        );

        const options: LearningQuestionSnapshotOption[] | undefined = question.options?.map((option) => {
            const optionWithId = option as unknown as { _id?: Types.ObjectId };
            return {
                optionId: optionWithId._id,
                content: option.content,
                isCorrect: option.isCorrect,
                orderIndex: option.orderIndex,
            };
        });

        return {
            questionId: question._id,
            type: question.type,
            difficulty: question.difficulty,
            correctAnswer: question.correctAnswer,
            options: options && options.length > 0 ? options : undefined,
            matchingPairs: matchingPairs && matchingPairs.length > 0 ? matchingPairs : undefined,
            vocabularyIds: vocabularyIds.length > 0 ? vocabularyIds : undefined,
            explanation: question.explanation,
        };
    }

    private toObjectId(value: unknown): Types.ObjectId | undefined {
        if (value instanceof Types.ObjectId) return value;
        if (typeof value === "string" && Types.ObjectId.isValid(value)) {
            return new Types.ObjectId(value);
        }
        if (value && typeof value === "object" && "_id" in value) {
            return this.toObjectId((value as { _id?: unknown })._id);
        }
        return undefined;
    }

    private async handlePassedSession(
        userId: string,
        session: LearningSessionDocument,
    ): Promise<LessonCompletionRewards> {
        const existingProgress = await this.userLessonProgressRepository.findByUserIdAndLessonId(
            userId,
            session.lessonId.toString(),
        );
        const isAlreadyCompleted = existingProgress?.status === "COMPLETED";

        const wrongQuestionIdSet = new Set(
            (session.wrongQuestionIds ?? []).map(String),
        );

        const correctSnapshots = (session.questionSnapshots ?? []).filter(
            (snapshot) => !wrongQuestionIdSet.has(String(snapshot.questionId)),
        );

        const correctDifficulties = correctSnapshots.map(
            (snapshot) => snapshot.difficulty ?? "EASY",
        );

        while (correctDifficulties.length < session.correctCount) {
            correctDifficulties.push("EASY");
        }
        if (correctDifficulties.length > session.correctCount) {
            correctDifficulties.length = session.correctCount;
        }

        const reward = this.userStatsService.calculateLessonRewards({
            correctCount: session.correctCount,
            totalQuestions: session.totalQuestions,
            requiredScore: session.requiredScore ?? 80,
            isAlreadyCompleted,
            correctDifficulties,
        });

        const previousBestScore = existingProgress?.bestScore ?? 0;
        const previousAttempts = existingProgress?.totalAttempts ?? 0;
        const now = session.completedAt ?? new Date();

        await this.userLessonProgressRepository.completeLesson(
            userId,
            session.lessonId.toString(),
            {
                score: session.score,
                bestScore: Math.max(previousBestScore, session.score),
                totalAttempts: previousAttempts + 1,
                correctCount: session.correctCount,
                wrongCount: session.wrongCount,
                completedAt: now,
                completedVersion: session.lessonVersion ?? 1,
            },
        );

        const currentUser = await this.userRepository.findById(userId);
        const updatedStats = currentUser
            ? await this.userStatsService.applyLessonCompletionStats(
                  userId,
                  currentUser.stats,
                  reward.xpEarned,
                  reward.diamondEarned,
                  now,
              )
            : {
                  totalXp: 0,
                  level: 1,
                  diamond: 0,
                  currentStreak: 0,
                  longestStreak: 0,
                  lastStudyDate: now,
              };

        const learnedVocabularyIds = this.getLearnedVocabularyIds(session);
        if (learnedVocabularyIds.length > 0) {
            const lesson = await this.lessonRepository.findById(session.lessonId.toString());
            if (lesson?.topicId) {
                await this.userVocabularyRepository.upsertLearnedVocabularies(
                    userId,
                    learnedVocabularyIds,
                    lesson.topicId.toString(),
                    session.lessonId.toString(),
                );
            }
        }

        // Persist container completion and all newly granted access before curriculum can change.
        await this.progressionService.getLessonProgression(userId, session.lessonId.toString());

        let isNextLessonUnlocked = false;
        const currentLesson = await this.lessonRepository.findById(session.lessonId.toString());
        if (currentLesson) {
            const nextLesson = await this.lessonRepository.findNextLesson(
                currentLesson.topicId.toString(),
                currentLesson.orderIndex,
            );
            if (nextLesson) {
                await this.userLessonProgressRepository.upsertInProgress(userId, nextLesson.id.toString());
                isNextLessonUnlocked = true;
            }
        }

        return {
            xpEarned: reward.xpEarned,
            diamondEarned: reward.diamondEarned,
            totalXp: updatedStats.totalXp,
            level: updatedStats.level,
            currentStreak: effectiveCurrentStreak(updatedStats),
            longestStreak: updatedStats.longestStreak,
            learnedVocabularyIds,
            isNextLessonUnlocked,
        };
    }

    private async handleFailedSession(userId: string, session: LearningSessionDocument): Promise<void> {
        const existingProgress = await this.userLessonProgressRepository.findByUserIdAndLessonId(
            userId,
            session.lessonId.toString(),
        );
        await this.userLessonProgressRepository.recordFailedAttempt(
            userId,
            session.lessonId.toString(),
            {
                score: session.score,
                bestScore: Math.max(existingProgress?.bestScore ?? 0, session.score),
                totalAttempts: (existingProgress?.totalAttempts ?? 0) + 1,
                correctCount: session.correctCount,
                wrongCount: session.wrongCount,
            },
        );
    }

    private getLearnedVocabularyIds(session: LearningSessionDocument): string[] {
        const vocabularyIds = new Set<string>();
        for (const snapshot of session.questionSnapshots ?? []) {
            for (const vocabularyId of snapshot.vocabularyIds ?? []) {
                vocabularyIds.add(vocabularyId.toString());
            }
        }
        return Array.from(vocabularyIds);
    }

    private getCorrectAnswer(snapshot: LearningQuestionSnapshot): unknown | null {
        if (snapshot.correctAnswer !== undefined) return snapshot.correctAnswer;
        return snapshot.options?.find((option) => option.isCorrect)?.content ?? null;
    }

    private checkAnswer(
        questionType: string,
        correctAnswer: unknown,
        userAnswer: string | string[],
        options?: LearningQuestionSnapshotOption[],
        matchingPairs?: LearningQuestionSnapshotMatchingPair[],
    ): boolean {
        switch (questionType) {
            case "MULTIPLE_CHOICE":
            case "LISTENING":
                return this.checkMultipleChoice(userAnswer, options);
            case "FILL_BLANK":
            case "TRANSLATION":
                return this.checkTextBased(correctAnswer, userAnswer);
            case "ORDER_SENTENCE":
                return this.checkOrderSentence(correctAnswer, userAnswer);
            case "MATCHING":
                return this.checkMatching(userAnswer, matchingPairs);
            default:
                return false;
        }
    }

    private checkMultipleChoice(
        userAnswer: string | string[],
        options?: LearningQuestionSnapshotOption[],
    ): boolean {
        if (typeof userAnswer !== "string" || !options) return false;
        const selectedOption = options.find((option) => {
            const optionId = option.optionId?.toString();
            return optionId === userAnswer || option.content === userAnswer;
        });
        return selectedOption?.isCorrect === true;
    }

    private checkTextBased(correctAnswer: unknown, userAnswer: string | string[]): boolean {
        if (typeof userAnswer !== "string" || typeof correctAnswer !== "string") return false;
        const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
        return normalize(userAnswer) === normalize(correctAnswer);
    }

    private checkOrderSentence(correctAnswer: unknown, userAnswer: string | string[]): boolean {
        const userText = Array.isArray(userAnswer) ? userAnswer.join(" ") : String(userAnswer || "");
        const targetText = Array.isArray(correctAnswer)
            ? correctAnswer.join(" ")
            : String(correctAnswer || "");
        const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
        return normalize(userText) === normalize(targetText);
    }

    private checkMatching(
        userAnswer: string | string[],
        matchingPairs?: LearningQuestionSnapshotMatchingPair[],
    ): boolean {
        if (!Array.isArray(userAnswer) || !matchingPairs || userAnswer.length !== matchingPairs.length) {
            return false;
        }

        return matchingPairs.every((pair) => {
            const expected = `${pair.leftValue.trim()}||${pair.rightValue.trim()}`.toLowerCase();
            const expectedDash = `${pair.leftValue.trim()}-${pair.rightValue.trim()}`.toLowerCase();
            return userAnswer.some((submittedItem) => {
                const submitted = (typeof submittedItem === "string" ? submittedItem : "")
                    .trim()
                    .toLowerCase();
                return submitted === expected || submitted === expectedDash;
            });
        });
    }
}

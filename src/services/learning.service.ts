import { AppError } from "../errors/app-error.js";
import { mapLearningQuestionToResponse, mapLearningSessionToResponse } from "../mappers/learning.mapper.js";
import type { ILearningSessionRepository } from "../repositories/interfaces/learning-session.repository.interface.js";
import type { ILessonRepository } from "../repositories/interfaces/lesson.repository.interface.js";
import type { ILessonQuestionRepository } from "../repositories/interfaces/lesson-question.repository.interface.js";
import type { IQuestionRepository } from "../repositories/interfaces/question.repository.interface.js";
import type { IUserLessonProgressRepository } from "../repositories/interfaces/user-lesson-progress.repository.interface.js";
import type { IUserRepository } from "../repositories/interfaces/user.repository.interface.js";
import type { StartLessonResponse, SubmitAnswerRequest, SubmitAnswerResponse } from "../types/learning.types.js";
import type { LearningSessionStatus } from "../models/learning-session.model.js";
import type { LearningProgressionService } from "./learning-progression.service.js";

import type { HeartService } from "./heart.service.js";

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
        if (!user) {
            throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
        }
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

        await this.learningSessionRepository.abandonInProgressByUserIdAndLessonId(userId, lessonId);
        const session = await this.learningSessionRepository.create(userId, lessonId, {
            heartStart: user.stats.currentHeart,
            heartRemaining: user.stats.currentHeart,
            totalQuestions: questions.length,
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
                questionCount: questions.length,
            },
            progress: { currentQuestionIndex: 0, totalQuestions: questions.length },
            hearts: {
                current: user.stats.currentHeart,
                max: user.stats.maxHeart,
                nextHeartAt: user.stats.nextHeartAt ? user.stats.nextHeartAt.toISOString() : null,
            },
            questions: questions.map(mapLearningQuestionToResponse),
        };
    }

    private async getPublishedLessonQuestions(lessonId: string) {
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
            .filter((question): question is NonNullable<typeof question> => question !== null);
    }

    async submitAnswer(userId: string, sessionId: string, body: SubmitAnswerRequest): Promise<SubmitAnswerResponse> {
        // 1. Lấy và validate session
        const session = await this.learningSessionRepository.findByIdAndUserId(sessionId, userId);
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

        // 2. Lấy và validate question
        const question = await this.questionRepository.findById(body.questionId);
        if (!question) {
            throw new AppError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi", 404);
        }

        // 3. Kiểm tra đáp án theo từng loại câu hỏi
        const isCorrect = this.checkAnswer(question.type, question.correctAnswer, body.answer, question.options, question.matchingPairs);

        // 4. Cập nhật session
        const newCorrectCount = session.correctCount + (isCorrect ? 1 : 0);
        const newWrongCount = session.wrongCount + (isCorrect ? 0 : 1);
        const newHeartRemaining = isCorrect ? session.heartRemaining : session.heartRemaining - 1;
        const newScore = session.totalQuestions > 0
            ? Math.round((newCorrectCount / session.totalQuestions) * 100)
            : 0;

        let newStatus: LearningSessionStatus = session.status;
        if (newHeartRemaining <= 0) {
            newStatus = "FAILED";
        } else if (newCorrectCount + newWrongCount === session.totalQuestions) {
            newStatus = "COMPLETED";
        }

        // 5. Cập nhật Session và số Tim User (nếu sai)
        await this.learningSessionRepository.updateAfterAnswer(sessionId, {
            correctCount: newCorrectCount,
            wrongCount: newWrongCount,
            heartRemaining: newHeartRemaining,
            score: newScore,
            status: newStatus,
        });

        let nextHeartAt: Date | null = null;
        if (!isCorrect) {
            const deductionResult = await this.heartService.deductHeart(userId);
            nextHeartAt = deductionResult.nextHeartAt;
        } else {
            const syncedUser = await this.heartService.syncUserHearts(userId);
            nextHeartAt = syncedUser.stats.nextHeartAt ?? null;
        }

        // 6. Xử lý logic Unlock bài tiếp theo nếu COMPLETED
        if (newStatus === "COMPLETED") {
            try {
                // Đánh dấu bài hiện tại là COMPLETED
                await this.userLessonProgressRepository.updateStatus(userId, session.lessonId.toString(), "COMPLETED");

                // Tìm bài tiếp theo
                const currentLesson = await this.lessonRepository.findById(session.lessonId.toString());
                if (currentLesson) {
                    const nextLesson = await this.lessonRepository.findNextLesson(currentLesson.topicId.toString(), currentLesson.orderIndex);
                    if (nextLesson) {
                        // Mở khoá bài tiếp theo bằng cách upsert (trạng thái mặc định là IN_PROGRESS/UNLOCKED)
                        await this.userLessonProgressRepository.upsertInProgress(userId, nextLesson.id.toString());
                    }
                }
            } catch (error) {
                // Log lỗi, không throw để khỏi ảnh hưởng response trả về FE
                console.error("Error unlocking next lesson:", error);
            }
        }

        return {
            isCorrect,
            // Chỉ trả correctAnswer khi user trả lời sai
            correctAnswer: isCorrect ? null : question.correctAnswer ?? null,
            explanation: question.explanation ?? null,
            heartsRemaining: newHeartRemaining,
            nextHeartAt: nextHeartAt ? nextHeartAt.toISOString() : null,
            sessionStatus: newStatus,
            correctCount: newCorrectCount,
            wrongCount: newWrongCount,
            score: newScore,
        };
    }

    /**
     * Kiểm tra đáp án theo từng loại question type.
     * - MULTIPLE_CHOICE / LISTENING: so sánh với option isCorrect = true
     * - FILL_BLANK / TRANSLATION: so sánh case-insensitive với correctAnswer
     * - ORDER_SENTENCE: so sánh mảng cố định thứ tự
     * - MATCHING: kiểm tra mọi cặp khớp
     */
    private checkAnswer(
        questionType: string,
        correctAnswer: unknown,
        userAnswer: string | string[],
        options?: Array<{ _id?: unknown; content: string; isCorrect: boolean }> | null,
        matchingPairs?: Array<{ leftValue: string; rightValue: string }> | null,
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
        options?: Array<{ _id?: unknown; content: string; isCorrect: boolean }> | null,
    ): boolean {
        if (typeof userAnswer !== "string" || !options) return false;
        const correctOption = options.find((o) => {
            // Check both string equality and object id toString equality
            const idStr = o._id?.toString() || ""; return idStr === userAnswer || o._id === userAnswer || o.content === userAnswer;
        });
        return correctOption?.isCorrect === true;
    }

    private checkTextBased(correctAnswer: unknown, userAnswer: string | string[]): boolean {
        if (typeof userAnswer !== "string" || typeof correctAnswer !== "string") return false;
        const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, " ");
        return normalize(userAnswer) === normalize(correctAnswer);
    }

    private checkOrderSentence(correctAnswer: unknown, userAnswer: string | string[]): boolean {
        if (!Array.isArray(userAnswer) || !Array.isArray(correctAnswer)) return false;
        if (userAnswer.length !== (correctAnswer as string[]).length) return false;
        return (correctAnswer as string[]).every((word, idx) => {
            const submitted = userAnswer[idx] ?? "";
            const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, " ");
            return normalize(word) === normalize(submitted);
        });
    }

    private checkMatching(
        userAnswer: string | string[],
        matchingPairs?: Array<{ leftValue: string; rightValue: string }> | null,
    ): boolean {
        if (!Array.isArray(userAnswer) || !matchingPairs || userAnswer.length !== matchingPairs.length) {
            return false;
        }
        
        // Matching format: Array of "leftValue||rightValue"
        return matchingPairs.every((pair) => {
            const expected = `${pair.leftValue.trim()}||${pair.rightValue.trim()}`.toLowerCase(); const expectedDash = `${pair.leftValue.trim()}-${pair.rightValue.trim()}`.toLowerCase();
            return userAnswer.some((submittedItem) => {
                const submitted = (typeof submittedItem === "string" ? submittedItem : "").trim().toLowerCase();
                return submitted === expected || submitted === expectedDash;
            });
        });
    }
}

import { AppError } from "../errors/app-error.js";
import { mapLearningQuestionToResponse, mapLearningSessionToResponse } from "../mappers/learning.mapper.js";
import type { ILearningSessionRepository } from "../repositories/interfaces/learning-session.repository.interface.js";
import type { ILessonQuestionRepository } from "../repositories/interfaces/lesson-question.repository.interface.js";
import type { IQuestionRepository } from "../repositories/interfaces/question.repository.interface.js";
import type { IUserLessonProgressRepository } from "../repositories/interfaces/user-lesson-progress.repository.interface.js";
import type { IUserRepository } from "../repositories/interfaces/user.repository.interface.js";
import type { StartLessonResponse } from "../types/learning.types.js";
import type { LearningProgressionService } from "./learning-progression.service.js";

export class LearningService {
    constructor(
        private readonly lessonQuestionRepository: ILessonQuestionRepository,
        private readonly questionRepository: IQuestionRepository,
        private readonly userRepository: IUserRepository,
        private readonly userLessonProgressRepository: IUserLessonProgressRepository,
        private readonly learningSessionRepository: ILearningSessionRepository,
        private readonly progressionService: LearningProgressionService,
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

        const user = await this.userRepository.findById(userId);
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
            hearts: { current: user.stats.currentHeart, max: user.stats.maxHeart },
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
}

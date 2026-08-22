import type { LearningSessionDocument, LearningSessionStatus } from "../../models/learning-session.model.js";

export interface CreateLearningSessionData {
    heartStart: number;
    heartRemaining: number;
    totalQuestions: number;
}

export interface UpdateSessionAfterAnswerData {
    correctCount: number;
    wrongCount: number;
    score: number;
    heartRemaining: number;
    status: LearningSessionStatus;
    xpEarned?: number;
    diamondEarned?: number;
    completedAt?: Date;
}

export interface ILearningSessionRepository {
    findByIdAndUserId(sessionId: string, userId: string): Promise<LearningSessionDocument | null>;
    abandonInProgressByUserIdAndLessonId(userId: string, lessonId: string): Promise<void>;
    create(userId: string, lessonId: string, data: CreateLearningSessionData): Promise<LearningSessionDocument>;
    updateAfterAnswer(sessionId: string, data: UpdateSessionAfterAnswerData): Promise<LearningSessionDocument | null>;
}

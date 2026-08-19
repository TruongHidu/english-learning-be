import type { LearningSessionDocument } from "../../models/learning-session.model.js";

export interface CreateLearningSessionData {
    heartStart: number;
    heartRemaining: number;
    totalQuestions: number;
}

export interface ILearningSessionRepository {
    abandonInProgressByUserIdAndLessonId(userId: string, lessonId: string): Promise<void>;
    create(userId: string, lessonId: string, data: CreateLearningSessionData): Promise<LearningSessionDocument>;
}

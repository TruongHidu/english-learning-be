import type { UserLessonProgressDocument, UserLessonProgressStatus } from "../../models/user-lesson-progress.model.js";

export interface CompleteLessonData {
    score: number;
    bestScore: number;
    totalAttempts: number;
    correctCount: number;
    wrongCount: number;
    completedAt: Date;
}

export interface IUserLessonProgressRepository {
    findByUserIdAndLessonId(userId: string, lessonId: string): Promise<UserLessonProgressDocument | null>;
    findByUserIdAndLessonIds(userId: string, lessonIds: string[]): Promise<UserLessonProgressDocument[]>;
    create(userId: string, lessonId: string, status: UserLessonProgressStatus): Promise<UserLessonProgressDocument>;
    upsertInProgress(userId: string, lessonId: string): Promise<void>;
    updateStatus(userId: string, lessonId: string, status: UserLessonProgressStatus): Promise<UserLessonProgressDocument | null>;
    completeLesson(userId: string, lessonId: string, data: CompleteLessonData): Promise<UserLessonProgressDocument | null>;
}


import type { UserLessonProgressDocument, UserLessonProgressStatus } from "../../models/user-lesson-progress.model.js";

export interface IUserLessonProgressRepository {
    findByUserIdAndLessonId(userId: string, lessonId: string): Promise<UserLessonProgressDocument | null>;
    findByUserIdAndLessonIds(userId: string, lessonIds: string[]): Promise<UserLessonProgressDocument[]>;
    create(userId: string, lessonId: string, status: UserLessonProgressStatus): Promise<UserLessonProgressDocument>;
    updateStatus(userId: string, lessonId: string, status: UserLessonProgressStatus): Promise<UserLessonProgressDocument | null>;
}

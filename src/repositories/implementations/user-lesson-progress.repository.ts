import { UserLessonProgressModel, type UserLessonProgressDocument, type UserLessonProgressStatus } from "../../models/user-lesson-progress.model.js";
import type { IUserLessonProgressRepository } from "../interfaces/user-lesson-progress.repository.interface.js";

export class UserLessonProgressRepository implements IUserLessonProgressRepository {
    async findByUserIdAndLessonId(userId: string, lessonId: string): Promise<UserLessonProgressDocument | null> {
        return UserLessonProgressModel.findOne({ userId, lessonId }).exec();
    }

    async findByUserIdAndLessonIds(userId: string, lessonIds: string[]): Promise<UserLessonProgressDocument[]> {
        return UserLessonProgressModel.find({
            userId,
            lessonId: { $in: lessonIds },
        }).exec();
    }

    async create(userId: string, lessonId: string, status: UserLessonProgressStatus): Promise<UserLessonProgressDocument> {
        return UserLessonProgressModel.create({
            userId,
            lessonId,
            status,
            ...(status === "UNLOCKED" && { unlockedAt: new Date() }),
        });
    }

    async updateStatus(userId: string, lessonId: string, status: UserLessonProgressStatus): Promise<UserLessonProgressDocument | null> {
        return UserLessonProgressModel.findOneAndUpdate(
            { userId, lessonId },
            { $set: { status } },
            { new: true, runValidators: true },
        ).exec();
    }
}

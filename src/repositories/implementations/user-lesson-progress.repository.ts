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

    async upsertInProgress(userId: string, lessonId: string): Promise<void> {
        await UserLessonProgressModel.updateOne(
            { userId, lessonId },
            [
                {
                    $set: {
                        // A concurrent start request must never downgrade a completed lesson.
                        status: {
                            $cond: [
                                { $eq: ["$status", "COMPLETED"] },
                                "COMPLETED",
                                "IN_PROGRESS",
                            ],
                        },
                        bestScore: { $ifNull: ["$bestScore", 0] },
                        totalAttempts: { $ifNull: ["$totalAttempts", 0] },
                        correctCount: { $ifNull: ["$correctCount", 0] },
                        wrongCount: { $ifNull: ["$wrongCount", 0] },
                        unlockedAt: { $ifNull: ["$unlockedAt", "$$NOW"] },
                        createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
                        updatedAt: "$$NOW",
                    },
                },
            ],
            {
                upsert: true,
            },
        ).exec();
    }

    async updateStatus(userId: string, lessonId: string, status: UserLessonProgressStatus): Promise<UserLessonProgressDocument | null> {
        return UserLessonProgressModel.findOneAndUpdate(
            { userId, lessonId },
            { $set: { status } },
            { new: true, runValidators: true },
        ).exec();
    }
}

import { UserLessonProgressModel, type UserLessonProgressDocument, type UserLessonProgressStatus } from "../../models/user-lesson-progress.model.js";
import type {
    CompleteLessonData,
    FailedLessonAttemptData,
    IUserLessonProgressRepository,
} from "../interfaces/user-lesson-progress.repository.interface.js";

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
        const existing = await UserLessonProgressModel.findOne({ userId, lessonId }).exec();

        if (!existing) {
            // New record: create as IN_PROGRESS
            await UserLessonProgressModel.create({
                userId,
                lessonId,
                status: "IN_PROGRESS",
                bestScore: 0,
                totalAttempts: 0,
                correctCount: 0,
                wrongCount: 0,
                unlockedAt: new Date(),
            });
        } else if (existing.status !== "COMPLETED") {
            // Never downgrade a COMPLETED lesson back to IN_PROGRESS
            await UserLessonProgressModel.updateOne(
                { userId, lessonId },
                { $set: { status: "IN_PROGRESS" } },
            ).exec();
        }
        // If already COMPLETED — do nothing
    }

    async updateStatus(userId: string, lessonId: string, status: UserLessonProgressStatus): Promise<UserLessonProgressDocument | null> {
        return UserLessonProgressModel.findOneAndUpdate(
            { userId, lessonId },
            { $set: { status } },
            { returnDocument: "after", runValidators: true },
        ).exec();
    }

    async recordFailedAttempt(
        userId: string,
        lessonId: string,
        data: FailedLessonAttemptData,
    ): Promise<UserLessonProgressDocument | null> {
        const existing = await this.findByUserIdAndLessonId(userId, lessonId);
        const status = existing?.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";

        const update: {
            $set: Record<string, unknown>;
            $unset?: Record<string, 1>;
        } = {
            $set: {
                status,
                bestScore: data.bestScore,
                totalAttempts: data.totalAttempts,
                correctCount: data.correctCount,
                wrongCount: data.wrongCount,
                ...(status === "IN_PROGRESS" && { unlockedAt: existing?.unlockedAt ?? new Date() }),
            },
        };

        if (status === "IN_PROGRESS") {
            update.$unset = { completedAt: 1 };
        }

        return UserLessonProgressModel.findOneAndUpdate(
            { userId, lessonId },
            update,
            { returnDocument: "after", runValidators: true, upsert: true },
        ).exec();
    }

    async completeLesson(
        userId: string,
        lessonId: string,
        data: CompleteLessonData,
    ): Promise<UserLessonProgressDocument | null> {
        return UserLessonProgressModel.findOneAndUpdate(
            { userId, lessonId },
            {
                $set: {
                    status: "COMPLETED",
                    bestScore: data.bestScore,
                    totalAttempts: data.totalAttempts,
                    correctCount: data.correctCount,
                    wrongCount: data.wrongCount,
                    completedAt: data.completedAt,
                },
            },
            { returnDocument: "after", runValidators: true, upsert: true },
        ).exec();
    }
}

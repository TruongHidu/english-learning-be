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
            ...(status !== "LOCKED" && { accessGrantedAt: new Date() }),
            ...(status === "UNLOCKED" && { unlockedAt: new Date() }),
        });
    }

    async upsertInProgress(userId: string, lessonId: string): Promise<void> {
        await UserLessonProgressModel.updateOne({ userId, lessonId }, {
            $setOnInsert: { status: "IN_PROGRESS", accessGrantedAt: new Date(), unlockedAt: new Date() },
        }, { upsert: true });
        await UserLessonProgressModel.updateOne({ userId, lessonId, status: { $ne: "COMPLETED" }, firstCompletedAt: { $exists: false } }, {
            $set: { status: "IN_PROGRESS" },
        });
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
        const status = existing?.status === "COMPLETED" || existing?.firstCompletedAt ? "COMPLETED" : "IN_PROGRESS";

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
                accessGrantedAt: existing?.accessGrantedAt ?? existing?.unlockedAt ?? new Date(),
                ...(status === "IN_PROGRESS" && { unlockedAt: existing?.unlockedAt ?? new Date() }),
            },
        };

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
        const existing = await this.findByUserIdAndLessonId(userId, lessonId);
        return UserLessonProgressModel.findOneAndUpdate(
            { userId, lessonId },
            {
                $set: {
                    status: "COMPLETED",
                    bestScore: data.bestScore,
                    totalAttempts: data.totalAttempts,
                    correctCount: data.correctCount,
                    wrongCount: data.wrongCount,
                    completedAt: existing?.completedAt ?? data.completedAt,
                    firstCompletedAt: existing?.firstCompletedAt ?? existing?.completedAt ?? data.completedAt,
                    accessGrantedAt: existing?.accessGrantedAt ?? existing?.unlockedAt ?? data.completedAt,
                },
                $max: { completedVersion: data.completedVersion, lastCompletedAt: data.completedAt },
            },
            { returnDocument: "after", runValidators: true, upsert: true },
        ).exec();
    }
}

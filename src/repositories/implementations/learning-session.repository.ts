import { LearningSessionModel, type LearningSessionDocument } from "../../models/learning-session.model.js";
import type { CreateLearningSessionData, ILearningSessionRepository } from "../interfaces/learning-session.repository.interface.js";

export class LearningSessionRepository implements ILearningSessionRepository {
    async abandonInProgressByUserIdAndLessonId(userId: string, lessonId: string): Promise<void> {
        await LearningSessionModel.updateMany(
            { userId, lessonId, status: "IN_PROGRESS" },
            { $set: { status: "ABANDONED" } },
        ).exec();
    }

    async create(userId: string, lessonId: string, data: CreateLearningSessionData): Promise<LearningSessionDocument> {
        return LearningSessionModel.create({
            userId,
            lessonId,
            status: "IN_PROGRESS",
            heartStart: data.heartStart,
            heartRemaining: data.heartRemaining,
            totalQuestions: data.totalQuestions,
            correctCount: 0,
            wrongCount: 0,
            score: 0,
            xpEarned: 0,
            diamondEarned: 0,
            startedAt: new Date(),
        });
    }
}

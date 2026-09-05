import {
    LearningSessionModel,
    type LearningSessionDocument,
} from "../../models/learning-session.model.js";
import { Types, type UpdateWithAggregationPipeline } from "mongoose";
import type {
    CreateLearningSessionData,
    ILearningSessionRepository,
    RecordAnswerData,
    UpdateSessionAfterAnswerData,
} from "../interfaces/learning-session.repository.interface.js";

export class LearningSessionRepository implements ILearningSessionRepository {
    async findByIdAndUserId(sessionId: string, userId: string): Promise<LearningSessionDocument | null> {
        return LearningSessionModel.findOne({ _id: sessionId, userId }).exec();
    }

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
            requiredScore: data.requiredScore,
            totalQuestions: data.totalQuestions,
            questionIds: data.questionIds,
            answeredQuestionIds: [],
            questionSnapshots: data.questionSnapshots,
            correctCount: 0,
            wrongCount: 0,
            score: 0,
            xpEarned: 0,
            diamondEarned: 0,
            startedAt: new Date(),
            terminalProcessed: false,
        });
    }

    async recordAnswer(data: RecordAnswerData): Promise<LearningSessionDocument | null> {
        const questionId = new Types.ObjectId(data.questionId);
        const correctIncrement = data.isCorrect ? 1 : 0;
        const wrongIncrement = data.isCorrect ? 0 : 1;
        const heartDecrement = data.isCorrect ? 0 : 1;
        const now = new Date();

        const pipeline: UpdateWithAggregationPipeline = [
            {
                $set: {
                    answeredQuestionIds: {
                        $setUnion: [
                            { $ifNull: ["$answeredQuestionIds", []] },
                            [questionId],
                        ],
                    },
                    correctCount: {
                        $add: [{ $ifNull: ["$correctCount", 0] }, correctIncrement],
                    },
                    wrongCount: {
                        $add: [{ $ifNull: ["$wrongCount", 0] }, wrongIncrement],
                    },
                    heartRemaining: {
                        $max: [
                            0,
                            {
                                $subtract: [
                                    { $ifNull: ["$heartRemaining", 0] },
                                    heartDecrement,
                                ],
                            },
                        ],
                    },
                },
            },
            {
                $set: {
                    score: {
                        $cond: [
                            { $gt: [{ $ifNull: ["$totalQuestions", 0] }, 0] },
                            {
                                $round: [
                                    {
                                        $multiply: [
                                            { $divide: ["$correctCount", "$totalQuestions"] },
                                            100,
                                        ],
                                    },
                                    0,
                                ],
                            },
                            0,
                        ],
                    },
                },
            },
            {
                $set: {
                    status: {
                        $cond: [
                            { $lte: ["$heartRemaining", 0] },
                            "FAILED",
                            {
                                $cond: [
                                    { $gte: [{ $size: "$answeredQuestionIds" }, "$totalQuestions"] },
                                    {
                                        $cond: [
                                            { $gte: ["$score", { $ifNull: ["$requiredScore", 80] }] },
                                            "COMPLETED",
                                            "FAILED",
                                        ],
                                    },
                                    "IN_PROGRESS",
                                ],
                            },
                        ],
                    },
                },
            },
            {
                $set: {
                    completedAt: {
                        $cond: [
                            { $ne: ["$status", "IN_PROGRESS"] },
                            { $ifNull: ["$completedAt", now] },
                            "$completedAt",
                        ],
                    },
                },
            },
        ];

        return LearningSessionModel.findOneAndUpdate(
            {
                _id: data.sessionId,
                userId: data.userId,
                status: "IN_PROGRESS",
                questionIds: questionId,
                answeredQuestionIds: { $ne: questionId },
                heartRemaining: { $gt: 0 },
            },
            pipeline as unknown as Record<string, unknown>,
            {
                returnDocument: "after",
                // Mongoose 9 requires this flag for array-based update pipelines.
                updatePipeline: true,
            },
        ).exec();
    }

    async claimTerminalProcessing(
        sessionId: string,
        userId: string,
    ): Promise<LearningSessionDocument | null> {
        return LearningSessionModel.findOneAndUpdate(
            {
                _id: sessionId,
                userId,
                status: { $in: ["COMPLETED", "FAILED"] },
                terminalProcessed: false,
            },
            { $set: { terminalProcessed: true } },
            { returnDocument: "after" },
        ).exec();
    }

    async releaseTerminalProcessing(sessionId: string, userId: string): Promise<void> {
        await LearningSessionModel.updateOne(
            { _id: sessionId, userId, status: { $in: ["COMPLETED", "FAILED"] } },
            { $set: { terminalProcessed: false } },
        ).exec();
    }

    async updateAfterAnswer(sessionId: string, data: UpdateSessionAfterAnswerData): Promise<LearningSessionDocument | null> {
        return LearningSessionModel.findByIdAndUpdate(
            sessionId,
            { $set: data },
            { returnDocument: "after", runValidators: true },
        ).exec();
    }
}

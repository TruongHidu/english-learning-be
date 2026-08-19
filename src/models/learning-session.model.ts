import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export const LEARNING_SESSION_STATUSES = [
    "IN_PROGRESS",
    "COMPLETED",
    "FAILED",
    "ABANDONED",
] as const;

export type LearningSessionStatus = (typeof LEARNING_SESSION_STATUSES)[number];

export interface LearningSessionPersistence {
    userId: Types.ObjectId;
    lessonId: Types.ObjectId;
    status: LearningSessionStatus;
    heartStart: number;
    heartRemaining: number;
    totalQuestions: number;
    correctCount: number;
    wrongCount: number;
    score: number;
    xpEarned: number;
    diamondEarned: number;
    startedAt: Date;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export type LearningSessionDocument = HydratedDocument<LearningSessionPersistence>;

const learningSessionSchema = new Schema<LearningSessionPersistence>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
        status: {
            type: String,
            enum: LEARNING_SESSION_STATUSES,
            required: true,
            default: "IN_PROGRESS",
        },
        heartStart: { type: Number, required: true, min: 0 },
        heartRemaining: { type: Number, required: true, min: 0 },
        totalQuestions: { type: Number, required: true, min: 0 },
        correctCount: { type: Number, required: true, min: 0, default: 0 },
        wrongCount: { type: Number, required: true, min: 0, default: 0 },
        score: { type: Number, required: true, min: 0, max: 100, default: 0 },
        xpEarned: { type: Number, required: true, min: 0, default: 0 },
        diamondEarned: { type: Number, required: true, min: 0, default: 0 },
        startedAt: { type: Date, required: true, default: Date.now },
        completedAt: { type: Date, required: false },
    },
    { timestamps: true, versionKey: false },
);

learningSessionSchema.index({ userId: 1, lessonId: 1, status: 1 });
learningSessionSchema.index({ userId: 1, startedAt: -1 });

export const LearningSessionModel = model<LearningSessionPersistence>(
    "LearningSession",
    learningSessionSchema,
);

import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export const USER_LESSON_PROGRESS_STATUSES = [
    "LOCKED",
    "UNLOCKED",
    "IN_PROGRESS",
    "COMPLETED",
] as const;

export type UserLessonProgressStatus = (typeof USER_LESSON_PROGRESS_STATUSES)[number];

export interface UserLessonProgressPersistence {
    userId: Types.ObjectId;
    lessonId: Types.ObjectId;
    status: UserLessonProgressStatus;
    bestScore: number;
    totalAttempts: number;
    correctCount: number;
    wrongCount: number;
    unlockedAt?: Date;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export type UserLessonProgressDocument = HydratedDocument<UserLessonProgressPersistence>;

const userLessonProgressSchema = new Schema<UserLessonProgressPersistence>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
        status: {
            type: String,
            enum: USER_LESSON_PROGRESS_STATUSES,
            required: true,
            default: "LOCKED",
        },
        bestScore: { type: Number, required: true, min: 0, max: 100, default: 0 },
        totalAttempts: { type: Number, required: true, min: 0, default: 0 },
        correctCount: { type: Number, required: true, min: 0, default: 0 },
        wrongCount: { type: Number, required: true, min: 0, default: 0 },
        unlockedAt: { type: Date, required: false },
        completedAt: { type: Date, required: false },
    },
    { timestamps: true, versionKey: false },
);

userLessonProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

export const UserLessonProgressModel = model<UserLessonProgressPersistence>(
    "UserLessonProgress",
    userLessonProgressSchema,
);

import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export type LearnedStatus = "LEARNED" | "MASTERED";

export interface UserVocabularyPersistence {
    userId: Types.ObjectId;
    vocabularyId: Types.ObjectId;
    topicId: Types.ObjectId;
    lessonId: Types.ObjectId;
    status: LearnedStatus;
    reviewLevel: number;
    reviewCount: number;
    correctCount: number;
    incorrectCount: number;
    excludedFromReview: boolean;
    learnedAt: Date;
    lastReviewedAt: Date | null;
    nextReviewAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export type UserVocabularyDocument = HydratedDocument<UserVocabularyPersistence>;

const userVocabularySchema = new Schema<UserVocabularyPersistence>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        vocabularyId: { type: Schema.Types.ObjectId, ref: "Vocabulary", required: true, index: true },
        topicId: { type: Schema.Types.ObjectId, ref: "Topic", required: true, index: true },
        lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
        status: { type: String, enum: ["LEARNED", "MASTERED"], default: "LEARNED" },
        reviewLevel: { type: Number, required: true, default: 0, min: 0, max: 5 },
        reviewCount: { type: Number, required: true, default: 0, min: 0 },
        correctCount: { type: Number, required: true, default: 0, min: 0 },
        incorrectCount: { type: Number, required: true, default: 0, min: 0 },
        excludedFromReview: { type: Boolean, default: false },
        learnedAt: { type: Date, required: true, default: Date.now },
        lastReviewedAt: { type: Date, default: null },
        nextReviewAt: { type: Date, required: true, default: Date.now },
    },
    { timestamps: true, versionKey: false },
);

userVocabularySchema.index({ userId: 1, vocabularyId: 1 }, { unique: true });
userVocabularySchema.index({ userId: 1, topicId: 1 });
userVocabularySchema.index({ userId: 1, lessonId: 1 });
userVocabularySchema.index({ userId: 1, nextReviewAt: 1, excludedFromReview: 1, status: 1 });

export const UserVocabularyModel = model<UserVocabularyPersistence>(
    "UserVocabulary",
    userVocabularySchema,
);

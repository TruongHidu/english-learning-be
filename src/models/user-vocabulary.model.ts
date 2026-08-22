import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export interface UserVocabularyPersistence {
    userId: Types.ObjectId;
    vocabularyId: Types.ObjectId;
    masteryLevel: number;
    reviewCount: number;
    learnedAt: Date;
    lastReviewedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export type UserVocabularyDocument = HydratedDocument<UserVocabularyPersistence>;

const userVocabularySchema = new Schema<UserVocabularyPersistence>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        vocabularyId: { type: Schema.Types.ObjectId, ref: "Vocabulary", required: true, index: true },
        masteryLevel: { type: Number, required: true, min: 1, default: 1 },
        reviewCount: { type: Number, required: true, min: 1, default: 1 },
        learnedAt: { type: Date, required: true, default: Date.now },
        lastReviewedAt: { type: Date, required: true, default: Date.now },
    },
    { timestamps: true, versionKey: false },
);

userVocabularySchema.index({ userId: 1, vocabularyId: 1 }, { unique: true });

export const UserVocabularyModel = model<UserVocabularyPersistence>(
    "UserVocabulary",
    userVocabularySchema,
);

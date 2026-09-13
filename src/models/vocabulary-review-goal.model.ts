import { Schema, model, type Types } from "mongoose";

export interface VocabularyReviewGoalPersistence {
    userId: Types.ObjectId;
    type: "WORDS" | "MINUTES";
    target: number;
    createdAt: Date;
    updatedAt: Date;
}

const vocabularyReviewGoalSchema = new Schema<VocabularyReviewGoalPersistence>({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    type: { type: String, enum: ["WORDS", "MINUTES"], default: "WORDS" },
    target: { type: Number, min: 1, max: 120, default: 10 },
}, { timestamps: true, versionKey: false });

export const VocabularyReviewGoalModel = model<VocabularyReviewGoalPersistence>(
    "VocabularyReviewGoal",
    vocabularyReviewGoalSchema,
);

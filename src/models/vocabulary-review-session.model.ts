import { Schema, model, type HydratedDocument, type Types } from "mongoose";
import type { CreateReviewSessionInput } from "../types/vocabulary-review.types.js";

export type ReviewSessionStatus = "ACTIVE" | "COMPLETED" | "EXITED" | "EXPIRED";

export interface VocabularyReviewSessionPersistence {
  userId: Types.ObjectId;
  status: ReviewSessionStatus;
  settings: CreateReviewSessionInput;
  questions: Record<string, unknown>[];
  answers: Record<string, unknown>[];
  xpEarned: number;
  xpGrantedAt?: Date;
  startedAt: Date;
  completedAt?: Date;
  exitedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type VocabularyReviewSessionDocument =
  HydratedDocument<VocabularyReviewSessionPersistence>;

const vocabularyReviewSessionSchema =
  new Schema<VocabularyReviewSessionPersistence>(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
      status: {
        type: String,
        enum: ["ACTIVE", "COMPLETED", "EXITED", "EXPIRED"],
        default: "ACTIVE",
        index: true,
      },
      settings: { type: Schema.Types.Mixed, required: true },
      questions: {
        type: [Schema.Types.Mixed],
        required: true,
        default: [],
      } as never,
      answers: {
        type: [Schema.Types.Mixed],
        required: true,
        default: [],
      } as never,
      xpEarned: { type: Number, min: 0, default: 0 },
      xpGrantedAt: Date,
      startedAt: { type: Date, default: Date.now },
      completedAt: Date,
      exitedAt: Date,
      expiresAt: { type: Date, required: true },
    },
    { timestamps: true, versionKey: false },
  );

vocabularyReviewSessionSchema.index({ userId: 1, status: 1, updatedAt: -1 });
vocabularyReviewSessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 },
);

export const VocabularyReviewSessionModel =
  model<VocabularyReviewSessionPersistence>(
    "VocabularyReviewSession",
    vocabularyReviewSessionSchema,
  );

import { Schema, model, type HydratedDocument, type Types } from "mongoose";
import {
    AI_GENERATION_STATUSES,
    AI_GENERATION_TYPES,
    type AIGenerationStatus,
    type AIGenerationType,
} from "../types/ai-generation.types.js";

export interface AIGenerationPersistence {
    adminId: Types.ObjectId;
    topicId: Types.ObjectId;
    lessonId?: Types.ObjectId;
    generationType: AIGenerationType;
    status: AIGenerationStatus;
    provider: string;
    modelName: string;
    promptVersion: string;
    requestedCount: number;
    generatedCount: number;
    acceptedCount: number;
    inputSnapshot: Record<string, unknown>;
    candidates: unknown[];
    result: unknown[];
    resultIds: Types.ObjectId[];
    errorCode?: string;
    errorMessage?: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
}

export type AIGenerationDocument = HydratedDocument<AIGenerationPersistence>;

const aiGenerationSchema = new Schema<AIGenerationPersistence>(
    {
        adminId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        topicId: { type: Schema.Types.ObjectId, ref: "Topic", required: true, index: true },
        lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: false, index: true },
        generationType: { type: String, enum: AI_GENERATION_TYPES, required: true, index: true },
        status: { type: String, enum: AI_GENERATION_STATUSES, required: true, default: "PENDING", index: true },
        provider: { type: String, required: true, trim: true, maxlength: 50 },
        modelName: { type: String, required: true, trim: true, maxlength: 100 },
        promptVersion: { type: String, required: true, trim: true, maxlength: 50 },
        requestedCount: { type: Number, required: true, min: 1, max: 500 },
        generatedCount: { type: Number, required: true, min: 0, max: 500, default: 0 },
        acceptedCount: { type: Number, required: true, min: 0, max: 500, default: 0 },
        inputSnapshot: { type: Schema.Types.Mixed, required: true },
        candidates: { type: [Schema.Types.Mixed], required: true, default: [] },
        result: { type: [Schema.Types.Mixed], required: true, default: [] },
        resultIds: { type: [{ type: Schema.Types.ObjectId }], required: true, default: [] },
        errorCode: { type: String, required: false, trim: true, maxlength: 100 },
        errorMessage: { type: String, required: false, trim: true, maxlength: 500 },
        createdAt: { type: Date, required: true, default: Date.now },
        startedAt: { type: Date, required: false },
        completedAt: { type: Date, required: false },
    },
    { timestamps: true, versionKey: false },
);

aiGenerationSchema.index({ adminId: 1, createdAt: -1 });
aiGenerationSchema.index({ topicId: 1, createdAt: -1 });

export const AIGenerationModel = model<AIGenerationPersistence>("AIGeneration", aiGenerationSchema);

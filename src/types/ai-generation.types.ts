export const AI_GENERATION_TYPES = ["VOCABULARY", "QUESTION"] as const;
export type AIGenerationType = (typeof AI_GENERATION_TYPES)[number];

export const AI_GENERATION_STATUSES = [
    "PENDING",
    "PROCESSING",
    "COMMITTING",
    "COMPLETED",
    "PARTIAL",
    "FAILED",
    "CANCELED",
    "COMMITTED",
] as const;
export type AIGenerationStatus = (typeof AI_GENERATION_STATUSES)[number];

export interface AIGenerationResponse {
    id: string;
    adminId: string;
    topicId: string;
    lessonId: string | null;
    generationType: AIGenerationType;
    status: AIGenerationStatus;
    provider: string;
    modelName: string;
    promptVersion: string;
    requestedCount: number;
    generatedCount: number;
    acceptedCount: number;
    inputSnapshot: Record<string, unknown>;
    candidates: Array<VocabularyPreviewCandidate | QuestionPreviewCandidate>;
    result: unknown[];
    resultIds: string[];
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
}

export interface AIGenerationListQuery {
    page?: number;
    limit?: number;
    status?: AIGenerationStatus;
    generationType?: AIGenerationType;
}

export interface AIGenerationResultData {
    status: Extract<AIGenerationStatus, "COMPLETED" | "PARTIAL">;
    generatedCount: number;
    acceptedCount: number;
    candidates: unknown[];
    result: unknown[];
    resultIds: string[];
}
import type {
    QuestionPreviewCandidate,
    VocabularyPreviewCandidate,
} from "../ai/schemas/generated-content.schema.js";

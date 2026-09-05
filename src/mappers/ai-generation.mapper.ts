import type { AIGenerationDocument } from "../models/ai-generation.model.js";
import type { AIGenerationResponse } from "../types/ai-generation.types.js";
import {
    questionPreviewCandidatesSchema,
    vocabularyPreviewCandidatesSchema,
} from "../ai/schemas/generated-content.schema.js";

export const mapAIGenerationToResponse = (
    generation: AIGenerationDocument,
): AIGenerationResponse => {
    const parsedCandidates = generation.generationType === "QUESTION"
        ? questionPreviewCandidatesSchema.safeParse(generation.candidates)
        : vocabularyPreviewCandidatesSchema.safeParse(generation.candidates);
    return ({
    id: generation._id.toString(),
    adminId: generation.adminId.toString(),
    topicId: generation.topicId.toString(),
    lessonId: generation.lessonId?.toString() ?? null,
    generationType: generation.generationType,
    status: generation.status,
    provider: generation.provider,
    modelName: generation.modelName,
    promptVersion: generation.promptVersion,
    requestedCount: generation.requestedCount,
    generatedCount: generation.generatedCount,
    acceptedCount: generation.acceptedCount,
    inputSnapshot: generation.inputSnapshot,
    candidates: parsedCandidates.success ? parsedCandidates.data : [],
    result: generation.result,
    resultIds: generation.resultIds.map((id) => id.toString()),
    errorCode: generation.errorCode ?? null,
    errorMessage: generation.errorMessage ?? null,
    createdAt: generation.createdAt,
    startedAt: generation.startedAt ?? null,
    completedAt: generation.completedAt ?? null,
    });
};

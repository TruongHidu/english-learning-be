import type { AIGenerationDocument } from "../../models/ai-generation.model.js";
import type {
    AIGenerationListQuery,
    AIGenerationResultData,
    AIGenerationType,
} from "../../types/ai-generation.types.js";

export interface CreateAIGenerationData {
    adminId: string;
    topicId: string;
    lessonId?: string;
    generationType: AIGenerationType;
    provider: string;
    modelName: string;
    promptVersion: string;
    requestedCount: number;
    inputSnapshot: Record<string, unknown>;
}

export interface IAIGenerationRepository {
    create(data: CreateAIGenerationData): Promise<AIGenerationDocument>;
    markProcessing(id: string, adminId: string): Promise<AIGenerationDocument | null>;
    markCompleted(
        id: string,
        adminId: string,
        data: AIGenerationResultData,
    ): Promise<AIGenerationDocument | null>;
    markFailed(
        id: string,
        adminId: string,
        errorCode: string,
        errorMessage: string,
    ): Promise<AIGenerationDocument | null>;
    markCanceled(
        id: string,
        adminId: string,
        errorCode: string,
        errorMessage: string,
    ): Promise<AIGenerationDocument | null>;
    findByIdForAdmin(id: string, adminId: string): Promise<AIGenerationDocument | null>;
    listForAdmin(
        adminId: string,
        query: AIGenerationListQuery,
    ): Promise<{ generations: AIGenerationDocument[]; total: number }>;
}

import type { AiGenerationService } from "./ai-generation.service.js";
import type {
    CommitVocabularyGenerationInput,
    CommitVocabularyGenerationResult,
    GenerateVocabularyPreviewInput,
    GenerateVocabularyPreviewResult,
    GenerateVocabulariesInput,
    GenerateVocabulariesResult,
} from "../types/ai.types.js";

export type { GenerateVocabulariesInput, GenerateVocabulariesResult } from "../types/ai.types.js";

/** Compatibility facade for existing admin vocabulary routes. */
export class AiVocabularyService {
    constructor(private readonly aiGenerationService: AiGenerationService) {}

    generateVocabularies(
        adminId: string,
        input: GenerateVocabulariesInput,
    ): Promise<GenerateVocabulariesResult> {
        return this.aiGenerationService.generateVocabularies(adminId, input);
    }

    generatePreview(
        adminId: string,
        topicId: string,
        input: GenerateVocabularyPreviewInput,
    ): Promise<GenerateVocabularyPreviewResult> {
        return this.aiGenerationService.generateVocabularyPreview(adminId, topicId, input);
    }

    commit(
        adminId: string,
        generationId: string,
        input: CommitVocabularyGenerationInput,
    ): Promise<CommitVocabularyGenerationResult> {
        return this.aiGenerationService.commitVocabularyGeneration(
            adminId,
            generationId,
            input,
        );
    }

    bulkPublishVocabularies(adminId: string, ids: string[]): Promise<{ modifiedCount: number }> {
        void adminId;
        return this.aiGenerationService.bulkPublishVocabularies(ids);
    }

    bulkDeleteVocabularies(adminId: string, ids: string[]): Promise<{ deletedCount: number }> {
        void adminId;
        return this.aiGenerationService.bulkDeleteVocabularies(ids);
    }
}

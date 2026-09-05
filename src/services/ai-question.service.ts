import type { AiGenerationService } from "./ai-generation.service.js";
import type { AdminQuestionService } from "./admin-question.service.js";
import type {
    CommitQuestionGenerationInput,
    CommitQuestionGenerationResult,
    CreateQuestionsGenerationInput,
    GenerateQuestionPreviewInput,
    GenerateQuestionPreviewResult,
    GenerateQuestionsResult,
} from "../types/ai.types.js";

export type {
    CreateQuestionsGenerationInput as GenerateQuestionsInput,
    GenerateQuestionsResult,
} from "../types/ai.types.js";

/** Compatibility facade for existing admin question routes. */
export class AiQuestionService {
    constructor(
        private readonly aiGenerationService: AiGenerationService,
        private readonly adminQuestionService: AdminQuestionService,
    ) {}

    generatePreview(
        adminId: string,
        topicId: string,
        input: GenerateQuestionPreviewInput,
        signal?: AbortSignal,
    ): Promise<GenerateQuestionPreviewResult> {
        return this.aiGenerationService.generateQuestionPreview(
            adminId,
            topicId,
            input,
            signal,
        );
    }

    commit(
        adminId: string,
        generationId: string,
        input: CommitQuestionGenerationInput,
    ): Promise<CommitQuestionGenerationResult> {
        return this.aiGenerationService.commitQuestionGeneration(adminId, generationId, input);
    }

    generateQuestions(
        adminId: string,
        input: CreateQuestionsGenerationInput,
    ): Promise<GenerateQuestionsResult> {
        return this.aiGenerationService.generateQuestions(adminId, input);
    }

    bulkPublishQuestions(
        adminId: string,
        ids: string[],
    ): Promise<{ modifiedCount: number; publishedIds: string[] }> {
        void adminId;
        return this.adminQuestionService.bulkPublishQuestions(ids);
    }

    bulkDeleteQuestions(adminId: string, ids: string[]): Promise<{ deletedCount: number }> {
        void adminId;
        return this.aiGenerationService.bulkDeleteQuestions(ids);
    }
}

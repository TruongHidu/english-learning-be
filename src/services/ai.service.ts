import type { AiGenerationService } from "./ai-generation.service.js";
import type {
    CreateQuestionsGenerationInput,
    GenerateQuestionsResult,
    GenerateVocabulariesInput,
    GenerateVocabulariesResult,
} from "../types/ai.types.js";

export type { GenerateVocabulariesInput } from "../types/ai.types.js";
export type { CreateQuestionsGenerationInput as GenerateQuestionsInput } from "../types/ai.types.js";

/**
 * Legacy facade kept for callers outside the current HTTP routes. The active
 * container does not instantiate this class; all work is delegated through DI.
 */
export class AiService {
    constructor(private readonly aiGenerationService: AiGenerationService) {}

    generateVocabularies(adminId: string, input: GenerateVocabulariesInput): Promise<GenerateVocabulariesResult> {
        return this.aiGenerationService.generateVocabularies(adminId, input);
    }

    generateQuestions(adminId: string, input: CreateQuestionsGenerationInput): Promise<GenerateQuestionsResult> {
        return this.aiGenerationService.generateQuestions(adminId, input);
    }
}

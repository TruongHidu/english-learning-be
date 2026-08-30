import { AiVocabularyService, type GenerateVocabulariesInput } from "./ai-vocabulary.service.js";
import { AiQuestionService, type GenerateQuestionsInput } from "./ai-question.service.js";

export type { GenerateVocabulariesInput } from "./ai-vocabulary.service.js";
export type { GenerateQuestionsInput } from "./ai-question.service.js";

/**
 * AiService Facade wrapper maintaining backward compatibility.
 * Delegates vocabulary tasks to AiVocabularyService and question tasks to AiQuestionService.
 */
export class AiService {
    private readonly aiVocabularyService: AiVocabularyService;
    private readonly aiQuestionService: AiQuestionService;

    constructor(
        aiVocabularyService?: AiVocabularyService,
        aiQuestionService?: AiQuestionService
    ) {
        this.aiVocabularyService = aiVocabularyService || new AiVocabularyService();
        this.aiQuestionService = aiQuestionService || new AiQuestionService();
    }

    async generateVocabularies(input: GenerateVocabulariesInput) {
        return this.aiVocabularyService.generateVocabularies(input);
    }

    async generateQuestions(input: GenerateQuestionsInput) {
        return this.aiQuestionService.generateQuestions(input);
    }

    async bulkPublishVocabularies(ids: string[]) {
        return this.aiVocabularyService.bulkPublishVocabularies(ids);
    }

    async bulkPublishQuestions(ids: string[]) {
        return this.aiQuestionService.bulkPublishQuestions(ids);
    }

    async bulkDeleteVocabularies(ids: string[]) {
        return this.aiVocabularyService.bulkDeleteVocabularies(ids);
    }

    async bulkDeleteQuestions(ids: string[]) {
        return this.aiQuestionService.bulkDeleteQuestions(ids);
    }
}

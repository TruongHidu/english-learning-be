import type { QuestionType } from "../../types/question.types.js";

export interface AiVocabularyPromptInput {
    topicName: string;
    lessonName?: string;
    level: string;
    quantity: number;
    excludeWords: string[];
    requirements?: string;
}

export interface AiVocabularyContext {
    id: string;
    word: string;
    meaning: string;
    example?: string;
    exampleMeaning?: string;
}

export interface AiQuestionPromptInput {
    topicName: string;
    lessonName?: string;
    vocabularies: AiVocabularyContext[];
    questionTypes: QuestionType[];
    quantity: number;
    difficulty: string;
    requirements?: string;
}

export interface AiGenerationRequestOptions {
    signal?: AbortSignal;
}

/**
 * Provider boundary for AI content. Implementations may return an untrusted
 * JSON value; the orchestration service must validate it before persistence.
 */
export interface IAiContentGenerator {
    generateVocabularies(
        input: AiVocabularyPromptInput,
        options?: AiGenerationRequestOptions,
    ): Promise<unknown>;
    generateQuestions(
        input: AiQuestionPromptInput,
        options?: AiGenerationRequestOptions,
    ): Promise<unknown>;
}

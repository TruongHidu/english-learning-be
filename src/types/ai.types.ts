import type { QuestionResponse, QuestionType } from "./question.types.js";
import type { VocabularyDifficulty, VocabularyResponse } from "./vocabulary.types.js";
import type {
    CommitVocabularyItem,
    CommitQuestionItem,
    QuestionPreviewCandidate,
    VocabularyPreviewCandidate,
} from "../ai/schemas/generated-content.schema.js";

export interface GenerateVocabulariesInput {
    topicId: string;
    lessonId?: string;
    level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
    quantity: number;
}

export interface GenerateVocabularyPreviewInput {
    count: number;
    requirements?: string;
}

export interface GenerateVocabularyPreviewResult {
    generationId: string;
    topicId: string;
    requestedCount: number;
    generatedCount: number;
    candidates: VocabularyPreviewCandidate[];
}

/** @deprecated Use GenerateVocabularyPreviewResult. */
export type GenerateVocabulariesResult = GenerateVocabularyPreviewResult;

export interface CommitVocabularyGenerationInput {
    items: CommitVocabularyItem[];
}

export interface CommitVocabularyGenerationResult {
    generationId: string;
    status: "COMMITTED";
    committedCount: number;
    alreadyCommitted: boolean;
    vocabularies: VocabularyResponse[];
}

export const AI_SUPPORTED_QUESTION_TYPES = [
    "MULTIPLE_CHOICE",
    "MATCHING",
    "FILL_BLANK",
    "ORDER_SENTENCE",
    "TRANSLATION",
] as const satisfies readonly QuestionType[];

export type AiSupportedQuestionType = (typeof AI_SUPPORTED_QUESTION_TYPES)[number];

export interface GenerateQuestionPreviewInput {
    lessonId?: string;
    vocabularyIds?: string[];
    questionTypes: AiSupportedQuestionType[];
    count: number;
    difficulty: VocabularyDifficulty;
    requirements?: string;
}

export interface GenerateQuestionPreviewResult {
    generationId: string;
    topicId: string;
    lessonId: string | null;
    requestedCount: number;
    generatedCount: number;
    acceptedCount: number;
    status: "COMPLETED" | "PARTIAL";
    candidates: QuestionPreviewCandidate[];
}

export interface CommitQuestionGenerationInput {
    items: CommitQuestionItem[];
}

export interface CommitQuestionGenerationResult {
    generationId: string;
    status: "COMMITTED";
    committedCount: number;
    alreadyCommitted: boolean;
    questions: QuestionResponse[];
}

/** @deprecated Use GenerateQuestionPreviewInput with topicId from the route path. */
export interface CreateQuestionsGenerationInput {
    topicId: string;
    lessonId?: string;
    vocabularyId?: string;
    vocabularyIds?: string[];
    questionTypes: string[];
    quantity: number;
    difficulty?: VocabularyDifficulty;
}

/** @deprecated Use GenerateQuestionPreviewResult. */
export type GenerateQuestionsResult = GenerateQuestionPreviewResult;

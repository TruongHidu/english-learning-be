import type { PaginationMeta } from "./course.types.js";
import type { VocabularyDifficulty } from "./vocabulary.types.js";

export const QUESTION_TYPES = [
    "MULTIPLE_CHOICE",
    "MATCHING",
    "FILL_BLANK",
    "ORDER_SENTENCE",
    "TRANSLATION",
    "LISTENING",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_STATUSES = [
    "DRAFT",
    "APPROVED",
    "REJECTED",
    "PUBLISHED",
    "INACTIVE",
] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export interface QuestionOptionResponse {
    id?: string;
    content: string;
    imageUrl?: string | null;
    isCorrect: boolean;
    orderIndex: number;
}

export interface QuestionOptionInput {
    content: string;
    imageUrl?: string | null;
    isCorrect: boolean;
    orderIndex: number;
}

export interface MatchingPairResponse {
    id?: string;
    vocabularyId?: string | null;
    leftValue: string;
    rightValue: string;
    orderIndex: number;
}

export interface MatchingPairInput {
    vocabularyId?: string | null;
    leftValue: string;
    rightValue: string;
    orderIndex: number;
}

export interface LinkedVocabularyItem {
    id: string;
    word: string;
    meaning: string;
}

export interface QuestionResponse {
    id: string;
    vocabularyId: string | null;
    vocabularyIds: string[] | null;
    vocabularies?: LinkedVocabularyItem[] | null;
    type: QuestionType;
    content: string;
    instruction: string | null;
    correctAnswer: unknown | null;
    options: QuestionOptionResponse[] | null;
    matchingPairs: MatchingPairResponse[] | null;
    explanation: string | null;
    difficulty: VocabularyDifficulty;
    audioUrl: string | null;
    imageUrl: string | null;
    status: QuestionStatus;
    createdByAi: boolean;
    aiGenerationId: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface QuestionListItemResponse {
    id: string;
    vocabularyId: string | null;
    vocabularyIds: string[] | null;
    vocabularies?: LinkedVocabularyItem[] | null;
    type: QuestionType;
    content: string;
    difficulty: VocabularyDifficulty;
    status: QuestionStatus;
    createdByAi: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateQuestionInput {
    vocabularyId?: string | null;
    vocabularyIds?: string[] | null;
    type: QuestionType;
    content: string;
    instruction?: string | null;
    correctAnswer?: unknown | null;
    options?: QuestionOptionInput[] | null;
    matchingPairs?: MatchingPairInput[] | null;
    explanation?: string | null;
    difficulty: VocabularyDifficulty;
    audioUrl?: string | null;
    imageUrl?: string | null;
}

export interface UpdateQuestionInput {
    vocabularyId?: string | null;
    vocabularyIds?: string[] | null;
    type?: QuestionType;
    content?: string;
    instruction?: string | null;
    correctAnswer?: unknown | null;
    options?: QuestionOptionInput[] | null;
    matchingPairs?: MatchingPairInput[] | null;
    explanation?: string | null;
    difficulty?: VocabularyDifficulty;
    audioUrl?: string | null;
    imageUrl?: string | null;
}


export interface QuestionListQuery {
    page?: number;
    limit?: number;
    search?: string;
    topicId?: string;
    vocabularyId?: string;
    type?: QuestionType;
    difficulty?: VocabularyDifficulty;
    status?: QuestionStatus;
    createdByAi?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface PaginatedQuestionResult {
    questions: QuestionListItemResponse[];
    pagination: PaginationMeta;
}

export interface LessonQuestionResponse {
    id: string;
    lessonId: string;
    questionId: string;
    orderIndex: number;
    question: QuestionResponse;
}

export interface AssignQuestionsInput {
    questionIds: string[];
}

export interface ReorderQuestionsInput {
    questionIds: string[];
}

import type { ContentStatus, PaginationMeta } from "./course.types.js";

export const VOCABULARY_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export type VocabularyDifficulty = (typeof VOCABULARY_DIFFICULTIES)[number];

export interface VocabularyResponse {
    id: string;
    topicId: string;
    word: string;
    meaning: string;
    phonetic: string | null;
    partOfSpeech: string | null;
    example: string | null;
    exampleMeaning: string | null;
    audioUrl: string | null;
    imageUrl: string | null;
    difficulty: VocabularyDifficulty;
    status: ContentStatus;
    createdByAi: boolean;
    aiGenerationId: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateVocabularyInput {
    word: string;
    meaning: string;
    phonetic?: string | null;
    partOfSpeech?: string | null;
    example?: string | null;
    exampleMeaning?: string | null;
    audioUrl?: string | null;
    imageUrl?: string | null;
    difficulty?: VocabularyDifficulty;
}

export interface UpdateVocabularyInput {
    word?: string;
    meaning?: string;
    phonetic?: string | null;
    partOfSpeech?: string | null;
    example?: string | null;
    exampleMeaning?: string | null;
    audioUrl?: string | null;
    imageUrl?: string | null;
    difficulty?: VocabularyDifficulty;
}

export interface VocabularyListQuery {
    page?: number;
    limit?: number;
    search?: string;
    difficulty?: VocabularyDifficulty;
    status?: ContentStatus;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface PaginatedVocabularyResult {
    vocabularies: VocabularyResponse[];
    pagination: PaginationMeta;
}

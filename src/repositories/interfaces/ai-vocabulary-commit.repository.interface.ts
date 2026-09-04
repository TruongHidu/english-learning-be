import type { VocabularyDocument } from "../../models/vocabulary.model.js";
import type { VocabularyDifficulty } from "../../types/vocabulary.types.js";

export interface AiVocabularyCommitItem {
    candidateKey: string;
    word: string;
    normalizedWord: string;
    meaning: string;
    phonetic?: string;
    partOfSpeech?: string;
    example?: string;
    exampleMeaning?: string;
}

export interface CommitAiVocabularyGenerationData {
    generationId: string;
    adminId: string;
    topicId: string;
    difficulty: VocabularyDifficulty;
    items: AiVocabularyCommitItem[];
}

export interface CommitAiVocabularyGenerationResult {
    vocabularies: VocabularyDocument[];
    alreadyCommitted: boolean;
}

/** Owns the MongoDB transaction spanning Vocabulary and AIGeneration. */
export interface IAiVocabularyCommitRepository {
    commit(
        data: CommitAiVocabularyGenerationData,
    ): Promise<CommitAiVocabularyGenerationResult>;
}

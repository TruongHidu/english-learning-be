import type { CommitQuestionItem } from "../../ai/schemas/generated-content.schema.js";
import type { QuestionDocument } from "../../models/question.model.js";

export interface AiQuestionCommitItem {
    candidate: CommitQuestionItem;
    dedupeKey: string;
}

export interface CommitAiQuestionGenerationData {
    generationId: string;
    adminId: string;
    topicId: string;
    topicVocabularyIds: string[];
    items: AiQuestionCommitItem[];
}

export interface CommitAiQuestionGenerationResult {
    questions: QuestionDocument[];
    alreadyCommitted: boolean;
}

/** Owns the MongoDB transaction spanning Question and AIGeneration. */
export interface IAiQuestionCommitRepository {
    commit(data: CommitAiQuestionGenerationData): Promise<CommitAiQuestionGenerationResult>;
}

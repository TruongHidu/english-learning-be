import type { QuestionDocument } from "../../models/question.model.js";
import type {
    CreateQuestionInput,
    QuestionListQuery,
    QuestionStatus,
    UpdateQuestionInput,
} from "../../types/question.types.js";

export interface QuestionMediaData {
    audioPublicId?: string | null;
    imagePublicId?: string | null;
    aiGenerationId?: string | null;
    topicId?: string | null;
    dedupeKey?: string | null;
}

export type CreateQuestionData = CreateQuestionInput & QuestionMediaData;
export type UpdateQuestionData = UpdateQuestionInput & QuestionMediaData;

export interface QuestionDedupeRecord {
    id: string;
    type: string;
    content: string;
    dedupeKey?: string;
}

export interface IQuestionRepository {
    findById(id: string): Promise<QuestionDocument | null>;
    findAll(
        query: QuestionListQuery,
    ): Promise<{ questions: QuestionDocument[]; total: number }>;
    create(data: CreateQuestionData): Promise<QuestionDocument>;
    update(id: string, data: UpdateQuestionData): Promise<QuestionDocument | null>;
    updateStatus(id: string, status: QuestionStatus): Promise<QuestionDocument | null>;
    deleteById(id: string): Promise<boolean>;
    countByVocabularyId(vocabularyId: string): Promise<number>;
    existsByIds(ids: string[]): Promise<boolean>;
    findByIds(ids: string[]): Promise<QuestionDocument[]>;
    findByIdsForAssignment(ids: string[]): Promise<QuestionDocument[]>;
    findDedupeRecordsByTopic(
        topicId: string,
        vocabularyIds: string[],
    ): Promise<QuestionDedupeRecord[]>;
    bulkUpdateStatus(ids: string[], status: QuestionStatus): Promise<number>;
}

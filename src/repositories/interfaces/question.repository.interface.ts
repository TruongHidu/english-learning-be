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
}

export type CreateQuestionData = CreateQuestionInput & QuestionMediaData;
export type UpdateQuestionData = UpdateQuestionInput & QuestionMediaData;

export interface IQuestionRepository {
    findById(id: string): Promise<QuestionDocument | null>;
    findAll(
        query: QuestionListQuery,
    ): Promise<{ questions: QuestionDocument[]; total: number }>;
    create(data: CreateQuestionData): Promise<QuestionDocument>;
    update(id: string, data: UpdateQuestionData): Promise<QuestionDocument | null>;
    updateStatus(id: string, status: QuestionStatus): Promise<QuestionDocument | null>;
    deleteById(id: string): Promise<void>;
    countByVocabularyId(vocabularyId: string): Promise<number>;
    existsByIds(ids: string[]): Promise<boolean>;
    findByIds(ids: string[]): Promise<QuestionDocument[]>;
}

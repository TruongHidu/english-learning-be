import type { ContentStatus } from "../../types/course.types.js";
import type { VocabularyDocument } from "../../models/vocabulary.model.js";
import type {
    CreateVocabularyInput,
    UpdateVocabularyInput,
    VocabularyListQuery,
} from "../../types/vocabulary.types.js";

export interface VocabularyWordRecord {
    id: string;
    word: string;
    normalizedWord?: string;
}

export interface IVocabularyRepository {
    findById(id: string): Promise<VocabularyDocument | null>;
    findByIds(ids: string[]): Promise<VocabularyDocument[]>;
    findByTopicId(
        topicId: string,
        query: VocabularyListQuery,
    ): Promise<{ vocabularies: VocabularyDocument[]; total: number }>;
    findAll(
        query: VocabularyListQuery,
    ): Promise<{ vocabularies: VocabularyDocument[]; total: number }>;
    findByWordAndTopicId(word: string, topicId: string): Promise<VocabularyDocument | null>;
    findWordsByTopicId(topicId: string): Promise<VocabularyWordRecord[]>;
    create(topicId: string, data: CreateVocabularyInput): Promise<VocabularyDocument>;
    update(id: string, data: UpdateVocabularyInput): Promise<VocabularyDocument | null>;
    updateStatus(id: string, status: ContentStatus): Promise<VocabularyDocument | null>;
    deleteById(id: string): Promise<boolean>;
    countByTopicId(topicId: string): Promise<number>;
}

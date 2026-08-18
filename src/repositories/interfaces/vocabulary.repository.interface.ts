import type { ContentStatus } from "../../types/course.types.js";
import type { VocabularyDocument } from "../../models/vocabulary.model.js";
import type {
    CreateVocabularyInput,
    UpdateVocabularyInput,
    VocabularyListQuery,
} from "../../types/vocabulary.types.js";

export interface IVocabularyRepository {
    findById(id: string): Promise<VocabularyDocument | null>;
    findByTopicId(
        topicId: string,
        query: VocabularyListQuery,
    ): Promise<{ vocabularies: VocabularyDocument[]; total: number }>;
    findAll(
        query: VocabularyListQuery,
    ): Promise<{ vocabularies: VocabularyDocument[]; total: number }>;
    findByWordAndTopicId(word: string, topicId: string): Promise<VocabularyDocument | null>;
    create(topicId: string, data: CreateVocabularyInput): Promise<VocabularyDocument>;
    update(id: string, data: UpdateVocabularyInput): Promise<VocabularyDocument | null>;
    updateStatus(id: string, status: ContentStatus): Promise<VocabularyDocument | null>;
    deleteById(id: string): Promise<void>;
    countByTopicId(topicId: string): Promise<number>;
}

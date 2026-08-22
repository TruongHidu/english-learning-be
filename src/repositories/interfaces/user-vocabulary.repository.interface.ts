import type { UserVocabularyDocument } from "../../models/user-vocabulary.model.js";

export interface IUserVocabularyRepository {
    upsertLearnedVocabularies(userId: string, vocabularyIds: string[]): Promise<void>;
    findByUserId(userId: string): Promise<UserVocabularyDocument[]>;
    findByUserIdWithDetails(userId: string): Promise<UserVocabularyDocument[]>;
    countByUserId(userId: string): Promise<number>;
}


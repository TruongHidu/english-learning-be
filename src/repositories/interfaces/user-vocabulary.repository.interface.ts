import type { UserVocabularyDocument, LearnedStatus } from "../../models/user-vocabulary.model.js";

export interface LearnedVocabularyListQuery {
    page: number;
    limit: number;
    status?: LearnedStatus;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface PaginatedUserVocabularyResult {
    items: UserVocabularyDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface UserVocabularyGroupedByLesson {
    lessonId: string;
    lessonName: string;
    vocabularies: UserVocabularyDocument[];
}

export interface IUserVocabularyRepository {
    upsertLearnedVocabularies(userId: string, vocabularyIds: string[], topicId: string, lessonId: string): Promise<void>;
    
    findByUserAndVocabulary(userId: string, vocabularyId: string): Promise<UserVocabularyDocument | null>;
    
    findByUserIdGroupedByLesson(userId: string): Promise<UserVocabularyGroupedByLesson[]>;
    
    findByUserId(userId: string): Promise<UserVocabularyDocument[]>;
    
    findByUserIdWithDetails(userId: string): Promise<UserVocabularyDocument[]>;
    
    findDueForReview(userId: string, query: { limit: number; forceAll?: boolean }): Promise<UserVocabularyDocument[]>;
    
    updateReviewResult(userId: string, vocabularyId: string, data: Partial<UserVocabularyDocument>): Promise<UserVocabularyDocument | null>;
    
    excludeFromReview(userId: string, vocabularyId: string, exclude: boolean): Promise<UserVocabularyDocument | null>;
    
    countDueByUserId(userId: string): Promise<number>;
}

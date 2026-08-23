import { AppError } from "../errors/app-error.js";
import type { IUserVocabularyRepository, UserVocabularyGroupedByLesson } from "../repositories/interfaces/user-vocabulary.repository.interface.js";
import type { IVocabularyRepository } from "../repositories/interfaces/vocabulary.repository.interface.js";

export class UserVocabularyService {
    constructor(
        private readonly vocabularyRepository: IVocabularyRepository,
        private readonly userVocabularyRepository: IUserVocabularyRepository,
    ) {}

    async getLearnedVocabulariesGroupedByLesson(userId: string): Promise<UserVocabularyGroupedByLesson[]> {
        return this.userVocabularyRepository.findByUserIdGroupedByLesson(userId);
    }

    async excludeFromReview(userId: string, vocabularyId: string, exclude: boolean) {
        const existing = await this.userVocabularyRepository.findByUserAndVocabulary(userId, vocabularyId);
        if (!existing) {
            throw new AppError("USER_VOCABULARY_NOT_FOUND", "Từ vựng này chưa được học", 404);
        }
        
        const updated = await this.userVocabularyRepository.excludeFromReview(userId, vocabularyId, exclude);
        return updated;
    }
}

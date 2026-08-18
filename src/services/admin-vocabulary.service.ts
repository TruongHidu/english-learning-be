import { AppError } from "../errors/app-error.js";
import { mapVocabularyToResponse } from "../mappers/vocabulary.mapper.js";
import type { IQuestionRepository } from "../repositories/interfaces/question.repository.interface.js";
import type { ITopicRepository } from "../repositories/interfaces/topic.repository.interface.js";
import type { IVocabularyRepository } from "../repositories/interfaces/vocabulary.repository.interface.js";
import type { ContentStatus } from "../types/course.types.js";
import type {
    CreateVocabularyInput,
    PaginatedVocabularyResult,
    UpdateVocabularyInput,
    VocabularyListQuery,
    VocabularyResponse,
} from "../types/vocabulary.types.js";

export class AdminVocabularyService {
    constructor(
        private readonly topicRepository: ITopicRepository,
        private readonly vocabularyRepository: IVocabularyRepository,
        private readonly questionRepository: IQuestionRepository,
    ) {}

    public async getVocabulariesByTopic(
        topicId: string,
        query: VocabularyListQuery,
    ): Promise<PaginatedVocabularyResult> {
        const topic = await this.topicRepository.findById(topicId);
        if (!topic) {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }

        const { vocabularies, total } = await this.vocabularyRepository.findByTopicId(topicId, query);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const totalPages = Math.ceil(total / limit) || 1;

        return {
            vocabularies: vocabularies.map(mapVocabularyToResponse),
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
        };
    }

    public async getAllVocabularies(
        query: VocabularyListQuery,
    ): Promise<PaginatedVocabularyResult> {
        const { vocabularies, total } = await this.vocabularyRepository.findAll(query);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const totalPages = Math.ceil(total / limit) || 1;

        return {
            vocabularies: vocabularies.map(mapVocabularyToResponse),
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
        };
    }

    public async getVocabularyById(vocabularyId: string): Promise<VocabularyResponse> {
        const vocabulary = await this.vocabularyRepository.findById(vocabularyId);
        if (!vocabulary) {
            throw new AppError("VOCABULARY_NOT_FOUND", "Không tìm thấy từ vựng", 404);
        }
        return mapVocabularyToResponse(vocabulary);
    }

    public async createVocabulary(
        topicId: string,
        input: CreateVocabularyInput,
    ): Promise<VocabularyResponse> {
        const topic = await this.topicRepository.findById(topicId);
        if (!topic) {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }

        const existingWord = await this.vocabularyRepository.findByWordAndTopicId(
            input.word,
            topicId,
        );
        if (existingWord) {
            throw new AppError(
                "VOCABULARY_ALREADY_EXISTS",
                "Từ vựng đã tồn tại trong chủ đề này",
                409,
            );
        }

        const vocabulary = await this.vocabularyRepository.create(topicId, input);
        return mapVocabularyToResponse(vocabulary);
    }

    public async updateVocabulary(
        vocabularyId: string,
        input: UpdateVocabularyInput,
    ): Promise<VocabularyResponse> {
        const existingVocabulary = await this.vocabularyRepository.findById(vocabularyId);
        if (!existingVocabulary) {
            throw new AppError("VOCABULARY_NOT_FOUND", "Không tìm thấy từ vựng", 404);
        }

        if (input.word && input.word.trim().toLowerCase() !== existingVocabulary.word.toLowerCase()) {
            const duplicate = await this.vocabularyRepository.findByWordAndTopicId(
                input.word,
                existingVocabulary.topicId.toString(),
            );
            if (duplicate) {
                throw new AppError(
                    "VOCABULARY_ALREADY_EXISTS",
                    "Từ vựng đã tồn tại trong chủ đề này",
                    409,
                );
            }
        }

        const updated = await this.vocabularyRepository.update(vocabularyId, input);
        if (!updated) {
            throw new AppError("VOCABULARY_NOT_FOUND", "Không tìm thấy từ vựng", 404);
        }
        return mapVocabularyToResponse(updated);
    }

    public async updateVocabularyStatus(
        vocabularyId: string,
        status: ContentStatus,
    ): Promise<VocabularyResponse> {
        const existingVocabulary = await this.vocabularyRepository.findById(vocabularyId);
        if (!existingVocabulary) {
            throw new AppError("VOCABULARY_NOT_FOUND", "Không tìm thấy từ vựng", 404);
        }

        const updated = await this.vocabularyRepository.updateStatus(vocabularyId, status);
        if (!updated) {
            throw new AppError("VOCABULARY_NOT_FOUND", "Không tìm thấy từ vựng", 404);
        }
        return mapVocabularyToResponse(updated);
    }

    public async deleteVocabulary(vocabularyId: string): Promise<void> {
        const existingVocabulary = await this.vocabularyRepository.findById(vocabularyId);
        if (!existingVocabulary) {
            throw new AppError("VOCABULARY_NOT_FOUND", "Không tìm thấy từ vựng", 404);
        }

        const questionCount = await this.questionRepository.countByVocabularyId(vocabularyId);
        if (questionCount > 0) {
            throw new AppError(
                "VOCABULARY_IS_USED_BY_QUESTION",
                "Không thể xóa từ vựng vì đang được sử dụng trong câu hỏi",
                409,
            );
        }

        await this.vocabularyRepository.deleteById(vocabularyId);
    }
}

import { AppError } from "../errors/app-error.js";
import { mapTopicToResponse } from "../mappers/topic.mapper.js";
import type { ILessonRepository } from "../repositories/interfaces/lesson.repository.interface.js";
import type { ISectionRepository } from "../repositories/interfaces/section.repository.interface.js";
import type { ITopicRepository } from "../repositories/interfaces/topic.repository.interface.js";
import type { IVocabularyRepository } from "../repositories/interfaces/vocabulary.repository.interface.js";
import type {
    CreateTopicInput,
    TopicResponse,
    TopicStatus,
    UpdateTopicInput,
} from "../types/topic.types.js";

export class AdminTopicService {
    constructor(
        private readonly sectionRepository: ISectionRepository,
        private readonly topicRepository: ITopicRepository,
        private readonly lessonRepository: ILessonRepository,
        private readonly vocabularyRepository: IVocabularyRepository,
    ) {}

    async getTopicsBySection(sectionId: string): Promise<TopicResponse[]> {
        const section = await this.sectionRepository.findById(sectionId);
        if (!section) {
            throw new AppError("SECTION_NOT_FOUND", "Không tìm thấy phần học", 404);
        }

        const topics = await this.topicRepository.findBySectionId(sectionId);
        
        return Promise.all(
            topics.map(async (topic) => {
                const lessonCount = await this.lessonRepository.countByTopicId(topic._id.toString());
                return mapTopicToResponse(topic, lessonCount);
            })
        );
    }

    async getTopicById(topicId: string): Promise<TopicResponse> {
        const topic = await this.topicRepository.findById(topicId);
        if (!topic) {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }
        const lessonCount = await this.lessonRepository.countByTopicId(topicId);
        return mapTopicToResponse(topic, lessonCount);
    }

    async createTopic(sectionId: string, input: CreateTopicInput): Promise<TopicResponse> {
        const section = await this.sectionRepository.findById(sectionId);
        if (!section) {
            throw new AppError("SECTION_NOT_FOUND", "Không tìm thấy phần học", 404);
        }

        const existingTopic = await this.topicRepository.findByNameAndSectionId(input.name, sectionId);
        if (existingTopic) {
            throw new AppError("TOPIC_NAME_ALREADY_EXISTS", "Tên chủ đề đã tồn tại trong phần học này", 409);
        }

        if (input.orderIndex === undefined) {
            const maxOrder = await this.topicRepository.getMaxOrderIndex(sectionId);
            input.orderIndex = maxOrder + 1;
        }

        const topic = await this.topicRepository.create(sectionId, input);
        return mapTopicToResponse(topic, 0);
    }

    async updateTopic(topicId: string, input: UpdateTopicInput): Promise<TopicResponse> {
        const existingTopic = await this.topicRepository.findById(topicId);
        if (!existingTopic) {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }

        if (input.name && input.name !== existingTopic.name) {
            const duplicate = await this.topicRepository.findByNameAndSectionId(
                input.name,
                existingTopic.sectionId.toString()
            );
            if (duplicate) {
                throw new AppError("TOPIC_NAME_ALREADY_EXISTS", "Tên chủ đề đã tồn tại trong phần học này", 409);
            }
        }

        const updatedTopic = await this.topicRepository.update(topicId, input);
        if (!updatedTopic) {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }

        const lessonCount = await this.lessonRepository.countByTopicId(topicId);
        return mapTopicToResponse(updatedTopic, lessonCount);
    }

    async updateTopicStatus(topicId: string, status: TopicStatus): Promise<TopicResponse> {
        const existingTopic = await this.topicRepository.findById(topicId);
        if (!existingTopic) {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }

        const updatedTopic = await this.topicRepository.updateStatus(topicId, status);
        if (!updatedTopic) {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }

        const lessonCount = await this.lessonRepository.countByTopicId(topicId);
        return mapTopicToResponse(updatedTopic, lessonCount);
    }

    async deleteTopic(topicId: string): Promise<void> {
        const existingTopic = await this.topicRepository.findById(topicId);
        if (!existingTopic) {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }

        const lessonCount = await this.lessonRepository.countByTopicId(topicId);
        if (lessonCount > 0) {
            throw new AppError("TOPIC_HAS_LESSONS", "Không thể xóa chủ đề vì chủ đề đang chứa màn học", 409);
        }

        const vocabularyCount = await this.vocabularyRepository.countByTopicId(topicId);
        if (vocabularyCount > 0) {
            throw new AppError("TOPIC_HAS_VOCABULARIES", "Không thể xóa chủ đề vì chủ đề đang chứa từ vựng", 409);
        }

        await this.topicRepository.deleteById(topicId);
    }

    async reorderTopics(sectionId: string, topicIds: string[]): Promise<void> {
        const section = await this.sectionRepository.findById(sectionId);
        if (!section) {
            throw new AppError("SECTION_NOT_FOUND", "Không tìm thấy phần học", 404);
        }

        const topics = await this.topicRepository.findBySectionId(sectionId);
        const validTopicIds = topics.map(t => t._id.toString());

        for (const id of topicIds) {
            if (!validTopicIds.includes(id)) {
                throw new AppError("INVALID_TOPIC_ORDER", "Danh sách chủ đề không hợp lệ", 400);
            }
        }

        await this.topicRepository.reorder(sectionId, topicIds);
    }
}

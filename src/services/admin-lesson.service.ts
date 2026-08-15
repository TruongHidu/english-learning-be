import { AppError } from "../errors/app-error.js";
import { mapLessonToResponse } from "../mappers/lesson.mapper.js";
import type { ILessonRepository } from "../repositories/interfaces/lesson.repository.interface.js";
import type { ITopicRepository } from "../repositories/interfaces/topic.repository.interface.js";
import type {
    CreateLessonInput,
    LessonResponse,
    LessonStatus,
    UpdateLessonInput,
} from "../types/lesson.types.js";

export class AdminLessonService {
    constructor(
        private readonly topicRepository: ITopicRepository,
        private readonly lessonRepository: ILessonRepository,
        // private readonly learningSessionRepository: ILearningSessionRepository,
        // private readonly userLessonProgressRepository: IUserLessonProgressRepository,
    ) {}

    async getLessonsByTopic(topicId: string): Promise<LessonResponse[]> {
        const topic = await this.topicRepository.findById(topicId);
        if (!topic) {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }

        const lessons = await this.lessonRepository.findByTopicId(topicId);
        return lessons.map(lesson => mapLessonToResponse(lesson));
    }

    async getLessonById(lessonId: string): Promise<LessonResponse> {
        const lesson = await this.lessonRepository.findById(lessonId);
        if (!lesson) {
            throw new AppError("LESSON_NOT_FOUND", "Không tìm thấy màn học", 404);
        }
        return mapLessonToResponse(lesson);
    }

    async createLesson(topicId: string, input: CreateLessonInput): Promise<LessonResponse> {
        const topic = await this.topicRepository.findById(topicId);
        if (!topic) {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }

        const existingLesson = await this.lessonRepository.findByNameAndTopicId(input.name, topicId);
        if (existingLesson) {
            throw new AppError("LESSON_NAME_ALREADY_EXISTS", "Tên màn học đã tồn tại trong chủ đề này", 409);
        }

        if (input.orderIndex === undefined) {
            const maxOrder = await this.lessonRepository.getMaxOrderIndex(topicId);
            input.orderIndex = maxOrder + 1;
        }

        const lesson = await this.lessonRepository.create(topicId, input);
        return mapLessonToResponse(lesson);
    }

    async updateLesson(lessonId: string, input: UpdateLessonInput): Promise<LessonResponse> {
        const existingLesson = await this.lessonRepository.findById(lessonId);
        if (!existingLesson) {
            throw new AppError("LESSON_NOT_FOUND", "Không tìm thấy màn học", 404);
        }

        if (input.name && input.name !== existingLesson.name) {
            const duplicate = await this.lessonRepository.findByNameAndTopicId(
                input.name,
                existingLesson.topicId.toString()
            );
            if (duplicate) {
                throw new AppError("LESSON_NAME_ALREADY_EXISTS", "Tên màn học đã tồn tại trong chủ đề này", 409);
            }
        }

        const updatedLesson = await this.lessonRepository.update(lessonId, input);
        if (!updatedLesson) {
            throw new AppError("LESSON_NOT_FOUND", "Không tìm thấy màn học", 404);
        }

        return mapLessonToResponse(updatedLesson);
    }

    async updateLessonStatus(lessonId: string, status: LessonStatus): Promise<LessonResponse> {
        const existingLesson = await this.lessonRepository.findById(lessonId);
        if (!existingLesson) {
            throw new AppError("LESSON_NOT_FOUND", "Không tìm thấy màn học", 404);
        }

        if (status === "PUBLISHED") {
            if (!existingLesson.name || existingLesson.requiredScore < 0 || existingLesson.questionCount <= 0) {
                throw new AppError("LESSON_NOT_READY_TO_PUBLISH", "Màn học chưa đủ điều kiện để xuất bản", 400);
            }
        }

        const updatedLesson = await this.lessonRepository.updateStatus(lessonId, status);
        if (!updatedLesson) {
            throw new AppError("LESSON_NOT_FOUND", "Không tìm thấy màn học", 404);
        }

        return mapLessonToResponse(updatedLesson);
    }

    async deleteLesson(lessonId: string): Promise<void> {
        const existingLesson = await this.lessonRepository.findById(lessonId);
        if (!existingLesson) {
            throw new AppError("LESSON_NOT_FOUND", "Không tìm thấy màn học", 404);
        }

        // if learning records check was implemented, it would be here
        // if (hasLearningData) { throw new AppError("LESSON_HAS_LEARNING_DATA", "Không thể xóa màn học vì đã có dữ liệu học tập", 409); }

        await this.lessonRepository.deleteById(lessonId);
    }

    async reorderLessons(topicId: string, lessonIds: string[]): Promise<void> {
        const topic = await this.topicRepository.findById(topicId);
        if (!topic) {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }

        const lessons = await this.lessonRepository.findByTopicId(topicId);
        const validLessonIds = lessons.map(l => l._id.toString());

        for (const id of lessonIds) {
            if (!validLessonIds.includes(id)) {
                throw new AppError("INVALID_LESSON_ORDER", "Danh sách màn học không hợp lệ", 400);
            }
        }

        await this.lessonRepository.reorder(topicId, lessonIds);
    }
}

import { type LessonDocument } from "../../models/lesson.model.js";
import {
    type CreateLessonInput,
    type LessonStatus,
    type UpdateLessonInput,
} from "../../types/lesson.types.js";

export interface ILessonRepository {
    findById(id: string): Promise<LessonDocument | null>;
    findByTopicId(topicId: string): Promise<LessonDocument[]>;
    findPublishedByTopicId(topicId: string): Promise<LessonDocument[]>;
    findPublishedByTopicIds(topicIds: string[]): Promise<LessonDocument[]>;
    findByNameAndTopicId(name: string, topicId: string): Promise<LessonDocument | null>;
    create(topicId: string, data: CreateLessonInput): Promise<LessonDocument>;
    update(id: string, data: UpdateLessonInput): Promise<LessonDocument | null>;
    updateStatus(id: string, status: LessonStatus): Promise<LessonDocument | null>;
    deleteById(id: string): Promise<void>;
    getMaxOrderIndex(topicId: string): Promise<number>;
    reorder(topicId: string, lessonIds: string[]): Promise<void>;
    countByTopicId(topicId: string): Promise<number>;
    findNextLesson(topicId: string, currentOrderIndex: number): Promise<LessonDocument | null>;
}

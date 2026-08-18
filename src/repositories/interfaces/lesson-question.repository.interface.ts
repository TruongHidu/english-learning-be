import type { LessonQuestionDocument } from "../../models/lesson-question.model.js";

export interface ILessonQuestionRepository {
    findByLessonId(lessonId: string): Promise<LessonQuestionDocument[]>;
    findByLessonIdAndQuestionId(
        lessonId: string,
        questionId: string,
    ): Promise<LessonQuestionDocument | null>;
    createMany(lessonId: string, questionIds: string[]): Promise<LessonQuestionDocument[]>;
    deleteByLessonIdAndQuestionId(lessonId: string, questionId: string): Promise<void>;
    reorder(lessonId: string, questionIds: string[]): Promise<void>;
    countByLessonId(lessonId: string): Promise<number>;
    countByQuestionId(questionId: string): Promise<number>;
}

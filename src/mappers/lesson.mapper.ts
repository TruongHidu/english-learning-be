import { type LessonDocument } from "../models/lesson.model.js";
import { type LessonResponse } from "../types/lesson.types.js";

export const mapLessonToResponse = (
    lesson: LessonDocument,
): LessonResponse => {
    return {
        id: lesson._id.toString(),
        topicId: lesson.topicId.toString(),
        name: lesson.name,
        description: lesson.description ?? null,
        orderIndex: lesson.orderIndex,
        requiredScore: lesson.requiredScore,
        questionCount: lesson.questionCount,
        assignedQuestionCount: lesson.questionCount,
        publishedQuestionCount: lesson.publishedQuestionCount ?? 0,
        publishedVersion: lesson.publishedVersion ?? 1,
        xpReward: lesson.xpReward,
        diamondReward: lesson.diamondReward,
        status: lesson.status,
        createdAt: lesson.createdAt,
        updatedAt: lesson.updatedAt,
    };
};

import { type TopicDocument } from "../models/topic.model.js";
import { type TopicResponse } from "../types/topic.types.js";

export const mapTopicToResponse = (
    topic: TopicDocument,
    lessonCount?: number,
): TopicResponse => {
    return {
        id: topic._id.toString(),
        sectionId: topic.sectionId.toString(),
        name: topic.name,
        description: topic.description ?? null,
        orderIndex: topic.orderIndex,
        status: topic.status,
        lessonCount: lessonCount,
        createdAt: topic.createdAt,
        updatedAt: topic.updatedAt,
    };
};

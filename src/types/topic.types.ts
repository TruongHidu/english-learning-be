import { CONTENT_STATUSES, type ContentStatus } from "./course.types.js";

export const TOPIC_STATUSES = CONTENT_STATUSES;
export type TopicStatus = ContentStatus;

export interface Topic {
    id: string;
    sectionId: string;
    name: string;
    description?: string;
    orderIndex: number;
    status: TopicStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateTopicInput {
    name: string;
    description?: string;
    orderIndex?: number;
    status?: TopicStatus;
}

export interface UpdateTopicInput {
    name?: string;
    description?: string;
}

export interface UpdateTopicStatusInput {
    status: TopicStatus;
}

export interface TopicResponse {
    id: string;
    sectionId: string;
    name: string;
    description: string | null;
    orderIndex: number;
    status: TopicStatus;
    lessonCount?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ReorderTopicsInput {
    topicIds: string[];
}

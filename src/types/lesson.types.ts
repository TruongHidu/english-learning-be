import { CONTENT_STATUSES, type ContentStatus } from "./course.types.js";

export const LESSON_STATUSES = CONTENT_STATUSES;
export type LessonStatus = ContentStatus;

export interface Lesson {
    id: string;
    topicId: string;
    name: string;
    description?: string;
    orderIndex: number;
    requiredScore: number;
    questionCount: number;
    xpReward: number;
    diamondReward: number;
    status: LessonStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateLessonInput {
    name: string;
    description?: string;
    orderIndex?: number;
    requiredScore?: number;
    questionCount?: number;
    xpReward?: number;
    diamondReward?: number;
    status?: LessonStatus;
}

export interface UpdateLessonInput {
    name?: string;
    description?: string;
    requiredScore?: number;
    questionCount?: number;
    xpReward?: number;
    diamondReward?: number;
}

export interface UpdateLessonStatusInput {
    status: LessonStatus;
}

export interface LessonResponse {
    id: string;
    topicId: string;
    name: string;
    description: string | null;
    orderIndex: number;
    requiredScore: number;
    questionCount: number;
    xpReward: number;
    diamondReward: number;
    status: LessonStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface ReorderLessonsInput {
    lessonIds: string[];
}

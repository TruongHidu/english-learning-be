import type { UserLessonProgressStatus } from "../models/user-lesson-progress.model.js";

// DTO trả về cho user khi xem danh sách topic thuộc section
export interface UserTopicResponse {
    id: string;
    sectionId: string;
    name: string;
    description: string | null;
    orderIndex: number;
    lessonCount: number;
}

// DTO trả về cho mỗi lesson trong lộ trình học (Duolingo style)
export interface UserLessonPathItemResponse {
    id: string;
    name: string;
    description: string | null;
    orderIndex: number;
    requiredScore: number;
    questionCount: number;
    xpReward: number;
    diamondReward: number;
    progressStatus: UserLessonProgressStatus;
    isLocked: boolean;
    bestScore: number;
    totalAttempts: number;
}

// DTO topic summary (nhúng vào response learning path)
export interface UserTopicSummaryResponse {
    id: string;
    name: string;
    description: string | null;
}

// Response tổng cho API GET /topics/:topicId/lessons
export interface UserTopicLearningPathResponse {
    topic: UserTopicSummaryResponse;
    lessons: UserLessonPathItemResponse[];
}

// Response tổng cho API GET /sections/:sectionId/topics
export interface UserSectionTopicsResponse {
    topics: UserTopicResponse[];
}

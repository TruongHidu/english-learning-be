import type { UserLessonProgressStatus } from "../models/user-lesson-progress.model.js";
import type { SectionStatus } from "./section.types.js";

export interface UserCourseSectionResponse {
    id: string;
    courseId: string;
    name: string;
    description: string | null;
    orderIndex: number;
    status: SectionStatus;
    createdAt: Date;
    updatedAt: Date;
    progressStatus: UserLessonProgressStatus;
    isLocked: boolean;
    isCompleted: boolean;
    completedLessonCount: number;
    totalLessonCount: number;
}

export interface UserCourseSectionsResponse {
    sections: UserCourseSectionResponse[];
}

// DTO trả về cho user khi xem danh sách topic thuộc section
export interface UserTopicResponse {
    id: string;
    sectionId: string;
    name: string;
    description: string | null;
    orderIndex: number;
    lessonCount: number;
    totalLessonCount: number;
    progressStatus: UserLessonProgressStatus;
    isLocked: boolean;
    isCompleted: boolean;
    completedLessonCount: number;
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
    isCompleted: boolean;
    bestScore: number;
    totalAttempts: number;
}

// DTO topic summary (nhúng vào response learning path)
export interface UserTopicSummaryResponse {
    id: string;
    name: string;
    description: string | null;
    progressStatus: UserLessonProgressStatus;
    isLocked: boolean;
    isCompleted: boolean;
    completedLessonCount: number;
    totalLessonCount: number;
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

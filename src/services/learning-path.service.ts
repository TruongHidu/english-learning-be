import { AppError } from "../errors/app-error.js";
import type {
    UserCourseSectionsResponse,
    UserSectionTopicsResponse,
    UserTopicLearningPathResponse,
} from "../types/learning-path.types.js";
import type { LearningProgressionService } from "./learning-progression.service.js";

export class LearningPathService {
    constructor(private readonly progressionService: LearningProgressionService) {}

    async getPublishedSectionsByCourse(
        userId: string,
        courseId: string,
    ): Promise<UserCourseSectionsResponse> {
        const snapshot = await this.progressionService.getCourseProgression(userId, courseId);

        return {
            sections: snapshot.sections.map((state) => ({
                id: state.section.id,
                courseId: state.section.courseId,
                name: state.section.name,
                description: state.section.description ?? null,
                orderIndex: state.section.orderIndex,
                status: state.section.status,
                createdAt: state.section.createdAt,
                updatedAt: state.section.updatedAt,
                progressStatus: state.progressStatus,
                isLocked: state.isLocked,
                isCompleted: state.isCompleted,
                completedLessonCount: state.completedLessonCount,
                totalLessonCount: state.totalLessonCount,
            })),
        };
    }

    async getPublishedTopicsBySection(
        userId: string,
        sectionId: string,
    ): Promise<UserSectionTopicsResponse> {
        const sectionState = await this.progressionService.getSectionProgression(userId, sectionId);
        if (sectionState.isLocked) {
            throw new AppError(
                "SECTION_LOCKED",
                "Bạn cần hoàn thành tất cả bài học trong phần học trước",
                403,
            );
        }

        return {
            topics: sectionState.topics.map((state) => ({
                id: state.topic._id.toString(),
                sectionId: state.topic.sectionId.toString(),
                name: state.topic.name,
                description: state.topic.description ?? null,
                orderIndex: state.topic.orderIndex,
                lessonCount: state.totalLessonCount,
                totalLessonCount: state.totalLessonCount,
                progressStatus: state.progressStatus,
                isLocked: state.isLocked,
                isCompleted: state.isCompleted,
                completedLessonCount: state.completedLessonCount,
            })),
        };
    }

    async getTopicLearningPath(
        userId: string,
        topicId: string,
    ): Promise<UserTopicLearningPathResponse> {
        const { section, topic } = await this.progressionService.getTopicProgression(
            userId,
            topicId,
        );
        if (section.isLocked) {
            throw new AppError(
                "SECTION_LOCKED",
                "Bạn cần hoàn thành tất cả bài học trong phần học trước",
                403,
            );
        }

        return {
            topic: {
                id: topic.topic._id.toString(),
                name: topic.topic.name,
                description: topic.topic.description ?? null,
                progressStatus: topic.progressStatus,
                isLocked: topic.isLocked,
                isCompleted: topic.isCompleted,
                completedLessonCount: topic.completedLessonCount,
                totalLessonCount: topic.totalLessonCount,
            },
            lessons: topic.lessons.map((state) => ({
                id: state.lesson._id.toString(),
                name: state.lesson.name,
                description: state.lesson.description ?? null,
                orderIndex: state.lesson.orderIndex,
                requiredScore: state.lesson.requiredScore,
                questionCount: state.lesson.questionCount,
                xpReward: state.lesson.xpReward,
                diamondReward: state.lesson.diamondReward,
                progressStatus: state.progressStatus,
                isLocked: state.isLocked,
                isCompleted: state.isCompleted,
                bestScore: state.progress?.bestScore ?? 0,
                totalAttempts: state.progress?.totalAttempts ?? 0,
            })),
        };
    }
}

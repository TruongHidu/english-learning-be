import { AppError } from "../errors/app-error.js";
import type { LessonDocument } from "../models/lesson.model.js";
import type { TopicDocument } from "../models/topic.model.js";
import type {
    UserLessonProgressDocument,
    UserLessonProgressStatus,
} from "../models/user-lesson-progress.model.js";
import type { ICourseRepository } from "../repositories/interfaces/course.repository.interface.js";
import type { ILessonRepository } from "../repositories/interfaces/lesson.repository.interface.js";
import type { ISectionRepository } from "../repositories/interfaces/section.repository.interface.js";
import type { ITopicRepository } from "../repositories/interfaces/topic.repository.interface.js";
import type { IUserLessonProgressRepository } from "../repositories/interfaces/user-lesson-progress.repository.interface.js";
import type { Section } from "../types/section.types.js";

export type LearningLockReason = "SECTION" | "LESSON" | null;

export interface LessonProgressionState {
    lesson: LessonDocument;
    progress: UserLessonProgressDocument | null;
    progressStatus: UserLessonProgressStatus;
    isLocked: boolean;
    lockReason: LearningLockReason;
    isCompleted: boolean;
}

export interface TopicProgressionState {
    topic: TopicDocument;
    lessons: LessonProgressionState[];
    progressStatus: UserLessonProgressStatus;
    isLocked: boolean;
    isCompleted: boolean;
    completedLessonCount: number;
    totalLessonCount: number;
}

export interface SectionProgressionState {
    section: Section;
    topics: TopicProgressionState[];
    progressStatus: UserLessonProgressStatus;
    isLocked: boolean;
    isCompleted: boolean;
    completedLessonCount: number;
    totalLessonCount: number;
}

export interface CourseProgressionSnapshot {
    courseId: string;
    sections: SectionProgressionState[];
}

export class LearningProgressionService {
    constructor(
        private readonly courseRepository: ICourseRepository,
        private readonly sectionRepository: ISectionRepository,
        private readonly topicRepository: ITopicRepository,
        private readonly lessonRepository: ILessonRepository,
        private readonly userLessonProgressRepository: IUserLessonProgressRepository,
    ) {}

    async getCourseProgression(
        userId: string,
        courseId: string,
    ): Promise<CourseProgressionSnapshot> {
        const course = await this.courseRepository.findPublishedById(courseId);
        if (!course) {
            throw new AppError("COURSE_NOT_FOUND", "Không tìm thấy khóa học", 404);
        }

        const sections = await this.sectionRepository.findPublishedByCourseId(courseId);
        const sectionIds = sections.map((section) => section.id);
        const topics = await this.topicRepository.findPublishedBySectionIds(sectionIds);
        const topicIds = topics.map((topic) => topic._id.toString());
        const lessons = await this.lessonRepository.findPublishedByTopicIds(topicIds);
        const lessonIds = lessons.map((lesson) => lesson._id.toString());
        const progressList = lessonIds.length > 0
            ? await this.userLessonProgressRepository.findByUserIdAndLessonIds(userId, lessonIds)
            : [];

        const topicsBySectionId = this.groupByParentId(topics, (topic) => topic.sectionId.toString());
        const lessonsByTopicId = this.groupByParentId(lessons, (lesson) => lesson.topicId.toString());
        const progressByLessonId = new Map(
            progressList.map((progress) => [progress.lessonId.toString(), progress]),
        );

        const sectionStates: SectionProgressionState[] = [];
        let allPreviousSectionsCompleted = true;

        for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
            const section = sections[sectionIndex]!;
            const sectionTopics = topicsBySectionId.get(section.id) ?? [];
            const sectionIsLocked = sectionIndex > 0 && !allPreviousSectionsCompleted;
            const topicStates: TopicProgressionState[] = [];
            let allPreviousLessonsInSectionCompleted = true;

            for (const topic of sectionTopics) {
                const topicLessons = lessonsByTopicId.get(topic._id.toString()) ?? [];
                const topicStartsUnlocked = !sectionIsLocked && allPreviousLessonsInSectionCompleted;
                const lessonStates: LessonProgressionState[] = [];

                for (const lesson of topicLessons) {
                    const lessonId = lesson._id.toString();
                    const progress = progressByLessonId.get(lessonId) ?? null;
                    const isCompleted = progress?.status === "COMPLETED";
                    const canStart = !sectionIsLocked && allPreviousLessonsInSectionCompleted;
                    const isLocked = !canStart;
                    const progressStatus = this.resolveLessonStatus(progress, isCompleted, isLocked);

                    lessonStates.push({
                        lesson,
                        progress,
                        progressStatus,
                        isLocked,
                        lockReason: isLocked ? (sectionIsLocked ? "SECTION" : "LESSON") : null,
                        isCompleted,
                    });

                    allPreviousLessonsInSectionCompleted =
                        allPreviousLessonsInSectionCompleted && isCompleted;
                }

                const completedLessonCount = lessonStates.filter((item) => item.isCompleted).length;
                const totalLessonCount = lessonStates.length;
                const isCompleted = totalLessonCount > 0 && completedLessonCount === totalLessonCount;
                const isLocked = !topicStartsUnlocked;

                topicStates.push({
                    topic,
                    lessons: lessonStates,
                    progressStatus: this.resolveContainerStatus(
                        isLocked,
                        isCompleted,
                        lessonStates.some((item) => item.progressStatus === "IN_PROGRESS"),
                        completedLessonCount,
                    ),
                    isLocked,
                    isCompleted,
                    completedLessonCount,
                    totalLessonCount,
                });
            }

            const sectionLessonStates = topicStates.flatMap((topic) => topic.lessons);
            const completedLessonCount = sectionLessonStates.filter((item) => item.isCompleted).length;
            const totalLessonCount = sectionLessonStates.length;
            // A published section without published lessons is incomplete and blocks later sections.
            const isCompleted = totalLessonCount > 0 && completedLessonCount === totalLessonCount;

            sectionStates.push({
                section,
                topics: topicStates,
                progressStatus: this.resolveContainerStatus(
                    sectionIsLocked,
                    isCompleted,
                    sectionLessonStates.some((item) => item.progressStatus === "IN_PROGRESS"),
                    completedLessonCount,
                ),
                isLocked: sectionIsLocked,
                isCompleted,
                completedLessonCount,
                totalLessonCount,
            });

            allPreviousSectionsCompleted = allPreviousSectionsCompleted && isCompleted;
        }

        return { courseId: course.id, sections: sectionStates };
    }

    async getSectionProgression(
        userId: string,
        sectionId: string,
    ): Promise<SectionProgressionState> {
        const section = await this.sectionRepository.findById(sectionId);
        if (!section || section.status !== "PUBLISHED") {
            throw new AppError("SECTION_NOT_FOUND", "Không tìm thấy chương học", 404);
        }

        const snapshot = await this.getCourseProgression(userId, section.courseId);
        const sectionState = snapshot.sections.find((item) => item.section.id === sectionId);
        if (!sectionState) {
            throw new AppError("SECTION_NOT_FOUND", "Không tìm thấy chương học", 404);
        }
        return sectionState;
    }

    async getTopicProgression(
        userId: string,
        topicId: string,
    ): Promise<{ section: SectionProgressionState; topic: TopicProgressionState }> {
        const topic = await this.topicRepository.findById(topicId);
        if (!topic || topic.status !== "PUBLISHED") {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }

        const sectionState = await this.getSectionProgression(userId, topic.sectionId.toString());
        const topicState = sectionState.topics.find(
            (item) => item.topic._id.toString() === topicId,
        );
        if (!topicState) {
            throw new AppError("TOPIC_NOT_FOUND", "Không tìm thấy chủ đề", 404);
        }
        return { section: sectionState, topic: topicState };
    }

    async getLessonProgression(
        userId: string,
        lessonId: string,
    ): Promise<{
        section: SectionProgressionState;
        topic: TopicProgressionState;
        lesson: LessonProgressionState;
    }> {
        const lesson = await this.lessonRepository.findById(lessonId);
        if (!lesson) {
            throw new AppError("LESSON_NOT_FOUND", "Không tìm thấy bài học", 404);
        }
        if (lesson.status !== "PUBLISHED") {
            throw new AppError("LESSON_NOT_PUBLISHED", "Bài học chưa được xuất bản", 404);
        }

        const topicState = await this.getTopicProgression(userId, lesson.topicId.toString());
        const lessonState = topicState.topic.lessons.find(
            (item) => item.lesson._id.toString() === lessonId,
        );
        if (!lessonState) {
            throw new AppError("LESSON_NOT_PUBLISHED", "Bài học chưa được xuất bản", 404);
        }

        return { ...topicState, lesson: lessonState };
    }

    private resolveLessonStatus(
        progress: UserLessonProgressDocument | null,
        isCompleted: boolean,
        isLocked: boolean,
    ): UserLessonProgressStatus {
        if (isLocked) return "LOCKED";
        if (isCompleted) return "COMPLETED";
        return progress?.status === "IN_PROGRESS" ? "IN_PROGRESS" : "UNLOCKED";
    }

    private resolveContainerStatus(
        isLocked: boolean,
        isCompleted: boolean,
        hasInProgressLesson: boolean,
        completedLessonCount: number,
    ): UserLessonProgressStatus {
        if (isLocked) return "LOCKED";
        if (isCompleted) return "COMPLETED";
        if (hasInProgressLesson || completedLessonCount > 0) return "IN_PROGRESS";
        return "UNLOCKED";
    }

    private groupByParentId<T>(
        items: T[],
        getParentId: (item: T) => string,
    ): Map<string, T[]> {
        const grouped = new Map<string, T[]>();
        for (const item of items) {
            const parentId = getParentId(item);
            const group = grouped.get(parentId) ?? [];
            group.push(item);
            grouped.set(parentId, group);
        }
        return grouped;
    }
}

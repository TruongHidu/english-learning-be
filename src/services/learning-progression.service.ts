import type { ICurriculumMilestoneRepository, Milestone } from "../repositories/interfaces/curriculum-milestone.repository.interface.js";
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
    currentVersion: number;
    completedVersion: number;
    isNewForUser: boolean;
    publishedQuestionCount: number;
    lesson: LessonDocument;
    progress: UserLessonProgressDocument | null;
    progressStatus: UserLessonProgressStatus;
    isLocked: boolean;
    lockReason: LearningLockReason;
    isCompleted: boolean;
    hasAccess: boolean;
    accessGrantedAt: Date | null;
    isCurrentVersionCompleted: boolean;
    hasNewContent: boolean;
}

export interface TopicProgressionState {
    topic: TopicDocument;
    lessons: LessonProgressionState[];
    progressStatus: UserLessonProgressStatus;
    isLocked: boolean;
    isCompleted: boolean;
    hasAccess: boolean;
    accessGrantedAt: Date | null;
    isCurrentVersionCompleted: boolean;
    hasNewContent: boolean;
    completedLessonCount: number;
    totalLessonCount: number;
    newLessonCount: number;
}

export interface SectionProgressionState {
    section: Section;
    topics: TopicProgressionState[];
    progressStatus: UserLessonProgressStatus;
    isLocked: boolean;
    isCompleted: boolean;
    hasAccess: boolean;
    accessGrantedAt: Date | null;
    isCurrentVersionCompleted: boolean;
    hasNewContent: boolean;
    completedLessonCount: number;
    totalLessonCount: number;
    newLessonCount: number;
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
        private readonly milestoneRepository: ICurriculumMilestoneRepository,
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

        const milestones = new Map((await this.milestoneRepository.findByUser(userId))
            .map(m => [`${m.kind}:${m.targetId}`, m]));
        const now = new Date();
        const grant = async (kind: Milestone["kind"], targetId: string, completed: boolean, members: string[] = []) => {
            const key = `${kind}:${targetId}`;
            const old = milestones.get(key);
            const milestone: Milestone = {
                kind, targetId, accessGrantedAt: old?.accessGrantedAt ?? now,
                ...(old?.firstCompletedAt ? { firstCompletedAt: old.firstCompletedAt, completedLessonIds: old.completedLessonIds }
                    : completed ? { firstCompletedAt: now, completedLessonIds: members } : {}),
            };
            if (!old || (completed && !old.firstCompletedAt)) await this.milestoneRepository.grant(userId, milestone);
            milestones.set(key, milestone);
            return milestone;
        };
        const sectionStates: SectionProgressionState[] = [];
        let allPreviousSectionsCompleted = true;

        for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
            const section = sections[sectionIndex]!;
            const sectionTopics = topicsBySectionId.get(section.id) ?? [];
            const sectionMilestone = milestones.get(`SECTION:${section.id}`);
            const sectionHasHistory = sectionTopics.some(t => (lessonsByTopicId.get(t._id.toString()) ?? []).some(l => {
                const progress = progressByLessonId.get(l._id.toString());
                return (progress && progress.status !== "LOCKED") || milestones.has(`LESSON:${l._id}`);
            }) || milestones.has(`TOPIC:${t._id}`));
            const sectionIsLocked = !sectionMilestone && !sectionHasHistory && sectionIndex > 0 && !allPreviousSectionsCompleted;
            const topicStates: TopicProgressionState[] = [];
            let allPreviousLessonsInSectionCompleted = true;

            for (const topic of sectionTopics) {
                const topicLessons = lessonsByTopicId.get(topic._id.toString()) ?? [];
                const topicMilestone = milestones.get(`TOPIC:${topic._id}`);
                const topicStartsUnlocked = Boolean(topicMilestone) || (!sectionIsLocked && allPreviousLessonsInSectionCompleted);
                const lessonStates: LessonProgressionState[] = [];

                for (const lesson of topicLessons) {
                    const lessonId = lesson._id.toString();
                    const progress = progressByLessonId.get(lessonId) ?? null;
                    const isCompleted = progress?.status === "COMPLETED" || Boolean(progress?.firstCompletedAt);
                    const currentVersion = lesson.publishedVersion ?? 1;
                    const completedVersion = progress?.completedVersion ?? (isCompleted ? 1 : 0);
                    const isCurrentVersionCompleted = completedVersion >= currentVersion;
                    const isNewForUser = !isCompleted && (
                        (Boolean(topicMilestone?.firstCompletedAt) && !topicMilestone?.completedLessonIds?.includes(lessonId))
                        || (Boolean(sectionMilestone?.firstCompletedAt) && !sectionMilestone?.completedLessonIds?.includes(lessonId))
                    );
                    const priorGrant = milestones.get(`LESSON:${lessonId}`);
                    const canStart = Boolean(priorGrant) || isCompleted || Boolean(progress?.accessGrantedAt)
                        || Boolean(progress && progress.status !== "LOCKED") || Boolean(topicMilestone?.firstCompletedAt)
                        || (!sectionIsLocked && allPreviousLessonsInSectionCompleted)
                        || (topicStartsUnlocked && lessonStates.length === 0);
                    const access = canStart ? await grant("LESSON", lessonId, false) : null;
                    const isLocked = !canStart;
                    const progressStatus = this.resolveLessonStatus(progress, isCompleted, isLocked);

                    lessonStates.push({
                        lesson,
                        progress,
                        progressStatus,
                        isLocked,
                        lockReason: isLocked ? (sectionIsLocked ? "SECTION" : "LESSON") : null,
                        isCompleted,
                        currentVersion, completedVersion, isCurrentVersionCompleted, isNewForUser,
                        publishedQuestionCount: lesson.publishedQuestionCount ?? 0,
                        hasNewContent: isCompleted && !isCurrentVersionCompleted,
                        hasAccess: canStart, accessGrantedAt: access?.accessGrantedAt ?? null,
                    });

                    allPreviousLessonsInSectionCompleted =
                        allPreviousLessonsInSectionCompleted && isCompleted;
                }

                const completedLessonCount = lessonStates.filter(item => item.isCurrentVersionCompleted).length;
                const totalLessonCount = lessonStates.length;
                const allEverCompleted = totalLessonCount > 0 && lessonStates.every(item => item.isCompleted);
                const isCurrentVersionCompleted = totalLessonCount > 0 && completedLessonCount === totalLessonCount;
                const isCompleted = Boolean(topicMilestone?.firstCompletedAt) || allEverCompleted;
                const isLocked = !isCompleted && !topicStartsUnlocked && !lessonStates.some(item => !item.isLocked);
                const access = !isLocked ? await grant("TOPIC", topic._id.toString(), allEverCompleted,
                    lessonStates.map(item => item.lesson._id.toString())) : null;
                topicStates.push({
                    topic, lessons: lessonStates,
                    progressStatus: this.resolveContainerStatus(isLocked, isCompleted,
                        lessonStates.some(item => item.progressStatus === "IN_PROGRESS"), completedLessonCount),
                    isLocked, isCompleted, completedLessonCount, totalLessonCount,
                    hasAccess: !isLocked, accessGrantedAt: access?.accessGrantedAt ?? null,
                    isCurrentVersionCompleted,
                    hasNewContent: isCompleted && !isCurrentVersionCompleted,
                    newLessonCount: lessonStates.filter(item => item.isNewForUser).length,
                });
                if (topicMilestone?.firstCompletedAt) allPreviousLessonsInSectionCompleted = true;
            }

            const sectionLessonStates = topicStates.flatMap((topic) => topic.lessons);
            const completedLessonCount = sectionLessonStates.filter(item => item.isCurrentVersionCompleted).length;
            const totalLessonCount = sectionLessonStates.length;
            const allEverCompleted = totalLessonCount > 0 && sectionLessonStates.every(item => item.isCompleted);
            const isCurrentVersionCompleted = totalLessonCount > 0 && completedLessonCount === totalLessonCount;
            const isCompleted = Boolean(sectionMilestone?.firstCompletedAt) || allEverCompleted;
            const isLocked = sectionIsLocked && !isCompleted;
            const access = !isLocked ? await grant("SECTION", section.id, allEverCompleted,
                sectionLessonStates.map(item => item.lesson._id.toString())) : null;
            sectionStates.push({
                section, topics: topicStates,
                progressStatus: this.resolveContainerStatus(isLocked, isCompleted,
                    sectionLessonStates.some(item => item.progressStatus === "IN_PROGRESS"), completedLessonCount),
                isLocked, isCompleted, completedLessonCount, totalLessonCount,
                hasAccess: !isLocked, accessGrantedAt: access?.accessGrantedAt ?? null,
                isCurrentVersionCompleted, hasNewContent: isCompleted && !isCurrentVersionCompleted,
                newLessonCount: sectionLessonStates.filter(item => item.isNewForUser).length,
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

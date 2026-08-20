import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Types } from "mongoose";

import { LessonModel, type LessonDocument } from "../src/models/lesson.model.js";
import { TopicModel, type TopicDocument } from "../src/models/topic.model.js";
import {
    UserLessonProgressModel,
    type UserLessonProgressDocument,
    type UserLessonProgressStatus,
} from "../src/models/user-lesson-progress.model.js";
import type { ICourseRepository } from "../src/repositories/interfaces/course.repository.interface.js";
import type { ILessonRepository } from "../src/repositories/interfaces/lesson.repository.interface.js";
import type { ILessonQuestionRepository } from "../src/repositories/interfaces/lesson-question.repository.interface.js";
import type { ILearningSessionRepository } from "../src/repositories/interfaces/learning-session.repository.interface.js";
import type { ISectionRepository } from "../src/repositories/interfaces/section.repository.interface.js";
import type { ITopicRepository } from "../src/repositories/interfaces/topic.repository.interface.js";
import type { IUserLessonProgressRepository } from "../src/repositories/interfaces/user-lesson-progress.repository.interface.js";
import type { IQuestionRepository } from "../src/repositories/interfaces/question.repository.interface.js";
import type { IUserRepository } from "../src/repositories/interfaces/user.repository.interface.js";
import { LearningProgressionService } from "../src/services/learning-progression.service.js";
import { LearningService } from "../src/services/learning.service.js";
import type { Course } from "../src/types/course.types.js";
import type { Section } from "../src/types/section.types.js";

const ids = {
    course: "000000000000000000000001",
    section1: "000000000000000000000011",
    section2: "000000000000000000000012",
    topic1: "000000000000000000000021",
    topic2: "000000000000000000000022",
    topic3: "000000000000000000000023",
    lesson1: "000000000000000000000031",
    lesson2: "000000000000000000000032",
    lesson3: "000000000000000000000033",
    lesson4: "000000000000000000000034",
    lesson5: "000000000000000000000035",
    user: "000000000000000000000041",
} as const;

const now = new Date("2026-01-01T00:00:00.000Z");

const course: Course = {
    id: ids.course,
    name: "Course",
    level: "A1",
    status: "PUBLISHED",
    orderIndex: 0,
    createdAt: now,
    updatedAt: now,
};

const sections: Section[] = [
    {
        id: ids.section1,
        courseId: ids.course,
        name: "Section 1",
        orderIndex: 0,
        status: "PUBLISHED",
        createdAt: now,
        updatedAt: now,
    },
    {
        id: ids.section2,
        courseId: ids.course,
        name: "Section 2",
        orderIndex: 1,
        status: "PUBLISHED",
        createdAt: now,
        updatedAt: now,
    },
];

const topics: TopicDocument[] = [
    new TopicModel({
        _id: ids.topic1,
        sectionId: ids.section1,
        name: "Topic 1",
        orderIndex: 0,
        status: "PUBLISHED",
        createdAt: now,
        updatedAt: now,
    }),
    new TopicModel({
        _id: ids.topic2,
        sectionId: ids.section1,
        name: "Topic 2",
        orderIndex: 1,
        status: "PUBLISHED",
        createdAt: now,
        updatedAt: now,
    }),
    new TopicModel({
        _id: ids.topic3,
        sectionId: ids.section2,
        name: "Topic 3",
        orderIndex: 0,
        status: "PUBLISHED",
        createdAt: now,
        updatedAt: now,
    }),
];

const createLesson = (
    id: string,
    topicId: string,
    orderIndex: number,
): LessonDocument => new LessonModel({
    _id: id,
    topicId,
    name: `Lesson ${id.slice(-2)}`,
    orderIndex,
    requiredScore: 70,
    questionCount: 5,
    xpReward: 10,
    diamondReward: 1,
    status: "PUBLISHED",
    createdAt: now,
    updatedAt: now,
});

const lessons: LessonDocument[] = [
    createLesson(ids.lesson1, ids.topic1, 0),
    createLesson(ids.lesson2, ids.topic1, 1),
    createLesson(ids.lesson3, ids.topic2, 0),
    createLesson(ids.lesson4, ids.topic3, 0),
    createLesson(ids.lesson5, ids.topic3, 1),
];

const createProgress = (
    lessonId: string,
    status: UserLessonProgressStatus,
): UserLessonProgressDocument => new UserLessonProgressModel({
    userId: ids.user,
    lessonId,
    status,
    bestScore: status === "COMPLETED" ? 90 : 0,
    totalAttempts: status === "COMPLETED" ? 1 : 0,
    correctCount: 0,
    wrongCount: 0,
    createdAt: now,
    updatedAt: now,
});

const createService = (
    progressStatuses: Partial<Record<string, UserLessonProgressStatus>>,
    fixtureLessons: LessonDocument[] = lessons,
): LearningProgressionService => {
    const progress = (
        Object.entries(progressStatuses) as Array<[string, UserLessonProgressStatus]>
    ).map(([lessonId, status]) => createProgress(lessonId, status));

    const courseRepository = {
        findPublishedById: async (courseId: string) => courseId === ids.course ? course : null,
    } as unknown as ICourseRepository;

    const sectionRepository = {
        findPublishedByCourseId: async (courseId: string) => courseId === ids.course ? sections : [],
        findById: async (sectionId: string) => sections.find((item) => item.id === sectionId) ?? null,
    } as unknown as ISectionRepository;

    const topicRepository = {
        findPublishedBySectionIds: async (sectionIds: string[]) =>
            topics.filter((topic) => sectionIds.includes(topic.sectionId.toString())),
        findById: async (topicId: string) =>
            topics.find((topic) => topic._id.toString() === topicId) ?? null,
    } as unknown as ITopicRepository;

    const lessonRepository = {
        findPublishedByTopicIds: async (topicIds: string[]) =>
            fixtureLessons.filter((lesson) => topicIds.includes(lesson.topicId.toString())),
        findById: async (lessonId: string) =>
            fixtureLessons.find((lesson) => lesson._id.toString() === lessonId) ?? null,
    } as unknown as ILessonRepository;

    const progressRepository = {
        findByUserIdAndLessonIds: async (_userId: string, lessonIds: string[]) =>
            progress.filter((item) => lessonIds.includes(item.lessonId.toString())),
    } as unknown as IUserLessonProgressRepository;

    return new LearningProgressionService(
        courseRepository,
        sectionRepository,
        topicRepository,
        lessonRepository,
        progressRepository,
    );
};

const findLesson = (
    snapshot: Awaited<ReturnType<LearningProgressionService["getCourseProgression"]>>,
    lessonId: string,
) => snapshot.sections
    .flatMap((section) => section.topics)
    .flatMap((topic) => topic.lessons)
    .find((item) => item.lesson._id.toString() === lessonId)!;

describe("LearningProgressionService", () => {
    it("chỉ mở lesson đầu tiên và khóa section tiếp theo khi chưa có progress", async () => {
        const snapshot = await createService({}).getCourseProgression(ids.user, ids.course);

        assert.equal(snapshot.sections[0]?.isLocked, false);
        assert.equal(snapshot.sections[1]?.isLocked, true);
        assert.equal(findLesson(snapshot, ids.lesson1).progressStatus, "UNLOCKED");
        assert.equal(findLesson(snapshot, ids.lesson2).progressStatus, "LOCKED");
        assert.equal(findLesson(snapshot, ids.lesson3).progressStatus, "LOCKED");
    });

    it("mở lesson kế tiếp sau khi lesson ngay trước đã COMPLETED", async () => {
        const snapshot = await createService({
            [ids.lesson1]: "COMPLETED",
        }).getCourseProgression(ids.user, ids.course);

        assert.equal(findLesson(snapshot, ids.lesson2).progressStatus, "UNLOCKED");
        assert.equal(findLesson(snapshot, ids.lesson3).progressStatus, "LOCKED");
    });

    it("nối thứ tự lesson xuyên qua ranh giới topic", async () => {
        const snapshot = await createService({
            [ids.lesson1]: "COMPLETED",
            [ids.lesson2]: "COMPLETED",
        }).getCourseProgression(ids.user, ids.course);

        assert.equal(findLesson(snapshot, ids.lesson3).progressStatus, "UNLOCKED");
        assert.equal(snapshot.sections[0]?.topics[1]?.isLocked, false);
    });

    it("chỉ mở section sau khi mọi lesson section trước đã COMPLETED", async () => {
        const snapshot = await createService({
            [ids.lesson1]: "COMPLETED",
            [ids.lesson2]: "COMPLETED",
            [ids.lesson3]: "COMPLETED",
        }).getCourseProgression(ids.user, ids.course);

        assert.equal(snapshot.sections[0]?.isCompleted, true);
        assert.equal(snapshot.sections[1]?.isLocked, false);
        assert.equal(findLesson(snapshot, ids.lesson4).progressStatus, "UNLOCKED");
        assert.equal(findLesson(snapshot, ids.lesson5).progressStatus, "LOCKED");
    });

    it("không để progress LOCKED cũ khóa vĩnh viễn lesson đã đủ điều kiện", async () => {
        const snapshot = await createService({
            [ids.lesson1]: "COMPLETED",
            [ids.lesson2]: "LOCKED",
        }).getCourseProgression(ids.user, ids.course);

        assert.equal(findLesson(snapshot, ids.lesson2).progressStatus, "UNLOCKED");
        assert.equal(findLesson(snapshot, ids.lesson2).isLocked, false);
    });

    it("không tin progress IN_PROGRESS phía sau khi prerequisite chưa hoàn thành", async () => {
        const snapshot = await createService({
            [ids.lesson3]: "IN_PROGRESS",
        }).getCourseProgression(ids.user, ids.course);

        assert.equal(findLesson(snapshot, ids.lesson3).progressStatus, "LOCKED");
        assert.equal(findLesson(snapshot, ids.lesson3).isLocked, true);
    });

    it("vẫn khóa lesson COMPLETED nếu prerequisite mới phía trước chưa hoàn thành", async () => {
        const snapshot = await createService({
            [ids.lesson2]: "COMPLETED",
        }).getCourseProgression(ids.user, ids.course);

        assert.equal(findLesson(snapshot, ids.lesson2).isCompleted, true);
        assert.equal(findLesson(snapshot, ids.lesson2).isLocked, true);
        assert.equal(findLesson(snapshot, ids.lesson2).progressStatus, "LOCKED");
    });

    it("section PUBLISHED rỗng không tự động mở section sau", async () => {
        const onlySecondSectionLessons = lessons.filter(
            (lesson) => lesson.topicId.toString() === ids.topic3,
        );
        const snapshot = await createService({}, onlySecondSectionLessons)
            .getCourseProgression(ids.user, ids.course);

        assert.equal(snapshot.sections[0]?.totalLessonCount, 0);
        assert.equal(snapshot.sections[0]?.isCompleted, false);
        assert.equal(snapshot.sections[1]?.isLocked, true);
    });

    it("trả lockReason SECTION cho lesson thuộc section bị khóa", async () => {
        const state = await createService({}).getLessonProgression(ids.user, ids.lesson4);

        assert.equal(state.section.isLocked, true);
        assert.equal(state.lesson.lockReason, "SECTION");
    });

    it("chặn start API trước mọi thao tác ghi khi lesson hoặc section bị khóa", async () => {
        const calls = {
            findUser: 0,
            findQuestions: 0,
            abandonSession: 0,
            createSession: 0,
            updateProgress: 0,
        };
        const lessonQuestionRepository = {
            findByLessonId: async () => {
                calls.findQuestions += 1;
                return [];
            },
        } as unknown as ILessonQuestionRepository;
        const questionRepository = {} as IQuestionRepository;
        const userRepository = {
            findById: async () => {
                calls.findUser += 1;
                return null;
            },
        } as unknown as IUserRepository;
        const progressRepository = {
            upsertInProgress: async () => {
                calls.updateProgress += 1;
                throw new Error("Không được ghi progress cho lesson bị khóa");
            },
        } as unknown as IUserLessonProgressRepository;
        const sessionRepository = {
            abandonInProgressByUserIdAndLessonId: async () => {
                calls.abandonSession += 1;
            },
            create: async () => {
                calls.createSession += 1;
                throw new Error("Không được tạo session cho lesson bị khóa");
            },
        } as unknown as ILearningSessionRepository;
        const service = new LearningService(
            lessonQuestionRepository,
            questionRepository,
            userRepository,
            progressRepository,
            sessionRepository,
            createService({}),
        );

        await assert.rejects(
            () => service.startLesson(ids.user, ids.lesson2),
            (error: unknown) => (
                error instanceof Error
                && "code" in error
                && error.code === "LESSON_LOCKED"
            ),
        );
        await assert.rejects(
            () => service.startLesson(ids.user, ids.lesson4),
            (error: unknown) => (
                error instanceof Error
                && "code" in error
                && error.code === "SECTION_LOCKED"
            ),
        );
        assert.deepEqual(calls, {
            findUser: 0,
            findQuestions: 0,
            abandonSession: 0,
            createSession: 0,
            updateProgress: 0,
        });
    });
});

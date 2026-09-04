import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";

import type { LessonDocument } from "../src/models/lesson.model.js";
import type { LessonQuestionDocument } from "../src/models/lesson-question.model.js";
import type { QuestionDocument } from "../src/models/question.model.js";
import type { VocabularyDocument } from "../src/models/vocabulary.model.js";
import { AppError } from "../src/errors/app-error.js";
import type { ILessonQuestionRepository } from "../src/repositories/interfaces/lesson-question.repository.interface.js";
import type { ILessonRepository } from "../src/repositories/interfaces/lesson.repository.interface.js";
import type { IQuestionRepository } from "../src/repositories/interfaces/question.repository.interface.js";
import type { IVocabularyRepository } from "../src/repositories/interfaces/vocabulary.repository.interface.js";
import type { IMediaStorage } from "../src/storage/media-storage.interface.js";
import { AdminQuestionService } from "../src/services/admin-question.service.js";

const LESSON_ID = new Types.ObjectId("64f000000000000000000001");
const TOPIC_ID = new Types.ObjectId("64f000000000000000000002");
const OTHER_TOPIC_ID = new Types.ObjectId("64f000000000000000000003");
const VOCAB_ID = new Types.ObjectId("64f000000000000000000004");
const QUESTION_ID = new Types.ObjectId("64f000000000000000000005");
const OTHER_QUESTION_ID = new Types.ObjectId("64f000000000000000000006");
const MISSING_QUESTION_ID = new Types.ObjectId("64f000000000000000000007");

const asDocument = <T>(value: object): T => value as T;

function makeLesson(): LessonDocument {
    return asDocument<LessonDocument>({
        _id: LESSON_ID,
        topicId: TOPIC_ID,
        name: "Greetings",
        description: null,
        orderIndex: 0,
        requiredScore: 70,
        questionCount: 0,
        xpReward: 50,
        diamondReward: 5,
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
    });
}

function makeQuestion(id: Types.ObjectId = QUESTION_ID, vocabularyId: Types.ObjectId | null = VOCAB_ID): QuestionDocument {
    return asDocument<QuestionDocument>({
        _id: id,
        vocabularyId,
        vocabularyIds: vocabularyId ? [vocabularyId] : undefined,
        type: "MULTIPLE_CHOICE",
        content: "Choose the answer",
        instruction: "Choose one",
        correctAnswer: "hello",
        options: [
            { _id: new Types.ObjectId(), content: "hello", isCorrect: true, orderIndex: 0 },
            { _id: new Types.ObjectId(), content: "bye", isCorrect: false, orderIndex: 1 },
        ],
        matchingPairs: undefined,
        explanation: "",
        difficulty: "EASY",
        audioUrl: undefined,
        imageUrl: undefined,
        status: "DRAFT",
        createdByAi: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        populated: () => undefined,
    });
}

function createFixture(questionTopicId = TOPIC_ID, lessonExists = true) {
    const lesson = makeLesson();
    const question = makeQuestion();
    const secondQuestion = makeQuestion(OTHER_QUESTION_ID);
    const questions = [question, secondQuestion];
    const vocabulary = asDocument<VocabularyDocument>({
        _id: VOCAB_ID,
        topicId: questionTopicId,
        word: "hello",
        meaning: "xin chào",
    });
    const assignments: LessonQuestionDocument[] = [];

    const lessonRepository = {
        findById: async () => lessonExists ? lesson : null,
        update: async (_id: string, data: { questionCount?: number }) => {
            lesson.questionCount = data.questionCount ?? lesson.questionCount;
            return lesson;
        },
    } as unknown as ILessonRepository;
    const questionRepository = {
        findByIdsForAssignment: async (ids: string[]) => questions.filter((item) => ids.includes(item._id.toString())),
        findByIds: async (ids: string[]) => questions.filter((item) => ids.includes(item._id.toString())),
        bulkUpdateStatus: async (ids: string[], status: "PUBLISHED") => {
            const matches = questions.filter((item) => ids.includes(item._id.toString()));
            matches.forEach((item) => { item.status = status; });
            return matches.length;
        },
    } as unknown as IQuestionRepository;
    const vocabularyRepository = {
        findByIds: async () => [vocabulary],
    } as unknown as IVocabularyRepository;
    const lessonQuestionRepository = {
        findByLessonId: async () => [...assignments],
        createMany: async (lessonId: string, questionIds: string[]) => {
            const lastOrder = assignments.reduce((max, item) => Math.max(max, item.orderIndex), 0);
            questionIds.forEach((questionId, index) => {
                assignments.push(asDocument<LessonQuestionDocument>({
                    _id: new Types.ObjectId(),
                    lessonId: new Types.ObjectId(lessonId),
                    questionId: new Types.ObjectId(questionId),
                    orderIndex: lastOrder + index + 1,
                }));
            });
            return assignments;
        },
        countByLessonId: async () => assignments.length,
    } as unknown as ILessonQuestionRepository;
    const mediaStorage = {} as IMediaStorage;
    return {
        service: new AdminQuestionService(
            questionRepository,
            vocabularyRepository,
            lessonRepository,
            lessonQuestionRepository,
            mediaStorage,
        ),
        assignments,
        question,
        vocabulary,
        questions,
    };
}

test("assign accepts a question in the lesson topic and is idempotent", async () => {
    const fixture = createFixture();
    const first = await fixture.service.assignQuestionsToLesson(LESSON_ID.toString(), [QUESTION_ID.toString()]);
    const second = await fixture.service.assignQuestionsToLesson(LESSON_ID.toString(), [QUESTION_ID.toString()]);

    assert.equal(first.assignedCount, 1);
    assert.equal(first.skippedCount, 0);
    assert.equal(second.assignedCount, 0);
    assert.equal(second.skippedCount, 1);
    assert.equal(fixture.assignments.length, 1);
});

test("assign rejects a question whose Vocabulary belongs to another Topic", async () => {
    const fixture = createFixture(OTHER_TOPIC_ID);
    await assert.rejects(
        () => fixture.service.assignQuestionsToLesson(LESSON_ID.toString(), [QUESTION_ID.toString()]),
        (error: unknown) => error instanceof AppError
            && error.code === "QUESTION_TOPIC_MISMATCH"
            && error.statusCode === 400,
    );
    assert.equal(fixture.assignments.length, 0);
});

test("assign rejects an ID that is not found", async () => {
    const fixture = createFixture();
    const missingId = MISSING_QUESTION_ID.toString();
    await assert.rejects(
        () => fixture.service.assignQuestionsToLesson(LESSON_ID.toString(), [missingId]),
        (error: unknown) => error instanceof AppError && error.code === "QUESTION_NOT_FOUND",
    );
});

test("assigns multiple questions with contiguous order and database-backed count", async () => {
    const fixture = createFixture();
    const result = await fixture.service.assignQuestionsToLesson(
        LESSON_ID.toString(),
        [QUESTION_ID.toString(), OTHER_QUESTION_ID.toString()],
    );

    assert.equal(result.assignedCount, 2);
    assert.equal(result.skippedCount, 0);
    assert.deepEqual(fixture.assignments.map((item) => item.orderIndex), [1, 2]);
    assert.equal(result.lesson.questionCount, 2);
    assert.equal(fixture.question.status, "DRAFT");
});

test("assign reports LESSON_NOT_FOUND before creating assignments", async () => {
    const fixture = createFixture(TOPIC_ID, false);
    await assert.rejects(
        () => fixture.service.assignQuestionsToLesson(LESSON_ID.toString(), [QUESTION_ID.toString()]),
        (error: unknown) => error instanceof AppError && error.code === "LESSON_NOT_FOUND",
    );
    assert.equal(fixture.assignments.length, 0);
});

test("bulk publish validates every Question before changing any status", async () => {
    const fixture = createFixture();
    fixture.questions[1]!.options = [
        { content: "hello", isCorrect: true, orderIndex: 0 },
        { content: "bye", isCorrect: true, orderIndex: 1 },
    ];

    await assert.rejects(
        fixture.service.bulkPublishQuestions([
            fixture.questions[0]!._id.toString(),
            fixture.questions[1]!._id.toString(),
        ]),
        (error: unknown) => error instanceof AppError
            && error.code === "QUESTION_NOT_READY_TO_PUBLISH",
    );
    assert.deepEqual(fixture.questions.map((question) => question.status), ["DRAFT", "DRAFT"]);
});

test("bulk publish uses the validated bulk repository operation", async () => {
    const fixture = createFixture();
    const ids = fixture.questions.map((question) => question._id.toString());

    const result = await fixture.service.bulkPublishQuestions(ids);

    assert.equal(result.modifiedCount, 2);
    assert.deepEqual(result.publishedIds, ids);
    assert.deepEqual(fixture.questions.map((question) => question.status), ["PUBLISHED", "PUBLISHED"]);
});

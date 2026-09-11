import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import mongoose, { Types } from "mongoose";
import { CourseModel } from "../src/models/course.model.js";
import { SectionModel } from "../src/models/section.model.js";
import { TopicModel } from "../src/models/topic.model.js";
import { LessonModel } from "../src/models/lesson.model.js";
import { QuestionModel } from "../src/models/question.model.js";
import { UserModel } from "../src/models/user.model.js";
import { UserLessonProgressModel } from "../src/models/user-lesson-progress.model.js";
import { LearningSessionModel } from "../src/models/learning-session.model.js";
import { UserCurriculumMilestoneModel } from "../src/models/user-curriculum-milestone.model.js";
import { CourseRepository } from "../src/repositories/implementations/course.repository.js";
import { SectionRepository } from "../src/repositories/implementations/section.repository.js";
import { TopicRepository } from "../src/repositories/implementations/topic.repository.js";
import { LessonRepository } from "../src/repositories/implementations/lesson.repository.js";
import { LessonQuestionRepository } from "../src/repositories/implementations/lesson-question.repository.js";
import { QuestionRepository } from "../src/repositories/implementations/question.repository.js";
import { UserRepository } from "../src/repositories/implementations/user.repository.js";
import { UserLessonProgressRepository } from "../src/repositories/implementations/user-lesson-progress.repository.js";
import { LearningSessionRepository } from "../src/repositories/implementations/learning-session.repository.js";
import { UserVocabularyRepository } from "../src/repositories/implementations/user-vocabulary.repository.js";
import { VocabularyRepository } from "../src/repositories/implementations/vocabulary.repository.js";
import { CurriculumMilestoneRepository } from "../src/repositories/implementations/curriculum-milestone.repository.js";
import { AdminLessonService } from "../src/services/admin-lesson.service.js";
import { AdminQuestionService } from "../src/services/admin-question.service.js";
import { LearningProgressionService } from "../src/services/learning-progression.service.js";
import { LearningPathService } from "../src/services/learning-path.service.js";
import { LearningService } from "../src/services/learning.service.js";
import { HeartService } from "../src/services/heart.service.js";
import { UserStatsService } from "../src/services/user-stats.service.js";
import { curriculumTransaction, transactionalMethods } from "../src/utils/curriculum-transaction.js";

// A NEW isolated local replica set, no .env, no existing database, no database cleanup/deletion.
let mongod: ChildProcess | undefined;
let testUri: string;
before(async () => {
    assert.ok(process.env.TEST_MONGOD_PATH, "Set TEST_MONGOD_PATH to a local mongod executable");
    const listener = createServer(); listener.listen(0, "127.0.0.1"); await once(listener, "listening");
    const address = listener.address(); assert.ok(address && typeof address !== "string");
    const port = address.port;
    await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
    const directory = await mkdtemp(join(tmpdir(), "english-content-test-"));
    console.log(`Isolated MongoDB test files: ${directory}`);
    mongod = spawn(process.env.TEST_MONGOD_PATH, ["--dbpath", directory, "--bind_ip", "127.0.0.1", "--port", String(port), "--replSet", "contentTest", "--noauth", "--quiet"],
        { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    await new Promise<void>((resolve, reject) => {
        let output = "";
        const timer = setTimeout(() => reject(new Error(`Mongo startup timeout: ${output}`)), 25000);
        const finish = (error?: Error) => { clearTimeout(timer); error ? reject(error) : resolve(); };
        mongod!.once("error", finish);
        mongod!.once("exit", code => finish(new Error(`Mongo exited ${code}: ${output}`)));
        const read = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-8000); if (output.includes("Waiting for connections")) finish(); };
        mongod!.stdout!.on("data", read); mongod!.stderr!.on("data", read);
    });
    const bootstrap = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`);
    try {
        await bootstrap.connect();
        await bootstrap.db("admin").command({ replSetInitiate: { _id: "contentTest", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    } finally { await bootstrap.close(); }
    testUri = `mongodb://127.0.0.1:${port}/lesson_content_test?replicaSet=contentTest`;
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 30000 });
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
});
after(async () => {
    // Graceful shutdown preserves the temporary fixture files for inspection.
    if (mongoose.connection.readyState === 1) {
        try { await mongoose.connection.db!.admin().command({ shutdown: 1 }); } catch { /* shutdown closes the socket */ }
    }
    await mongoose.disconnect();
    if (mongod && mongod.exitCode === null && mongod.signalCode === null) {
        await once(mongod, "exit");
    }
});

const lessons = new LessonRepository();
const questions = new QuestionRepository();
const assignments = new LessonQuestionRepository();
const progress = new UserLessonProgressRepository();
const users = new UserRepository();
const topics = new TopicRepository();
const adminLessons = transactionalMethods(new AdminLessonService(topics, lessons),
    ["createLesson", "updateLesson", "updateLessonStatus", "reorderLessons"]);
const adminQuestions = transactionalMethods(new AdminQuestionService(questions, new VocabularyRepository(), lessons, assignments, {
    upload: async () => { throw new Error("No media uploads in this test"); }, delete: async () => {},
}), ["assignQuestionsToLesson", "removeQuestionFromLesson", "reorderLessonQuestions", "updateQuestionStatus", "bulkPublishQuestions", "deleteQuestion"]);
const progression = transactionalMethods(new LearningProgressionService(new CourseRepository(), new SectionRepository(), topics,
    lessons, progress, new CurriculumMilestoneRepository()), ["getCourseProgression", "getSectionProgression", "getTopicProgression", "getLessonProgression"], false);
const paths = new LearningPathService(progression);
const learning = transactionalMethods(new LearningService(lessons, assignments, questions, users, progress,
    new LearningSessionRepository(), progression, new HeartService(users), new UserStatsService(users), new UserVocabularyRepository()), ["startLesson", "submitAnswer"], false);

async function publishedQuestion() {
    return QuestionModel.create({ type: "TRANSLATION", content: `Translate ${new Types.ObjectId()}`, correctAnswer: "hello", status: "PUBLISHED" });
}
async function addLesson(topicId: string, published = true) {
    const lesson = await adminLessons.createLesson(topicId, { name: `Lesson ${new Types.ObjectId()}` });
    const question = await publishedQuestion();
    await adminQuestions.assignQuestionsToLesson(lesson.id, [question._id.toString()]);
    if (published) await adminLessons.updateLessonStatus(lesson.id, "PUBLISHED");
    return { id: lesson.id, question };
}
async function fixture() {
    const user = await UserModel.create({ email: `${new Types.ObjectId()}@example.test`, displayName: "Content test" });
    const course = await CourseModel.create({ name: "Course", level: "A1", status: "PUBLISHED" });
    const section = await SectionModel.create({ courseId: course._id, name: "Section", status: "PUBLISHED", orderIndex: 0 });
    const topic = await TopicModel.create({ sectionId: section._id, name: "Topic", status: "PUBLISHED", orderIndex: 0 });
    const first = await addLesson(topic._id.toString());
    return { userId: user._id.toString(), courseId: course._id.toString(), sectionId: section._id.toString(), topicId: topic._id.toString(), first };
}
async function pass(userId: string, lessonId: string) {
    const session = await learning.startLesson(userId, lessonId);
    for (const question of session.questions) await learning.submitAnswer(userId, session.session.id, { questionId: question.id, answer: "hello" });
    return session;
}

test("draft lessons stay hidden; publishing into a completed topic opens new content and preserves later section access", async () => {
    const f = await fixture();
    const laterSection = await SectionModel.create({ courseId: f.courseId, name: "Later", status: "PUBLISHED", orderIndex: 1 });
    const laterTopic = await TopicModel.create({ sectionId: laterSection._id, name: "Later", status: "PUBLISHED" });
    const later = await addLesson(laterTopic._id.toString());
    await assert.rejects(() => learning.startLesson(f.userId, later.id), { code: "SECTION_LOCKED" });
    await pass(f.userId, f.first.id);
    let sections = (await paths.getPublishedSectionsByCourse(f.userId, f.courseId)).sections;
    assert.equal(sections[1]!.isLocked, false);
    const added = await addLesson(f.topicId, false);
    assert.equal((await paths.getTopicLearningPath(f.userId, f.topicId)).lessons.length, 1);
    await adminLessons.updateLessonStatus(added.id, "PUBLISHED");
    const path = await paths.getTopicLearningPath(f.userId, f.topicId);
    assert.equal(path.topic.isCompleted, true);
    assert.equal(path.topic.isCurrentVersionCompleted, false);
    assert.equal(path.topic.hasNewContent, true);
    assert.equal(path.topic.newLessonCount, 1);
    assert.equal(path.topic.completedLessonCount, 1);
    assert.equal(path.topic.totalLessonCount, 2);
    assert.equal(path.lessons[1]!.isNewForUser, true);
    assert.equal(path.lessons[1]!.isLocked, false);
    await learning.startLesson(f.userId, added.id);
    await learning.startLesson(f.userId, later.id);
    sections = (await paths.getPublishedSectionsByCourse(f.userId, f.courseId)).sections;
    assert.equal(sections[0]!.hasNewContent, true);
    assert.equal(sections[1]!.isLocked, false);
});

test("new users stay sequential; reorder cannot revoke persisted lesson/topic access", async () => {
    const f = await fixture();
    const second = await addLesson(f.topicId);
    await assert.rejects(() => learning.startLesson(f.userId, second.id), { code: "LESSON_LOCKED" });
    await learning.startLesson(f.userId, f.first.id);
    await adminLessons.reorderLessons(f.topicId, [second.id, f.first.id]);
    const path = await paths.getTopicLearningPath(f.userId, f.topicId);
    assert.equal(path.lessons.find(l => l.id === f.first.id)!.isLocked, false);
    await learning.startLesson(f.userId, f.first.id);
    assert.equal((await UserCurriculumMilestoneModel.findOne({ userId: f.userId, targetId: f.topicId }))?.kind, "TOPIC");
});

test("draft assignment leaves version/count; publishing shared question updates all published lessons exactly once", async () => {
    const f = await fixture();
    const second = await addLesson(f.topicId);
    const draft = await questions.create({ type: "TRANSLATION", difficulty: "EASY", content: "New draft", correctAnswer: "hello" });
    await adminQuestions.assignQuestionsToLesson(f.first.id, [draft._id.toString()]);
    await adminQuestions.assignQuestionsToLesson(second.id, [draft._id.toString()]);
    assert.equal((await lessons.findById(f.first.id))!.publishedVersion, 1);
    assert.equal((await lessons.findById(f.first.id))!.publishedQuestionCount, 1);
    await adminQuestions.updateQuestionStatus(draft._id.toString(), "PUBLISHED");
    for (const id of [f.first.id, second.id]) {
        assert.equal((await lessons.findById(id))!.publishedVersion, 2);
        assert.equal((await lessons.findById(id))!.publishedQuestionCount, 2);
    }
    await adminQuestions.updateQuestionStatus(draft._id.toString(), "PUBLISHED");
    await adminQuestions.assignQuestionsToLesson(f.first.id, [draft._id.toString()]);
    assert.equal((await lessons.findById(f.first.id))!.publishedVersion, 2);
    await adminQuestions.updateQuestion(draft._id.toString(), { correctAnswer: "hi" });
    assert.equal((await lessons.findById(f.first.id))!.publishedVersion, 3);
    assert.equal((await lessons.findById(second.id))!.publishedVersion, 3);
    await adminQuestions.updateQuestion(draft._id.toString(), { correctAnswer: "hi" });
    assert.equal((await lessons.findById(f.first.id))!.publishedVersion, 3);
    await adminQuestions.updateQuestionStatus(draft._id.toString(), "DRAFT");
    assert.equal((await lessons.findById(second.id))!.publishedVersion, 4);
    assert.equal((await lessons.findById(second.id))!.publishedQuestionCount, 1);
});

test("old session retains question set, score threshold and grading; old-version pass reports new content; next session sees new questions", async () => {
    const f = await fixture();
    const started = await learning.startLesson(f.userId, f.first.id);
    const extra = await publishedQuestion();
    await adminQuestions.assignQuestionsToLesson(f.first.id, [extra._id.toString()]);
    await adminQuestions.updateQuestion(f.first.question._id.toString(), { correctAnswer: "changed" });
    await adminLessons.updateLesson(f.first.id, { requiredScore: 100 });
    const old = (await LearningSessionModel.findById(started.session.id))!;
    assert.equal(old.totalQuestions, 1);
    assert.equal(old.lessonVersion, 1);
    assert.equal(old.requiredScore, 70);
    await assert.rejects(() => learning.submitAnswer(f.userId, started.session.id, { questionId: extra._id.toString(), answer: "hello" }), { code: "QUESTION_NOT_IN_SESSION" });
    const answer = await learning.submitAnswer(f.userId, started.session.id, { questionId: started.questions[0]!.id, answer: "hello" });
    assert.equal(answer.isPassed, true);
    const path = await paths.getTopicLearningPath(f.userId, f.topicId);
    assert.equal(path.lessons[0]!.completedVersion, 1);
    assert.equal(path.lessons[0]!.currentVersion, 4);
    assert.equal(path.lessons[0]!.hasNewContent, true);
    assert.equal(path.lessons[0]!.isLocked, false);
    const next = await learning.startLesson(f.userId, f.first.id);
    assert.equal(next.questions.length, 2);
    assert.equal(next.session.lessonVersion, 4);
    assert.equal(path.lessons[0]!.publishedQuestionCount, next.questions.length);
});

test("unpublished live question still grades from old snapshot; failed replay and lower version cannot erase completion", async () => {
    const f = await fixture();
    await pass(f.userId, f.first.id);
    const before = (await progress.findByUserIdAndLessonId(f.userId, f.first.id))!;
    const survivor = await publishedQuestion();
    await adminQuestions.assignQuestionsToLesson(f.first.id, [survivor._id.toString()]);
    const replay = await learning.startLesson(f.userId, f.first.id);
    await adminQuestions.updateQuestionStatus(f.first.question._id.toString(), "DRAFT");
    const snapshotted = await learning.submitAnswer(f.userId, replay.session.id, { questionId: replay.questions[0]!.id, answer: "hello" });
    assert.equal(snapshotted.isCorrect, true);
    const failed = await learning.submitAnswer(f.userId, replay.session.id, { questionId: replay.questions[1]!.id, answer: "wrong" });
    assert.equal(failed.sessionStatus, "FAILED");
    const after = (await progress.findByUserIdAndLessonId(f.userId, f.first.id))!;
    for (const key of ["firstCompletedAt", "completedAt", "accessGrantedAt", "lastCompletedAt"] as const) {
        assert.equal(after[key]?.getTime(), before[key]?.getTime());
    }
    assert.equal(after.status, "COMPLETED");
    assert.equal(after.completedVersion, 1);
    await adminQuestions.updateQuestionStatus(f.first.question._id.toString(), "PUBLISHED");
    await pass(f.userId, f.first.id);
    const newer = (await progress.findByUserIdAndLessonId(f.userId, f.first.id))!;
    assert.equal(newer.completedVersion, 4);
    assert.equal(newer.firstCompletedAt?.getTime(), before.firstCompletedAt?.getTime());
    await curriculumTransaction(() => progress.completeLesson(f.userId, f.first.id, {
        score: 100, bestScore: 100, totalAttempts: 4, correctCount: 1, wrongCount: 0,
        completedAt: new Date(), completedVersion: 1,
    }));
    assert.equal((await progress.findByUserIdAndLessonId(f.userId, f.first.id))!.completedVersion, 4);
});

test("publish readiness ignores client count and queries assignments; zero published questions cannot publish", async () => {
    const f = await fixture();
    await assert.rejects(() => adminLessons.createLesson(f.topicId, { name: "Invalid published", status: "PUBLISHED", questionCount: 99 }), { code: "LESSON_NOT_READY_TO_PUBLISH" });
    const empty = await adminLessons.createLesson(f.topicId, { name: "Empty lesson", questionCount: 99 });
    assert.equal(empty.questionCount, 0);
    await adminLessons.updateLesson(empty.id, { questionCount: 99 });
    assert.equal((await lessons.findById(empty.id))!.questionCount, 0);
    await assert.rejects(() => adminLessons.updateLessonStatus(empty.id, "PUBLISHED"), { code: "LESSON_NOT_READY_TO_PUBLISH" });
    const draft = await questions.create({ type: "TRANSLATION", difficulty: "EASY", content: "draft readiness", correctAnswer: "hello" });
    await adminQuestions.assignQuestionsToLesson(empty.id, [draft._id.toString()]);
    await assert.rejects(() => adminLessons.updateLessonStatus(empty.id, "PUBLISHED"), { code: "LESSON_NOT_READY_TO_PUBLISH" });
});

test("remove, delete, reorder and requiredScore revisions are atomic/idempotent; republish detects draft edits", async () => {
    const f = await fixture();
    const q = await publishedQuestion();
    await adminQuestions.assignQuestionsToLesson(f.first.id, [q._id.toString()]);
    await adminQuestions.reorderLessonQuestions(f.first.id, [q._id.toString(), f.first.question._id.toString()]);
    assert.equal((await lessons.findById(f.first.id))!.publishedVersion, 3);
    await adminQuestions.reorderLessonQuestions(f.first.id, [q._id.toString(), f.first.question._id.toString()]);
    assert.equal((await lessons.findById(f.first.id))!.publishedVersion, 3);
    await adminQuestions.removeQuestionFromLesson(f.first.id, q._id.toString());
    assert.equal((await lessons.findById(f.first.id))!.publishedVersion, 4);
    await assert.rejects(() => adminQuestions.removeQuestionFromLesson(f.first.id, q._id.toString()), { code: "QUESTION_NOT_ASSIGNED_TO_LESSON" });
    assert.equal((await lessons.findById(f.first.id))!.publishedVersion, 4);
    await adminLessons.updateLessonStatus(f.first.id, "DRAFT");
    await adminQuestions.updateQuestion(f.first.question._id.toString(), { correctAnswer: "hi" });
    assert.equal((await lessons.findById(f.first.id))!.publishedVersion, 4);
    await adminLessons.updateLessonStatus(f.first.id, "PUBLISHED");
    assert.equal((await lessons.findById(f.first.id))!.publishedVersion, 5);
    await assert.rejects(
        () => adminQuestions.deleteQuestion(f.first.question._id.toString()),
        { code: "LESSON_REQUIRES_PUBLISHED_QUESTION" },
    );
    const retained = (await lessons.findById(f.first.id))!;
    assert.equal(retained.publishedVersion, 5);
    assert.equal(retained.publishedQuestionCount, 1);
    assert.equal(retained.questionCount, 1);
});

test("a published lesson cannot lose its final published question through remove, unpublish or delete", async () => {
    const f = await fixture();
    for (const action of [
        () => adminQuestions.removeQuestionFromLesson(f.first.id, f.first.question._id.toString()),
        () => adminQuestions.updateQuestionStatus(f.first.question._id.toString(), "DRAFT"),
        () => adminQuestions.deleteQuestion(f.first.question._id.toString()),
    ]) {
        await assert.rejects(action, { code: "LESSON_REQUIRES_PUBLISHED_QUESTION" });
        const lesson = (await lessons.findById(f.first.id))!;
        assert.equal(lesson.status, "PUBLISHED");
        assert.equal(lesson.publishedVersion, 1);
        assert.equal(lesson.publishedQuestionCount, 1);
        assert.equal((await assignments.findByLessonId(f.first.id)).length, 1);
        assert.equal((await questions.findById(f.first.question._id.toString()))!.status, "PUBLISHED");
    }
});

test("unpublishing a shared final question is rejected atomically for every affected lesson", async () => {
    const f = await fixture();
    const second = await adminLessons.createLesson(f.topicId, { name: "Second shared lesson" });
    await adminQuestions.assignQuestionsToLesson(second.id, [f.first.question._id.toString()]);
    await adminLessons.updateLessonStatus(second.id, "PUBLISHED");
    await assert.rejects(
        () => adminQuestions.updateQuestionStatus(f.first.question._id.toString(), "INACTIVE"),
        { code: "LESSON_REQUIRES_PUBLISHED_QUESTION" },
    );
    assert.equal((await questions.findById(f.first.question._id.toString()))!.status, "PUBLISHED");
    for (const id of [f.first.id, second.id]) {
        assert.equal((await lessons.findById(id))!.publishedQuestionCount, 1);
        assert.equal((await lessons.findById(id))!.publishedVersion, 1);
    }
});

test("draft questions can still be removed from a published lesson", async () => {
    const f = await fixture();
    const draft = await questions.create({ type: "TRANSLATION", difficulty: "EASY", content: "Removable draft", correctAnswer: "hello" });
    await adminQuestions.assignQuestionsToLesson(f.first.id, [draft._id.toString()]);
    await adminQuestions.removeQuestionFromLesson(f.first.id, draft._id.toString());
    const lesson = (await lessons.findById(f.first.id))!;
    assert.equal(lesson.questionCount, 1);
    assert.equal(lesson.publishedQuestionCount, 1);
    assert.equal(lesson.publishedVersion, 1);
});

test("transaction rollback leaves assignments, count and version unchanged", async () => {
    const f = await fixture();
    const q = await publishedQuestion();
    await assert.rejects(() => curriculumTransaction(async () => {
        await adminQuestions.assignQuestionsToLesson(f.first.id, [q._id.toString()]);
        throw new Error("Injected failure after mutation");
    }), /Injected failure/);
    const lesson = (await lessons.findById(f.first.id))!;
    assert.equal(lesson.publishedVersion, 1);
    assert.equal(lesson.publishedQuestionCount, 1);
    assert.equal((await assignments.findByLessonId(f.first.id)).length, 1);
});

test("concurrent duplicate assignments and publishing only create one effective revision", async () => {
    const f = await fixture();
    const q = await publishedQuestion();
    await Promise.all([1, 2].map(() => adminQuestions.assignQuestionsToLesson(f.first.id, [q._id.toString()])));
    assert.equal((await lessons.findById(f.first.id))!.publishedVersion, 2);
    assert.equal((await assignments.findByLessonId(f.first.id)).length, 2);
    assert.equal((await LessonModel.findById(f.first.id))!.publishedQuestionCount, 2);
    assert.equal((await UserLessonProgressModel.find({ userId: f.userId })).length, 0);
});

test("concurrent path reads persist a single access grant", async () => {
    const f = await fixture();
    const results = await Promise.all([1, 2, 3].map(() => paths.getTopicLearningPath(f.userId, f.topicId)));
    assert.ok(results.every(path => !path.lessons[0]!.isLocked));
    assert.equal(await UserCurriculumMilestoneModel.countDocuments({ userId: f.userId, targetId: f.first.id }), 1);
});

test("migration dry run writes nothing; apply backfills legacy completion/access/milestones and reruns do nothing", async () => {
    const f = await fixture();
    const completedAt = new Date("2025-01-02T03:00:00.000Z");
    // Raw insertion simulates legacy documents without new schema defaults.
    await UserLessonProgressModel.collection.insertOne({
        userId: new Types.ObjectId(f.userId), lessonId: new Types.ObjectId(f.first.id), status: "COMPLETED",
        bestScore: 100, totalAttempts: 1, correctCount: 1, wrongCount: 0,
        completedAt, createdAt: completedAt, updatedAt: completedAt,
    });
    const migrate = async (...args: string[]) => promisify(execFile)(process.execPath,
        [fileURLToPath(new URL("../src/scripts/migrate-lesson-content.js", import.meta.url)), ...args],
        { env: { ...process.env, MIGRATION_MONGODB_URI: testUri }, windowsHide: true });
    await migrate();
    assert.equal((await UserLessonProgressModel.collection.findOne({ userId: new Types.ObjectId(f.userId) }))?.completedVersion, undefined);
    await migrate("--apply");
    const completed = (await progress.findByUserIdAndLessonId(f.userId, f.first.id))!;
    assert.equal(completed.completedVersion, 1);
    assert.equal(completed.firstCompletedAt?.toISOString(), completedAt.toISOString());
    assert.equal(completed.lastCompletedAt?.toISOString(), completedAt.toISOString());
    assert.ok(completed.accessGrantedAt);
    const milestone = (await UserCurriculumMilestoneModel.findOne({ userId: f.userId, targetId: f.topicId }))!;
    assert.ok(milestone.firstCompletedAt);
    assert.deepEqual(milestone.completedLessonIds?.map(String), [f.first.id]);
    const before = completed.toObject();
    const rerun = await migrate("--apply");
    assert.match(rerun.stdout, /already applied/);
    assert.deepEqual((await progress.findByUserIdAndLessonId(f.userId, f.first.id))!.toObject(), before);
    const added = await addLesson(f.topicId);
    const path = await paths.getTopicLearningPath(f.userId, f.topicId);
    assert.equal(path.topic.newLessonCount, 1);
    assert.equal(path.lessons.find(l => l.id === added.id)!.isLocked, false);
});

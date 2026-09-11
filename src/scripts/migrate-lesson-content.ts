import mongoose from "mongoose";
import { LessonModel } from "../models/lesson.model.js";
import { LearningSessionModel } from "../models/learning-session.model.js";
import { UserLessonProgressModel } from "../models/user-lesson-progress.model.js";
import { CourseModel } from "../models/course.model.js";
import { CurriculumMilestoneRepository } from "../repositories/implementations/curriculum-milestone.repository.js";
import { CourseRepository } from "../repositories/implementations/course.repository.js";
import { SectionRepository } from "../repositories/implementations/section.repository.js";
import { TopicRepository } from "../repositories/implementations/topic.repository.js";
import { LessonRepository } from "../repositories/implementations/lesson.repository.js";
import { UserLessonProgressRepository } from "../repositories/implementations/user-lesson-progress.repository.js";
import { LearningProgressionService } from "../services/learning-progression.service.js";
import { contentFingerprint, readLessonContent } from "../services/lesson-content.service.js";
import { curriculumTransaction } from "../utils/curriculum-transaction.js";

// Deliberately does not load dotenv or import the server/container.
const uri = process.env.MIGRATION_MONGODB_URI;
if (!uri) throw new Error("Set MIGRATION_MONGODB_URI in the shell. This script does not read .env.");
const apply = process.argv.includes("--apply");
try {
    await mongoose.connect(uri);
    const markers = mongoose.connection.collection<{ _id: string; completedAt: Date }>("curriculummigrations");
    if (await markers.findOne({ _id: "lesson-content-v1" })) {
        console.log("lesson-content-v1 already applied; no changes.");
    } else if (!apply) {
        console.log({ dryRun: true, lessons: await LessonModel.countDocuments(), progress: await UserLessonProgressModel.countDocuments(), sessions: await LearningSessionModel.countDocuments() });
        console.log("Pause curriculum edits and learner writes, back up MongoDB, then run again with --apply.");
    } else {
        await curriculumTransaction(async () => {
            await LessonModel.updateMany({ publishedVersion: { $exists: false } }, { $set: { publishedVersion: 1 } });
            await LearningSessionModel.updateMany({ lessonVersion: { $exists: false } }, { $set: { lessonVersion: 1 } });
            for await (const lesson of LessonModel.find().cursor()) {
                const content = await readLessonContent(lesson._id.toString());
                await LessonModel.updateOne({ _id: lesson._id }, { $set: {
                    questionCount: content.assignedQuestionCount, publishedQuestionCount: content.questions.length,
                    ...(lesson.status === "PUBLISHED" && !lesson.publishedContentFingerprint
                        ? { publishedContentFingerprint: contentFingerprint(lesson.requiredScore, content.questions) } : {}),
                } });
            }
            await UserLessonProgressModel.updateMany({ status: "COMPLETED" }, [{ $set: {
                completedVersion: { $ifNull: ["$completedVersion", 1] },
                firstCompletedAt: { $ifNull: ["$firstCompletedAt", { $ifNull: ["$completedAt", "$updatedAt"] }] },
                lastCompletedAt: { $ifNull: ["$lastCompletedAt", { $ifNull: ["$completedAt", "$updatedAt"] }] },
            } }], { updatePipeline: true });
            await UserLessonProgressModel.updateMany({ status: { $ne: "LOCKED" } }, [{ $set: {
                accessGrantedAt: { $ifNull: ["$accessGrantedAt", { $ifNull: ["$unlockedAt", "$createdAt"] }] },
            } }], { updatePipeline: true });
        });
        const milestones = new CurriculumMilestoneRepository();
        // Sessions are also evidence of access, including abandoned and failed sessions.
        for await (const session of LearningSessionModel.find().sort({ startedAt: 1 }).cursor()) {
            await milestones.grant(session.userId.toString(), { kind: "LESSON", targetId: session.lessonId.toString(), accessGrantedAt: session.startedAt });
        }
        for await (const progress of UserLessonProgressModel.find({ status: { $ne: "LOCKED" } }).cursor()) {
            await milestones.grant(progress.userId.toString(), { kind: "LESSON", targetId: progress.lessonId.toString(), accessGrantedAt: progress.accessGrantedAt ?? progress.createdAt });
        }
        const progression = new LearningProgressionService(new CourseRepository(), new SectionRepository(),
            new TopicRepository(), new LessonRepository(), new UserLessonProgressRepository(), milestones);
        const userIds = new Set([
            ...(await UserLessonProgressModel.distinct("userId")).map(String),
            ...(await LearningSessionModel.distinct("userId")).map(String),
        ]);
        const courses = await CourseModel.find({ status: "PUBLISHED" }).select("_id").lean();
        for (const userId of userIds) {
            for (const course of courses) {
                await curriculumTransaction(() => progression.getCourseProgression(userId, course._id.toString()));
            }
        }
        await markers.updateOne({ _id: "lesson-content-v1" }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true });
        console.log("lesson-content-v1 applied. Existing progress and rewards retained.");
    }
} finally {
    await mongoose.disconnect();
}

import "dotenv/config";
import mongoose from "mongoose";
import { CourseModel } from "./models/course.model.js";
import { SectionModel } from "./models/section.model.js";
import { TopicModel } from "./models/topic.model.js";
import { LessonModel } from "./models/lesson.model.js";
import { VocabularyModel } from "./models/vocabulary.model.js";
import { QuestionModel } from "./models/question.model.js";
import { LessonQuestionModel } from "./models/lesson-question.model.js";

async function runSeed() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) throw new Error("MONGODB_URI is not defined");
        await mongoose.connect(mongoUri);
        console.log("Connected to MongoDB for seeding...");

        // Clean up previous mock data to prevent duplicates
        await CourseModel.deleteMany({ name: "Mock Test Course" });
        await SectionModel.deleteMany({ name: "Mock Section 1" });
        await TopicModel.deleteMany({ name: "Mock Topic 1" });
        await LessonModel.deleteMany({ name: "Mock Lesson 1" });
        await VocabularyModel.deleteMany({ word: { $in: ["Apple", "Banana", "Orange", "Grape", "Watermelon"] } });
        await QuestionModel.deleteMany({ type: { $in: ["MULTIPLE_CHOICE", "MATCHING", "FILL_IN_THE_BLANK", "FILL_IN_BLANK"] as any } });

        const course = await CourseModel.create({
            name: "Mock Test Course",
            description: "A course generated for testing purposes",
            level: "BEGINNER",
            status: "PUBLISHED",
            orderIndex: 999
        });

        const section = await SectionModel.create({
            courseId: course._id,
            name: "Mock Section 1",
            description: "First mock section",
            status: "PUBLISHED",
            orderIndex: 1
        });

        const topic = await TopicModel.create({
            sectionId: section._id,
            name: "Mock Topic 1",
            description: "First mock topic",
            status: "PUBLISHED",
            orderIndex: 1
        });

        const lesson = await LessonModel.create({
            topicId: topic._id,
            name: "Mock Lesson 1",
            description: "A mock lesson to test lesson features",
            orderIndex: 1,
            requiredScore: 70,
            questionCount: 2,
            xpReward: 20,
            diamondReward: 5,
            status: "PUBLISHED"
        });

        const vocab1 = await VocabularyModel.create({
            topicId: topic._id,
            word: "Apple",
            meaning: "Quả táo",
            phonetic: "/ˈæp.əl/",
            partOfSpeech: "n",
            difficulty: "EASY",
            status: "PUBLISHED"
        });

        const vocab2 = await VocabularyModel.create({
            topicId: topic._id,
            word: "Banana",
            meaning: "Quả chuối",
            phonetic: "/bəˈnæn.ə/",
            partOfSpeech: "n",
            difficulty: "EASY",
            status: "PUBLISHED"
        });

        const vocab3 = await VocabularyModel.create({
            topicId: topic._id,
            word: "Orange",
            meaning: "Quả cam",
            phonetic: "/ˈɒr.ɪndʒ/",
            partOfSpeech: "n",
            difficulty: "EASY",
            status: "PUBLISHED"
        });

        const vocab4 = await VocabularyModel.create({
            topicId: topic._id,
            word: "Grape",
            meaning: "Quả nho",
            phonetic: "/ɡreɪp/",
            partOfSpeech: "n",
            difficulty: "EASY",
            status: "PUBLISHED"
        });

        const vocab5 = await VocabularyModel.create({
            topicId: topic._id,
            word: "Watermelon",
            meaning: "Dưa hấu",
            phonetic: "/ˈwɔː.təˌmel.ən/",
            partOfSpeech: "n",
            difficulty: "MEDIUM",
            status: "PUBLISHED"
        });

        const q1 = await QuestionModel.create({
            vocabularyId: vocab1._id,
            type: "MULTIPLE_CHOICE",
            content: "What is the meaning of 'Apple'?",
            difficulty: "EASY",
            status: "PUBLISHED",
            options: [
                { content: "Quả táo", isCorrect: true, orderIndex: 1 },
                { content: "Quả chuối", isCorrect: false, orderIndex: 2 },
                { content: "Quả cam", isCorrect: false, orderIndex: 3 },
                { content: "Quả dưa hấu", isCorrect: false, orderIndex: 4 }
            ]
        });

        const q2 = await QuestionModel.create({
            vocabularyId: vocab2._id,
            type: "MATCHING",
            content: "Match the correct meaning for 'Banana'",
            difficulty: "EASY",
            status: "PUBLISHED",
            matchingPairs: [
                { leftValue: "Banana", rightValue: "Quả chuối", orderIndex: 1 }
            ]
        });

        const q3 = await QuestionModel.create({
            vocabularyId: vocab3._id,
            type: "MULTIPLE_CHOICE",
            content: "What does 'Orange' mean?",
            difficulty: "EASY",
            status: "PUBLISHED",
            options: [
                { content: "Quả chuối", isCorrect: false, orderIndex: 1 },
                { content: "Quả cam", isCorrect: true, orderIndex: 2 },
                { content: "Quả mận", isCorrect: false, orderIndex: 3 }
            ]
        });

        const q4 = await QuestionModel.create({
            vocabularyId: vocab4._id,
            type: "MATCHING",
            content: "Match the fruit name 'Grape'",
            difficulty: "EASY",
            status: "PUBLISHED",
            matchingPairs: [
                { leftValue: "Grape", rightValue: "Quả nho", orderIndex: 1 }
            ]
        });

        const q5 = await QuestionModel.create({
            vocabularyId: vocab5._id,
            type: "MULTIPLE_CHOICE",
            content: "What does 'Watermelon' mean?",
            difficulty: "MEDIUM",
            status: "PUBLISHED",
            options: [
                { content: "Dưa hấu", isCorrect: true, orderIndex: 1 },
                { content: "Dưa leo", isCorrect: false, orderIndex: 2 },
                { content: "Dưa gang", isCorrect: false, orderIndex: 3 }
            ]
        });

        await LessonQuestionModel.create({ lessonId: lesson._id, questionId: q1._id, orderIndex: 1 });
        await LessonQuestionModel.create({ lessonId: lesson._id, questionId: q2._id, orderIndex: 2 });
        await LessonQuestionModel.create({ lessonId: lesson._id, questionId: q3._id, orderIndex: 3 });
        await LessonQuestionModel.create({ lessonId: lesson._id, questionId: q4._id, orderIndex: 4 });
        await LessonQuestionModel.create({ lessonId: lesson._id, questionId: q5._id, orderIndex: 5 });

        console.log("Mock data inserted successfully!");
    } catch (err) {
        console.error("Error inserting mock data:", err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
}

runSeed();

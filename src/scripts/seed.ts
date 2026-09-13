import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { UserModel } from "../models/user.model.js";
import { CourseModel } from "../models/course.model.js";
import { SectionModel } from "../models/section.model.js";
import { TopicModel } from "../models/topic.model.js";
import { VocabularyModel } from "../models/vocabulary.model.js";
import { LessonModel } from "../models/lesson.model.js";
import { QuestionModel } from "../models/question.model.js";
import { LessonQuestionModel } from "../models/lesson-question.model.js";
import { UserLessonProgressModel } from "../models/user-lesson-progress.model.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/english-learning";

async function seed() {
    console.log("🌱 Starting seed script...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // 1. Create Student User if not exists
    const studentEmail = "student@gmail.com";
    let student = await UserModel.findOne({ email: studentEmail });
    if (!student) {
        const passwordHash = await bcrypt.hash("Student123456", 10);
        student = await UserModel.create({
            email: studentEmail,
            passwordHash,
            displayName: "Học Viên Lingo",
            role: "USER",
            status: "ACTIVE",
            stats: {
                currentHeart: 5,
                maxHeart: 5,
                heartUpdatedAt: new Date(),
                diamond: 20,
                totalXp: 0,
                level: 1,
                currentStreak: 0,
                longestStreak: 0,
            },
        });
        console.log("👤 Created student user: student@gmail.com / Student123456");
    } else {
        console.log("👤 Student user already exists: student@gmail.com");
    }

    // 2. Course
    let course = await CourseModel.findOne({ name: "Tiếng Anh Giao Tiếp Cơ Bản" });
    if (!course) {
        course = await CourseModel.create({
            name: "Tiếng Anh Giao Tiếp Cơ Bản",
            description: "Khóa học nền tảng giao tiếp hằng ngày dành cho người mới bắt đầu",
            level: "BEGINNER",
            status: "PUBLISHED",
            orderIndex: 1,
        });
        console.log("📚 Created Course: Tiếng Anh Giao Tiếp Cơ Bản");
    }

    // 3. Section
    let section = await SectionModel.findOne({ courseId: course._id, name: "Phần 1: Chào Hỏi & Giao Tiếp" });
    if (!section) {
        section = await SectionModel.create({
            courseId: course._id,
            name: "Phần 1: Chào Hỏi & Giao Tiếp",
            description: "Học cách chào hỏi, cảm ơn và xưng hô tiếng Anh cơ bản",
            orderIndex: 1,
            status: "PUBLISHED",
        });
        console.log("📖 Created Section: Phần 1: Chào Hỏi & Giao Tiếp");
    }

    // 4. Topic
    let topic = await TopicModel.findOne({ sectionId: section._id, name: "Chủ Đề 1: Chào Hỏi Cơ Bản" });
    if (!topic) {
        topic = await TopicModel.create({
            sectionId: section._id,
            name: "Chủ Đề 1: Chào Hỏi Cơ Bản",
            description: "Từ vựng và mẫu câu chào hỏi giao tiếp cơ bản",
            orderIndex: 1,
            status: "PUBLISHED",
        });
        console.log("🎯 Created Topic: Chủ Đề 1: Chào Hỏi Cơ Bản");
    }

    // 5. Vocabularies
    const vocabData = [
        { word: "Hello", meaning: "Xin chào", phonetic: "/həˈləʊ/", difficulty: "EASY" as const },
        { word: "Goodbye", meaning: "Tạm biệt", phonetic: "/ˌɡʊdˈbaɪ/", difficulty: "EASY" as const },
        { word: "Thank you", meaning: "Cảm ơn", phonetic: "/θæŋk juː/", difficulty: "EASY" as const },
        { word: "Apple", meaning: "Quả táo", phonetic: "/ˈæp.əl/", difficulty: "EASY" as const },
        { word: "Water", meaning: "Nước", phonetic: "/ˈwɔː.tər/", difficulty: "EASY" as const },
    ];

    const vocabMap: Record<string, mongoose.Types.ObjectId> = {};
    for (const item of vocabData) {
        let vocab = await VocabularyModel.findOne({ topicId: topic._id, word: item.word });
        if (!vocab) {
            vocab = await VocabularyModel.create({
                topicId: topic._id,
                word: item.word,
                meaning: item.meaning,
                phonetic: item.phonetic,
                difficulty: item.difficulty,
                status: "PUBLISHED",
                createdByAi: false,
            });
        }
        vocabMap[item.word] = vocab._id as mongoose.Types.ObjectId;
    }
    console.log("🔤 Created 5 Vocabularies (Hello, Goodbye, Thank you, Apple, Water)");

    const getVocabId = (word: string): mongoose.Types.ObjectId => {
        const id = vocabMap[word];
        if (!id) throw new Error(`Vocabulary ${word} not found in map`);
        return id;
    };

    // 6. Lessons
    let lesson1 = await LessonModel.findOne({ topicId: topic._id, name: "Bài 1: Chào hỏi thường ngày" });
    if (!lesson1) {
        lesson1 = await LessonModel.create({
            topicId: topic._id,
            name: "Bài 1: Chào hỏi thường ngày",
            description: "Luyện tập các mẫu câu chào hỏi thông dụng",
            orderIndex: 1,
            requiredScore: 70,
            questionCount: 3,
            xpReward: 10,
            diamondReward: 5,
            status: "PUBLISHED",
        });
        console.log("📝 Created Lesson 1: Bài 1: Chào hỏi thường ngày");
    }

    let lesson2 = await LessonModel.findOne({ topicId: topic._id, name: "Bài 2: Cảm ơn và tạm biệt" });
    if (!lesson2) {
        lesson2 = await LessonModel.create({
            topicId: topic._id,
            name: "Bài 2: Cảm ơn và tạm biệt",
            description: "Học cách nói cảm ơn và chào tạm biệt",
            orderIndex: 2,
            requiredScore: 70,
            questionCount: 2,
            xpReward: 10,
            diamondReward: 5,
            status: "PUBLISHED",
        });
        console.log("📝 Created Lesson 2: Bài 2: Cảm ơn và tạm biệt");
    }

    // 7. Questions for Lesson 1
    // Question 1: MC
    let q1 = await QuestionModel.findOne({ content: "Từ 'Hello' có nghĩa là gì trong tiếng Việt?" });
    if (!q1) {
        q1 = await QuestionModel.create({
            vocabularyId: getVocabId("Hello"),
            vocabularyIds: [getVocabId("Hello")],
            type: "MULTIPLE_CHOICE",
            content: "Từ 'Hello' có nghĩa là gì trong tiếng Việt?",
            instruction: "Chọn đáp án đúng nhất",
            options: [
                { content: "Xin chào", isCorrect: true, orderIndex: 0 },
                { content: "Tạm biệt", isCorrect: false, orderIndex: 1 },
                { content: "Cảm ơn", isCorrect: false, orderIndex: 2 },
                { content: "Xin lỗi", isCorrect: false, orderIndex: 3 },
            ],
            explanation: "'Hello' là câu chào xã giao thông dụng trong tiếng Anh.",
            difficulty: "EASY",
            status: "PUBLISHED",
            createdByAi: false,
        });
    }

    // Question 2: Fill Blank
    let q2 = await QuestionModel.findOne({ content: "Điền từ tiếng Anh có nghĩa là 'Cảm ơn': ____ you" });
    if (!q2) {
        q2 = await QuestionModel.create({
            vocabularyId: getVocabId("Thank you"),
            vocabularyIds: [getVocabId("Thank you")],
            type: "FILL_BLANK",
            content: "Điền từ tiếng Anh có nghĩa là 'Cảm ơn': ____ you",
            instruction: "Nhập từ còn thiếu vào ô trống",
            correctAnswer: "Thank",
            explanation: "'Thank you' có nghĩa là Cảm ơn bạn.",
            difficulty: "EASY",
            status: "PUBLISHED",
            createdByAi: false,
        });
    }

    // Question 3: Matching
    let q3 = await QuestionModel.findOne({ content: "Ghép các cặp từ tương ứng tiếng Anh - tiếng Việt" });
    if (!q3) {
        q3 = await QuestionModel.create({
            vocabularyIds: [getVocabId("Hello"), getVocabId("Goodbye")],
            type: "MATCHING",
            content: "Ghép các cặp từ tương ứng tiếng Anh - tiếng Việt",
            instruction: "Nối mỗi từ bên trái với nghĩa bên phải",
            matchingPairs: [
                { vocabularyId: getVocabId("Hello"), leftValue: "Hello", rightValue: "Xin chào", orderIndex: 0 },
                { vocabularyId: getVocabId("Goodbye"), leftValue: "Goodbye", rightValue: "Tạm biệt", orderIndex: 1 },
            ],
            explanation: "Hello = Xin chào, Goodbye = Tạm biệt.",
            difficulty: "EASY",
            status: "PUBLISHED",
            createdByAi: false,
        });
    }

    // Assign to Lesson 1
    await LessonQuestionModel.deleteMany({ lessonId: lesson1._id });
    await LessonQuestionModel.create([
        { lessonId: lesson1._id, questionId: q1._id, orderIndex: 1 },
        { lessonId: lesson1._id, questionId: q2._id, orderIndex: 2 },
        { lessonId: lesson1._id, questionId: q3._id, orderIndex: 3 },
    ]);
    console.log("❓ Created & assigned 3 questions to Lesson 1");

    // 8. Questions for Lesson 2
    let q4 = await QuestionModel.findOne({ content: "Từ 'Goodbye' có nghĩa là gì?" });
    if (!q4) {
        q4 = await QuestionModel.create({
            vocabularyId: getVocabId("Goodbye"),
            vocabularyIds: [getVocabId("Goodbye")],
            type: "MULTIPLE_CHOICE",
            content: "Từ 'Goodbye' có nghĩa là gì?",
            instruction: "Chọn đáp án đúng nhất",
            options: [
                { content: "Xin chào", isCorrect: false, orderIndex: 0 },
                { content: "Tạm biệt", isCorrect: true, orderIndex: 1 },
                { content: "Nước", isCorrect: false, orderIndex: 2 },
                { content: "Quả táo", isCorrect: false, orderIndex: 3 },
            ],
            explanation: "'Goodbye' có nghĩa là chào tạm biệt.",
            difficulty: "EASY",
            status: "PUBLISHED",
            createdByAi: false,
        });
    }

    let q5 = await QuestionModel.findOne({ content: "Dịch từ 'Water' sang tiếng Việt" });
    if (!q5) {
        q5 = await QuestionModel.create({
            vocabularyId: getVocabId("Water"),
            vocabularyIds: [getVocabId("Water")],
            type: "FILL_BLANK",
            content: "Dịch từ 'Water' sang tiếng Việt",
            instruction: "Nhập nghĩa tiếng Việt",
            correctAnswer: "Nước",
            explanation: "'Water' nghĩa là Nước uống.",
            difficulty: "EASY",
            status: "PUBLISHED",
            createdByAi: false,
        });
    }

    // Assign to Lesson 2
    await LessonQuestionModel.deleteMany({ lessonId: lesson2._id });
    await LessonQuestionModel.create([
        { lessonId: lesson2._id, questionId: q4._id, orderIndex: 1 },
        { lessonId: lesson2._id, questionId: q5._id, orderIndex: 2 },
    ]);
    console.log("❓ Created & assigned 2 questions to Lesson 2");

    // 9. Unlock Lesson 1 for student
    let progress = await UserLessonProgressModel.findOne({ userId: student._id, lessonId: lesson1._id });
    if (!progress) {
        await UserLessonProgressModel.create({
            userId: student._id,
            lessonId: lesson1._id,
            status: "UNLOCKED",
            bestScore: 0,
            totalAttempts: 0,
            correctCount: 0,
            wrongCount: 0,
            unlockedAt: new Date(),
        });
        console.log("🔓 Unlocked Lesson 1 for student user");
    }

    console.log("🎉 Seed data created successfully!");
    console.log("\n==========================================");
    console.log("Tài khoản học viên để đăng nhập:");
    console.log("📧 Email:    student@gmail.com");
    console.log("🔑 Password: Student123456");
    console.log("==========================================\n");

    await mongoose.disconnect();
}

seed().catch((err) => {
    console.error("❌ Seed failed:", err);
    mongoose.disconnect();
});

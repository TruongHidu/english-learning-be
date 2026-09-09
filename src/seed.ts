import "dotenv/config";
import mongoose, { Types } from "mongoose";
import bcrypt from "bcrypt";
import { CourseModel } from "./models/course.model.js";
import { SectionModel } from "./models/section.model.js";
import { TopicModel } from "./models/topic.model.js";
import { LessonModel } from "./models/lesson.model.js";
import { VocabularyModel } from "./models/vocabulary.model.js";
import { QuestionModel } from "./models/question.model.js";
import { LessonQuestionModel } from "./models/lesson-question.model.js";
import { DiamondPackageModel } from "./models/diamond-package.model.js";
import { UserModel } from "./models/user.model.js";
import { LearningSessionModel } from "./models/learning-session.model.js";
import { UserLessonProgressModel } from "./models/user-lesson-progress.model.js";

async function runSeed() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) throw new Error("MONGODB_URI is not defined");
        await mongoose.connect(mongoUri);
        console.log("Connected to MongoDB for seeding test data...");

        // 1. Ensure Default Admin exists
        const adminEmail = (process.env.ADMIN_EMAIL || "adminlingo@gmail.com").trim();
        const adminPassword = process.env.ADMIN_PASSWORD || "Admin123456";
        const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

        await UserModel.findOneAndUpdate(
            { email: adminEmail },
            {
                $setOnInsert: {
                    email: adminEmail,
                    passwordHash: adminPasswordHash,
                    displayName: "LingoFox Admin",
                    role: "ADMIN",
                    status: "ACTIVE",
                    authProvider: "LOCAL",
                },
            },
            { upsert: true, new: true },
        );
        console.log(`Verified Admin account: ${adminEmail}`);

        // 2. Clean up previous seed mock entities
        await CourseModel.deleteMany({ name: { $in: ["English Mastery 2026", "Mock Test Course"] } });
        await SectionModel.deleteMany({ name: { $regex: /^(Giao tiếp|Mock Section)/i } });
        await TopicModel.deleteMany({ name: { $regex: /^(Từ vựng|Giao tiếp|Du lịch|Tiếng Anh|Thành ngữ|Mock Topic)/i } });
        await LessonModel.deleteMany({ name: { $regex: /^(Bài \d|Mock Lesson)/i } });
        await QuestionModel.deleteMany({ content: { $regex: /^(What|Match|Choose|Điền|Meaning)/i } });
        await UserModel.deleteMany({ email: { $regex: /@lingotest\.com$/i } });

        // 3. Create Courses, Sections, Topics, Lessons
        const course = await CourseModel.create({
            name: "English Mastery 2026",
            description: "Khóa học tiếng Anh tổng hợp từ cơ bản đến nâng cao",
            level: "BEGINNER",
            status: "PUBLISHED",
            orderIndex: 1,
        });

        const section1 = await SectionModel.create({
            courseId: course._id,
            name: "Giao tiếp cơ bản hàng ngày",
            description: "Làm quen với các chủ đề thông dụng trong đời sống",
            status: "PUBLISHED",
            orderIndex: 1,
        });

        const section2 = await SectionModel.create({
            courseId: course._id,
            name: "Tiếng Anh chuyên sâu & Công sở",
            description: "Nâng cao vốn từ và giao tiếp môi trường làm việc",
            status: "PUBLISHED",
            orderIndex: 2,
        });

        // 5 Topics
        const topic1 = await TopicModel.create({
            sectionId: section1._id,
            name: "Từ vựng Trái cây & Đồ ăn",
            description: "Từ vựng quen thuộc về ẩm thực và trái cây",
            status: "PUBLISHED",
            orderIndex: 1,
        });

        const topic2 = await TopicModel.create({
            sectionId: section1._id,
            name: "Giao tiếp chào hỏi & Làm quen",
            description: "Mẫu câu tự giới thiệu và trò chuyện thường nhật",
            status: "PUBLISHED",
            orderIndex: 2,
        });

        const topic3 = await TopicModel.create({
            sectionId: section1._id,
            name: "Du lịch & Phương tiện giao thông",
            description: "Chỉ đường, hỏi phương tiện và đặt phòng",
            status: "PUBLISHED",
            orderIndex: 3,
        });

        const topic4 = await TopicModel.create({
            sectionId: section2._id,
            name: "Tiếng Anh Văn phòng & Email",
            description: "Viết email chuyên nghiệp và họp bàn công việc",
            status: "PUBLISHED",
            orderIndex: 4,
        });

        const topic5 = await TopicModel.create({
            sectionId: section2._id,
            name: "Thành ngữ thông dụng (Idioms)",
            description: "Các idioms thường gặp trong phim ảnh và đời sống",
            status: "PUBLISHED",
            orderIndex: 5,
        });

        // Lessons
        const lesson1 = await LessonModel.create({
            topicId: topic1._id,
            name: "Bài 1: Trái cây nhiệt đới",
            description: "Học các loại quả phổ biến",
            orderIndex: 1,
            requiredScore: 70,
            questionCount: 5,
            xpReward: 25,
            diamondReward: 5,
            status: "PUBLISHED",
        });

        const lesson2 = await LessonModel.create({
            topicId: topic2._id,
            name: "Bài 1: Cách chào hỏi tự nhiên",
            description: "Chào hỏi chuẩn bản xứ",
            orderIndex: 1,
            requiredScore: 75,
            questionCount: 4,
            xpReward: 30,
            diamondReward: 5,
            status: "PUBLISHED",
        });

        const lesson3 = await LessonModel.create({
            topicId: topic3._id,
            name: "Bài 1: Sân bay & Hỏi đường",
            description: "Từ vựng làm thủ tục check-in",
            orderIndex: 1,
            requiredScore: 70,
            questionCount: 4,
            xpReward: 25,
            diamondReward: 5,
            status: "PUBLISHED",
        });

        const lesson4 = await LessonModel.create({
            topicId: topic4._id,
            name: "Bài 1: Viết email công việc",
            description: "Cấu trúc email chuyên nghiệp",
            orderIndex: 1,
            requiredScore: 80,
            questionCount: 4,
            xpReward: 35,
            diamondReward: 10,
            status: "PUBLISHED",
        });

        const lesson5 = await LessonModel.create({
            topicId: topic5._id,
            name: "Bài 1: Thành ngữ về cảm xúc",
            description: "Ý nghĩa ẩn dụ của các idioms",
            orderIndex: 1,
            requiredScore: 80,
            questionCount: 4,
            xpReward: 40,
            diamondReward: 10,
            status: "PUBLISHED",
        });

        // 4. Create Questions
        // Lesson 1 questions
        const q1 = await QuestionModel.create({
            topicId: topic1._id,
            type: "MULTIPLE_CHOICE",
            content: "What is the meaning of 'Pomegranate'?",
            difficulty: "HARD",
            status: "PUBLISHED",
            options: [
                { content: "Quả lựu", isCorrect: true, orderIndex: 1 },
                { content: "Quả ổi", isCorrect: false, orderIndex: 2 },
                { content: "Quả thanh long", isCorrect: false, orderIndex: 3 },
                { content: "Quả bưởi", isCorrect: false, orderIndex: 4 },
            ],
        });

        const q2 = await QuestionModel.create({
            topicId: topic1._id,
            type: "MULTIPLE_CHOICE",
            content: "Choose the fruit rich in Vitamin C: 'Orange' means:",
            difficulty: "EASY",
            status: "PUBLISHED",
            options: [
                { content: "Quả cam", isCorrect: true, orderIndex: 1 },
                { content: "Quả xoài", isCorrect: false, orderIndex: 2 },
                { content: "Quả chuối", isCorrect: false, orderIndex: 3 },
            ],
        });

        const q3 = await QuestionModel.create({
            topicId: topic1._id,
            type: "MATCHING",
            content: "Match the fruit name with its meaning",
            difficulty: "MEDIUM",
            status: "PUBLISHED",
            matchingPairs: [
                { leftValue: "Watermelon", rightValue: "Dưa hấu", orderIndex: 1 },
                { leftValue: "Pineapple", rightValue: "Quả dứa", orderIndex: 2 },
            ],
        });

        // Lesson 5 questions (Idioms - tricky questions with high wrong rate)
        const q4 = await QuestionModel.create({
            topicId: topic5._id,
            type: "MULTIPLE_CHOICE",
            content: "What does the idiom 'Break a leg' mean in English?",
            difficulty: "HARD",
            status: "PUBLISHED",
            options: [
                { content: "Chúc may mắn (Good luck)", isCorrect: true, orderIndex: 1 },
                { content: "Bị gãy chân", isCorrect: false, orderIndex: 2 },
                { content: "Đi lại cẩn thận", isCorrect: false, orderIndex: 3 },
                { content: "Bỏ cuộc đi", isCorrect: false, orderIndex: 4 },
            ],
        });

        const q5 = await QuestionModel.create({
            topicId: topic5._id,
            type: "MULTIPLE_CHOICE",
            content: "What does 'Bite the bullet' mean?",
            difficulty: "HARD",
            status: "PUBLISHED",
            options: [
                { content: "Cắn răng chịu đựng để vượt qua", isCorrect: true, orderIndex: 1 },
                { content: "Bắn súng săn", isCorrect: false, orderIndex: 2 },
                { content: "Mua vũ khí", isCorrect: false, orderIndex: 3 },
            ],
        });

        const q6 = await QuestionModel.create({
            topicId: topic4._id,
            type: "MULTIPLE_CHOICE",
            content: "What does 'ASAP' stand for in business emails?",
            difficulty: "MEDIUM",
            status: "PUBLISHED",
            options: [
                { content: "As Soon As Possible", isCorrect: true, orderIndex: 1 },
                { content: "Always Send A Packet", isCorrect: false, orderIndex: 2 },
                { content: "At Some Any Place", isCorrect: false, orderIndex: 3 },
            ],
        });

        const q7 = await QuestionModel.create({
            topicId: topic3._id,
            type: "MULTIPLE_CHOICE",
            content: "Where do you go to board a flight? 'Departure Gate' means:",
            difficulty: "MEDIUM",
            status: "PUBLISHED",
            options: [
                { content: "Cổng khởi hành / Cổng lên máy bay", isCorrect: true, orderIndex: 1 },
                { content: "Khu vực gửi hành lý", isCorrect: false, orderIndex: 2 },
                { content: "Băng chuyền hành lý đến", isCorrect: false, orderIndex: 3 },
            ],
        });

        // Assign questions to lessons
        await LessonQuestionModel.create([
            { lessonId: lesson1._id, questionId: q1._id, orderIndex: 1 },
            { lessonId: lesson1._id, questionId: q2._id, orderIndex: 2 },
            { lessonId: lesson1._id, questionId: q3._id, orderIndex: 3 },
            { lessonId: lesson5._id, questionId: q4._id, orderIndex: 1 },
            { lessonId: lesson5._id, questionId: q5._id, orderIndex: 2 },
            { lessonId: lesson4._id, questionId: q6._id, orderIndex: 1 },
            { lessonId: lesson3._id, questionId: q7._id, orderIndex: 1 },
        ]);

        // 5. Create 8 Realistic Learners
        const defaultPasswordHash = await bcrypt.hash("User123456", 10);
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

        const usersData = [
            {
                email: "nguyenvanan@lingotest.com",
                displayName: "Nguyễn Văn An",
                passwordHash: defaultPasswordHash,
                role: "USER" as const,
                status: "ACTIVE" as const,
                authProvider: "LOCAL" as const,
                stats: {
                    currentHeart: 5,
                    maxHeart: 5,
                    heartUpdatedAt: now,
                    diamond: 450,
                    totalXp: 4250,
                    level: 9,
                    currentStreak: 21,
                    longestStreak: 21,
                    lastStudyDate: now,
                },
            },
            {
                email: "tranthimai@lingotest.com",
                displayName: "Trần Thị Mai",
                passwordHash: defaultPasswordHash,
                role: "USER" as const,
                status: "ACTIVE" as const,
                authProvider: "LOCAL" as const,
                stats: {
                    currentHeart: 4,
                    maxHeart: 5,
                    heartUpdatedAt: now,
                    diamond: 820,
                    totalXp: 6100,
                    level: 11,
                    currentStreak: 35,
                    longestStreak: 35,
                    lastStudyDate: now,
                },
            },
            {
                email: "lehoangnam@lingotest.com",
                displayName: "Lê Hoàng Nam",
                passwordHash: defaultPasswordHash,
                role: "USER" as const,
                status: "ACTIVE" as const,
                authProvider: "LOCAL" as const,
                stats: {
                    currentHeart: 5,
                    maxHeart: 5,
                    heartUpdatedAt: now,
                    diamond: 190,
                    totalXp: 1850,
                    level: 6,
                    currentStreak: 8,
                    longestStreak: 14,
                    lastStudyDate: yesterday,
                },
            },
            {
                email: "phamminhduc@lingotest.com",
                displayName: "Phạm Minh Đức",
                passwordHash: defaultPasswordHash,
                role: "USER" as const,
                status: "ACTIVE" as const,
                authProvider: "LOCAL" as const,
                stats: {
                    currentHeart: 3,
                    maxHeart: 5,
                    heartUpdatedAt: now,
                    diamond: 1200,
                    totalXp: 8500,
                    level: 14,
                    currentStreak: 48,
                    longestStreak: 48,
                    lastStudyDate: now,
                },
            },
            {
                email: "dothutrang@lingotest.com",
                displayName: "Đỗ Thu Trang",
                passwordHash: defaultPasswordHash,
                role: "USER" as const,
                status: "ACTIVE" as const,
                authProvider: "LOCAL" as const,
                stats: {
                    currentHeart: 5,
                    maxHeart: 5,
                    heartUpdatedAt: now,
                    diamond: 90,
                    totalXp: 720,
                    level: 3,
                    currentStreak: 3,
                    longestStreak: 5,
                    lastStudyDate: twoDaysAgo,
                },
            },
            {
                email: "hoangkimngan@lingotest.com",
                displayName: "Hoàng Kim Ngân",
                passwordHash: defaultPasswordHash,
                role: "USER" as const,
                status: "ACTIVE" as const,
                authProvider: "LOCAL" as const,
                stats: {
                    currentHeart: 5,
                    maxHeart: 5,
                    heartUpdatedAt: now,
                    diamond: 310,
                    totalXp: 2900,
                    level: 7,
                    currentStreak: 12,
                    longestStreak: 12,
                    lastStudyDate: now,
                },
            },
            {
                email: "vuhoanglong@lingotest.com",
                displayName: "Vũ Hoàng Long",
                passwordHash: defaultPasswordHash,
                role: "USER" as const,
                status: "ACTIVE" as const,
                authProvider: "LOCAL" as const,
                stats: {
                    currentHeart: 2,
                    maxHeart: 5,
                    heartUpdatedAt: now,
                    diamond: 40,
                    totalXp: 350,
                    level: 2,
                    currentStreak: 0,
                    longestStreak: 3,
                    lastStudyDate: twoDaysAgo,
                },
            },
            {
                email: "buiquochuy@lingotest.com",
                displayName: "Bùi Quốc Huy (Locked)",
                passwordHash: defaultPasswordHash,
                role: "USER" as const,
                status: "LOCKED" as const,
                authProvider: "LOCAL" as const,
                stats: {
                    currentHeart: 0,
                    maxHeart: 5,
                    heartUpdatedAt: now,
                    diamond: 0,
                    totalXp: 100,
                    level: 1,
                    currentStreak: 0,
                    longestStreak: 1,
                    lastStudyDate: twoDaysAgo,
                },
            },
        ];

        const createdUsers = await UserModel.create(usersData);
        console.log(`Created ${createdUsers.length} sample learners.`);

        // 6. Create UserLessonProgress records
        const user1 = createdUsers[0]!;
        const user2 = createdUsers[1]!;
        const user3 = createdUsers[2]!;
        const user4 = createdUsers[3]!;
        const user5 = createdUsers[4]!;

        await UserLessonProgressModel.create([
            { userId: user1._id, lessonId: lesson1._id, status: "COMPLETED", bestScore: 90, totalAttempts: 2, correctCount: 9, wrongCount: 1, completedAt: now },
            { userId: user1._id, lessonId: lesson2._id, status: "COMPLETED", bestScore: 85, totalAttempts: 1, correctCount: 4, wrongCount: 0, completedAt: now },
            { userId: user2._id, lessonId: lesson1._id, status: "COMPLETED", bestScore: 100, totalAttempts: 1, correctCount: 5, wrongCount: 0, completedAt: now },
            { userId: user2._id, lessonId: lesson3._id, status: "COMPLETED", bestScore: 80, totalAttempts: 2, correctCount: 6, wrongCount: 2, completedAt: now },
            { userId: user2._id, lessonId: lesson5._id, status: "COMPLETED", bestScore: 75, totalAttempts: 3, correctCount: 5, wrongCount: 4, completedAt: now },
            { userId: user3._id, lessonId: lesson1._id, status: "IN_PROGRESS", bestScore: 50, totalAttempts: 1, correctCount: 2, wrongCount: 3 },
            { userId: user4._id, lessonId: lesson1._id, status: "COMPLETED", bestScore: 95, totalAttempts: 1, correctCount: 5, wrongCount: 0, completedAt: now },
            { userId: user4._id, lessonId: lesson2._id, status: "COMPLETED", bestScore: 100, totalAttempts: 1, correctCount: 4, wrongCount: 0, completedAt: now },
            { userId: user4._id, lessonId: lesson4._id, status: "COMPLETED", bestScore: 88, totalAttempts: 2, correctCount: 7, wrongCount: 1, completedAt: now },
            { userId: user4._id, lessonId: lesson5._id, status: "COMPLETED", bestScore: 80, totalAttempts: 2, correctCount: 6, wrongCount: 2, completedAt: now },
            { userId: user5._id, lessonId: lesson1._id, status: "IN_PROGRESS", bestScore: 40, totalAttempts: 1, correctCount: 1, wrongCount: 3 },
        ]);

        // 7. Create LearningSessions with wrongQuestionIds to populate Top Wrong Questions
        // q4 (Break a leg) answered wrong 6 times out of 7 attempts -> 85.7% (HIGH)
        // q1 (Pomegranate) answered wrong 5 times out of 8 attempts -> 62.5% (MEDIUM)
        // q5 (Bite the bullet) answered wrong 3 times out of 6 attempts -> 50.0% (MEDIUM)
        // q7 (Departure gate) answered wrong 1 time out of 5 attempts -> 20.0% (LOW)
        await LearningSessionModel.create([
            // Session 1: User 1 on Lesson 5 (Idioms)
            {
                userId: user1._id,
                lessonId: lesson5._id,
                status: "COMPLETED",
                heartStart: 5,
                heartRemaining: 3,
                requiredScore: 70,
                totalQuestions: 2,
                questionIds: [q4._id, q5._id],
                answeredQuestionIds: [q4._id, q5._id],
                wrongQuestionIds: [q4._id], // wrong on q4
                questionSnapshots: [],
                correctCount: 1,
                wrongCount: 1,
                score: 50,
                xpEarned: 12,
                diamondEarned: 0,
                startedAt: now,
                completedAt: now,
                terminalProcessed: true,
            },
            // Session 2: User 2 on Lesson 5 (Idioms)
            {
                userId: user2._id,
                lessonId: lesson5._id,
                status: "COMPLETED",
                heartStart: 5,
                heartRemaining: 3,
                requiredScore: 70,
                totalQuestions: 2,
                questionIds: [q4._id, q5._id],
                answeredQuestionIds: [q4._id, q5._id],
                wrongQuestionIds: [q4._id, q5._id], // wrong on both
                questionSnapshots: [],
                correctCount: 0,
                wrongCount: 2,
                score: 0,
                xpEarned: 0,
                diamondEarned: 0,
                startedAt: now,
                completedAt: now,
                terminalProcessed: true,
            },
            // Session 3: User 3 on Lesson 5 (Idioms)
            {
                userId: user3._id,
                lessonId: lesson5._id,
                status: "COMPLETED",
                heartStart: 5,
                heartRemaining: 4,
                requiredScore: 70,
                totalQuestions: 2,
                questionIds: [q4._id, q5._id],
                answeredQuestionIds: [q4._id, q5._id],
                wrongQuestionIds: [q4._id], // wrong on q4
                questionSnapshots: [],
                correctCount: 1,
                wrongCount: 1,
                score: 50,
                xpEarned: 12,
                diamondEarned: 0,
                startedAt: yesterday,
                completedAt: yesterday,
                terminalProcessed: true,
            },
            // Session 4: User 4 on Lesson 5 (Idioms)
            {
                userId: user4._id,
                lessonId: lesson5._id,
                status: "COMPLETED",
                heartStart: 5,
                heartRemaining: 3,
                requiredScore: 70,
                totalQuestions: 2,
                questionIds: [q4._id, q5._id],
                answeredQuestionIds: [q4._id, q5._id],
                wrongQuestionIds: [q4._id, q5._id], // wrong on both
                questionSnapshots: [],
                correctCount: 0,
                wrongCount: 2,
                score: 0,
                xpEarned: 0,
                diamondEarned: 0,
                startedAt: yesterday,
                completedAt: yesterday,
                terminalProcessed: true,
            },
            // Session 5: User 5 on Lesson 5 (Idioms)
            {
                userId: user5._id,
                lessonId: lesson5._id,
                status: "COMPLETED",
                heartStart: 5,
                heartRemaining: 4,
                requiredScore: 70,
                totalQuestions: 2,
                questionIds: [q4._id, q5._id],
                answeredQuestionIds: [q4._id, q5._id],
                wrongQuestionIds: [q4._id], // wrong on q4
                questionSnapshots: [],
                correctCount: 1,
                wrongCount: 1,
                score: 50,
                xpEarned: 10,
                diamondEarned: 0,
                startedAt: twoDaysAgo,
                completedAt: twoDaysAgo,
                terminalProcessed: true,
            },
            // Session 6: User 1 on Lesson 1 (Fruits)
            {
                userId: user1._id,
                lessonId: lesson1._id,
                status: "COMPLETED",
                heartStart: 5,
                heartRemaining: 4,
                requiredScore: 70,
                totalQuestions: 3,
                questionIds: [q1._id, q2._id, q3._id],
                answeredQuestionIds: [q1._id, q2._id, q3._id],
                wrongQuestionIds: [q1._id], // wrong on q1
                questionSnapshots: [],
                correctCount: 2,
                wrongCount: 1,
                score: 67,
                xpEarned: 16,
                diamondEarned: 0,
                startedAt: now,
                completedAt: now,
                terminalProcessed: true,
            },
            // Session 7: User 2 on Lesson 1 (Fruits)
            {
                userId: user2._id,
                lessonId: lesson1._id,
                status: "COMPLETED",
                heartStart: 5,
                heartRemaining: 4,
                requiredScore: 70,
                totalQuestions: 3,
                questionIds: [q1._id, q2._id, q3._id],
                answeredQuestionIds: [q1._id, q2._id, q3._id],
                wrongQuestionIds: [q1._id], // wrong on q1
                questionSnapshots: [],
                correctCount: 2,
                wrongCount: 1,
                score: 67,
                xpEarned: 16,
                diamondEarned: 0,
                startedAt: now,
                completedAt: now,
                terminalProcessed: true,
            },
            // Session 8: User 3 on Lesson 1 (Fruits)
            {
                userId: user3._id,
                lessonId: lesson1._id,
                status: "COMPLETED",
                heartStart: 5,
                heartRemaining: 3,
                requiredScore: 70,
                totalQuestions: 3,
                questionIds: [q1._id, q2._id, q3._id],
                answeredQuestionIds: [q1._id, q2._id, q3._id],
                wrongQuestionIds: [q1._id], // wrong on q1
                questionSnapshots: [],
                correctCount: 2,
                wrongCount: 1,
                score: 67,
                xpEarned: 16,
                diamondEarned: 0,
                startedAt: yesterday,
                completedAt: yesterday,
                terminalProcessed: true,
            },
            // Session 9: User 4 on Lesson 1 (Fruits)
            {
                userId: user4._id,
                lessonId: lesson1._id,
                status: "COMPLETED",
                heartStart: 5,
                heartRemaining: 4,
                requiredScore: 70,
                totalQuestions: 3,
                questionIds: [q1._id, q2._id, q3._id],
                answeredQuestionIds: [q1._id, q2._id, q3._id],
                wrongQuestionIds: [q1._id], // wrong on q1
                questionSnapshots: [],
                correctCount: 2,
                wrongCount: 1,
                score: 67,
                xpEarned: 16,
                diamondEarned: 0,
                startedAt: yesterday,
                completedAt: yesterday,
                terminalProcessed: true,
            },
            // Session 10: User 5 on Lesson 1 (Fruits)
            {
                userId: user5._id,
                lessonId: lesson1._id,
                status: "COMPLETED",
                heartStart: 5,
                heartRemaining: 4,
                requiredScore: 70,
                totalQuestions: 3,
                questionIds: [q1._id, q2._id, q3._id],
                answeredQuestionIds: [q1._id, q2._id, q3._id],
                wrongQuestionIds: [q1._id], // wrong on q1
                questionSnapshots: [],
                correctCount: 2,
                wrongCount: 1,
                score: 67,
                xpEarned: 16,
                diamondEarned: 0,
                startedAt: twoDaysAgo,
                completedAt: twoDaysAgo,
                terminalProcessed: true,
            },
            // Session 11: User 1 on Lesson 3 (Travel)
            {
                userId: user1._id,
                lessonId: lesson3._id,
                status: "COMPLETED",
                heartStart: 5,
                heartRemaining: 4,
                requiredScore: 70,
                totalQuestions: 1,
                questionIds: [q7._id],
                answeredQuestionIds: [q7._id],
                wrongQuestionIds: [q7._id], // wrong on q7
                questionSnapshots: [],
                correctCount: 0,
                wrongCount: 1,
                score: 0,
                xpEarned: 0,
                diamondEarned: 0,
                startedAt: now,
                completedAt: now,
                terminalProcessed: true,
            },
            // Session 12: User 2 on Lesson 3 (Travel)
            {
                userId: user2._id,
                lessonId: lesson3._id,
                status: "COMPLETED",
                heartStart: 5,
                heartRemaining: 5,
                requiredScore: 70,
                totalQuestions: 1,
                questionIds: [q7._id],
                answeredQuestionIds: [q7._id],
                wrongQuestionIds: [],
                questionSnapshots: [],
                correctCount: 1,
                wrongCount: 0,
                score: 100,
                xpEarned: 25,
                diamondEarned: 5,
                startedAt: now,
                completedAt: now,
                terminalProcessed: true,
            },
            // Session 13: User 4 on Lesson 3 (Travel)
            {
                userId: user4._id,
                lessonId: lesson3._id,
                status: "COMPLETED",
                heartStart: 5,
                heartRemaining: 5,
                requiredScore: 70,
                totalQuestions: 1,
                questionIds: [q7._id],
                answeredQuestionIds: [q7._id],
                wrongQuestionIds: [],
                questionSnapshots: [],
                correctCount: 1,
                wrongCount: 0,
                score: 100,
                xpEarned: 25,
                diamondEarned: 5,
                startedAt: yesterday,
                completedAt: yesterday,
                terminalProcessed: true,
            },
            // Session 14: User 2 on Lesson 2 (Greetings)
            {
                userId: user2._id,
                lessonId: lesson2._id,
                status: "COMPLETED",
                heartStart: 5,
                heartRemaining: 5,
                requiredScore: 75,
                totalQuestions: 1,
                questionIds: [q2._id],
                answeredQuestionIds: [q2._id],
                wrongQuestionIds: [],
                questionSnapshots: [],
                correctCount: 1,
                wrongCount: 0,
                score: 100,
                xpEarned: 30,
                diamondEarned: 5,
                startedAt: now,
                completedAt: now,
                terminalProcessed: true,
            },
            // Session 15: User 4 on Lesson 4 (Work Email)
            {
                userId: user4._id,
                lessonId: lesson4._id,
                status: "COMPLETED",
                heartStart: 5,
                heartRemaining: 4,
                requiredScore: 80,
                totalQuestions: 1,
                questionIds: [q6._id],
                answeredQuestionIds: [q6._id],
                wrongQuestionIds: [],
                questionSnapshots: [],
                correctCount: 1,
                wrongCount: 0,
                score: 100,
                xpEarned: 35,
                diamondEarned: 10,
                startedAt: now,
                completedAt: now,
                terminalProcessed: true,
            },
        ]);

        // 8. Diamond Packages
        const defaultDiamondPackages = [
            {
                code: "DIAMOND_SMALL",
                name: "Túi Đá Quý",
                diamondAmount: 100,
                bonusDiamond: 0,
                price: 19000,
                currency: "VND",
                status: "ACTIVE",
                orderIndex: 1,
                description: "Gói phù hợp cho người mới",
            },
            {
                code: "DIAMOND_MEDIUM",
                name: "Rương Bạc",
                diamondAmount: 500,
                bonusDiamond: 50,
                price: 49000,
                currency: "VND",
                status: "ACTIVE",
                orderIndex: 2,
                description: "Gói tiết kiệm phổ biến nhất",
            },
            {
                code: "DIAMOND_LARGE",
                name: "Kho Báu Hoàng Gia",
                diamondAmount: 1000,
                bonusDiamond: 200,
                price: 99000,
                currency: "VND",
                status: "ACTIVE",
                orderIndex: 3,
                description: "Gói ưu đãi tốt nhất cho học viên chăm chỉ",
            },
        ];

        for (const pkg of defaultDiamondPackages) {
            await DiamondPackageModel.findOneAndUpdate(
                { code: pkg.code },
                { $setOnInsert: pkg },
                { upsert: true, new: true },
            );
        }

        console.log("--------------------------------------------------");
        console.log("Seeding completed successfully!");
        console.log("Admin Account: " + adminEmail + " / " + adminPassword);
        console.log("Learner accounts: 8 users (@lingotest.com / User123456)");
        console.log("5 Topics, 5 Lessons, 7 Questions, 15 Learning Sessions created!");
        console.log("--------------------------------------------------");
    } catch (err) {
        console.error("Error inserting seed data:", err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
}

runSeed();

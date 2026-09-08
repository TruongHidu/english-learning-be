import { UserModel } from "../models/user.model.js";
import { DiamondTransactionModel } from "../models/diamond-transaction.model.js";
import { UserLessonProgressModel } from "../models/user-lesson-progress.model.js";
import { UserVocabularyModel } from "../models/user-vocabulary.model.js";
import { CourseModel } from "../models/course.model.js";
import { SectionModel } from "../models/section.model.js";
import { LessonModel } from "../models/lesson.model.js";
import { AppError } from "../errors/app-error.js";
import { realtimeService } from "./realtime.service.js";
import { effectiveCurrentStreak } from "../utils/streak.js";

export interface GetUsersQuery {
    q?: string;
    status?: string;
    page?: number;
    limit?: number;
}

export interface GetTransactionsQuery {
    userId?: string;
    type?: string;
    page?: number;
    limit?: number;
}

export class AdminDiamondService {
    async getUsers(query: GetUsersQuery) {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = {};
        if (query.status) {
            filter.status = query.status;
        }
        if (query.q) {
            const regex = new RegExp(query.q.trim(), "i");
            filter.$or = [{ email: regex }, { displayName: regex }];
        }

        const [users, total] = await Promise.all([
            UserModel.find(filter)
                .select("email displayName role status stats createdAt")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            UserModel.countDocuments(filter).exec(),
        ]);

        const now = new Date();
        return {
            users: users.map((u) => ({
                id: u._id.toString(),
                email: u.email,
                name: u.displayName,
                role: u.role,
                status: u.status,
                diamond: u.stats?.diamond ?? 0,
                currentHeart: u.stats?.currentHeart ?? 0,
                maxHeart: u.stats?.maxHeart ?? 5,
                totalXp: u.stats?.totalXp ?? 0,
                currentStreak: effectiveCurrentStreak(u.stats, now),
                createdAt: u.createdAt,
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async adjustUserDiamonds(adminId: string, userId: string, amount: number, reason: string) {
        if (!amount || typeof amount !== "number" || !Number.isInteger(amount)) {
            throw new AppError("INVALID_AMOUNT", "Số lượng kim cương phải là số nguyên khác 0", 400);
        }
        if (!reason || !reason.trim()) {
            throw new AppError("REASON_REQUIRED", "Vui lòng nhập lý do điều chỉnh", 400);
        }

        // Increment atomically so an admin adjustment cannot overwrite a learning reward.
        const user = await UserModel.findOneAndUpdate(
            { _id: userId, ...(amount < 0 ? { "stats.diamond": { $gte: -amount } } : {}) },
            { $inc: { "stats.diamond": amount } },
            { returnDocument: "after", runValidators: true },
        ).exec();
        if (!user) {
            const existing = await UserModel.findById(userId).exec();
            if (!existing) {
                throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
            }
            throw new AppError(
                "INSUFFICIENT_DIAMOND",
                `Không thể trừ vượt quá số dư hiện tại (Hiện có ${existing.stats.diamond ?? 0} 💎)`,
                400,
            );
        }
        const nextDiamond = user.stats.diamond;
        const currentDiamond = nextDiamond - amount;

        const transaction = await DiamondTransactionModel.create({
            userId: user._id,
            amount,
            type: "ADMIN_ADJUST",
            balanceBefore: currentDiamond,
            balanceAfter: nextDiamond,
            referenceType: "ADMIN",
            referenceId: adminId,
            description: reason.trim(),
        });

        // Real-time instant notification to active client sessions
        realtimeService.notifyUser(userId, {
            type: "DIAMOND_UPDATED",
            diamond: nextDiamond,
            change: amount,
            reason: reason.trim(),
            balanceBefore: currentDiamond,
            balanceAfter: nextDiamond,
        });

        return {
            user: {
                id: user._id.toString(),
                email: user.email,
                name: user.displayName,
                diamond: user.stats.diamond,
                currentHeart: user.stats.currentHeart,
            },
            transaction: {
                id: transaction._id.toString(),
                amount,
                balanceBefore: currentDiamond,
                balanceAfter: nextDiamond,
                description: transaction.description,
                createdAt: transaction.createdAt,
            },
        };
    }

    async getTransactions(query: GetTransactionsQuery) {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = {};
        if (query.type) {
            filter.type = query.type;
        }
        if (query.userId) {
            filter.userId = query.userId;
        }

        const [transactions, total] = await Promise.all([
            DiamondTransactionModel.find(filter)
                .populate("userId", "email displayName")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            DiamondTransactionModel.countDocuments(filter).exec(),
        ]);

        return {
            transactions: transactions.map((t) => {
                const userObj = t.userId as unknown as { _id: unknown; email?: string; displayName?: string } | null;
                return {
                    id: t._id.toString(),
                    userId: userObj?._id ? String(userObj._id) : String(t.userId),
                    userEmail: userObj?.email || "N/A",
                    userName: userObj?.displayName || "N/A",
                    amount: t.amount,
                    type: t.type,
                    balanceBefore: t.balanceBefore,
                    balanceAfter: t.balanceAfter,
                    description: t.description || "",
                    referenceType: t.referenceType,
                    referenceId: t.referenceId,
                    createdAt: t.createdAt,
                };
            }),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getUserDetail(userId: string) {
        const user = await UserModel.findById(userId).lean();
        if (!user) {
            throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
        }

        const streak = effectiveCurrentStreak({
            currentStreak: user.stats?.currentStreak ?? 0,
            lastStudyDate: user.stats?.lastStudyDate,
        });

        return {
            id: user._id.toString(),
            name: user.displayName,
            email: user.email,
            role: user.role,
            status: user.status,
            avatarUrl: user.avatarUrl || null,
            authProvider: user.authProvider,
            diamond: user.stats?.diamond ?? 0,
            currentHeart: user.stats?.currentHeart ?? 5,
            maxHeart: user.stats?.maxHeart ?? 5,
            totalXp: user.stats?.totalXp ?? 0,
            level: user.stats?.level ?? 1,
            currentStreak: streak,
            longestStreak: user.stats?.longestStreak ?? 0,
            lastStudyDate: user.stats?.lastStudyDate ?? null,
            lastLoginAt: user.lastLoginAt ?? null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }

    async getUserProgress(userId: string) {
        const user = await UserModel.findById(userId).lean();
        if (!user) {
            throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
        }

        const progresses = await UserLessonProgressModel.find({
            userId,
            status: "COMPLETED",
        }).lean();

        const completedLessonIds = new Set(progresses.map((p) => p.lessonId.toString()));

        const courses = await CourseModel.find({ status: { $ne: "INACTIVE" } }).sort({ orderIndex: 1 }).lean();

        const courseProgressList = await Promise.all(
            courses.map(async (course) => {
                const sections = await SectionModel.find({ courseId: course._id, status: "PUBLISHED" }).lean();
                const sectionIds = sections.map((s) => s._id);

                const lessons = await LessonModel.find({ sectionId: { $in: sectionIds }, status: "PUBLISHED" }).lean();

                const totalLessons = lessons.length;
                let completedLessons = 0;

                for (const l of lessons) {
                    if (completedLessonIds.has(l._id.toString())) {
                        completedLessons++;
                    }
                }

                const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

                return {
                    courseId: course._id.toString(),
                    courseName: course.name,
                    level: course.level,
                    thumbnailUrl: course.thumbnailUrl || null,
                    totalLessons,
                    completedLessons,
                    progressPercent,
                };
            })
        );

        return {
            totalCompletedLessons: completedLessonIds.size,
            courses: courseProgressList,
        };
    }

    async getUserVocabularies(userId: string, query: { page?: number; limit?: number }) {
        const user = await UserModel.findById(userId).lean();
        if (!user) {
            throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
        }

        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = { userId };

        const [userVocabs, total] = await Promise.all([
            UserVocabularyModel.find(filter)
                .populate("vocabularyId", "word meaning phonetic partOfSpeech difficulty")
                .sort({ learnedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            UserVocabularyModel.countDocuments(filter),
        ]);

        const vocabularies = userVocabs.map((uv) => {
            const vocab = uv.vocabularyId as unknown as {
                word?: string;
                meaning?: string;
                phonetic?: string;
                partOfSpeech?: string;
                difficulty?: string;
            } | null;

            return {
                id: uv._id.toString(),
                word: vocab?.word || "N/A",
                meaning: vocab?.meaning || "N/A",
                phonetic: vocab?.phonetic || "",
                partOfSpeech: vocab?.partOfSpeech || "",
                difficulty: vocab?.difficulty || "BEGINNER",
                status: uv.status,
                reviewLevel: uv.reviewLevel,
                reviewCount: uv.reviewCount,
                correctCount: uv.correctCount,
                incorrectCount: uv.incorrectCount,
                learnedAt: uv.learnedAt,
                lastReviewedAt: uv.lastReviewedAt,
            };
        });

        return {
            vocabularies,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async updateUserStatus(adminId: string, userId: string, status: "ACTIVE" | "LOCKED" | "BANNED", reason?: string) {
        if (adminId === userId) {
            throw new AppError("CANNOT_MODIFY_SELF", "Không thể tự thay đổi trạng thái của chính mình", 400);
        }

        const user = await UserModel.findById(userId);
        if (!user) {
            throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
        }

        if (user.role === "ADMIN" && status !== "ACTIVE") {
            throw new AppError("CANNOT_LOCK_ADMIN", "Không thể khóa tài khoản có quyền Quản trị viên", 400);
        }

        user.status = status;
        await user.save();

        realtimeService.notifyUser(userId, {
            type: "ACCOUNT_STATUS_CHANGED",
            status,
            reason: reason || "",
        });

        return {
            id: user._id.toString(),
            name: user.displayName,
            email: user.email,
            status: user.status,
            role: user.role,
        };
    }
}

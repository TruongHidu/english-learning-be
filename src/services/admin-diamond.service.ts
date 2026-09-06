import { UserModel } from "../models/user.model.js";
import { DiamondTransactionModel } from "../models/diamond-transaction.model.js";
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
}

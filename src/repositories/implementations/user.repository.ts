import { UserModel, type UserDocument } from "../../models/user.model.js";
import type { User } from "../../types/auth.types.js";
import type {
    CreateUserData,
    IUserRepository,
} from "../interfaces/user.repository.interface.js";

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const toDomainUser = (document: UserDocument): User => {
    const user: User = {
        id: document._id.toString(),
        email: document.email,
        displayName: document.displayName,
        authProvider: document.authProvider,
        role: document.role,
        status: document.status,
        stats: {
            currentHeart: document.stats.currentHeart,
            maxHeart: document.stats.maxHeart,
            heartUpdatedAt: document.stats.heartUpdatedAt,
            diamond: document.stats.diamond,
            totalXp: document.stats.totalXp,
            level: document.stats.level,
            currentStreak: document.stats.currentStreak,
            longestStreak: document.stats.longestStreak,
            ...(document.stats.lastStudyDate && { lastStudyDate: document.stats.lastStudyDate }),
        },
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
    };

    if (document.passwordHash) user.passwordHash = document.passwordHash;
    if (document.avatarUrl) user.avatarUrl = document.avatarUrl;
    if (document.providerId) user.providerId = document.providerId;
    if (document.lastLoginAt) user.lastLoginAt = document.lastLoginAt;

    return user;
};

export class UserRepository implements IUserRepository {
    async findByEmail(email: string): Promise<User | null> {
        const document = await UserModel.findOne({ email: normalizeEmail(email) })
            .select("+passwordHash")
            .exec();

        return document ? toDomainUser(document) : null;
    }

    async findById(id: string): Promise<User | null> {
        const document = await UserModel.findById(id).select("+passwordHash").exec();
        return document ? toDomainUser(document) : null;
    }

    async create(data: CreateUserData): Promise<User> {
        const document = await UserModel.create({
            ...data,
            email: normalizeEmail(data.email),
        });

        return toDomainUser(document);
    }

    async updateLastLogin(userId: string, date: Date): Promise<void> {
        await UserModel.updateOne({ _id: userId }, { $set: { lastLoginAt: date } }).exec();
    }

    async updateDisplayName(userId: string, displayName: string): Promise<User | null> {
        const document = await UserModel.findByIdAndUpdate(
            userId,
            { $set: { displayName } },
            { new: true, runValidators: true },
        ).exec();

        return document ? toDomainUser(document) : null;
    }

    async updatePassword(userId: string, passwordHash: string): Promise<void> {
        await UserModel.updateOne(
            { _id: userId },
            { $set: { passwordHash } },
            { runValidators: true },
        ).exec();
    }

    async updateHeart(userId: string, delta: number): Promise<void> {
        await UserModel.updateOne(
            { _id: userId },
            { $inc: { "stats.currentHeart": delta } },
            { runValidators: true },
        ).exec();
    }

    async updateHeartState(
        userId: string,
        currentHeart: number,
        heartUpdatedAt: Date,
        expectedCurrentHeart?: number,
        expectedHeartUpdatedAt?: Date,
    ): Promise<User | null> {
        const filter: Record<string, unknown> = { _id: userId };
        if (expectedCurrentHeart !== undefined) {
            filter["stats.currentHeart"] = expectedCurrentHeart;
        }
        if (expectedHeartUpdatedAt !== undefined) {
            filter["stats.heartUpdatedAt"] = expectedHeartUpdatedAt;
        }

        const document = await UserModel.findOneAndUpdate(
            filter,
            {
                $set: {
                    "stats.currentHeart": currentHeart,
                    "stats.heartUpdatedAt": heartUpdatedAt,
                },
            },
            { new: true, runValidators: true },
        ).exec();

        return document ? toDomainUser(document) : null;
    }

    async updateStats(
        userId: string,
        statsUpdate: {
            totalXp: number;
            level: number;
            diamond: number;
            currentStreak: number;
            longestStreak: number;
            lastStudyDate: Date;
        },
    ): Promise<User | null> {
        const document = await UserModel.findByIdAndUpdate(
            userId,
            {
                $set: {
                    "stats.totalXp": statsUpdate.totalXp,
                    "stats.level": statsUpdate.level,
                    "stats.diamond": statsUpdate.diamond,
                    "stats.currentStreak": statsUpdate.currentStreak,
                    "stats.longestStreak": statsUpdate.longestStreak,
                    "stats.lastStudyDate": statsUpdate.lastStudyDate,
                },
            },
            { new: true, runValidators: true },
        ).exec();

        return document ? toDomainUser(document) : null;
    }
}

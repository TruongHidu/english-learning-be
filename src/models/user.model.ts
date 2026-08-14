import { Schema, model, type HydratedDocument } from "mongoose";

import {
    AUTH_PROVIDERS,
    USER_ROLES,
    USER_STATUSES,
    type AuthProvider,
    type UserRole,
    type UserStats,
    type UserStatus,
} from "../types/auth.types.js";

export interface UserPersistence {
    email: string;
    passwordHash?: string;
    displayName: string;
    avatarUrl?: string;
    authProvider: AuthProvider;
    providerId?: string;
    role: UserRole;
    status: UserStatus;
    stats: UserStats;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserPersistence>;

const userStatsSchema = new Schema<UserStats>(
    {
        currentHeart: { type: Number, default: 5, min: 0, required: true },
        maxHeart: { type: Number, default: 5, min: 1, required: true },
        heartUpdatedAt: { type: Date, default: Date.now, required: true },
        diamond: { type: Number, default: 0, min: 0, required: true },
        totalXp: { type: Number, default: 0, min: 0, required: true },
        level: { type: Number, default: 1, min: 1, required: true },
        currentStreak: { type: Number, default: 0, min: 0, required: true },
        longestStreak: { type: Number, default: 0, min: 0, required: true },
        lastStudyDate: { type: Date, required: false },
    },
    { _id: false },
);

const userSchema = new Schema<UserPersistence>(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        passwordHash: { type: String, required: false, select: false },
        displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
        avatarUrl: { type: String, required: false },
        authProvider: { type: String, enum: AUTH_PROVIDERS, default: "LOCAL", required: true },
        providerId: { type: String, required: false },
        role: { type: String, enum: USER_ROLES, default: "USER", required: true },
        status: { type: String, enum: USER_STATUSES, default: "ACTIVE", required: true },
        stats: { type: userStatsSchema, default: () => ({}), required: true },
        lastLoginAt: { type: Date, required: false },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

userSchema.index(
    { authProvider: 1, providerId: 1 },
    {
        unique: true,
        partialFilterExpression: { providerId: { $type: "string" } },
    },
);

export const UserModel = model<UserPersistence>("User", userSchema);

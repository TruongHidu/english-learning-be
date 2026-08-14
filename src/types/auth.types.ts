export const USER_ROLES = ["USER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "LOCKED", "BANNED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const AUTH_PROVIDERS = ["LOCAL", "GOOGLE"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export interface UserStats {
    currentHeart: number;
    maxHeart: number;
    heartUpdatedAt: Date;
    diamond: number;
    totalXp: number;
    level: number;
    currentStreak: number;
    longestStreak: number;
    lastStudyDate?: Date;
}

export interface User {
    id: string;
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

export interface RegisterInput {
    email: string;
    password: string;
    displayName: string;
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface AuthenticatedUser {
    id: string;
    role: UserRole;
}

export interface JwtPayload {
    sub: string;
    role: UserRole;
}

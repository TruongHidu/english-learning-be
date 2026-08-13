import type { AuthProvider, UserRole, UserStatus } from "./auth.types.js";

export interface UpdateDisplayNameInput {
    displayName: string;
}

export interface ChangePasswordInput {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export interface UserProfileResponse {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    authProvider: AuthProvider;
    role: UserRole;
    status: UserStatus;
    stats: {
        currentHeart: number;
        maxHeart: number;
        diamond: number;
        totalXp: number;
        level: number;
        currentStreak: number;
        longestStreak: number;
    };
    createdAt: Date;
}

export interface UpdatedUserNameResponse {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
}

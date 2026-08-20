import type { AuthProvider, User, UserRole, UserStats, UserStatus } from "../../types/auth.types.js";

export interface CreateUserData {
    email: string;
    passwordHash?: string;
    displayName: string;
    avatarUrl?: string;
    authProvider?: AuthProvider;
    providerId?: string;
    role?: UserRole;
    status?: UserStatus;
    stats?: Partial<UserStats>;
}

export interface IUserRepository {
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    create(data: CreateUserData): Promise<User>;
    updateLastLogin(userId: string, date: Date): Promise<void>;
    updateDisplayName(userId: string, displayName: string): Promise<User | null>;
    updatePassword(userId: string, passwordHash: string): Promise<void>;
    updateHeart(userId: string, delta: number): Promise<void>;
}

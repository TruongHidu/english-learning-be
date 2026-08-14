import type { User } from "../types/auth.types.js";
import type { UpdatedUserNameResponse, UserProfileResponse } from "../types/user.types.js";

export class UserMapper {
    static toProfileResponse(user: User): UserProfileResponse {
        return {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl ?? null,
            authProvider: user.authProvider,
            role: user.role,
            status: user.status,
            stats: {
                currentHeart: user.stats.currentHeart,
                maxHeart: user.stats.maxHeart,
                diamond: user.stats.diamond,
                totalXp: user.stats.totalXp,
                level: user.stats.level,
                currentStreak: user.stats.currentStreak,
                longestStreak: user.stats.longestStreak,
            },
            createdAt: user.createdAt,
        };
    }

    static toUpdatedNameResponse(user: User): UpdatedUserNameResponse {
        return {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl ?? null,
        };
    }
}

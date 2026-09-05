import { HEART_REGEN_INTERVAL_MS } from "../config/heart.config.js";
import { AppError } from "../errors/app-error.js";
import type { IUserRepository } from "../repositories/interfaces/user.repository.interface.js";
import type { User } from "../types/auth.types.js";

export interface HeartCalculationResult {
    currentHeart: number;
    maxHeart: number;
    heartUpdatedAt: Date;
    nextHeartAt: Date | null;
    heartsRestored: number;
}

export interface DeductHeartResult {
    user: User;
    heartsRemaining: number;
    nextHeartAt: Date | null;
}

export class HeartService {
    constructor(private readonly userRepository: IUserRepository) {}

    public calculateHeartState(
        currentHeart: number,
        maxHeart: number,
        heartUpdatedAt: Date,
        now: Date = new Date(),
    ): HeartCalculationResult {
        const safeMax = Math.max(1, maxHeart);
        const clampedCurrent = Math.max(0, Math.min(currentHeart, safeMax));

        if (clampedCurrent >= safeMax) {
            return {
                currentHeart: safeMax,
                maxHeart: safeMax,
                heartUpdatedAt,
                nextHeartAt: null,
                heartsRestored: 0,
            };
        }

        const elapsedMs = Math.max(0, now.getTime() - heartUpdatedAt.getTime());
        const regeneratedHearts = Math.floor(elapsedMs / HEART_REGEN_INTERVAL_MS);
        const missingHearts = safeMax - clampedCurrent;
        const heartsToRestore = Math.min(regeneratedHearts, missingHearts);
        const newCurrentHeart = clampedCurrent + heartsToRestore;

        if (newCurrentHeart >= safeMax) {
            return {
                currentHeart: safeMax,
                maxHeart: safeMax,
                heartUpdatedAt: now,
                nextHeartAt: null,
                heartsRestored: heartsToRestore,
            };
        }

        const newHeartUpdatedAt = new Date(
            heartUpdatedAt.getTime() + heartsToRestore * HEART_REGEN_INTERVAL_MS,
        );
        const nextHeartAt = new Date(
            newHeartUpdatedAt.getTime() + HEART_REGEN_INTERVAL_MS,
        );

        return {
            currentHeart: newCurrentHeart,
            maxHeart: safeMax,
            heartUpdatedAt: newHeartUpdatedAt,
            nextHeartAt,
            heartsRestored: heartsToRestore,
        };
    }

    public async syncUserHearts(userId: string, now: Date = new Date()): Promise<User> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
        }

        const state = this.calculateHeartState(
            user.stats.currentHeart,
            user.stats.maxHeart,
            user.stats.heartUpdatedAt,
            now,
        );

        if (state.heartsRestored > 0 || state.currentHeart !== user.stats.currentHeart) {
            const updatedUser = await this.userRepository.updateHeartState(
                userId,
                state.currentHeart,
                state.heartUpdatedAt,
                user.stats.currentHeart,
                user.stats.heartUpdatedAt,
            );

            if (updatedUser) {
                return {
                    ...updatedUser,
                    stats: {
                        ...updatedUser.stats,
                        nextHeartAt: state.nextHeartAt,
                    },
                };
            }

            // Fallback if atomic conditional update didn't match (e.g. concurrent sync)
            const freshUser = await this.userRepository.findById(userId);
            if (freshUser) {
                const freshState = this.calculateHeartState(
                    freshUser.stats.currentHeart,
                    freshUser.stats.maxHeart,
                    freshUser.stats.heartUpdatedAt,
                    now,
                );
                return {
                    ...freshUser,
                    stats: {
                        ...freshUser.stats,
                        nextHeartAt: freshState.nextHeartAt,
                    },
                };
            }
        }

        return {
            ...user,
            stats: {
                ...user.stats,
                nextHeartAt: state.nextHeartAt,
            },
        };
    }

    public async deductHeart(userId: string, now: Date = new Date()): Promise<DeductHeartResult> {
        const syncedUser = await this.syncUserHearts(userId, now);
        const wasFull = syncedUser.stats.currentHeart >= syncedUser.stats.maxHeart;
        const newCurrentHeart = Math.max(0, syncedUser.stats.currentHeart - 1);
        const newHeartUpdatedAt = wasFull ? now : syncedUser.stats.heartUpdatedAt;

        let nextHeartAt: Date | null = null;
        if (newCurrentHeart < syncedUser.stats.maxHeart) {
            nextHeartAt = new Date(newHeartUpdatedAt.getTime() + HEART_REGEN_INTERVAL_MS);
        }

        const updatedUser = await this.userRepository.updateHeartState(
            userId,
            newCurrentHeart,
            newHeartUpdatedAt,
        );

        const resultUser: User = updatedUser
            ? {
                  ...updatedUser,
                  stats: {
                      ...updatedUser.stats,
                      nextHeartAt,
                  },
              }
            : {
                  ...syncedUser,
                  stats: {
                      ...syncedUser.stats,
                      currentHeart: newCurrentHeart,
                      heartUpdatedAt: newHeartUpdatedAt,
                      nextHeartAt,
                  },
              };

        return {
            user: resultUser,
            heartsRemaining: newCurrentHeart,
            nextHeartAt,
        };
    }
}

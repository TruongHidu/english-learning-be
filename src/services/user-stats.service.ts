import type { UserStats } from "../types/auth.types.js";
import type { IUserRepository } from "../repositories/interfaces/user.repository.interface.js";

export interface LessonRewardInput {
    correctCount: number;
    totalQuestions: number;
    requiredScore: number;
    isAlreadyCompleted?: boolean;
}

export interface LessonRewardResult {
    score: number;
    xpEarned: number;
    diamondEarned: number;
}

export interface UpdatedUserStats {
    totalXp: number;
    level: number;
    diamond: number;
    currentStreak: number;
    longestStreak: number;
    lastStudyDate: Date;
}

export class UserStatsService {
    constructor(private readonly userRepository: IUserRepository) {}

    calculateLessonRewards(input: LessonRewardInput): LessonRewardResult {
        const { correctCount, totalQuestions, requiredScore, isAlreadyCompleted } = input;

        const score = totalQuestions > 0
            ? Math.round((correctCount / totalQuestions) * 100)
            : 0;

        if (isAlreadyCompleted) {
            return { score, xpEarned: 0, diamondEarned: 0 };
        }

        const isPerfect = score === 100;
        const isPassed = score >= requiredScore;

        const xpEarned = 10 + correctCount * 2 + (isPerfect ? 5 : 0);
        const diamondEarned = (isPassed ? 5 : 0) + (isPerfect ? 5 : 0);

        return { score, xpEarned, diamondEarned };
    }

    calculateStreak(lastStudyDate: Date | undefined, now: Date): {
        currentStreak: number;
        longestStreak: number;
    } {
        if (!lastStudyDate) {
            return { currentStreak: 1, longestStreak: 1 };
        }

        const toUtcDay = (d: Date): string =>
            d.toISOString().slice(0, 10);

        const todayStr = toUtcDay(now);
        const lastStr = toUtcDay(lastStudyDate);

        if (todayStr === lastStr) {
            return { currentStreak: -1, longestStreak: -1 };
        }

        const msPerDay = 24 * 60 * 60 * 1000;
        const todayMidnight = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
        ));
        const lastMidnight = new Date(Date.UTC(
            lastStudyDate.getUTCFullYear(),
            lastStudyDate.getUTCMonth(),
            lastStudyDate.getUTCDate(),
        ));
        const diffDays = Math.round(
            (todayMidnight.getTime() - lastMidnight.getTime()) / msPerDay,
        );

        if (diffDays === 1) {
            return { currentStreak: 1, longestStreak: 1 };
        }

        return { currentStreak: 0, longestStreak: 0 };
    }

    calculateLevel(totalXp: number): number {
        if (totalXp <= 0) return 1;
        return Math.floor((1 + Math.sqrt(1 + 8 * (totalXp / 100))) / 2);
    }

    async applyLessonCompletionStats(
        userId: string,
        currentStats: UserStats,
        xpEarned: number,
        diamondEarned: number,
        now: Date = new Date(),
    ): Promise<UpdatedUserStats> {
        const streakResult = this.calculateStreak(currentStats.lastStudyDate, now);

        let newCurrentStreak: number;
        let newLongestStreak: number;

        if (streakResult.currentStreak === -1) {
            newCurrentStreak = currentStats.currentStreak;
            newLongestStreak = currentStats.longestStreak;
        } else if (streakResult.currentStreak === 1) {
            newCurrentStreak = currentStats.currentStreak + 1;
            newLongestStreak = Math.max(currentStats.longestStreak, newCurrentStreak);
        } else {
            newCurrentStreak = 1;
            newLongestStreak = Math.max(currentStats.longestStreak, 1);
        }

        const newTotalXp = currentStats.totalXp + xpEarned;
        const newLevel = this.calculateLevel(newTotalXp);
        const newDiamond = currentStats.diamond + diamondEarned;

        const updatedStats: UpdatedUserStats = {
            totalXp: newTotalXp,
            level: newLevel,
            diamond: newDiamond,
            currentStreak: newCurrentStreak,
            longestStreak: newLongestStreak,
            lastStudyDate: now,
        };

        await this.userRepository.updateStats(userId, updatedStats);

        return updatedStats;
    }
}

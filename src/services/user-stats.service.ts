import type { UserStats } from "../types/auth.types.js";
import type { IUserRepository } from "../repositories/interfaces/user.repository.interface.js";
import type { VocabularyDifficulty } from "../types/vocabulary.types.js";
import { AppError } from "../errors/app-error.js";
import { calculateStreakTransition, type StreakTransition } from "../utils/streak.js";

export interface LessonRewardInput {
    correctCount: number;
    totalQuestions: number;
    requiredScore: number;
    isAlreadyCompleted?: boolean;
    correctDifficulties?: Array<VocabularyDifficulty | string | undefined>;
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
        const { correctCount, totalQuestions, requiredScore, isAlreadyCompleted, correctDifficulties } = input;

        const score = totalQuestions > 0
            ? Math.round((correctCount / totalQuestions) * 100)
            : 0;

        const isPerfect = totalQuestions > 0 && correctCount === totalQuestions;
        const isPassed = score >= requiredScore;

        if (isAlreadyCompleted) {
            const xpEarned = isPassed ? (5 + (isPerfect ? 5 : 0)) : 0;
            return { score, xpEarned, diamondEarned: 0 };
        }

        const difficultyXpMap: Record<string, number> = {
            EASY: 2,
            MEDIUM: 3,
            HARD: 5,
        };

        let questionXp = 0;
        if (correctDifficulties && correctDifficulties.length > 0) {
            const normalizedDifficulties = [...correctDifficulties];
            while (normalizedDifficulties.length < correctCount) {
                normalizedDifficulties.push("EASY");
            }
            questionXp = normalizedDifficulties
                .slice(0, correctCount)
                .reduce((sum, diff) => sum + (diff ? (difficultyXpMap[diff] ?? 2) : 2), 0);
        } else {
            questionXp = correctCount * 2;
        }

        const xpEarned = 10 + questionXp + (isPerfect ? 5 : 0);
        const diamondEarned = (isPassed ? 5 : 0) + (isPerfect ? 5 : 0);

        return { score, xpEarned, diamondEarned };
    }

    calculateStreak(lastStudyDate: Date | undefined, now: Date): StreakTransition {
        return calculateStreakTransition(lastStudyDate, now);
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
        // CAS checks every stat used in the calculation. Retry only definite conflicts,
        // never database/network errors whose write outcome may be unknown.
        let snapshot = currentStats;
        for (let attempt = 0; attempt < 10; attempt++) {
            const transition = this.calculateStreak(snapshot.lastStudyDate, now);
            const currentStreak = transition === "SAME_DAY" || transition === "FUTURE_ACTIVITY"
                ? snapshot.currentStreak
                : transition === "NEXT_DAY" ? snapshot.currentStreak + 1 : 1;
            const totalXp = snapshot.totalXp + xpEarned;
            const updatedStats: UpdatedUserStats = {
                totalXp,
                level: this.calculateLevel(totalXp),
                diamond: snapshot.diamond + diamondEarned,
                currentStreak,
                longestStreak: Math.max(snapshot.longestStreak, currentStreak),
                lastStudyDate: snapshot.lastStudyDate && snapshot.lastStudyDate > now
                    ? snapshot.lastStudyDate : now,
            };
            const updated = await this.userRepository.updateStats(userId, updatedStats, snapshot);
            if (updated) return updatedStats;

            const latest = await this.userRepository.findById(userId);
            if (!latest) throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
            snapshot = latest.stats;
        }
        throw new AppError("USER_STATS_UPDATE_CONFLICT", "Thống kê đang được cập nhật, vui lòng thử lại", 409);
    }
}

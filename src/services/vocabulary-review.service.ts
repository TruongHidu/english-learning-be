import { AppError } from "../errors/app-error.js";
import type { IUserVocabularyRepository } from "../repositories/interfaces/user-vocabulary.repository.interface.js";
import type { IVocabularyRepository } from "../repositories/interfaces/vocabulary.repository.interface.js";
import type { UserStatsService } from "./user-stats.service.js";
import type { IUserRepository } from "../repositories/interfaces/user.repository.interface.js";

// Simplified Spaced Repetition Logic
export function calculateNextReview(currentLevel: number, isCorrect: boolean): { level: number; nextReviewAt: Date } {
    let newLevel = currentLevel;
    if (isCorrect) {
        newLevel = Math.min(currentLevel + 1, 5);
    } else {
        newLevel = Math.max(currentLevel - 1, 0);
    }

    const intervals = [0, 1, 3, 7, 14, 30]; // Days
    const daysToAdd = intervals[newLevel] ?? 30;
    
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + daysToAdd);
    
    return { level: newLevel, nextReviewAt };
}

export interface ReviewResultInput {
    vocabularyId: string;
    isCorrect: boolean;
}

const XP_PER_REVIEW_SESSION = 5;

export class VocabularyReviewService {
    constructor(
        private readonly userVocabularyRepository: IUserVocabularyRepository,
        private readonly vocabularyRepository: IVocabularyRepository,
        private readonly userStatsService: UserStatsService,
        private readonly userRepository: IUserRepository
    ) {}

    async getReviewSession(userId: string, query: { limit: number; forceAll?: boolean }) {
        const { limit, forceAll } = query;
        let items = await this.userVocabularyRepository.findDueForReview(userId, { limit, forceAll });
        return items;
    }

    async submitReviewResults(userId: string, results: ReviewResultInput[]) {
        const updatedItems = [];
        
        for (const result of results) {
            const userVocab = await this.userVocabularyRepository.findByUserAndVocabulary(userId, result.vocabularyId);
            if (!userVocab) continue;
            
            const { level, nextReviewAt } = calculateNextReview(userVocab.reviewLevel, result.isCorrect);
            
            const newCorrectCount = userVocab.correctCount + (result.isCorrect ? 1 : 0);
            let newStatus = userVocab.status;
            
            // If they reach level 5 or answer correctly 3 times in a row (simple heuristic for MASTERED)
            if (level === 5 || newCorrectCount >= 3) {
                newStatus = "MASTERED";
            } else if (userVocab.status === "MASTERED" && !result.isCorrect) {
                newStatus = "LEARNED";
            }
            
            const updated = await this.userVocabularyRepository.updateReviewResult(userId, result.vocabularyId, {
                reviewLevel: level,
                nextReviewAt,
                status: newStatus,
                reviewCount: userVocab.reviewCount + 1,
                correctCount: newCorrectCount,
                incorrectCount: userVocab.incorrectCount + (result.isCorrect ? 0 : 1),
                lastReviewedAt: new Date(),
            });
            
            if (updated) updatedItems.push(updated);
        }
        
        // Give XP for completing a review session (minimum 1 item)
        let xpEarned = 0;
        let totalXp = 0;
        let level = 1;
        let currentStreak = 0;

        if (updatedItems.length > 0) {
            const user = await this.userRepository.findById(userId);
            if (user) {
                xpEarned = XP_PER_REVIEW_SESSION;
                const updatedStats = await this.userStatsService.applyLessonCompletionStats(
                    userId,
                    user.stats,
                    xpEarned,
                    0, // No diamond for review
                    new Date()
                );
                totalXp = updatedStats.totalXp;
                level = updatedStats.level;
                currentStreak = updatedStats.currentStreak;
            }
        }
        
        return {
            results: updatedItems,
            rewards: updatedItems.length > 0 ? { xpEarned, totalXp, level, currentStreak } : null,
        };
    }

    async getReviewStats(userId: string) {
        const dueToday = await this.userVocabularyRepository.countDueByUserId(userId);
        return { dueToday };
    }
}

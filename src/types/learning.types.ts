import type { LearningSessionStatus } from "../models/learning-session.model.js";
import type { UserLessonProgressStatus } from "../models/user-lesson-progress.model.js";
import type { QuestionType } from "./question.types.js";

export interface LearningQuestionOptionResponse {
    id: string | null;
    content: string;
    imageUrl: string | null;
    orderIndex: number;
}

export interface LearningQuestionResponse {
    id: string;
    type: QuestionType;
    content: string;
    instruction: string | null;
    options: LearningQuestionOptionResponse[] | null;
    matchingLeftItems: string[] | null;
    matchingRightItems: string[] | null;
    audioUrl: string | null;
    imageUrl: string | null;
    vocabularyId: string | null;
}

export interface LearningSessionResponse {
    id: string;
    lessonId: string;
    lessonVersion: number;
    status: LearningSessionStatus;
    heartStart: number;
    heartRemaining: number;
    requiredScore: number;
    totalQuestions: number;
    correctCount: number;
    wrongCount: number;
    score: number;
    startedAt: Date;
}

export interface StartLessonResponse {
    session: LearningSessionResponse;
    lesson: {
        id: string;
        name: string;
        description: string | null;
        requiredScore: number;
        questionCount: number;
    };
    progress: { currentQuestionIndex: number; totalQuestions: number };
    hearts: { current: number; max: number; nextHeartAt: string | null };
    questions: LearningQuestionResponse[];
}

export type { UserLessonProgressStatus };

// SubmitAnswer
export interface SubmitAnswerRequest {
    questionId: string;
    answer: string | string[];
}

export interface LessonCompletionRewards {
    xpEarned: number;
    diamondEarned: number;
    totalXp: number;
    totalDiamond: number;
    level: number;
    currentStreak: number;
    longestStreak: number;
    learnedVocabularyIds: string[];
    isNextLessonUnlocked: boolean;
}

export interface SubmitAnswerResponse {
    isCorrect: boolean;
    isPassed: boolean;
    /** Chỉ trả về khi sai — để FE hiển thị đáp án đúng */
    correctAnswer: unknown | null;
    /** Giải thích đáp án, có thể null nếu không có */
    explanation: string | null;
    heartsRemaining: number;
    nextHeartAt: string | null;
    sessionStatus: LearningSessionStatus;
    correctCount: number;
    wrongCount: number;
    score: number;
    rewards: LessonCompletionRewards | null;
}


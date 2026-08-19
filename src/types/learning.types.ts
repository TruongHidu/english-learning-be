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
}

export interface LearningSessionResponse {
    id: string;
    lessonId: string;
    status: LearningSessionStatus;
    heartStart: number;
    heartRemaining: number;
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
    hearts: { current: number; max: number };
    questions: LearningQuestionResponse[];
}

export type { UserLessonProgressStatus };

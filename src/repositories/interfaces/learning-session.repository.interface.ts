import type {
    LearningQuestionSnapshot,
    LearningSessionDocument,
    LearningSessionStatus,
} from "../../models/learning-session.model.js";

export interface CreateLearningSessionData {
    lessonVersion: number;
    heartStart: number;
    heartRemaining: number;
    requiredScore: number;
    totalQuestions: number;
    questionIds: string[];
    questionSnapshots: LearningQuestionSnapshot[];
}

export interface RecordAnswerData {
    sessionId: string;
    userId: string;
    questionId: string;
    isCorrect: boolean;
}

export interface UpdateSessionAfterAnswerData {
    correctCount: number;
    wrongCount: number;
    score: number;
    heartRemaining: number;
    status: LearningSessionStatus;
    xpEarned?: number;
    diamondEarned?: number;
    completedAt?: Date;
}

export interface ILearningSessionRepository {
    findByIdAndUserId(sessionId: string, userId: string): Promise<LearningSessionDocument | null>;
    abandonInProgressByUserIdAndLessonId(userId: string, lessonId: string): Promise<void>;
    create(userId: string, lessonId: string, data: CreateLearningSessionData): Promise<LearningSessionDocument>;
    recordAnswer(data: RecordAnswerData): Promise<LearningSessionDocument | null>;
    claimTerminalProcessing(sessionId: string, userId: string): Promise<LearningSessionDocument | null>;
    releaseTerminalProcessing(sessionId: string, userId: string): Promise<void>;
    updateAfterAnswer(sessionId: string, data: UpdateSessionAfterAnswerData): Promise<LearningSessionDocument | null>;
}

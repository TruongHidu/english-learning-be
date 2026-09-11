import { Schema, model, type HydratedDocument, type Types } from "mongoose";
import { QUESTION_TYPES, type QuestionType } from "../types/question.types.js";
import { VOCABULARY_DIFFICULTIES, type VocabularyDifficulty } from "../types/vocabulary.types.js";

export const LEARNING_SESSION_STATUSES = [
    "IN_PROGRESS",
    "COMPLETED",
    "FAILED",
    "ABANDONED",
] as const;

export type LearningSessionStatus = (typeof LEARNING_SESSION_STATUSES)[number];

export interface LearningQuestionSnapshotOption {
    optionId?: Types.ObjectId;
    content: string;
    isCorrect: boolean;
    orderIndex: number;
}

export interface LearningQuestionSnapshotMatchingPair {
    vocabularyId?: Types.ObjectId;
    leftValue: string;
    rightValue: string;
    orderIndex: number;
}

/** Immutable grading data captured when a learning session starts. */
export interface LearningQuestionSnapshot {
    questionId: Types.ObjectId;
    type: QuestionType;
    difficulty?: VocabularyDifficulty;
    correctAnswer?: unknown;
    options?: LearningQuestionSnapshotOption[];
    matchingPairs?: LearningQuestionSnapshotMatchingPair[];
    vocabularyIds?: Types.ObjectId[];
    explanation?: string;
}

export interface LearningSessionPersistence {
    userId: Types.ObjectId;
    lessonId: Types.ObjectId;
    status: LearningSessionStatus;
    heartStart: number;
    heartRemaining: number;
    lessonVersion: number;
    requiredScore: number;
    totalQuestions: number;
    questionIds: Types.ObjectId[];
    answeredQuestionIds: Types.ObjectId[];
    wrongQuestionIds: Types.ObjectId[];
    questionSnapshots: LearningQuestionSnapshot[];
    correctCount: number;
    wrongCount: number;
    score: number;
    xpEarned: number;
    diamondEarned: number;
    startedAt: Date;
    completedAt?: Date;
    terminalProcessed: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export type LearningSessionDocument = HydratedDocument<LearningSessionPersistence>;

const learningSessionSchema = new Schema<LearningSessionPersistence>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
        status: {
            type: String,
            enum: LEARNING_SESSION_STATUSES,
            required: true,
            default: "IN_PROGRESS",
        },
        heartStart: { type: Number, required: true, min: 0 },
        heartRemaining: { type: Number, required: true, min: 0 },
        lessonVersion: { type: Number, default: 1, required: true, min: 1 },
        requiredScore: { type: Number, required: true, min: 0, max: 100, default: 80 },
        totalQuestions: { type: Number, required: true, min: 0 },
        questionIds: {
            type: [{ type: Schema.Types.ObjectId, ref: "Question" }],
            required: true,
            default: [],
        },
        answeredQuestionIds: {
            type: [{ type: Schema.Types.ObjectId, ref: "Question" }],
            required: true,
            default: [],
        },
        wrongQuestionIds: {
            type: [{ type: Schema.Types.ObjectId, ref: "Question" }],
            required: true,
            default: [],
        },
        questionSnapshots: {
            type: [
                new Schema<LearningQuestionSnapshot>(
                    {
                        questionId: {
                            type: Schema.Types.ObjectId,
                            ref: "Question",
                            required: true,
                        },
                        type: {
                            type: String,
                            enum: QUESTION_TYPES,
                            required: true,
                        },
                        difficulty: {
                            type: String,
                            enum: VOCABULARY_DIFFICULTIES,
                            required: false,
                        },
                        correctAnswer: { type: Schema.Types.Mixed, required: false },
                        options: {
                            type: [
                                new Schema<LearningQuestionSnapshotOption>(
                                    {
                                        optionId: { type: Schema.Types.ObjectId, required: false },
                                        content: { type: String, required: true },
                                        isCorrect: { type: Boolean, required: true },
                                        orderIndex: { type: Number, required: true },
                                    },
                                    { _id: false },
                                ),
                            ],
                            required: false,
                            default: undefined,
                        },
                        matchingPairs: {
                            type: [
                                new Schema<LearningQuestionSnapshotMatchingPair>(
                                    {
                                        vocabularyId: { type: Schema.Types.ObjectId, required: false },
                                        leftValue: { type: String, required: true },
                                        rightValue: { type: String, required: true },
                                        orderIndex: { type: Number, required: true },
                                    },
                                    { _id: false },
                                ),
                            ],
                            required: false,
                            default: undefined,
                        },
                        vocabularyIds: {
                            type: [{ type: Schema.Types.ObjectId, ref: "Vocabulary" }],
                            required: false,
                            default: undefined,
                        },
                        explanation: { type: String, required: false },
                    },
                    { _id: false },
                ),
            ],
            required: true,
            default: [],
        },
        correctCount: { type: Number, required: true, min: 0, default: 0 },
        wrongCount: { type: Number, required: true, min: 0, default: 0 },
        score: { type: Number, required: true, min: 0, max: 100, default: 0 },
        xpEarned: { type: Number, required: true, min: 0, default: 0 },
        diamondEarned: { type: Number, required: true, min: 0, default: 0 },
        startedAt: { type: Date, required: true, default: Date.now },
        completedAt: { type: Date, required: false },
        terminalProcessed: { type: Boolean, required: true, default: false },
    },
    { timestamps: true, versionKey: false },
);

learningSessionSchema.index({ userId: 1, lessonId: 1, status: 1 });
learningSessionSchema.index({ userId: 1, startedAt: -1 });
learningSessionSchema.index({ lessonId: 1, status: 1 });
learningSessionSchema.index({ answeredQuestionIds: 1 });
learningSessionSchema.index({ wrongQuestionIds: 1 });

export const LearningSessionModel = model<LearningSessionPersistence>(
    "LearningSession",
    learningSessionSchema,
);

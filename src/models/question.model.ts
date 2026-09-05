import { Schema, model, type HydratedDocument, type Types } from "mongoose";

import {
    QUESTION_STATUSES,
    QUESTION_TYPES,
    type QuestionStatus,
    type QuestionType,
} from "../types/question.types.js";
import { VOCABULARY_DIFFICULTIES, type VocabularyDifficulty } from "../types/vocabulary.types.js";
import {
    buildQuestionDedupeKey,
    normalizeQuestionContent,
} from "../utils/question-normalization.utils.js";

export interface QuestionOptionPersistence {
    content: string;
    imageUrl?: string;
    isCorrect: boolean;
    orderIndex: number;
}

export interface MatchingPairPersistence {
    vocabularyId?: Types.ObjectId;
    leftValue: string;
    rightValue: string;
    orderIndex: number;
}

export interface QuestionPersistence {
    topicId?: Types.ObjectId;
    vocabularyId?: Types.ObjectId;
    vocabularyIds?: Types.ObjectId[];
    type: QuestionType;

    content: string;
    instruction?: string;
    correctAnswer?: unknown;
    options?: QuestionOptionPersistence[];
    matchingPairs?: MatchingPairPersistence[];
    explanation?: string;
    difficulty: VocabularyDifficulty;
    audioUrl?: string;
    audioPublicId?: string;
    imageUrl?: string;
    imagePublicId?: string;
    status: QuestionStatus;
    createdByAi: boolean;
    aiGenerationId?: Types.ObjectId;
    normalizedContent?: string;
    dedupeKey?: string;
    createdAt: Date;
    updatedAt: Date;
}

export type QuestionDocument = HydratedDocument<QuestionPersistence>;

const questionOptionSchema = new Schema<QuestionOptionPersistence>(
    {
        content: { type: String, required: true, trim: true },
        imageUrl: { type: String, required: false, trim: true },
        isCorrect: { type: Boolean, required: true, default: false },
        orderIndex: { type: Number, required: true, default: 0 },
    },
    { _id: true },
);

const matchingPairSchema = new Schema<MatchingPairPersistence>(
    {
        vocabularyId: { type: Schema.Types.ObjectId, ref: "Vocabulary", required: false },
        leftValue: { type: String, required: true, trim: true },
        rightValue: { type: String, required: true, trim: true },
        orderIndex: { type: Number, required: true, default: 0 },
    },
    { _id: true },
);

const questionSchema = new Schema<QuestionPersistence>(
    {
        topicId: {
            type: Schema.Types.ObjectId,
            ref: "Topic",
            required: false,
            index: true,
        },
        vocabularyId: {
            type: Schema.Types.ObjectId,
            ref: "Vocabulary",
            required: false,
            index: true,
        },
        vocabularyIds: {
            type: [{ type: Schema.Types.ObjectId, ref: "Vocabulary" }],
            required: false,
            default: undefined,
        },

        type: {
            type: String,
            enum: QUESTION_TYPES,
            required: true,
            index: true,
        },
        content: {
            type: String,
            required: true,
            trim: true,
        },
        instruction: {
            type: String,
            required: false,
            trim: true,
        },
        correctAnswer: {
            type: Schema.Types.Mixed,
            required: false,
        },
        options: {
            type: [questionOptionSchema],
            required: false,
            default: undefined,
        },
        matchingPairs: {
            type: [matchingPairSchema],
            required: false,
            default: undefined,
        },
        explanation: {
            type: String,
            required: false,
            trim: true,
        },
        difficulty: {
            type: String,
            enum: VOCABULARY_DIFFICULTIES,
            default: "EASY",
            required: true,
        },
        audioUrl: {
            type: String,
            required: false,
            trim: true,
        },
        audioPublicId: {
            type: String,
            required: false,
            select: false,
        },
        imageUrl: {
            type: String,
            required: false,
            trim: true,
        },
        imagePublicId: {
            type: String,
            required: false,
            select: false,
        },
        status: {
            type: String,
            enum: QUESTION_STATUSES,
            default: "DRAFT",
            required: true,
            index: true,
        },
        createdByAi: {
            type: Boolean,
            default: false,
            required: true,
        },
        aiGenerationId: {
            type: Schema.Types.ObjectId,
            ref: "AIGeneration",
            required: false,
        },
        normalizedContent: {
            type: String,
            required: false,
            trim: true,
            select: false,
        },
        dedupeKey: {
            type: String,
            required: false,
            trim: true,
            select: false,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

questionSchema.pre("validate", function normalizeContentBeforeValidation() {
    if (!this.topicId || !this.type || !this.content) return;
    this.normalizedContent = normalizeQuestionContent(this.content);
    this.dedupeKey = buildQuestionDedupeKey(
        this.topicId.toString(),
        this.type,
        this.content,
    );
});

questionSchema.index(
    { dedupeKey: 1 },
    {
        unique: true,
        name: "uniq_question_topic_type_normalized_content",
        partialFilterExpression: { dedupeKey: { $type: "string" } },
    },
);

questionSchema.index({ type: 1, status: 1 });
questionSchema.index({ difficulty: 1, status: 1 });

export const QuestionModel = model<QuestionPersistence>("Question", questionSchema);

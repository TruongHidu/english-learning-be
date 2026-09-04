import { Schema, model, type HydratedDocument, type Types } from "mongoose";

import { CONTENT_STATUSES, type ContentStatus } from "../types/course.types.js";
import { VOCABULARY_DIFFICULTIES, type VocabularyDifficulty } from "../types/vocabulary.types.js";
import { normalizeVocabularyWord } from "../utils/vocabulary-normalization.utils.js";

export interface VocabularyPersistence {
    topicId: Types.ObjectId;
    word: string;
    normalizedWord?: string;
    meaning: string;
    phonetic?: string;
    partOfSpeech?: string;
    example?: string;
    exampleMeaning?: string;
    audioUrl?: string;
    imageUrl?: string;
    difficulty: VocabularyDifficulty;
    status: ContentStatus;
    createdByAi: boolean;
    aiGenerationId?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export type VocabularyDocument = HydratedDocument<VocabularyPersistence>;

const vocabularySchema = new Schema<VocabularyPersistence>(
    {
        topicId: {
            type: Schema.Types.ObjectId,
            ref: "Topic",
            required: true,
            index: true,
        },
        word: {
            type: String,
            required: true,
            trim: true,
        },
        normalizedWord: {
            type: String,
            required: true,
            trim: true,
            select: false,
        },
        meaning: {
            type: String,
            required: true,
            trim: true,
        },
        phonetic: {
            type: String,
            required: false,
            trim: true,
        },
        partOfSpeech: {
            type: String,
            required: false,
            trim: true,
        },
        example: {
            type: String,
            required: false,
            trim: true,
        },
        exampleMeaning: {
            type: String,
            required: false,
            trim: true,
        },
        audioUrl: {
            type: String,
            required: false,
            trim: true,
        },
        imageUrl: {
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
        status: {
            type: String,
            enum: CONTENT_STATUSES,
            default: "DRAFT",
            required: true,
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
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

vocabularySchema.pre("validate", function normalizeWordBeforeValidation() {
    this.word = normalizeVocabularyWord(this.word);
    this.normalizedWord = this.word;
});

vocabularySchema.index(
    { topicId: 1, normalizedWord: 1 },
    {
        unique: true,
        name: "uniq_vocabulary_topic_normalized_word",
        partialFilterExpression: { normalizedWord: { $type: "string" } },
    },
);
vocabularySchema.index({ topicId: 1, status: 1 });

export const VocabularyModel = model<VocabularyPersistence>("Vocabulary", vocabularySchema);

import { z } from "zod";
import {
    commitQuestionItemsSchema,
    commitVocabularyItemsSchema,
} from "../ai/schemas/generated-content.schema.js";
import { AI_SUPPORTED_QUESTION_TYPES } from "../types/ai.types.js";

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const generateVocabulariesSchema = z.object({
    topicId: z.string({ error: "topicId là bắt buộc" }).min(1, "topicId không được để trống"),
    lessonId: z.string().optional(),
    level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
    quantity: z.number().int().min(1, "Số lượng phải lớn hơn 0").max(50, "Tối đa 50 từ mỗi lần").default(20),
});

export const generateQuestionsSchema = z.object({
    topicId: z.string({ error: "topicId là bắt buộc" }).min(1, "topicId không được để trống"),
    lessonId: z.string().optional(),
    vocabularyId: z.string().optional(),
    vocabularyIds: z.array(z.string()).optional(),
    questionTypes: z.array(z.enum(["MULTIPLE_CHOICE", "FILL_IN_BLANK", "FILL_BLANK", "TRANSLATION", "MATCHING", "REORDER", "ORDER_SENTENCE"])).min(1, "Phải chọn ít nhất 1 loại câu hỏi"),
    quantity: z.number().int().min(1, "Số lượng phải lớn hơn 0").max(50, "Tối đa 50 câu mỗi lần").default(10),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional().default("EASY"),
});

export const bulkPublishSchema = z.object({
    ids: z.array(z.string().min(1)).min(1, "Phải cung cấp ít nhất 1 ID để duyệt"),
}).strict();

export const generateVocabularyPreviewSchema = z.object({
    count: z.number().int().min(1, "Số lượng phải từ 1 đến 20").max(20, "Số lượng phải từ 1 đến 20").default(10),
    requirements: z.string().trim().max(500, "Yêu cầu không được vượt quá 500 ký tự").optional(),
}).strict();

export const commitVocabularyGenerationSchema = z.object({
    items: commitVocabularyItemsSchema,
}).strict();

export const topicAiVocabularyParamSchema = z.object({
    topicId: z.string().regex(OBJECT_ID_REGEX, "topicId không hợp lệ"),
}).strict();

export const aiGenerationIdParamSchema = z.object({
    generationId: z.string().regex(OBJECT_ID_REGEX, "generationId không hợp lệ"),
});

const configuredMaxQuestions = Number(process.env.AI_MAX_QUESTIONS ?? 50);
const maxQuestions = Number.isInteger(configuredMaxQuestions) && configuredMaxQuestions > 0
    ? Math.min(configuredMaxQuestions, 100)
    : 50;

export const generateQuestionPreviewSchema = z.object({
    lessonId: z.string().regex(OBJECT_ID_REGEX, "lessonId không hợp lệ").optional(),
    vocabularyIds: z
        .array(z.string().regex(OBJECT_ID_REGEX, "ID từ vựng không hợp lệ"))
        .min(1, "Phải chọn ít nhất một từ vựng")
        .max(100, "Chỉ được chọn tối đa 100 từ vựng")
        .refine((ids) => new Set(ids).size === ids.length, "vocabularyIds không được trùng")
        .optional(),
    questionTypes: z
        .array(z.enum(AI_SUPPORTED_QUESTION_TYPES))
        .min(1, "Phải chọn ít nhất một loại câu hỏi")
        .max(AI_SUPPORTED_QUESTION_TYPES.length)
        .refine((types) => new Set(types).size === types.length, "questionTypes không được trùng"),
    count: z.number().int().min(1).max(maxQuestions).default(10),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("EASY"),
    requirements: z.string().trim().max(500, "Yêu cầu không được vượt quá 500 ký tự").optional(),
}).strict();

export const commitQuestionGenerationSchema = z.object({
    items: commitQuestionItemsSchema,
}).strict();

export const aiGenerationListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z.enum(["PENDING", "PROCESSING", "COMMITTING", "COMPLETED", "PARTIAL", "FAILED", "CANCELED", "COMMITTED"]).optional(),
    generationType: z.enum(["VOCABULARY", "QUESTION"]).optional(),
}).strict();

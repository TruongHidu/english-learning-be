import { z } from "zod";

import { CONTENT_STATUSES } from "../types/course.types.js";
import { VOCABULARY_DIFFICULTIES } from "../types/vocabulary.types.js";

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const urlSchema = z
    .string()
    .trim()
    .url("URL không đúng định dạng")
    .nullable()
    .optional()
    .or(z.literal(""));

export const topicIdParamSchema = z.object({
    topicId: z
        .string({ error: "ID chủ đề là bắt buộc" })
        .regex(OBJECT_ID_REGEX, "ID chủ đề không hợp lệ"),
});

export const vocabularyIdParamSchema = z.object({
    vocabularyId: z
        .string({ error: "ID từ vựng là bắt buộc" })
        .regex(OBJECT_ID_REGEX, "ID từ vựng không hợp lệ"),
});

export const createVocabularySchema = z.object({
    word: z
        .string({ error: "Từ vựng là bắt buộc" })
        .trim()
        .min(1, "Từ vựng không được để trống")
        .max(100, "Từ vựng không được vượt quá 100 ký tự"),
    meaning: z
        .string({ error: "Nghĩa của từ là bắt buộc" })
        .trim()
        .min(1, "Nghĩa của từ không được để trống")
        .max(300, "Nghĩa của từ không được vượt quá 300 ký tự"),
    phonetic: z.string().trim().max(150, "Phiên âm không được vượt quá 150 ký tự").optional().nullable(),
    partOfSpeech: z.string().trim().max(50, "Từ loại không được vượt quá 50 ký tự").optional().nullable(),
    example: z.string().trim().max(500, "Ví dụ không được vượt quá 500 ký tự").optional().nullable(),
    exampleMeaning: z.string().trim().max(500, "Nghĩa của ví dụ không được vượt quá 500 ký tự").optional().nullable(),
    audioUrl: urlSchema,
    imageUrl: urlSchema,
    difficulty: z.enum(VOCABULARY_DIFFICULTIES).optional(),
});

export const updateVocabularySchema = z.object({
    word: z.string().trim().min(1, "Từ vựng không được để trống").max(100, "Từ vựng không được vượt quá 100 ký tự").optional(),
    meaning: z.string().trim().min(1, "Nghĩa của từ không được để trống").max(300, "Nghĩa của từ không được vượt quá 300 ký tự").optional(),
    phonetic: z.string().trim().max(150, "Phiên âm không được vượt quá 150 ký tự").optional().nullable(),
    partOfSpeech: z.string().trim().max(50, "Từ loại không được vượt quá 50 ký tự").optional().nullable(),
    example: z.string().trim().max(500, "Ví dụ không được vượt quá 500 ký tự").optional().nullable(),
    exampleMeaning: z.string().trim().max(500, "Nghĩa của ví dụ không được vượt quá 500 ký tự").optional().nullable(),
    audioUrl: urlSchema,
    imageUrl: urlSchema,
    difficulty: z.enum(VOCABULARY_DIFFICULTIES).optional(),
});

export const updateVocabularyStatusSchema = z.object({
    status: z.enum(CONTENT_STATUSES, {
        error: "Trạng thái không hợp lệ. Chấp nhận: DRAFT, PUBLISHED, INACTIVE",
    }),
});

export const vocabularyListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().optional(),
    difficulty: z.enum(VOCABULARY_DIFFICULTIES).optional(),
    status: z.enum(CONTENT_STATUSES).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
});

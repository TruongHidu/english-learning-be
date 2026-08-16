import { z } from "zod";

import { QUESTION_STATUSES, QUESTION_TYPES } from "../types/question.types.js";
import { VOCABULARY_DIFFICULTIES } from "../types/vocabulary.types.js";

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const urlSchema = z
    .string()
    .trim()
    .url("URL không đúng định dạng")
    .nullable()
    .optional()
    .or(z.literal(""));

export const questionIdParamSchema = z.object({
    questionId: z
        .string({ error: "ID câu hỏi là bắt buộc" })
        .regex(OBJECT_ID_REGEX, "ID câu hỏi không hợp lệ"),
});

export const lessonIdParamSchema = z.object({
    lessonId: z
        .string({ error: "ID bài học là bắt buộc" })
        .regex(OBJECT_ID_REGEX, "ID bài học không hợp lệ"),
});

export const lessonQuestionParamSchema = z.object({
    lessonId: z
        .string({ error: "ID bài học là bắt buộc" })
        .regex(OBJECT_ID_REGEX, "ID bài học không hợp lệ"),
    questionId: z
        .string({ error: "ID câu hỏi là bắt buộc" })
        .regex(OBJECT_ID_REGEX, "ID câu hỏi không hợp lệ"),
});

const optionInputSchema = z.object({
    content: z.string({ error: "Nội dung lựa chọn là bắt buộc" }).trim().min(1, "Nội dung lựa chọn không được để trống"),
    imageUrl: urlSchema,
    isCorrect: z.boolean({ error: "Trạng thái đáp án đúng/sai là bắt buộc" }),
    orderIndex: z.number().int().min(0).default(0),
});

const matchingPairInputSchema = z.object({
    vocabularyId: z.string().regex(OBJECT_ID_REGEX, "ID từ vựng không hợp lệ").optional().nullable(),
    leftValue: z.string({ error: "Giá trị vế trái là bắt buộc" }).trim().min(1, "Giá trị vế trái không được trống"),
    rightValue: z.string({ error: "Giá trị vế phải là bắt buộc" }).trim().min(1, "Giá trị vế phải không được trống"),
    orderIndex: z.number().int().min(0).default(0),
});

export const createQuestionSchema = z
    .object({
        vocabularyId: z.string().regex(OBJECT_ID_REGEX, "ID từ vựng không hợp lệ").optional().nullable(),
        vocabularyIds: z.array(z.string().regex(OBJECT_ID_REGEX, "ID từ vựng không hợp lệ")).optional().nullable(),
        type: z.enum(QUESTION_TYPES, { error: "Loại câu hỏi không hợp lệ" }),

        content: z
            .string({ error: "Nội dung câu hỏi là bắt buộc" })
            .trim()
            .min(1, "Nội dung câu hỏi không được để trống")
            .max(2000, "Nội dung câu hỏi không được vượt quá 2000 ký tự"),
        instruction: z.string().trim().max(500, "Hướng dẫn không được vượt quá 500 ký tự").optional().nullable(),
        correctAnswer: z.unknown().optional().nullable(),
        options: z.array(optionInputSchema).optional().nullable(),
        matchingPairs: z.array(matchingPairInputSchema).optional().nullable(),
        explanation: z.string().trim().max(2000, "Giải thích không được vượt quá 2000 ký tự").optional().nullable(),
        difficulty: z.enum(VOCABULARY_DIFFICULTIES).default("EASY"),
        audioUrl: urlSchema,
        imageUrl: urlSchema,
    })
    .superRefine((data, ctx) => {
        if (data.type === "MULTIPLE_CHOICE") {
            if (!data.options || data.options.length < 2) {

                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["options"],
                    message: "Câu hỏi trắc nghiệm phải có ít nhất 2 lựa chọn",
                });
            } else {
                const correctCount = data.options.filter((opt) => opt.isCorrect).length;
                if (correctCount !== 1) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["options"],
                        message: "Câu hỏi trắc nghiệm phải có đúng 1 đáp án chính xác",
                    });
                }
            }
        } else if (data.type === "MATCHING") {
            if (!data.matchingPairs || data.matchingPairs.length < 2) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["matchingPairs"],
                    message: "Câu hỏi ghép đôi phải có ít nhất 2 cặp từ",
                });
            }
        } else if (
            data.type === "FILL_BLANK" ||
            data.type === "TRANSLATION" ||
            data.type === "ORDER_SENTENCE"
        ) {
            if (data.correctAnswer === undefined || data.correctAnswer === null || data.correctAnswer === "") {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["correctAnswer"],
                    message: "Đáp án đúng là bắt buộc cho loại câu hỏi này",
                });
            }
        } else if (data.type === "LISTENING") {
            if (!data.audioUrl) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["audioUrl"],
                    message: "File âm thanh audioUrl là bắt buộc cho câu hỏi nghe LISTENING",
                });
            }
        }
    });

export const updateQuestionSchema = z
    .object({
        vocabularyId: z.string().regex(OBJECT_ID_REGEX, "ID từ vựng không hợp lệ").optional().nullable(),
        vocabularyIds: z.array(z.string().regex(OBJECT_ID_REGEX, "ID từ vựng không hợp lệ")).optional().nullable(),
        type: z.enum(QUESTION_TYPES).optional(),

        content: z.string().trim().min(1, "Nội dung câu hỏi không được để trống").max(2000, "Nội dung câu hỏi không được vượt quá 2000 ký tự").optional(),
        instruction: z.string().trim().max(500, "Hướng dẫn không được vượt quá 500 ký tự").optional().nullable(),
        correctAnswer: z.unknown().optional().nullable(),
        options: z.array(optionInputSchema).optional().nullable(),
        matchingPairs: z.array(matchingPairInputSchema).optional().nullable(),
        explanation: z.string().trim().max(2000, "Giải thích không được vượt quá 2000 ký tự").optional().nullable(),
        difficulty: z.enum(VOCABULARY_DIFFICULTIES).optional(),
        audioUrl: urlSchema,
        imageUrl: urlSchema,
    });

export const updateQuestionStatusSchema = z.object({
    status: z.enum(QUESTION_STATUSES, {
        error: "Trạng thái không hợp lệ",
    }),
});

export const questionListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(500).optional().default(20),
    search: z.string().optional(),

    topicId: z.string().regex(OBJECT_ID_REGEX, "ID chủ đề không hợp lệ").optional(),
    vocabularyId: z.string().regex(OBJECT_ID_REGEX, "ID từ vựng không hợp lệ").optional(),
    type: z.enum(QUESTION_TYPES).optional(),
    difficulty: z.enum(VOCABULARY_DIFFICULTIES).optional(),
    status: z.enum(QUESTION_STATUSES).optional(),
    createdByAi: z.coerce.boolean().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const assignQuestionsSchema = z.object({
    questionIds: z
        .array(z.string().regex(OBJECT_ID_REGEX, "ID câu hỏi không hợp lệ"))
        .min(1, "Danh sách ID câu hỏi không được trống"),
});

export const reorderQuestionsSchema = z.object({
    questionIds: z
        .array(z.string().regex(OBJECT_ID_REGEX, "ID câu hỏi không hợp lệ"))
        .min(1, "Danh sách ID câu hỏi không được trống"),
});

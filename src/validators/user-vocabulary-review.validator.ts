import { Types } from "mongoose";
import { z } from "zod";
import {
  REVIEW_MODES,
  REVIEW_SCOPES,
  REVIEW_SKILLS,
} from "../types/vocabulary-review.types.js";

const objectId = z
  .string()
  .refine((value) => Types.ObjectId.isValid(value), "ID không hợp lệ");
export const reviewSessionParamsSchema = z.object({ sessionId: objectId });
export const reviewBookmarkParamsSchema = z.object({ vocabularyId: objectId });
export const createReviewSessionSchema = z
  .object({
    mode: z.enum(REVIEW_MODES).default("SMART_REVIEW"),
    scope: z.enum(REVIEW_SCOPES).default("SMART_QUEUE"),
    selectionMode: z.enum(["WORD_COUNT", "TIME"]).default("WORD_COUNT"),
    wordCount: z.number().int().min(5).max(50).optional(),
    targetMinutes: z.number().int().min(3).max(15).optional(),
    topicIds: z.array(objectId).max(20).default([]),
    skillFocus: z.enum(REVIEW_SKILLS).default("ADAPTIVE"),
    intensity: z.enum(["LIGHT", "STANDARD", "DEEP"]).default("STANDARD"),
    autoPlayAudio: z.boolean().default(false),
    showPhonetic: z.boolean().default(true),
    includeMastered: z.boolean().default(true),
    recentDays: z.union([z.literal(1), z.literal(3), z.literal(7)]).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.selectionMode === "WORD_COUNT" && data.wordCount === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["wordCount"],
        message: "Vui lòng chọn số từ",
      });
    if (data.selectionMode === "TIME" && data.targetMinutes === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["targetMinutes"],
        message: "Vui lòng chọn thời gian",
      });
  });
export const submitReviewAnswerSchema = z
  .object({
    questionId: objectId,
    selectedOptionId: objectId.nullish(),
    typedAnswer: z.string().max(100).nullish(),
    responseTimeMs: z.number().int().min(0).max(3_600_000),
    usedHint: z.boolean().default(false),
  })
  .refine(
    (data) => Boolean(data.selectedOptionId || data.typedAnswer?.trim()),
    { message: "Vui lòng nhập hoặc chọn đáp án" },
  );
export const exitReviewSessionSchema = z.object({
  finish: z.boolean().default(false),
});
export const bookmarkReviewSchema = z.object({ isBookmarked: z.boolean() });
export const reviewGoalSchema = z.object({
  type: z.enum(["WORDS", "MINUTES"]),
  target: z.number().int().min(1).max(120),
});

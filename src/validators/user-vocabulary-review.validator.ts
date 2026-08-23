import { z } from "zod";
import { Types } from "mongoose";

const objectIdSchema = z
    .string()
    .refine((val) => Types.ObjectId.isValid(val), {
        message: "ID không hợp lệ",
    });

export const reviewDueQuerySchema = z.object({
    topicId: objectIdSchema.optional(),
    limit: z.string().regex(/^\d+$/).optional().transform((val) => (val ? parseInt(val, 10) : 20)),
});

export const reviewSubmitSchema = z.object({
    results: z.array(
        z.object({
            vocabularyId: objectIdSchema,
            isCorrect: z.boolean(),
        })
    ).min(1).max(100),
});

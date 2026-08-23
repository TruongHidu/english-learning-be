import { z } from "zod";
import { Types } from "mongoose";

const objectIdSchema = z
    .string()
    .refine((val) => Types.ObjectId.isValid(val), {
        message: "ID không hợp lệ",
    });

export const vocabularyIdParamSchema = z.object({
    params: z.object({
        vocabularyId: objectIdSchema,
    }),
});

export const excludeReviewSchema = z.object({
    params: z.object({
        vocabularyId: objectIdSchema,
    }),
    body: z.object({
        exclude: z.boolean(),
    }),
});

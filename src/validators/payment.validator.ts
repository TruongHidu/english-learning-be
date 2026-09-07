import { z } from "zod";
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "ID không hợp lệ");
export const paymentCheckoutSchema = z.object({ packageId: objectId }).strict();
export const paymentActionSchema = z.object({}).strict().default({});
export const paymentIdSchema = z.object({ paymentId: objectId });
export const paymentHistorySchema = z.object({
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

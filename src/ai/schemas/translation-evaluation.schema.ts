import { z } from "zod";

export const translationEvaluationSchema = z.object({
    semanticScore: z.number().min(0).max(1),
    hasCriticalError: z.boolean(),
    errorTypes: z.array(z.string().max(100)).max(10),
    reason: z.string().max(500),
}).strict();

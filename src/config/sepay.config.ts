import { z } from "zod";
import { AppError } from "../errors/app-error.js";

const schema = z.object({
    SEPAY_BANK_CODE: z.string().trim().min(1).max(100),
    SEPAY_ACCOUNT_NUMBER: z.string().trim().min(1).max(100),
    SEPAY_ACCOUNT_NAME: z.string().trim().max(200).default(""),
    SEPAY_WEBHOOK_SECRET: z.string().min(32).max(512).refine(value => value.trim().length >= 32),
    SEPAY_PAYMENT_CODE_PREFIX: z.string().regex(/^[A-Z]{2,5}$/).default("EL"),
    SEPAY_EXPIRE_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
});

export type SepayConfig = z.infer<typeof schema>;

export function getSepayConfig(env: NodeJS.ProcessEnv = process.env): SepayConfig {
    const result = schema.safeParse(env);
    if (!result.success) {
        const fields = [...new Set(result.error.issues.map(issue => issue.path.join(".")))];
        throw new AppError("PAYMENT_NOT_CONFIGURED", `Cấu hình SePay không hợp lệ: ${fields.join(", ")}`, 503);
    }
    return result.data;
}

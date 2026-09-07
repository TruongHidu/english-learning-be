import { z } from "zod";
import { AppError } from "../errors/app-error.js";

const callbackUrl = z.string().url().refine(value => {
    const url = new URL(value);
    return !url.username && !url.password && !url.hash && !url.search &&
        (url.protocol === "https:" || (url.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
});
const schema = z.object({
    VNPAY_TMN_CODE: z.string().regex(/^[a-zA-Z0-9]{8}$/),
    VNPAY_HASH_SECRET: z.string().min(1),
    VNPAY_PAYMENT_URL: z.literal("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html")
        .default("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"),
    VNPAY_RETURN_URL: callbackUrl.max(255),
    VNPAY_VERSION: z.literal("2.1.0").default("2.1.0"),
    VNPAY_EXPIRE_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
    PAYMENT_FRONTEND_RESULT_URL: z.string().url().refine(value => {
        const url = new URL(value);
        return !url.username && !url.password && !url.search && !url.hash &&
            (url.protocol === "https:" || (url.protocol === "http:" &&
                ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
    }).default("http://localhost:5173/payment/result"),
});

export type VnpayConfig = z.infer<typeof schema>;

// Lazy validation keeps unrelated APIs usable before sandbox credentials are supplied.
export function getVnpayConfig(env: NodeJS.ProcessEnv = process.env): VnpayConfig {
    const parsed = schema.safeParse(env);
    if (!parsed.success) {
        const fields = [...new Set(parsed.error.issues.map(issue => issue.path.join(".")))];
        throw new AppError("PAYMENT_NOT_CONFIGURED", `Cấu hình thanh toán không hợp lệ: ${fields.join(", ")}`, 503);
    }
    return parsed.data;
}

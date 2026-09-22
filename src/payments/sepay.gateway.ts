import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getSepayConfig, type SepayConfig } from "../config/sepay.config.js";
import { AppError } from "../errors/app-error.js";
import type { Payment } from "../types/payment.types.js";

export function parseSepayDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return null;
    const date = new Date(value.replace(" ", "T") + "+07:00");
    if (!Number.isFinite(date.getTime())) return null;
    return new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 19).replace("T", " ") === value ? date : null;
}

const text = z.string().max(4096);
const payloadSchema = z.object({
    id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    gateway: text.min(1),
    transactionDate: z.string().refine(value => parseSepayDate(value) !== null),
    accountNumber: text.min(1),
    subAccount: text.optional(),
    code: text.nullable(),
    content: text,
    transferType: z.enum(["in", "out"]),
    description: text.optional(),
    transferAmount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    accumulated: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
    referenceCode: text.optional(),
});

export class SepayGateway {
    constructor(readonly config: () => SepayConfig = getSepayConfig) {}

    checkoutDetails(payment: Pick<Payment, "id" | "transactionCode" | "amount" | "currency" | "status" | "expiresAt">) {
        const config = this.config();
        const receivingAccountNumber = config.SEPAY_VA_NUMBER ?? config.SEPAY_ACCOUNT_NUMBER;
        const url = new URL("https://vietqr.app/img");
        url.search = new URLSearchParams({
            acc: receivingAccountNumber, bank: config.SEPAY_BANK_CODE,
            amount: String(payment.amount), des: payment.transactionCode,
            template: "compact", showinfo: "true",
            ...(config.SEPAY_ACCOUNT_NAME ? { holder: config.SEPAY_ACCOUNT_NAME } : {}),
        }).toString();
        return {
            paymentId: payment.id, transactionCode: payment.transactionCode, paymentMethod: "SEPAY" as const,
            status: payment.status, amount: payment.amount, currency: payment.currency,
            qrUrl: url.toString(), bankCode: config.SEPAY_BANK_CODE,
            accountNumber: receivingAccountNumber, accountName: config.SEPAY_ACCOUNT_NAME,
            transferContent: payment.transactionCode, expiresAt: payment.expiresAt.toISOString(),
        };
    }

    verifyWebhook(rawBody: unknown, signature: unknown, timestamp: unknown, now: Date) {
        if (!Buffer.isBuffer(rawBody) || typeof signature !== "string" || !/^sha256=[a-fA-F0-9]{64}$/.test(signature) ||
            typeof timestamp !== "string" || !/^\d{1,12}$/.test(timestamp) ||
            Math.abs(now.getTime() / 1000 - Number(timestamp)) > 300) {
            throw new AppError("SEPAY_UNAUTHORIZED", "Webhook không được xác thực", 401);
        }
        const expected = createHmac("sha256", this.config().SEPAY_WEBHOOK_SECRET)
            .update(timestamp + ".").update(rawBody).digest();
        if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"))) {
            throw new AppError("SEPAY_UNAUTHORIZED", "Webhook không được xác thực", 401);
        }
        let json: unknown;
        try { json = JSON.parse(rawBody.toString("utf8")); }
        catch { throw new AppError("SEPAY_INVALID_PAYLOAD", "Webhook không hợp lệ", 400); }
        const parsed = payloadSchema.safeParse(json);
        if (!parsed.success) throw new AppError("SEPAY_INVALID_PAYLOAD", "Webhook không hợp lệ", 400);
        return parsed.data;
    }
}

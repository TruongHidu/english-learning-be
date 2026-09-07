import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { VnpayConfig } from "../config/vnpay.config.js";
import type { PaymentGateway, PaymentUrlInput } from "./payment-gateway.interface.js";

export function formatVnpayDate(date: Date): string {
    return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19).replace(/[-T:]/g, "");
}

export function parseVnpayDate(value: string): Date | null {
    if (!/^\d{14}$/.test(value)) return null;
    const date = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}+07:00`);
    return Number.isFinite(date.getTime()) && formatVnpayDate(date) === value ? date : null;
}

export function canonicalVnpayQuery(params: Record<string, string>): string {
    const encode = (value: string) => encodeURIComponent(value).replace(/%20/g, "+");
    return Object.keys(params).sort().map(key => `${encode(key)}=${encode(params[key]!)}`).join("&");
}

export class VnpayGateway implements PaymentGateway {
    constructor(private readonly config: () => VnpayConfig) {}

    createPaymentUrl(input: PaymentUrlInput): string {
        const config = this.config();
        const ipAddress = input.ipAddress.replace(/^::ffff:/, "");
        if (!isIP(ipAddress)) throw new Error("Invalid client IP address");
        const params = {
            vnp_Version: config.VNPAY_VERSION,
            vnp_Command: "pay",
            vnp_TmnCode: config.VNPAY_TMN_CODE,
            vnp_Amount: String(input.amount * 100),
            vnp_CurrCode: "VND",
            vnp_TxnRef: input.transactionCode,
            vnp_OrderInfo: `Nap kim cuong ${input.transactionCode}`,
            vnp_OrderType: "other",
            vnp_Locale: "vn",
            vnp_IpAddr: ipAddress,
            vnp_CreateDate: formatVnpayDate(input.createdAt),
            vnp_ExpireDate: formatVnpayDate(input.expiresAt),
            vnp_ReturnUrl: config.VNPAY_RETURN_URL,
        };
        const query = canonicalVnpayQuery(params);
        const hash = createHmac("sha512", config.VNPAY_HASH_SECRET).update(query, "utf8").digest("hex");
        return `${config.VNPAY_PAYMENT_URL}?${query}&vnp_SecureHash=${hash}`;
    }

    verifyCallback(query: Record<string, unknown>): Record<string, string> | null {
        const signature = query.vnp_SecureHash;
        if (typeof signature !== "string" || !/^[a-fA-F0-9]{128}$/.test(signature)) return null;
        const params: Record<string, string> = {};
        for (const [key, value] of Object.entries(query)) {
            if (key === "vnp_SecureHash" || key === "vnp_SecureHashType") continue;
            if (!key.startsWith("vnp_") || typeof value !== "string" || value.length > 2048) return null;
            params[key] = value;
        }
        const expected = createHmac("sha512", this.config().VNPAY_HASH_SECRET)
            .update(canonicalVnpayQuery(params), "utf8").digest();
        return timingSafeEqual(expected, Buffer.from(signature, "hex")) ? params : null;
    }
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import express from "express";
import { getVnpayConfig } from "../src/config/vnpay.config.js";
import { VnpayGateway, canonicalVnpayQuery, formatVnpayDate, parseVnpayDate } from "../src/payments/vnpay.gateway.js";
import { PaymentService } from "../src/services/payment.service.js";
import { PaymentController } from "../src/controllers/payment.controller.js";
import { createPaymentRouter } from "../src/routes/payment.routes.js";
import { errorHandler } from "../src/middlewares/error.middleware.js";
import type { IPaymentTransactionRepository } from "../src/repositories/interfaces/payment-transaction.repository.interface.js";
import type { IDiamondPackageRepository } from "../src/repositories/interfaces/diamond-package.repository.interface.js";
import type { IUserRepository } from "../src/repositories/interfaces/user.repository.interface.js";
import type { NewPayment, Payment, PaymentConfirmation } from "../src/types/payment.types.js";
import type { DiamondPackage } from "../src/types/diamond-package.types.js";
import { paymentCheckoutSchema } from "../src/validators/payment.validator.js";

export const config = getVnpayConfig({
    VNPAY_TMN_CODE: "TEST0001", VNPAY_HASH_SECRET: "local-test-secret",
    VNPAY_RETURN_URL: "https://test.example/api/v1/payments/vnpay/return",
    VNPAY_IPN_URL: "https://test.example/api/v1/payments/vnpay/ipn",
});
const gateway = new VnpayGateway(() => config);
function signed(params: Record<string, string>): Record<string, string> {
    return { ...params, vnp_SecureHash: createHmac("sha512", config.VNPAY_HASH_SECRET).update(canonicalVnpayQuery(params)).digest("hex") };
}
class MemoryPayments implements IPaymentTransactionRepository {
    rows: Payment[] = [];
    diamond = 10;
    ledger: { amount: number; balanceBefore: number; balanceAfter: number }[] = [];
    async create(data: NewPayment): Promise<Payment> {
        const row: Payment = { ...data, id: "a".repeat(24), status: "PENDING", createdAt: new Date(), updatedAt: new Date() };
        this.rows.push(row);
        return row;
    }
    async findByCode(code: string) { return this.rows.find(p => p.transactionCode === code) ?? null; }
    async findOwned(id: string, userId: string) { return this.rows.find(p => p.id === id && p.userId === userId) ?? null; }
    async listOwned(userId: string, page: number, limit: number) {
        const rows = this.rows.filter(p => p.userId === userId);
        return { payments: rows.slice((page - 1) * limit, page * limit), total: rows.length };
    }
    async confirm(payment: Payment, confirmation: PaymentConfirmation) {
        const row = this.rows.find(p => p.id === payment.id)!;
        if (row.status !== "PENDING") return "ALREADY_CONFIRMED" as const;
        Object.assign(row, confirmation);
        if (confirmation.status === "SUCCESS") {
            this.ledger.push({ amount: row.diamondAmount, balanceBefore: this.diamond, balanceAfter: this.diamond + row.diamondAmount });
            this.diamond += row.diamondAmount;
        }
        return "CONFIRMED" as const;
    }
}
function fixture() {
    const payments = new MemoryPayments();
    const pkg: DiamondPackage = { id: "b".repeat(24), code: "SMALL", name: "Gói nhỏ", diamondAmount: 100,
        bonusDiamond: 20, totalDiamond: 120, price: 19000, currency: "VND", status: "ACTIVE", orderIndex: 1,
        createdAt: new Date(), updatedAt: new Date() };
    const packages = { findById: async () => pkg } as unknown as IDiamondPackageRepository;
    const users = { findById: async () => ({ status: "ACTIVE" }) } as unknown as Pick<IUserRepository, "findById">;
    const service = new PaymentService(payments, packages, users, gateway, () => config);
    const start = () => service.checkout("c".repeat(24), pkg.id, "127.0.0.1");
    const callback = (overrides: Record<string, string> = {}) => signed({
        vnp_TmnCode: config.VNPAY_TMN_CODE, vnp_TxnRef: payments.rows[0]!.transactionCode,
        vnp_Amount: "1900000", vnp_ResponseCode: "00", vnp_TransactionStatus: "00",
        vnp_TransactionNo: "1234567", vnp_PayDate: "20260907120000", ...overrides,
    });
    return { payments, pkg, service, start, callback };
}

test("VNPay canonical encoding matches independent HMAC vector, order and Unicode", () => {
    const params = { vnp_TxnRef: "abc", vnp_OrderInfo: "Nap + kim cương &", vnp_Amount: "1900000" };
    const expected = "vnp_Amount=1900000&vnp_OrderInfo=Nap+%2B+kim+c%C6%B0%C6%A1ng+%26&vnp_TxnRef=abc";
    assert.equal(canonicalVnpayQuery(params), expected);
    const signature = createHmac("sha512", config.VNPAY_HASH_SECRET).update(expected).digest("hex");
    const query = { ...params, vnp_SecureHash: signature, vnp_SecureHashType: "SHA512" };
    const original = structuredClone(query);
    assert.deepEqual(gateway.verifyCallback(query), params);
    assert.deepEqual(query, original);
    assert.deepEqual(gateway.verifyCallback(Object.fromEntries(Object.entries(query).reverse())), params);
    assert.equal(gateway.verifyCallback({ ...query, vnp_Amount: "1" }), null);
    assert.equal(gateway.verifyCallback({ ...query, vnp_Amount: ["1900000", "1"] }), null);
    assert.equal(gateway.verifyCallback({ ...query, vnp_SecureHash: "bad" }), null);
});
test("VNPay dates use GMT+7 and reject invalid calendar values", () => {
    assert.equal(formatVnpayDate(new Date("2026-09-06T18:00:00Z")), "20260907010000");
    assert.equal(parseVnpayDate("20260907010000")!.toISOString(), "2026-09-06T18:00:00.000Z");
    assert.equal(parseVnpayDate("20260231010000"), null);
});
test("config rejects missing secrets and unsafe URLs without exposing secrets", () => {
    assert.throws(() => getVnpayConfig({}), /PAYMENT|Cấu hình/);
    assert.throws(() => getVnpayConfig({ ...config, VNPAY_EXPIRE_MINUTES: "15", VNPAY_RETURN_URL: "http://evil.example", VNPAY_HASH_SECRET: "DO_NOT_EXPOSE" }), error =>
        error instanceof Error && !error.message.includes("DO_NOT_EXPOSE"));
});
test("checkout saves snapshot before URL, multiplies amount and rejects client prices", async () => {
    const f = fixture();
    const result = await f.start();
    const url = new URL(result.paymentUrl);
    assert.equal(url.searchParams.get("vnp_Amount"), "1900000");
    assert.equal(url.searchParams.get("vnp_BankCode"), null);
    assert.equal(url.searchParams.get("vnp_IpnUrl"), null);
    assert.equal(result.status, "PENDING");
    assert.equal(f.payments.rows[0]!.diamondAmount, 120);
    assert.ok(gateway.verifyCallback(Object.fromEntries(url.searchParams)));
    assert.equal(paymentCheckoutSchema.safeParse({ packageId: f.pkg.id, amount: 1 }).success, false);
    f.pkg.status = "INACTIVE";
    await assert.rejects(f.start, /không được bán/);
});
test("IPN validates signature, merchant, reference, amount and payload without writes", async () => {
    const f = fixture(); await f.start();
    assert.equal((await f.service.ipn({ ...f.callback(), vnp_SecureHash: "bad" })).RspCode, "97");
    assert.equal((await f.service.ipn(f.callback({ vnp_TmnCode: "OTHER001" }))).RspCode, "99");
    assert.equal((await f.service.ipn(f.callback({ vnp_TxnRef: "unknown" }))).RspCode, "01");
    assert.equal((await f.service.ipn(f.callback({ vnp_Amount: "1" }))).RspCode, "04");
    assert.equal((await f.service.ipn(f.callback({ vnp_TransactionNo: "0" }))).RspCode, "99");
    assert.equal((await f.service.ipn(f.callback({ vnp_ResponseCode: "" }))).RspCode, "99");
    assert.equal(f.payments.diamond, 10);
    assert.equal(f.payments.rows[0]!.status, "PENDING");
});
test("successful IPN accepts optional PayDate and numeric provider IDs with leading zero", async () => {
    const f = fixture(); await f.start();
    const params = f.callback({ vnp_TransactionNo: "001234567" });
    delete params.vnp_PayDate;
    delete params.vnp_SecureHash;
    const result = await f.service.ipn(signed(params));
    assert.equal(result.RspCode, "00");
    assert.equal(f.payments.rows[0]!.status, "SUCCESS");
    assert.equal(f.payments.rows[0]!.providerTransactionId, "001234567");
    assert.equal(f.payments.rows[0]!.paidAt, undefined);
    assert.equal(f.payments.diamond, 130);
});
test("IPN rejects PayDate only when the optional value is present and malformed", async () => {
    const f = fixture(); await f.start();
    const result = await f.service.ipn(f.callback({ vnp_PayDate: "20260231010000" }));
    assert.equal(result.RspCode, "99");
    assert.equal(result.Message, "Invalid pay date");
    assert.equal(f.payments.rows[0]!.status, "PENDING");
    assert.equal(f.payments.diamond, 10);
});
test("IPN credits snapshot exactly once even after package change and repeated callbacks", async () => {
    const f = fixture(); await f.start();
    f.pkg.price = 99000; f.pkg.diamondAmount = 999;
    f.payments.rows[0]!.expiresAt = new Date(0);
    const results = await Promise.all([f.service.ipn(f.callback()), f.service.ipn(f.callback())]);
    assert.deepEqual(results.map(r => r.RspCode).sort(), ["00", "02"]);
    assert.equal((await f.service.ipn(f.callback())).RspCode, "02");
    assert.equal(f.payments.diamond, 130);
    assert.deepEqual(f.payments.ledger, [{ amount: 120, balanceBefore: 10, balanceAfter: 130 }]);
});
test("both VNPay codes must indicate success; failure does not credit or store sentinel ID", async () => {
    const f = fixture(); await f.start();
    assert.equal((await f.service.ipn(f.callback({ vnp_TransactionStatus: "02", vnp_TransactionNo: "0" }))).RspCode, "00");
    assert.equal(f.payments.rows[0]!.status, "FAILED");
    assert.equal(f.payments.rows[0]!.providerTransactionId, undefined);
    assert.equal(f.payments.diamond, 10);
});
test("repository errors yield retryable IPN 99", async () => {
    const f = fixture(); await f.start();
    f.payments.confirm = async () => { throw new Error("transaction unavailable"); };
    assert.equal((await f.service.ipn(f.callback())).RspCode, "99");
    assert.equal(f.payments.rows[0]!.status, "PENDING");
});
test("return before IPN is read only; payment API enforces ownership and omits secrets", async () => {
    const f = fixture(); const checkout = await f.start();
    const before = structuredClone(f.payments.rows);
    const url = new URL(await f.service.returnUrl(f.callback()));
    assert.equal(url.searchParams.get("signatureValid"), "true");
    assert.equal(url.searchParams.get("paymentId"), checkout.paymentId);
    assert.equal(url.searchParams.has("vnp_SecureHash"), false);
    assert.deepEqual(f.payments.rows, before);
    assert.equal((await f.service.getPayment("c".repeat(24), checkout.paymentId)).status, "PENDING");
    await assert.rejects(() => f.service.getPayment("d".repeat(24), checkout.paymentId), /Không tìm thấy/);
    const invalid = new URL(await f.service.returnUrl({ vnp_TxnRef: "forged" }));
    assert.equal(invalid.searchParams.get("signatureValid"), "false");
    assert.equal(invalid.searchParams.has("transactionCode"), false);
});
test("HTTP routes: callbacks public, checkout protected, /me before /:paymentId and validation", async t => {
    const f = fixture();
    const app = express(); app.use(express.json());
    app.use("/payments", createPaymentRouter(new PaymentController(f.service), (req, res, next) => {
        if (!req.headers.authorization) { res.sendStatus(401); return; }
        req.user = { id: "c".repeat(24), role: "USER" }; next();
    }));
    app.use(errorHandler);
    const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
    t.after(() => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }));
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/payments`;
    const ipn = await fetch(`${base}/vnpay/ipn`); assert.equal(ipn.status, 200); assert.equal((await ipn.json()).RspCode, "97");
    assert.equal((await fetch(`${base}/vnpay/return`, { redirect: "manual" })).status, 302);
    assert.equal((await fetch(`${base}/vnpay/checkout`, { method: "POST" })).status, 401);
    const headers = { Authorization: "Bearer test", "Content-Type": "application/json" };
    assert.equal((await fetch(`${base}/vnpay/checkout`, { method: "POST", headers, body: JSON.stringify({ packageId: f.pkg.id, amount: 1 }) })).status, 400);
    assert.equal((await fetch(`${base}/vnpay/checkout`, { method: "POST", headers, body: JSON.stringify({ packageId: f.pkg.id }) })).status, 201);
    const history = await fetch(`${base}/me`, { headers }); assert.equal(history.status, 200); assert.equal((await history.json()).data.total, 1);
    assert.equal((await fetch(`${base}/me?limit=-1`, { headers })).status, 400);
    assert.equal((await fetch(`${base}/bad-id`, { headers })).status, 400);
});

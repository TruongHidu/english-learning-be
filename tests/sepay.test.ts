import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac, randomBytes } from "node:crypto";
import { once } from "node:events";
import express from "express";
import { getSepayConfig } from "../src/config/sepay.config.js";
import { getVnpayConfig } from "../src/config/vnpay.config.js";
import { SepayGateway, parseSepayDate } from "../src/payments/sepay.gateway.js";
import { VnpayGateway, canonicalVnpayQuery } from "../src/payments/vnpay.gateway.js";
import { PaymentService } from "../src/services/payment.service.js";
import { PaymentController } from "../src/controllers/payment.controller.js";
import { createPaymentRouter } from "../src/routes/payment.routes.js";
import { errorHandler } from "../src/middlewares/error.middleware.js";
import type { IPaymentTransactionRepository } from "../src/repositories/interfaces/payment-transaction.repository.interface.js";
import type { IDiamondPackageRepository } from "../src/repositories/interfaces/diamond-package.repository.interface.js";
import type { IUserRepository } from "../src/repositories/interfaces/user.repository.interface.js";
import type { Payment } from "../src/types/payment.types.js";

const env = { SEPAY_BANK_CODE: "BIDV", SEPAY_ACCOUNT_NUMBER: "0012345678", SEPAY_VA_NUMBER: "VA123456789",
    SEPAY_ACCOUNT_NAME: "NGUYỄN A + B & C", SEPAY_WEBHOOK_SECRET: "sepay-test-secret-only-32-characters-long" };
const config = getSepayConfig(env);
const gateway = new SepayGateway(() => config);
const vnpConfig = getVnpayConfig({ VNPAY_TMN_CODE: "TEST0001", VNPAY_HASH_SECRET: "vnp-test",
    VNPAY_RETURN_URL: "https://test.example/return" });
const userId = "c".repeat(24), packageId = "b".repeat(24);

function sign(body: string, now: Date, offset = 0) {
    const timestamp = String(Math.floor(now.getTime() / 1000) + offset);
    return { timestamp, signature: "sha256=" + createHmac("sha256", config.SEPAY_WEBHOOK_SECRET)
        .update(timestamp + ".").update(body).digest("hex") };
}

function fixture() {
    let now = new Date("2026-09-22T05:00:00Z");
    const rows: Payment[] = [];
    let diamond = 10, ledger = 0;
    const pkg = { id: packageId, code: "SMALL", name: "Small", price: 19000,
        diamondAmount: 100, bonusDiamond: 20, currency: "VND", status: "ACTIVE" };
    const user = { status: "ACTIVE" };
    const repository: IPaymentTransactionRepository = {
        create: async data => {
            const row: Payment = { ...data, id: randomBytes(12).toString("hex"), status: "PENDING", createdAt: now, updatedAt: now };
            rows.push(row); return row;
        },
        findByCode: async code => rows.find(row => row.transactionCode === code) ?? null,
        findOwned: async (id, owner) => rows.find(row => row.id === id && row.userId === owner) ?? null,
        findActivePendingByUser: async (owner, time) => rows.find(row => row.userId === owner && row.status === "PENDING" && row.expiresAt > time) ?? null,
        expirePendingByUser: async (owner, time) => {
            let count = 0;
            for (const row of rows) if (row.userId === owner && row.status === "PENDING" && row.expiresAt <= time) { row.status = "EXPIRED"; count++; }
            return count;
        },
        expireAllPending: async () => 0,
        extendPendingPayment: async (payment, _time, expiresAt) => { payment.expiresAt = expiresAt; return payment; },
        cancelPendingPayment: async id => { const row = rows.find(row => row.id === id)!; row.status = "CANCELLED"; return row; },
        listOwned: async owner => ({ payments: rows.filter(row => row.userId === owner), total: rows.length }),
        confirm: async (payment, confirmation) => {
            if (!["PENDING", "EXPIRED", "CANCELLED"].includes(payment.status)) return "ALREADY_CONFIRMED";
            Object.assign(payment, confirmation); diamond += payment.diamondAmount; ledger++;
            return "CONFIRMED";
        },
    };
    const service = new PaymentService(repository, { findById: async () => pkg } as unknown as IDiamondPackageRepository,
        { findById: async () => user } as unknown as Pick<IUserRepository, "findById">,
        new VnpayGateway(() => vnpConfig), () => vnpConfig, () => now, gateway);
    const payload = (overrides: Record<string, unknown> = {}) => ({
        id: 92704, gateway: config.SEPAY_BANK_CODE, transactionDate: "2026-09-22 12:00:00",
        accountNumber: config.SEPAY_ACCOUNT_NUMBER, subAccount: config.SEPAY_VA_NUMBER, code: rows[0]?.transactionCode,
        content: "Thanh toán kim cương", transferType: "in", description: "", transferAmount: 19000,
        accumulated: 100000, referenceCode: "FT123", ...overrides,
    });
    const deliver = async (overrides: Record<string, unknown> = {}) => {
        const body = JSON.stringify(payload(overrides)), signed = sign(body, now);
        await service.sepayWebhook(Buffer.from(body), signed.signature, signed.timestamp);
    };
    return { service, repository, rows, pkg, user, payload, deliver, now: () => now, setNow: (time: Date) => { now = time; },
        start: () => service.checkoutSepay(userId, packageId), balance: () => diamond, ledger: () => ledger };
}

test("SePay config validates without exposing secrets; dates use Vietnam timezone", () => {
    assert.equal(config.SEPAY_EXPIRE_MINUTES, 15);
    assert.equal(config.SEPAY_PAYMENT_CODE_PREFIX, "EL");
    assert.equal(getSepayConfig({ ...env, SEPAY_VA_NUMBER: "" }).SEPAY_VA_NUMBER, undefined);
    for (const change of [{ SEPAY_BANK_CODE: " " }, { SEPAY_ACCOUNT_NUMBER: "" },
        { SEPAY_WEBHOOK_SECRET: "DO_NOT_EXPOSE" },
        { SEPAY_PAYMENT_CODE_PREFIX: "el" }, { SEPAY_PAYMENT_CODE_PREFIX: "ABCDEF" }, { SEPAY_EXPIRE_MINUTES: "0" }, { SEPAY_EXPIRE_MINUTES: "1.5" }]) {
        assert.throws(() => getSepayConfig({ ...env, ...change }), error => error instanceof Error && !error.message.includes("DO_NOT_EXPOSE"));
    }
    assert.equal(parseSepayDate("2026-09-22 12:00:00")!.toISOString(), "2026-09-22T05:00:00.000Z");
    assert.equal(parseSepayDate("2026-02-31 12:00:00"), null);
});

test("SePay checkout uses snapshots, bounded code and correctly encoded QR", async () => {
    const f = fixture(), result = await f.start();
    assert.match(result.transactionCode, /^EL[A-F0-9]{16}$/);
    assert.equal(result.paymentMethod, "SEPAY"); assert.equal(result.amount, 19000);
    assert.equal(result.expiresAt, "2026-09-22T05:15:00.000Z");
    assert.equal(f.rows[0]!.diamondAmount, 120);
    const url = new URL(result.qrUrl);
    assert.equal(url.origin + url.pathname, "https://vietqr.app/img");
    assert.deepEqual(Object.fromEntries(url.searchParams), { acc: env.SEPAY_VA_NUMBER, bank: env.SEPAY_BANK_CODE,
        amount: "19000", des: result.transactionCode, template: "compact", showinfo: "true", holder: env.SEPAY_ACCOUNT_NAME });
    assert.equal(JSON.stringify(result).includes(config.SEPAY_WEBHOOK_SECRET), false);
    await assert.rejects(f.start, { code: "PAYMENT_PENDING_EXISTS" });
    await assert.rejects(() => f.service.checkout(userId, packageId, "127.0.0.1"), { code: "PAYMENT_PENDING_EXISTS" });
});

test("SePay rejects inactive users/packages and invalid package prices", async () => {
    for (const change of ["user", "package", "price"]) {
        const f = fixture();
        if (change === "user") f.user.status = "LOCKED";
        if (change === "package") f.pkg.status = "INACTIVE";
        if (change === "price") f.pkg.price = 19000.5;
        await assert.rejects(f.start); assert.equal(f.rows.length, 0);
    }
});

test("SePay HMAC authenticates original bytes and rejects missing, forged, stale or future signatures", async () => {
    const f = fixture(); await f.start();
    const body = JSON.stringify(f.payload(), null, 2), signed = sign(body, f.now());
    assert.equal(gateway.verifyWebhook(Buffer.from(body), signed.signature, signed.timestamp, f.now()).id, 92704);
    for (const [raw, signature, timestamp] of [
        [Buffer.from(body), undefined, signed.timestamp], [Buffer.from(body), "sha256=" + "0".repeat(64), signed.timestamp],
        [Buffer.from(body + " "), signed.signature, signed.timestamp], [f.payload(), signed.signature, signed.timestamp],
        [Buffer.from(body), signed.signature, undefined],
        ...[-301, 301].map(offset => { const s = sign(body, f.now(), offset); return [Buffer.from(body), s.signature, s.timestamp]; }),
    ]) {
        await assert.rejects(() => f.service.sepayWebhook(raw, signature, timestamp), { statusCode: 401 });
    }
    assert.equal(f.balance(), 10);
});

test("SePay validates payload, rejects malformed JSON and unsafe money/id/date", async () => {
    const f = fixture(); await f.start();
    for (const change of [{ id: 0 }, { id: Number.MAX_SAFE_INTEGER + 1 }, { transferAmount: 1.1 }, { transferAmount: "19000" },
        { transactionDate: "2026-02-31 12:00:00" }, { code: {} }, { transferType: "other" }]) {
        await assert.rejects(() => f.deliver(change), { statusCode: 400 });
    }
    const s = sign("{", f.now());
    await assert.rejects(() => f.service.sepayWebhook(Buffer.from("{"), s.signature, s.timestamp), { statusCode: 400 });
    assert.equal(f.balance(), 10);
});

test("SePay ignores outgoing, mismatched main account/VA, amount, code and provider", async () => {
    const f = fixture(); await f.start();
    for (const change of [{ transferType: "out" }, { accountNumber: "other" }, { subAccount: "other" },
        { subAccount: "" }, { transferAmount: 1 },
        { code: "ELUNKNOWN" }, { code: null }, { code: "" }]) await f.deliver(change);
    f.rows[0]!.paymentMethod = "VNPAY"; await f.deliver();
    assert.equal(f.balance(), 10); assert.equal(f.rows[0]!.status, "PENDING");
});

test("SePay valid webhook uses diamond snapshot, metadata and credits once on repeated/concurrent delivery", async () => {
    const f = fixture(); await f.start();
    f.pkg.diamondAmount = 999; f.pkg.price = 99999; f.pkg.status = "INACTIVE";
    await Promise.all(Array.from({ length: 6 }, () => f.deliver())); await f.deliver();
    assert.equal(f.balance(), 130); assert.equal(f.ledger(), 1);
    assert.equal(f.rows[0]!.status, "SUCCESS"); assert.equal(f.rows[0]!.providerTransactionId, "92704");
    assert.equal(f.rows[0]!.referenceCode, "FT123"); assert.equal(f.rows[0]!.bankCode, config.SEPAY_BANK_CODE);
    assert.equal(f.rows[0]!.paidAt!.toISOString(), "2026-09-22T05:00:00.000Z");
    await f.deliver({ transferType: "out" }); assert.equal(f.rows[0]!.status, "SUCCESS");
});

test("SePay late success recovers cancelled/expired payments; failed and success never retry", async () => {
    for (const status of ["CANCELLED", "EXPIRED", "FAILED", "SUCCESS"] as const) {
        const f = fixture(); const p = await f.start(); f.rows[0]!.status = status;
        await assert.rejects(() => f.service.retry(userId, p.paymentId, "127.0.0.1"));
        await f.deliver(); await f.deliver();
        assert.equal(f.balance(), ["CANCELLED", "EXPIRED"].includes(status) ? 130 : 10);
    }
});

test("SePay retry preserves snapshot/code and fails safely on concurrent status changes", async () => {
    const f = fixture(), p = await f.start(); const createdAt = f.rows[0]!.createdAt;
    f.pkg.price = 99999; f.pkg.status = "INACTIVE"; f.setNow(new Date("2026-09-22T05:05:00Z"));
    const retry = await f.service.retry(userId, p.paymentId, "invalid-ip-not-needed-for-sepay");
    assert.ok("qrUrl" in retry); assert.equal(retry.amount, 19000); assert.equal(retry.transactionCode, p.transactionCode);
    assert.equal(retry.expiresAt, "2026-09-22T05:20:00.000Z"); assert.equal(f.rows[0]!.createdAt, createdAt);
    await assert.rejects(() => f.service.retry("d".repeat(24), p.paymentId, "127.0.0.1"), { code: "PAYMENT_NOT_FOUND" });
    f.repository.extendPendingPayment = async () => null;
    await assert.rejects(() => f.service.retry(userId, p.paymentId, "127.0.0.1"), { code: "PAYMENT_NOT_PENDING" });
});

test("VNPay signed return cannot confirm a SePay payment", async () => {
    const f = fixture(), p = await f.start();
    const params = { vnp_TmnCode: vnpConfig.VNPAY_TMN_CODE, vnp_TxnRef: p.transactionCode,
        vnp_Amount: "1900000", vnp_ResponseCode: "00", vnp_TransactionStatus: "00", vnp_TransactionNo: "123" };
    const query = { ...params, vnp_SecureHash: createHmac("sha512", vnpConfig.VNPAY_HASH_SECRET).update(canonicalVnpayQuery(params)).digest("hex") };
    assert.equal(new URL(await f.service.returnUrl(query)).searchParams.get("returnResult"), "invalid");
    assert.equal(f.balance(), 10);
});

test("SePay HTTP checkout protected; public raw webhook responds exactly and retries database errors", async t => {
    const f = fixture(), controller = new PaymentController(f.service), app = express();
    app.post("/payments/sepay/webhook", express.raw({ type: "application/json", limit: "64kb", inflate: false }), controller.sepayWebhook);
    app.use(express.json());
    app.use("/payments", createPaymentRouter(controller, (req, res, next) => {
        if (!req.headers.authorization) { res.sendStatus(401); return; }
        req.user = { id: userId, role: "USER" }; next();
    }));
    app.use(errorHandler);
    const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
    t.after(() => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }));
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/payments`;
    const headers = { Authorization: "Bearer test", "Content-Type": "application/json" };
    assert.equal((await fetch(base + "/sepay/checkout", { method: "POST" })).status, 401);
    assert.equal((await fetch(base + "/sepay/checkout", { method: "POST", headers, body: JSON.stringify({ packageId, amount: 1 }) })).status, 400);
    const checkout = await fetch(base + "/sepay/checkout", { method: "POST", headers, body: JSON.stringify({ packageId }) });
    assert.equal(checkout.status, 201);
    const paymentId = (await checkout.json()).data.paymentId;
    assert.equal((await fetch(base + "/sepay/webhook", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
    const deliverHttp = async (change: Record<string, unknown> = {}) => {
        const body = JSON.stringify(f.payload(change), null, 2), s = sign(body, f.now());
        return fetch(base + "/sepay/webhook", { method: "POST", headers: { "Content-Type": "application/json",
            "X-SePay-Timestamp": s.timestamp, "X-SePay-Signature": s.signature }, body });
    };
    for (const change of [{ code: "unknown" }, { transferAmount: 1 }, { accountNumber: "wrong" },
        { subAccount: "wrong" }, { transferType: "out" }]) {
        const response = await deliverHttp(change); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { success: true });
    }
    const confirm = f.repository.confirm;
    f.repository.confirm = async () => { throw { code: 11000 }; };
    assert.equal((await deliverHttp()).status, 500); assert.equal(f.balance(), 10);
    f.repository.confirm = confirm;
    const response = await deliverHttp(); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { success: true });
    assert.equal(f.balance(), 130);
    assert.equal((await (await fetch(`${base}/${paymentId}`, { headers })).json()).data.status, "SUCCESS");
    assert.deepEqual(await (await deliverHttp()).json(), { success: true }); assert.equal(f.balance(), 130);
});

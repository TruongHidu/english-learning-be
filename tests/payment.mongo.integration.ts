import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createServer } from "node:net";
import { createHmac, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { UserModel } from "../src/models/user.model.js";
import { DiamondPackageModel } from "../src/models/diamond-package.model.js";
import { DiamondTransactionModel } from "../src/models/diamond-transaction.model.js";
import { PaymentTransactionModel } from "../src/models/payment-transaction.model.js";
import { PaymentTransactionRepository } from "../src/repositories/implementations/payment-transaction.repository.js";
import { DiamondPackageRepository } from "../src/repositories/implementations/diamond-package.repository.js";
import { UserRepository } from "../src/repositories/implementations/user.repository.js";
import { PaymentService } from "../src/services/payment.service.js";
import { getVnpayConfig } from "../src/config/vnpay.config.js";
import { canonicalVnpayQuery, VnpayGateway } from "../src/payments/vnpay.gateway.js";

// Starts a NEW local replica set. Never reads .env or connects to the user's database.
let mongod: ChildProcess | undefined;
let directory: string | undefined;
const config = getVnpayConfig({ VNPAY_TMN_CODE: "TEST0001", VNPAY_HASH_SECRET: "test-secret",
    VNPAY_RETURN_URL: "https://test.example/return", VNPAY_IPN_URL: "https://test.example/ipn" });
const repository = new PaymentTransactionRepository();
const packages = new DiamondPackageRepository();
const service = new PaymentService(repository, packages, new UserRepository(), new VnpayGateway(() => config), () => config);

before(async () => {
    assert.ok(process.env.TEST_MONGOD_PATH, "Set TEST_MONGOD_PATH to the local mongod executable");
    const listener = createServer(); listener.listen(0, "127.0.0.1"); await once(listener, "listening");
    const address = listener.address(); assert.ok(address && typeof address !== "string");
    const port = address.port;
    await new Promise<void>((res, reject) => listener.close(error => error ? reject(error) : res()));
    directory = await mkdtemp(join(tmpdir(), "english-payment-test-"));
    mongod = spawn(process.env.TEST_MONGOD_PATH, ["--dbpath", directory, "--bind_ip", "127.0.0.1", "--port", String(port), "--replSet", "paymentTest", "--noauth", "--quiet"],
        { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    await new Promise<void>((res, reject) => {
        let output = "";
        const timer = setTimeout(() => reject(new Error(`Mongo startup timeout: ${output}`)), 25000);
        const finish = (error?: Error) => { clearTimeout(timer); error ? reject(error) : res(); };
        mongod!.once("error", finish);
        mongod!.once("exit", code => finish(new Error(`Mongo exited ${code}: ${output}`)));
        const read = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-8000); if (output.includes("Waiting for connections")) finish(); };
        mongod!.stdout!.on("data", read); mongod!.stderr!.on("data", read);
    });
    const bootstrap = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`);
    try {
        await bootstrap.connect();
        await bootstrap.db("admin").command({ replSetInitiate: { _id: "paymentTest", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    } finally { await bootstrap.close(); }
    await mongoose.connect(`mongodb://127.0.0.1:${port}/payment_integration?replicaSet=paymentTest`, { serverSelectionTimeoutMS: 30000 });
    await Promise.all([UserModel.init(), DiamondPackageModel.init(), DiamondTransactionModel.init(), PaymentTransactionModel.init()]);
});

after(async () => {
    await mongoose.disconnect();
    if (mongod && mongod.exitCode === null && mongod.signalCode === null) {
        const exited = once(mongod, "exit"); mongod.kill(); await exited;
    }
    if (directory) {
        const target = resolve(directory);
        assert.equal(dirname(target), resolve(tmpdir()));
        assert.ok(basename(target).startsWith("english-payment-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
});

async function fixture() {
    const unique = randomBytes(8).toString("hex");
    const user = await UserModel.create({ email: `${unique}@example.test`, displayName: "Payment test", stats: { diamond: 10 } });
    const pkg = await packages.create({ code: unique, name: "Gói test", diamondAmount: 100, bonusDiamond: 20, price: 19000 });
    const checkout = await service.checkout(user._id.toString(), pkg.id, "127.0.0.1");
    const payment = (await repository.findByCode(checkout.transactionCode))!;
    const callback = (overrides: Record<string, string> = {}) => {
        const params = { vnp_TmnCode: config.VNPAY_TMN_CODE, vnp_TxnRef: checkout.transactionCode,
            vnp_Amount: "1900000", vnp_ResponseCode: "00", vnp_TransactionStatus: "00",
            vnp_TransactionNo: String(100000 + Math.floor(Math.random() * 1e12)), vnp_PayDate: "20260907120000", ...overrides };
        return { ...params, vnp_SecureHash: createHmac("sha512", config.VNPAY_HASH_SECRET).update(canonicalVnpayQuery(params)).digest("hex") };
    };
    return { user, pkg, checkout, payment, callback };
}

test("real replica set: parallel IPNs credit once, snapshot survives package deactivation", async () => {
    const f = await fixture();
    await packages.update(f.pkg.id, { price: 99000, diamondAmount: 1000 });
    assert.equal(await packages.delete(f.pkg.id), true);
    assert.equal((await packages.findById(f.pkg.id))!.status, "INACTIVE");
    assert.equal((await packages.findActive()).some(p => p.id === f.pkg.id), false);
    const callback = f.callback();
    const results = await Promise.all(Array.from({ length: 6 }, () => service.ipn(callback)));
    assert.equal(results.filter(r => r.RspCode === "00").length, 1);
    assert.equal(results.filter(r => r.RspCode === "02").length, 5);
    const savedUser = await UserModel.findById(f.user._id).lean();
    assert.equal(savedUser!.stats.diamond, 130);
    const ledger = await DiamondTransactionModel.find({ referenceId: f.payment.id }).lean();
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0]!.type, "TOP_UP");
    assert.equal(ledger[0]!.balanceBefore, 10);
    assert.equal(ledger[0]!.balanceAfter, 130);
    assert.equal((await repository.findByCode(f.payment.transactionCode))!.status, "SUCCESS");
});

test("real replica set: ledger duplicate rolls back wallet and payment status", async () => {
    const f = await fixture();
    await DiamondTransactionModel.create({ userId: f.user._id, amount: 1, type: "TOP_UP", referenceType: "PAYMENT",
        referenceId: f.payment.id, balanceBefore: 0, balanceAfter: 1 });
    assert.equal((await service.ipn(f.callback())).RspCode, "99");
    assert.equal((await UserModel.findById(f.user._id))!.stats.diamond, 10);
    assert.equal((await repository.findByCode(f.payment.transactionCode))!.status, "PENDING");
});

test("real replica set: missing wallet rolls back payment and allows recovery retry", async () => {
    const f = await fixture();
    const original = f.user.toObject();
    await UserModel.deleteOne({ _id: f.user._id });
    const callback = f.callback();
    assert.equal((await service.ipn(callback)).RspCode, "99");
    assert.equal((await repository.findByCode(f.payment.transactionCode))!.status, "PENDING");
    assert.equal(await DiamondTransactionModel.countDocuments({ referenceId: f.payment.id }), 0);
    await UserModel.create(original);
    assert.equal((await service.ipn(callback)).RspCode, "00");
});

test("real replica set: duplicate provider ID cannot credit another payment; ownership enforced", async () => {
    const a = await fixture(); const b = await fixture();
    const providerId = "999999999999999";
    assert.equal((await service.ipn(a.callback({ vnp_TransactionNo: providerId }))).RspCode, "00");
    assert.equal((await service.ipn(b.callback({ vnp_TransactionNo: providerId }))).RspCode, "99");
    assert.equal((await UserModel.findById(b.user._id))!.stats.diamond, 10);
    assert.equal((await repository.findByCode(b.payment.transactionCode))!.status, "PENDING");
    await assert.rejects(() => service.getPayment(b.user.id, a.payment.id), /Không tìm thấy/);
    const history = await service.history(a.user.id, 1, 20);
    assert.equal(history.total, 1);
    assert.equal(history.payments[0]!.paymentId, a.payment.id);
});

test("real replica set: failures with provider sentinel zero do not collide or credit", async () => {
    for (let i = 0; i < 2; i++) {
        const f = await fixture();
        assert.equal((await service.ipn(f.callback({ vnp_ResponseCode: "24", vnp_TransactionStatus: "02", vnp_TransactionNo: "0" }))).RspCode, "00");
        const payment = await repository.findByCode(f.payment.transactionCode);
        assert.equal(payment!.status, "FAILED");
        assert.equal(payment!.providerTransactionId, undefined);
        assert.equal((await UserModel.findById(f.user._id))!.stats.diamond, 10);
    }
});

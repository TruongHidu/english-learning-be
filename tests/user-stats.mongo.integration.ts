import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createServer } from "node:net";
import mongoose from "mongoose";
import { UserModel } from "../src/models/user.model.js";
import { UserRepository } from "../src/repositories/implementations/user.repository.js";
import { UserStatsService } from "../src/services/user-stats.service.js";
import { AdminDiamondService } from "../src/services/admin-diamond.service.js";
import { UserMapper } from "../src/mappers/user.mapper.js";

// Explicitly launches an isolated standalone server. Never reads MONGODB_URI/.env.
let mongod: ChildProcess | undefined;
let directory: string | undefined;
const repository = new UserRepository();
const service = new UserStatsService(repository);
const activityAt = new Date();

before(async () => {
    const binary = process.env.TEST_MONGOD_PATH;
    assert.ok(binary, "Set TEST_MONGOD_PATH to a local mongod executable");
    const listener = createServer();
    listener.listen(0, "127.0.0.1");
    await once(listener, "listening");
    const address = listener.address();
    assert.ok(address && typeof address !== "string");
    const port = address.port;
    await new Promise<void>((res, reject) => listener.close(error => error ? reject(error) : res()));
    directory = await mkdtemp(join(tmpdir(), "english-streak-test-"));
    mongod = spawn(binary, ["--dbpath", directory, "--bind_ip", "127.0.0.1", "--port", String(port), "--noauth", "--quiet"], {
        windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
    await new Promise<void>((res, reject) => {
        let output = "";
        const timer = setTimeout(() => reject(new Error(`MongoDB startup timeout: ${output}`)), 20000);
        const finish = (error?: Error) => {
            clearTimeout(timer);
            error ? reject(error) : res();
        };
        mongod!.once("error", finish);
        mongod!.once("exit", code => finish(new Error(`MongoDB exited (${code}): ${output}`)));
        const read = (chunk: Buffer) => {
            output = (output + chunk.toString()).slice(-8000);
            if (output.includes("Waiting for connections")) finish();
        };
        mongod!.stdout!.on("data", read);
        mongod!.stderr!.on("data", read);
    });
    await mongoose.connect(`mongodb://127.0.0.1:${port}/streak_integration`, { serverSelectionTimeoutMS: 5000 });
});

after(async () => {
    await mongoose.disconnect();
    if (mongod && mongod.exitCode === null && mongod.signalCode === null) {
        const exited = once(mongod, "exit");
        mongod.kill();
        await exited;
    }
    if (directory) {
        // Only remove this test's uniquely created temporary database directory.
        const target = resolve(directory);
        assert.equal(dirname(target), resolve(tmpdir()));
        assert.ok(basename(target).startsWith("english-streak-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
});

async function makeUser() {
    return repository.create({
        email: `${new mongoose.Types.ObjectId()}@example.com`, displayName: "Streak Learner",
        stats: { totalXp: 90, diamond: 100, currentHeart: 3, currentStreak: 4, longestStreak: 9,
            lastStudyDate: new Date(activityAt.getTime() - 86400000) },
    });
}

test("standalone MongoDB: six simultaneous activities preserve every reward and increment streak once", async () => {
    const user = await makeUser();
    const results = await Promise.all(Array.from({ length: 6 }, () =>
        service.applyLessonCompletionStats(user.id, structuredClone(user.stats), 10, 5, activityAt)));
    const saved = (await repository.findById(user.id))!;
    assert.equal(saved.stats.totalXp, 150);
    assert.equal(saved.stats.diamond, 130);
    assert.equal(saved.stats.level, 2);
    assert.equal(saved.stats.currentStreak, 5);
    assert.equal(saved.stats.longestStreak, 9);
    assert.equal(saved.stats.currentHeart, 3);
    assert.ok(results.every(result => result.currentStreak === 5));
    assert.deepEqual(results.map(result => result.totalXp).sort((a, b) => a - b), [100, 110, 120, 130, 140, 150]);
});

test("first simultaneous activities support missing legacy stats fields and lastStudyDate", async () => {
    const id = new mongoose.Types.ObjectId();
    await UserModel.collection.insertOne({ _id: id, email: `${id}@example.com`, displayName: "Legacy", stats: {},
        authProvider: "LOCAL", role: "USER", status: "ACTIVE" });
    const user = (await repository.findById(id.toString()))!;
    await Promise.all([
        service.applyLessonCompletionStats(user.id, user.stats, 10, 5, activityAt),
        service.applyLessonCompletionStats(user.id, user.stats, 5, 0, activityAt),
    ]);
    const saved = (await repository.findById(user.id))!;
    assert.equal(saved.stats.currentStreak, 1);
    assert.equal(saved.stats.longestStreak, 1);
    assert.equal(saved.stats.totalXp, 15);
    assert.equal(saved.stats.diamond, 5);
});

test("read projections cannot reset a newly earned streak or its history", async () => {
    const user = await makeUser();
    await UserModel.updateOne({ _id: user.id }, { $set: { "stats.lastStudyDate": new Date("2000-01-01T00:00:00Z") } });
    const stale = (await repository.findById(user.id))!;
    const snapshot = structuredClone(stale.stats);
    await service.applyLessonCompletionStats(user.id, stale.stats, 10, 5, activityAt);
    assert.equal(UserMapper.toProfileResponse(stale).stats.currentStreak, 0);
    assert.deepEqual(stale.stats, snapshot);
    const saved = (await repository.findById(user.id))!;
    assert.equal(UserMapper.toProfileResponse(saved).stats.currentStreak, 1);
    assert.equal(saved.stats.longestStreak, 9);
    assert.deepEqual(saved.stats.lastStudyDate, activityAt);
});

test("reward concurrent with shop purchase preserves diamond deduction and heart update", async () => {
    const user = await makeUser();
    const [, purchase] = await Promise.all([
        service.applyLessonCompletionStats(user.id, user.stats, 10, 5, activityAt),
        repository.purchaseHeart(user.id, 20),
    ]);
    assert.ok(purchase);
    const saved = (await repository.findById(user.id))!;
    assert.equal(saved.stats.totalXp, 100);
    assert.equal(saved.stats.diamond, 85);
    assert.equal(saved.stats.currentHeart, 4);
    assert.equal(saved.stats.currentStreak, 5);
});

test("admin adjustments and rewards cannot overwrite one another, and responses stay compatible", async () => {
    const user = await makeUser();
    const admin = new AdminDiamondService();
    const adminId = new mongoose.Types.ObjectId().toString();
    const [adjustment] = await Promise.all([
        admin.adjustUserDiamonds(adminId, user.id, -20, "Concurrent adjustment"),
        service.applyLessonCompletionStats(user.id, user.stats, 10, 5, activityAt),
        admin.adjustUserDiamonds(adminId, user.id, 7, "Concurrent credit"),
    ]);
    const saved = (await repository.findById(user.id))!;
    assert.equal(saved.stats.diamond, 92);
    assert.equal(saved.stats.totalXp, 100);
    assert.equal(adjustment.transaction.balanceAfter - adjustment.transaction.balanceBefore, -20);
    assert.deepEqual(Object.keys(adjustment).sort(), ["transaction", "user"]);
    assert.deepEqual(Object.keys(adjustment.user).sort(), ["id", "email", "name", "diamond", "currentHeart"].sort());
    await assert.rejects(() => admin.adjustUserDiamonds(adminId, user.id, -1000, "Too much"), { code: "INSUFFICIENT_DIAMOND", statusCode: 400 });
    await assert.rejects(() => admin.adjustUserDiamonds(adminId, new mongoose.Types.ObjectId().toString(), 5, "Missing"), { code: "USER_NOT_FOUND", statusCode: 404 });
});

test("admin list returns expired streak with its existing response fields", async () => {
    const user = await makeUser();
    await UserModel.updateOne({ _id: user.id }, { $set: { "stats.lastStudyDate": new Date("2000-01-01T00:00:00Z") } });
    const before = (await repository.findById(user.id))!.stats;
    const response = await new AdminDiamondService().getUsers({ q: user.email });
    assert.equal(response.users.length, 1);
    assert.equal(response.users[0]!.currentStreak, 0);
    assert.deepEqual(Object.keys(response).sort(), ["users", "total", "page", "totalPages"].sort());
    assert.deepEqual(Object.keys(response.users[0]!).sort(), ["id", "email", "name", "role", "status", "diamond", "currentHeart", "maxHeart", "totalXp", "currentStreak", "createdAt"].sort());
    assert.deepEqual((await repository.findById(user.id))!.stats, before);
});

test("older requests cannot move the stored activity timestamp backwards", async () => {
    const user = await makeUser();
    const later = new Date(activityAt.getTime() + 1000);
    await service.applyLessonCompletionStats(user.id, user.stats, 10, 5, later);
    await service.applyLessonCompletionStats(user.id, user.stats, 10, 5, activityAt);
    const saved = (await repository.findById(user.id))!;
    assert.deepEqual(saved.stats.lastStudyDate, later);
    assert.equal(saved.stats.currentStreak, 5);
    assert.equal(saved.stats.totalXp, 110);
});

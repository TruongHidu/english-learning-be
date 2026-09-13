import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createServer } from "node:net";
import mongoose from "mongoose";
import { RefreshSessionModel } from "../src/models/refresh-session.model.js";
import { RefreshSessionRepository } from "../src/repositories/implementations/refresh-session.repository.js";
import { RefreshSessionService, hashRefreshToken } from "../src/services/refresh-session.service.js";
import { JwtTokenService } from "../src/security/jwt-token-service.js";
import type { IUserRepository } from "../src/repositories/interfaces/user.repository.interface.js";

// Uses a NEW temporary replica set, never the application's database or .env.
let processHandle: ChildProcess | undefined;
let directory: string | undefined;
const repository = new RefreshSessionRepository();
const users = { findById: async (id: string) => ({ id, role: "USER", status: "ACTIVE" }) } as unknown as IUserRepository;
const service = new RefreshSessionService(repository, users, new JwtTokenService("integration-secret"));

before(async () => {
    assert.ok(process.env.TEST_MONGOD_PATH, "Set TEST_MONGOD_PATH to mongod.exe");
    const listener = createServer().listen(0, "127.0.0.1");
    await once(listener, "listening");
    const address = listener.address();
    assert.ok(address && typeof address !== "string");
    const port = address.port;
    await new Promise<void>((resolve, reject) => listener.close(err => err ? reject(err) : resolve()));
    directory = await mkdtemp(join(tmpdir(), "english-refresh-test-"));
    processHandle = spawn(process.env.TEST_MONGOD_PATH, ["--dbpath", directory, "--bind_ip", "127.0.0.1", "--port", String(port), "--replSet", "refreshTest", "--noauth", "--quiet"],
        { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    await new Promise<void>((resolve, reject) => {
        let output = "";
        const timer = setTimeout(() => reject(new Error("Mongo startup timeout")), 25000);
        const finish = (error?: Error) => { clearTimeout(timer); error ? reject(error) : resolve(); };
        processHandle!.once("error", finish);
        processHandle!.once("exit", code => finish(new Error(`Mongo exited ${code}`)));
        const read = (chunk: Buffer) => {
            output = (output + chunk.toString()).slice(-8000);
            if (output.includes("Waiting for connections")) finish();
        };
        processHandle!.stdout!.on("data", read);
        processHandle!.stderr!.on("data", read);
    });
    const bootstrap = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`);
    try {
        await bootstrap.connect();
        await bootstrap.db("admin").command({ replSetInitiate: { _id: "refreshTest", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    } finally { await bootstrap.close(); }
    await mongoose.connect(`mongodb://127.0.0.1:${port}/refresh_integration?replicaSet=refreshTest`, { serverSelectionTimeoutMS: 30000 });
    await RefreshSessionModel.init();
});

after(async () => {
    await mongoose.disconnect();
    if (processHandle && processHandle.exitCode === null && processHandle.signalCode === null) {
        const exited = once(processHandle, "exit");
        processHandle.kill();
        await exited;
    }
    if (directory) {
        const target = resolve(directory);
        assert.equal(dirname(target), resolve(tmpdir()));
        assert.ok(basename(target).startsWith("english-refresh-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
});

test("real Mongo rotation inserts a distinct record, retains ancestors, and keeps absolute expiry", async () => {
    const first = await service.issue("sequential");
    const next = await service.refresh(first.token);
    const original = await repository.find(hashRefreshToken(first.token));
    const successor = await repository.find(hashRefreshToken(next.token));
    assert.ok(original?.revokedAt);
    assert.equal(original.replacedByTokenHash, successor?.tokenHash);
    assert.equal(successor?.expiresAt.getTime(), first.expiresAt.getTime());
    await assert.rejects(service.refresh(first.token), { code: "REFRESH_TOKEN_REUSE_DETECTED" });
    assert.ok((await repository.find(hashRefreshToken(next.token)))?.revokedAt);
});

test("real Mongo concurrent refresh commits at most one successor and reuse revokes it", async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
        const first = await service.issue(`parallel-${attempt}`);
        const results = await Promise.allSettled(Array.from({ length: 4 }, () => service.refresh(first.token)));
        assert.ok(results.filter(r => r.status === "fulfilled").length <= 1);
        const rows = await RefreshSessionModel.find({ userId: `parallel-${attempt}` }).lean();
        assert.ok(rows.every(row => row.revokedAt));
        assert.ok(rows.length <= 2);
    }
});

test("real Mongo logout racing rotation leaves no usable family; user revocation covers separate logins", async () => {
    const first = await service.issue("logout-race");
    await Promise.allSettled([service.refresh(first.token), service.logout(first.token)]);
    assert.equal(await RefreshSessionModel.countDocuments({ userId: "logout-race", revokedAt: null }), 0);
    await service.issue("all-sessions");
    await service.issue("all-sessions");
    await repository.revokeUser("all-sessions");
    assert.equal(await RefreshSessionModel.countDocuments({ userId: "all-sessions", revokedAt: null }), 0);
});

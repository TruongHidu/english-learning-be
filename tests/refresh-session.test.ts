import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import express from "express";
import cookieParser from "cookie-parser";
import { RefreshSessionService, hashRefreshToken } from "../src/services/refresh-session.service.js";
import type { RefreshSession } from "../src/models/refresh-session.model.js";
import type { IRefreshSessionRepository } from "../src/repositories/interfaces/refresh-session.repository.interface.js";
import type { IUserRepository } from "../src/repositories/interfaces/user.repository.interface.js";
import type { AuthService } from "../src/services/auth.service.js";
import { JwtTokenService } from "../src/security/jwt-token-service.js";
import { AuthController } from "../src/controllers/auth.controller.js";
import { createAuthenticate } from "../src/middlewares/authenticate.middleware.js";
import { errorHandler } from "../src/middlewares/error.middleware.js";
import { authOrigin } from "../src/middlewares/auth-origin.middleware.js";
import { refreshCookieOptions } from "../src/config/auth.config.js";

function harness() {
    const rows = new Map<string, RefreshSession>();
    let status = "ACTIVE";
    const repository: IRefreshSessionRepository = {
        async create(row) { rows.set(row.tokenHash, structuredClone(row)); },
        async find(hash) { return structuredClone(rows.get(hash) ?? null); },
        async rotate(hash, successor, now) {
            const old = rows.get(hash);
            if (!old || old.revokedAt || old.expiresAt <= now) return false;
            old.revokedAt = now;
            old.lastUsedAt = now;
            old.replacedByTokenHash = successor.tokenHash;
            rows.set(successor.tokenHash, structuredClone(successor));
            return true;
        },
        async revokeFamily(id) { for (const row of rows.values()) if (row.familyId === id) row.revokedAt = new Date(); },
        async revokeUser(id) { for (const row of rows.values()) if (row.userId === id) row.revokedAt = new Date(); },
    };
    const users = { findById: async () => ({ id: "user", role: "USER", status }) } as unknown as IUserRepository;
    const tokens = new JwtTokenService("test-refresh-secret");
    return { rows, tokens, service: new RefreshSessionService(repository, users, tokens), setStatus: (s: string) => { status = s; } };
}

test("rotation stores hashes, preserves absolute expiry, and reuse revokes the entire family", async () => {
    const h = harness();
    const first = await h.service.issue("user");
    assert.ok(h.rows.has(hashRefreshToken(first.token)));
    assert.ok(!JSON.stringify([...h.rows.values()]).includes(first.token));
    const second = await h.service.refresh(first.token);
    assert.notEqual(second.token, first.token);
    assert.equal(second.expiresAt.getTime(), first.expiresAt.getTime());
    assert.equal(h.tokens.verifyAccessToken(second.accessToken).sub, "user");
    await assert.rejects(h.service.refresh(first.token), { code: "REFRESH_TOKEN_REUSE_DETECTED" });
    await assert.rejects(h.service.refresh(second.token), { code: "REFRESH_TOKEN_REUSE_DETECTED" });
    assert.ok([...h.rows.values()].every(row => row.revokedAt));
});

test("concurrent refresh allows at most one success and revokes its successor on reuse", async () => {
    const h = harness();
    const first = await h.service.issue("user");
    const outcomes = await Promise.allSettled([h.service.refresh(first.token), h.service.refresh(first.token)]);
    assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
    assert.ok([...h.rows.values()].every(row => row.revokedAt));
});

test("expired, unknown, missing tokens and inactive users cannot refresh; logout is idempotent", async () => {
    const h = harness();
    await assert.rejects(h.service.refresh(undefined), { code: "INVALID_REFRESH_TOKEN" });
    await assert.rejects(h.service.refresh("a".repeat(64)), { code: "INVALID_REFRESH_TOKEN" });
    const expired = await h.service.issue("user");
    h.rows.get(hashRefreshToken(expired.token))!.expiresAt = new Date(0);
    await assert.rejects(h.service.refresh(expired.token), { code: "INVALID_REFRESH_TOKEN" });
    for (const status of ["LOCKED", "BANNED"]) {
        h.setStatus(status);
        const token = await h.service.issue("user");
        await assert.rejects(h.service.refresh(token.token), { code: "INVALID_REFRESH_TOKEN" });
    }
    h.setStatus("ACTIVE");
    const token = await h.service.issue("user");
    await h.service.logout(token.token);
    await h.service.logout(token.token);
    await h.service.logout(undefined);
    await assert.rejects(h.service.refresh(token.token));
});

test("HTTP login/refresh/logout cookies, Origin protection, and Bearer API compatibility", async () => {
    const previousOrigin = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = "http://localhost:5173";
    const h = harness();
    const auth = { login: async () => ({ accessToken: h.tokens.generateAccessToken("user", "USER"), user: { id: "user" } }) } as unknown as AuthService;
    const controller = new AuthController(auth, h.service);
    const app = express();
    app.use(express.json(), cookieParser());
    app.post("/auth/login", authOrigin, controller.login);
    app.post("/auth/refresh", authOrigin, controller.refresh);
    app.post("/auth/logout", authOrigin, controller.logout);
    app.get("/protected", createAuthenticate(h.tokens), (_req, res) => { res.json({ success: true }); });
    app.use(errorHandler);
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const post = (path: string, cookie = "", origin = process.env.FRONTEND_URL!) => fetch(base + path, {
        method: "POST", headers: { Origin: origin, Cookie: cookie },
    });
    try {
        assert.equal((await post("/auth/login", "", "https://evil.example")).status, 403);
        const login = await post("/auth/login");
        assert.equal(login.status, 200);
        const cookie = login.headers.get("set-cookie")!;
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /Path=\/api\/v1\/auth/);
        const body = await login.json() as { data: { accessToken: string; user: unknown } };
        assert.deepEqual(Object.keys(body.data).sort(), ["accessToken", "user"]);
        assert.equal(h.rows.size, 1);
        const refreshed = await post("/auth/refresh", cookie.split(";")[0]);
        assert.equal(refreshed.status, 200);
        const refreshBody = await refreshed.json() as { data: { accessToken: string } };
        assert.deepEqual(Object.keys(refreshBody.data), ["accessToken"]);
        assert.equal((await fetch(base + "/protected", { headers: { Authorization: `Bearer ${refreshBody.data.accessToken}` } })).status, 200);
        const expired = new JwtTokenService("test-refresh-secret", "-1s").generateAccessToken("user", "USER");
        assert.equal((await fetch(base + "/protected", { headers: { Authorization: `Bearer ${expired}` } })).status, 401);
        const newCookie = refreshed.headers.get("set-cookie")!.split(";")[0];
        const logout = await post("/auth/logout", newCookie);
        assert.match(logout.headers.get("set-cookie")!, /Expires=Thu, 01 Jan 1970/);
        assert.equal((await post("/auth/logout", newCookie)).status, 200);
        assert.equal((await post("/auth/logout")).status, 200);
        const rejected = await post("/auth/refresh", newCookie);
        assert.equal(rejected.status, 401);
        assert.match(rejected.headers.get("set-cookie")!, /Expires=Thu, 01 Jan 1970/);
    } finally {
        await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
        if (previousOrigin === undefined) delete process.env.FRONTEND_URL;
        else process.env.FRONTEND_URL = previousOrigin;
    }
});

test("SameSite=None requires secure cookies", () => {
    const previous = { ...process.env };
    try {
        process.env.NODE_ENV = "development";
        process.env.AUTH_COOKIE_SAME_SITE = "none";
        process.env.AUTH_COOKIE_SECURE = "false";
        assert.throws(refreshCookieOptions);
        process.env.AUTH_COOKIE_SECURE = "true";
        assert.equal(refreshCookieOptions().secure, true);
    } finally { process.env = previous; }
});

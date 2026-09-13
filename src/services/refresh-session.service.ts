import { createHash, randomBytes, randomUUID } from "node:crypto";
import { AppError } from "../errors/app-error.js";
import { refreshLifetimeMs } from "../config/auth.config.js";
import type { IRefreshSessionRepository } from "../repositories/interfaces/refresh-session.repository.interface.js";
import type { IUserRepository } from "../repositories/interfaces/user.repository.interface.js";
import type { ITokenService } from "../security/token-service.interface.js";

export const hashRefreshToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export class RefreshSessionService {
    constructor(private readonly sessions: IRefreshSessionRepository, private readonly users: IUserRepository,
        private readonly tokens: ITokenService) {}

    async issue(userId: string) {
        const token = randomBytes(48).toString("base64url");
        const expiresAt = new Date(Date.now() + refreshLifetimeMs());
        await this.sessions.create({ userId, tokenHash: hashRefreshToken(token), familyId: randomUUID(),
            createdAt: new Date(), expiresAt, revokedAt: null, replacedByTokenHash: null, lastUsedAt: null });
        return { token, expiresAt };
    }
    async refresh(raw: unknown) {
        if (typeof raw !== "string" || !/^[A-Za-z0-9_-]{64}$/.test(raw)) throw this.invalid();
        const current = await this.sessions.find(hashRefreshToken(raw));
        if (!current || current.expiresAt.getTime() <= Date.now()) throw this.invalid();
        if (current.revokedAt) {
            await this.sessions.revokeFamily(current.familyId);
            throw new AppError("REFRESH_TOKEN_REUSE_DETECTED", "Vui lòng đăng nhập lại", 401);
        }
        const user = await this.users.findById(current.userId);
        if (!user || user.status !== "ACTIVE") {
            await this.sessions.revokeUser(current.userId);
            throw this.invalid();
        }
        const token = randomBytes(48).toString("base64url");
        const accessToken = this.tokens.generateAccessToken(user.id, user.role);
        const now = new Date();
        if (!await this.sessions.rotate(current.tokenHash, { userId: current.userId, familyId: current.familyId,
            expiresAt: current.expiresAt, tokenHash: hashRefreshToken(token),
            createdAt: now, revokedAt: null, replacedByTokenHash: null, lastUsedAt: null }, now)) {
            await this.sessions.revokeFamily(current.familyId);
            throw new AppError("REFRESH_TOKEN_REUSE_DETECTED", "Vui lòng đăng nhập lại", 401);
        }
        return { token, expiresAt: current.expiresAt, accessToken };
    }
    async logout(raw: unknown): Promise<void> {
        if (typeof raw !== "string") return;
        const current = await this.sessions.find(hashRefreshToken(raw));
        if (current) await this.sessions.revokeFamily(current.familyId);
    }
    private invalid() { return new AppError("INVALID_REFRESH_TOKEN", "Vui lòng đăng nhập lại", 401); }
}

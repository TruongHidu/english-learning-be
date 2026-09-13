import type { CookieOptions } from "express";

export const REFRESH_COOKIE = "lingofox.refresh";
export function refreshLifetimeMs(): number {
    const days = Number(process.env.REFRESH_TOKEN_DAYS ?? 30);
    if (!Number.isFinite(days) || days <= 0) throw new Error("Invalid REFRESH_TOKEN_DAYS");
    return days * 86400000;
}
export function refreshCookieOptions(): CookieOptions {
    const sameSite = process.env.AUTH_COOKIE_SAME_SITE ?? "lax";
    const setting = process.env.AUTH_COOKIE_SECURE;
    if (setting !== undefined && setting !== "true" && setting !== "false") throw new Error("Invalid AUTH_COOKIE_SECURE");
    const secure = process.env.NODE_ENV === "production" || setting === "true";
    if (!["lax", "strict", "none"].includes(sameSite) || (sameSite === "none" && !secure)) {
        throw new Error("Invalid auth cookie configuration: SameSite=None requires Secure");
    }
    return { httpOnly: true, secure, sameSite: sameSite as "lax" | "strict" | "none", path: "/api/v1/auth" };
}

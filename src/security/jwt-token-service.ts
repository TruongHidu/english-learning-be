import jwt, { type SignOptions } from "jsonwebtoken";

import { USER_ROLES, type JwtPayload, type UserRole } from "../types/auth.types.js";
import type { ITokenService } from "./token-service.interface.js";

export class JwtTokenService implements ITokenService {
    private readonly secret: string;
    private readonly expiresIn: SignOptions["expiresIn"];

    constructor(secret = process.env.JWT_SECRET, expiresIn = process.env.JWT_EXPIRES_IN ?? "7d") {
        if (!secret) {
            throw new Error("JWT_SECRET is not defined");
        }

        this.secret = secret;
        this.expiresIn = expiresIn as SignOptions["expiresIn"];
    }

    generateAccessToken(userId: string, role: UserRole): string {
        return jwt.sign({ role }, this.secret, {
            subject: userId,
            expiresIn: this.expiresIn,
        });
    }

    verifyAccessToken(token: string): JwtPayload {
        const decoded = jwt.verify(token, this.secret);

        if (
            typeof decoded === "string" ||
            typeof decoded.sub !== "string" ||
            typeof decoded.role !== "string" ||
            !USER_ROLES.includes(decoded.role as UserRole)
        ) {
            throw new Error("Invalid access token payload");
        }

        return { sub: decoded.sub, role: decoded.role as UserRole };
    }
}

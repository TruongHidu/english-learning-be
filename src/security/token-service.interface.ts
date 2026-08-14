import type { JwtPayload, UserRole } from "../types/auth.types.js";

export interface ITokenService {
    generateAccessToken(userId: string, role: UserRole): string;
    verifyAccessToken(token: string): JwtPayload;
}

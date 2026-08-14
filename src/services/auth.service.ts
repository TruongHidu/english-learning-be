import { AppError } from "../errors/app-error.js";
import type { IUserRepository } from "../repositories/interfaces/user.repository.interface.js";
import type { IPasswordHasher } from "../security/password-hasher.interface.js";
import type { ITokenService } from "../security/token-service.interface.js";
import type { LoginInput, RegisterInput, UserRole, UserStatus } from "../types/auth.types.js";

interface RegisterResult {
    user: {
        id: string;
        email: string;
        displayName: string;
        role: UserRole;
        status: UserStatus;
    };
}

interface LoginResult {
    accessToken: string;
    user: {
        id: string;
        email: string;
        displayName: string;
        avatarUrl: string | null;
        role: UserRole;
        stats: {
            currentHeart: number;
            maxHeart: number;
            diamond: number;
            totalXp: number;
            level: number;
            currentStreak: number;
        };
    };
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export class AuthService {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly passwordHasher: IPasswordHasher,
        private readonly tokenService: ITokenService,
    ) {}

    async register(input: RegisterInput): Promise<RegisterResult> {
        const email = normalizeEmail(input.email);
        const existingUser = await this.userRepository.findByEmail(email);

        if (existingUser) {
            throw new AppError("EMAIL_ALREADY_EXISTS", "Email đã được sử dụng", 409);
        }

        const passwordHash = await this.passwordHasher.hash(input.password);
        const user = await this.userRepository.create({
            email,
            passwordHash,
            displayName: input.displayName.trim(),
            authProvider: "LOCAL",
            role: "USER",
            status: "ACTIVE",
            stats: {
                currentHeart: 5,
                maxHeart: 5,
                heartUpdatedAt: new Date(),
                diamond: 0,
                totalXp: 0,
                level: 1,
                currentStreak: 0,
                longestStreak: 0,
            },
        });

        return {
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                status: user.status,
            },
        };
    }

    async login(input: LoginInput): Promise<LoginResult> {
        const user = await this.userRepository.findByEmail(normalizeEmail(input.email));

        if (!user) {
            throw new AppError(
                "INVALID_CREDENTIALS",
                "Email hoặc mật khẩu không chính xác",
                401,
            );
        }

        if (user.status === "LOCKED") {
            throw new AppError("ACCOUNT_LOCKED", "Tài khoản đã bị khóa", 403);
        }

        if (user.status === "BANNED") {
            throw new AppError("ACCOUNT_BANNED", "Tài khoản đã bị cấm", 403);
        }

        if (user.authProvider === "GOOGLE") {
            throw new AppError(
                "GOOGLE_AUTH_REQUIRED",
                "Tài khoản này cần đăng nhập bằng Google",
                403,
            );
        }

        if (!user.passwordHash) {
            throw new AppError(
                "INVALID_CREDENTIALS",
                "Email hoặc mật khẩu không chính xác",
                401,
            );
        }

        const isPasswordValid = await this.passwordHasher.compare(input.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new AppError(
                "INVALID_CREDENTIALS",
                "Email hoặc mật khẩu không chính xác",
                401,
            );
        }

        const accessToken = this.tokenService.generateAccessToken(user.id, user.role);
        await this.userRepository.updateLastLogin(user.id, new Date());

        return {
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl ?? null,
                role: user.role,
                stats: {
                    currentHeart: user.stats.currentHeart,
                    maxHeart: user.stats.maxHeart,
                    diamond: user.stats.diamond,
                    totalXp: user.stats.totalXp,
                    level: user.stats.level,
                    currentStreak: user.stats.currentStreak,
                },
            },
        };
    }
}

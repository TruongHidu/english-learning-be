import { AppError } from "../errors/app-error.js";
import { UserMapper } from "../mappers/user.mapper.js";
import type { IUserRepository } from "../repositories/interfaces/user.repository.interface.js";
import type { IPasswordHasher } from "../security/password-hasher.interface.js";
import type {
    ChangePasswordInput,
    UpdatedUserNameResponse,
    UpdateDisplayNameInput,
    UserProfileResponse,
} from "../types/user.types.js";

export class UserService {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly passwordHasher: IPasswordHasher,
    ) {}

    async getProfile(userId: string): Promise<UserProfileResponse> {
        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
        }

        return UserMapper.toProfileResponse(user);
    }

    async updateDisplayName(
        userId: string,
        input: UpdateDisplayNameInput,
    ): Promise<UpdatedUserNameResponse> {
        const user = await this.userRepository.updateDisplayName(
            userId,
            input.displayName.trim(),
        );

        if (!user) {
            throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
        }

        return UserMapper.toUpdatedNameResponse(user);
    }

    async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new AppError("USER_NOT_FOUND", "Không tìm thấy người dùng", 404);
        }

        if (user.authProvider !== "LOCAL" || !user.passwordHash) {
            throw new AppError(
                "PASSWORD_CHANGE_NOT_AVAILABLE",
                "Tài khoản này không hỗ trợ đổi mật khẩu",
                400,
            );
        }

        const isCurrentPasswordCorrect = await this.passwordHasher.compare(
            input.currentPassword,
            user.passwordHash,
        );

        if (!isCurrentPasswordCorrect) {
            throw new AppError(
                "CURRENT_PASSWORD_INCORRECT",
                "Mật khẩu hiện tại không chính xác",
                400,
            );
        }

        if (input.newPassword === input.currentPassword) {
            throw new AppError(
                "NEW_PASSWORD_SAME_AS_CURRENT",
                "Mật khẩu mới không được giống mật khẩu hiện tại",
                400,
            );
        }

        const newPasswordHash = await this.passwordHasher.hash(input.newPassword);
        await this.userRepository.updatePassword(userId, newPasswordHash);
    }
}

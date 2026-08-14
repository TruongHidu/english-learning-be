import type { IUserRepository } from "../repositories/interfaces/user.repository.interface.js";
import type { IPasswordHasher } from "../security/password-hasher.interface.js";

export class AdminBootstrapService {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly passwordHasher: IPasswordHasher,
    ) {}

    async ensureDefaultAdmin(): Promise<void> {
        const adminEmail = process.env.ADMIN_EMAIL?.trim();
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.warn(
                "Default admin bootstrap skipped: ADMIN_EMAIL or ADMIN_PASSWORD is missing.",
            );
            return;
        }

        const existingUser = await this.userRepository.findByEmail(adminEmail);

        if (existingUser) {
            if (existingUser.role === "ADMIN") {
                console.log("Default admin account already exists.");
            } else {
                console.warn(
                    "Default admin email already exists but does not have ADMIN role.",
                );
            }
            return;
        }

        const passwordHash = await this.passwordHasher.hash(adminPassword);

        await this.userRepository.create({
            email: adminEmail,
            passwordHash,
            displayName: "LingoFox Admin",
            role: "ADMIN",
            status: "ACTIVE",
            authProvider: "LOCAL",
        });

        console.log("Default admin account created successfully.");
    }
}

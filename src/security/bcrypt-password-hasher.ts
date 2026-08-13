import bcrypt from "bcrypt";

import type { IPasswordHasher } from "./password-hasher.interface.js";

export class BcryptPasswordHasher implements IPasswordHasher {
    constructor(private readonly saltRounds = 12) {}

    hash(password: string): Promise<string> {
        return bcrypt.hash(password, this.saltRounds);
    }

    compare(plainPassword: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(plainPassword, hashedPassword);
    }
}

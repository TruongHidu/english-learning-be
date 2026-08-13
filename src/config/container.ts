import { AuthController } from "../controllers/auth.controller.js";
import { UserController } from "../controllers/user.controller.js";
import { createAuthenticate } from "../middlewares/authenticate.middleware.js";
import { UserRepository } from "../repositories/implementations/user.repository.js";
import { BcryptPasswordHasher } from "../security/bcrypt-password-hasher.js";
import { JwtTokenService } from "../security/jwt-token-service.js";
import { AuthService } from "../services/auth.service.js";
import { UserService } from "../services/user.service.js";

const userRepository = new UserRepository();
const passwordHasher = new BcryptPasswordHasher();
const tokenService = new JwtTokenService();

const authService = new AuthService(userRepository, passwordHasher, tokenService);
const userService = new UserService(userRepository, passwordHasher);

export const authController = new AuthController(authService);
export const userController = new UserController(userService);
export const authenticate = createAuthenticate(tokenService);

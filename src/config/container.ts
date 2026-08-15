import { AuthController } from "../controllers/auth.controller.js";
import { CourseController } from "../controllers/course.controller.js";
import { SectionController } from "../controllers/section.controller.js";
import { UserController } from "../controllers/user.controller.js";
import { createAuthenticate } from "../middlewares/authenticate.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { CourseRepository } from "../repositories/implementations/course.repository.js";
import { SectionRepository } from "../repositories/implementations/section.repository.js";
import { UserRepository } from "../repositories/implementations/user.repository.js";
import { BcryptPasswordHasher } from "../security/bcrypt-password-hasher.js";
import { JwtTokenService } from "../security/jwt-token-service.js";
import { AdminBootstrapService } from "../services/admin-bootstrap.service.js";
import { AuthService } from "../services/auth.service.js";
import { CourseService } from "../services/course.service.js";
import { SectionService } from "../services/section.service.js";
import { UserService } from "../services/user.service.js";

const userRepository = new UserRepository();
const courseRepository = new CourseRepository();
const sectionRepository = new SectionRepository();

const passwordHasher = new BcryptPasswordHasher();
const tokenService = new JwtTokenService();

const authService = new AuthService(userRepository, passwordHasher, tokenService);
const userService = new UserService(userRepository, passwordHasher);
const courseService = new CourseService(courseRepository);
const sectionService = new SectionService(sectionRepository, courseRepository);
export const adminBootstrapService = new AdminBootstrapService(userRepository, passwordHasher);

export const authController = new AuthController(authService);
export const userController = new UserController(userService);
export const courseController = new CourseController(courseService);
export const sectionController = new SectionController(sectionService);

export const authenticate = createAuthenticate(tokenService);
export const authorizeAdmin = authorize("ADMIN");

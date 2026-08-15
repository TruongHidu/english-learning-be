import { AuthController } from "../controllers/auth.controller.js";
import { CourseController } from "../controllers/course.controller.js";
import { SectionController } from "../controllers/section.controller.js";
import { UserController } from "../controllers/user.controller.js";
import { AdminTopicController } from "../controllers/admin-topic.controller.js";
import { AdminLessonController } from "../controllers/admin-lesson.controller.js";
import { createAuthenticate } from "../middlewares/authenticate.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { CourseRepository } from "../repositories/implementations/course.repository.js";
import { SectionRepository } from "../repositories/implementations/section.repository.js";
import { UserRepository } from "../repositories/implementations/user.repository.js";
import { TopicRepository } from "../repositories/implementations/topic.repository.js";
import { LessonRepository } from "../repositories/implementations/lesson.repository.js";
import { BcryptPasswordHasher } from "../security/bcrypt-password-hasher.js";
import { JwtTokenService } from "../security/jwt-token-service.js";
import { AdminBootstrapService } from "../services/admin-bootstrap.service.js";
import { AuthService } from "../services/auth.service.js";
import { CourseService } from "../services/course.service.js";
import { SectionService } from "../services/section.service.js";
import { UserService } from "../services/user.service.js";
import { AdminTopicService } from "../services/admin-topic.service.js";
import { AdminLessonService } from "../services/admin-lesson.service.js";

const userRepository = new UserRepository();
const courseRepository = new CourseRepository();
const sectionRepository = new SectionRepository();
const topicRepository = new TopicRepository();
const lessonRepository = new LessonRepository();

const passwordHasher = new BcryptPasswordHasher();
const tokenService = new JwtTokenService();

const authService = new AuthService(userRepository, passwordHasher, tokenService);
const userService = new UserService(userRepository, passwordHasher);
const courseService = new CourseService(courseRepository);
const sectionService = new SectionService(sectionRepository, courseRepository);
const adminTopicService = new AdminTopicService(sectionRepository, topicRepository, lessonRepository);
const adminLessonService = new AdminLessonService(topicRepository, lessonRepository);
export const adminBootstrapService = new AdminBootstrapService(userRepository, passwordHasher);

export const authController = new AuthController(authService);
export const userController = new UserController(userService);
export const courseController = new CourseController(courseService);
export const sectionController = new SectionController(sectionService);
export const adminTopicController = new AdminTopicController(adminTopicService);
export const adminLessonController = new AdminLessonController(adminLessonService);

export const authenticate = createAuthenticate(tokenService);
export const authorizeAdmin = authorize("ADMIN");

import { AuthController } from "../controllers/auth.controller.js";
import { CourseController } from "../controllers/course.controller.js";
import { SectionController } from "../controllers/section.controller.js";
import { UserController } from "../controllers/user.controller.js";
import { AdminTopicController } from "../controllers/admin-topic.controller.js";
import { AdminLessonController } from "../controllers/admin-lesson.controller.js";
import { AdminVocabularyController } from "../controllers/admin-vocabulary.controller.js";
import { AdminQuestionController } from "../controllers/admin-question.controller.js";
import { LearningController } from "../controllers/learning.controller.js";
import { LearningPathController } from "../controllers/learning-path.controller.js";
import { createAuthenticate } from "../middlewares/authenticate.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { CourseRepository } from "../repositories/implementations/course.repository.js";
import { SectionRepository } from "../repositories/implementations/section.repository.js";
import { UserRepository } from "../repositories/implementations/user.repository.js";
import { TopicRepository } from "../repositories/implementations/topic.repository.js";
import { LessonRepository } from "../repositories/implementations/lesson.repository.js";
import { VocabularyRepository } from "../repositories/implementations/vocabulary.repository.js";
import { QuestionRepository } from "../repositories/implementations/question.repository.js";
import { LessonQuestionRepository } from "../repositories/implementations/lesson-question.repository.js";
import { LearningSessionRepository } from "../repositories/implementations/learning-session.repository.js";
import { UserLessonProgressRepository } from "../repositories/implementations/user-lesson-progress.repository.js";
import { BcryptPasswordHasher } from "../security/bcrypt-password-hasher.js";
import { JwtTokenService } from "../security/jwt-token-service.js";
import { AdminBootstrapService } from "../services/admin-bootstrap.service.js";
import { HeartService } from "../services/heart.service.js";
import { AuthService } from "../services/auth.service.js";
import { CourseService } from "../services/course.service.js";
import { SectionService } from "../services/section.service.js";
import { UserService } from "../services/user.service.js";
import { AdminTopicService } from "../services/admin-topic.service.js";
import { AdminLessonService } from "../services/admin-lesson.service.js";
import { AdminVocabularyService } from "../services/admin-vocabulary.service.js";
import { AdminQuestionService } from "../services/admin-question.service.js";
import { LearningService } from "../services/learning.service.js";
import { LearningPathService } from "../services/learning-path.service.js";
import { LearningProgressionService } from "../services/learning-progression.service.js";
import { CloudinaryMediaStorage } from "../storage/cloudinary-media-storage.js";

const userRepository = new UserRepository();
const courseRepository = new CourseRepository();
const sectionRepository = new SectionRepository();
const topicRepository = new TopicRepository();
const lessonRepository = new LessonRepository();
const vocabularyRepository = new VocabularyRepository();
const questionRepository = new QuestionRepository();
const lessonQuestionRepository = new LessonQuestionRepository();
const userLessonProgressRepository = new UserLessonProgressRepository();
const learningSessionRepository = new LearningSessionRepository();

const passwordHasher = new BcryptPasswordHasher();
const tokenService = new JwtTokenService();
const mediaStorage = new CloudinaryMediaStorage();
const heartService = new HeartService(userRepository);

const authService = new AuthService(userRepository, passwordHasher, tokenService, heartService);
const userService = new UserService(userRepository, passwordHasher, heartService);
const courseService = new CourseService(courseRepository);
const sectionService = new SectionService(sectionRepository, courseRepository);
const adminTopicService = new AdminTopicService(
    sectionRepository,
    topicRepository,
    lessonRepository,
    vocabularyRepository,
);
const adminLessonService = new AdminLessonService(topicRepository, lessonRepository);
const adminVocabularyService = new AdminVocabularyService(
    topicRepository,
    vocabularyRepository,
    questionRepository,
);
const adminQuestionService = new AdminQuestionService(
    questionRepository,
    vocabularyRepository,
    lessonRepository,
    lessonQuestionRepository,
    mediaStorage,
);
const learningProgressionService = new LearningProgressionService(
    courseRepository,
    sectionRepository,
    topicRepository,
    lessonRepository,
    userLessonProgressRepository,
);
const learningService = new LearningService(
    lessonRepository,
    lessonQuestionRepository,
    questionRepository,
    userRepository,
    userLessonProgressRepository,
    learningSessionRepository,
    learningProgressionService,
    heartService,
);
const learningPathService = new LearningPathService(learningProgressionService);

export const adminBootstrapService = new AdminBootstrapService(userRepository, passwordHasher);

export const authController = new AuthController(authService);
export const userController = new UserController(userService);
export const courseController = new CourseController(courseService);
export const sectionController = new SectionController(sectionService);
export const adminTopicController = new AdminTopicController(adminTopicService);
export const adminLessonController = new AdminLessonController(adminLessonService);
export const adminVocabularyController = new AdminVocabularyController(adminVocabularyService);
export const adminQuestionController = new AdminQuestionController(adminQuestionService);
export const learningController = new LearningController(learningService);
export const learningPathController = new LearningPathController(learningPathService);

export const authenticate = createAuthenticate(tokenService);
export const authorizeAdmin = authorize("ADMIN");
export const authorizeUser = authorize("USER");

import { AdminDiamondService } from '../services/admin-diamond.service.js';
import { AdminDiamondController } from '../controllers/admin-diamond.controller.js';
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
import { UserVocabularyRepository } from "../repositories/implementations/user-vocabulary.repository.js";
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
import { UserStatsService } from "../services/user-stats.service.js";
import { AiGenerationService } from "../services/ai-generation.service.js";
import { AiVocabularyService } from "../services/ai-vocabulary.service.js";
import { AiQuestionService } from "../services/ai-question.service.js";
import { AIGenerationRepository } from "../repositories/implementations/ai-generation.repository.js";
import { AiVocabularyCommitRepository } from "../repositories/implementations/ai-vocabulary-commit.repository.js";
import { AiQuestionCommitRepository } from "../repositories/implementations/ai-question-commit.repository.js";
import { GeminiContentGenerator } from "../ai/providers/gemini-content-generator.js";
import { GeminiTranslationEvaluator } from "../ai/providers/gemini-translation-evaluator.js";
import {
    TRANSLATION_GRADING_ENABLED,
    TRANSLATION_TIMEOUT_MS,
} from "./translation-grading.config.js";
import { CloudinaryMediaStorage } from "../storage/cloudinary-media-storage.js";
import { DiamondTransactionRepository } from "../repositories/implementations/diamond-transaction.repository.js";
import { DiamondPackageRepository } from "../repositories/implementations/diamond-package.repository.js";
import { AdminDiamondPackageService } from "../services/admin-diamond-package.service.js";
import { AdminDiamondPackageController } from "../controllers/admin-diamond-package.controller.js";
import { realtimeService } from "../services/realtime.service.js";
import { ShopService } from "../services/shop.service.js";
import { ShopController } from "../controllers/shop.controller.js";
import { PaymentTransactionRepository } from "../repositories/implementations/payment-transaction.repository.js";
import { VnpayGateway } from "../payments/vnpay.gateway.js";
import { getVnpayConfig } from "./vnpay.config.js";
import { PaymentService } from "../services/payment.service.js";
import { PaymentController } from "../controllers/payment.controller.js";
import { PaymentExpirationService } from "../services/payment-expiration.service.js";

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
const userVocabularyRepository = new UserVocabularyRepository();
const diamondTransactionRepository = new DiamondTransactionRepository();
const diamondPackageRepository = new DiamondPackageRepository();
const paymentRepository = new PaymentTransactionRepository();
export const paymentExpirationService = new PaymentExpirationService(paymentRepository);
const paymentGateway = new VnpayGateway(getVnpayConfig);
const paymentService = new PaymentService(paymentRepository, diamondPackageRepository, userRepository, paymentGateway, getVnpayConfig);
export const paymentController = new PaymentController(paymentService);
const aiGenerationRepository = new AIGenerationRepository();
const aiVocabularyCommitRepository = new AiVocabularyCommitRepository();
const aiQuestionCommitRepository = new AiQuestionCommitRepository();

const passwordHasher = new BcryptPasswordHasher();
const tokenService = new JwtTokenService();
const mediaStorage = new CloudinaryMediaStorage();
const heartService = new HeartService(userRepository);
const userStatsService = new UserStatsService(userRepository);
const translationEvaluator = TRANSLATION_GRADING_ENABLED
    ? new GeminiTranslationEvaluator({
          apiKey: process.env.GEMINI_API_KEY,
          modelName: process.env.AI_MODEL || "gemini-2.0-flash",
          timeoutMs: TRANSLATION_TIMEOUT_MS,
      })
    : undefined;

const authService = new AuthService(userRepository, passwordHasher, tokenService, heartService);
const userService = new UserService(userRepository, passwordHasher, heartService, userVocabularyRepository);
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
export const learningService = new LearningService(
    lessonRepository,
    lessonQuestionRepository,
    questionRepository,
    userRepository,
    userLessonProgressRepository,
    learningSessionRepository,
    learningProgressionService,
    heartService,
    userStatsService,
    userVocabularyRepository,
    translationEvaluator,
);
const learningPathService = new LearningPathService(learningProgressionService);
const shopService = new ShopService(userRepository, heartService, diamondTransactionRepository, diamondPackageRepository);

export const adminBootstrapService = new AdminBootstrapService(userRepository, passwordHasher);

import { UserVocabularyService } from "../services/user-vocabulary.service.js";
import { VocabularyReviewService } from "../services/vocabulary-review.service.js";
import { UserVocabularyController } from "../controllers/user-vocabulary.controller.js";
import { VocabularyReviewController } from "../controllers/vocabulary-review.controller.js";

const userVocabularyService = new UserVocabularyService(
    vocabularyRepository,
    userVocabularyRepository
);

const vocabularyReviewService = new VocabularyReviewService(
    userVocabularyRepository,
    vocabularyRepository,
    userStatsService,
    userRepository
);

export const userVocabularyController = new UserVocabularyController(userVocabularyService);
export const vocabularyReviewController = new VocabularyReviewController(vocabularyReviewService);

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
export const shopController = new ShopController(shopService);

import { AdminAiController } from "../controllers/admin-ai.controller.js";

const parsePositiveEnvNumber = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const aiContentGenerator = new GeminiContentGenerator({
    apiKey: process.env.GEMINI_API_KEY,
    modelName: process.env.AI_MODEL || "gemini-2.0-flash",
    timeoutMs: parsePositiveEnvNumber(process.env.AI_TIMEOUT_MS, 30_000),
});

export const aiGenerationService = new AiGenerationService(
    aiContentGenerator,
    aiGenerationRepository,
    topicRepository,
    sectionRepository,
    courseRepository,
    lessonRepository,
    vocabularyRepository,
    aiVocabularyCommitRepository,
    aiQuestionCommitRepository,
    questionRepository,
    lessonQuestionRepository,
    {
        provider: "gemini",
        modelName: process.env.AI_MODEL || "gemini-2.0-flash",
        promptVersion: "v1",
        maxVocabularies: parsePositiveEnvNumber(process.env.AI_MAX_VOCABULARIES, 20),
        maxQuestions: parsePositiveEnvNumber(process.env.AI_MAX_QUESTIONS, 50),
    },
);

export const aiVocabularyService = new AiVocabularyService(aiGenerationService);
export const aiQuestionService = new AiQuestionService(
    aiGenerationService,
    adminQuestionService,
);
export const adminAiController = new AdminAiController(
    aiVocabularyService,
    aiQuestionService,
    aiGenerationService,
);

export const authenticate = createAuthenticate(tokenService);
export const authorizeAdmin = authorize("ADMIN");
export const authorizeUser = authorize("USER");

const adminDiamondService = new AdminDiamondService();
export const adminDiamondController = new AdminDiamondController(adminDiamondService);

const adminDiamondPackageService = new AdminDiamondPackageService(diamondPackageRepository, realtimeService);
export const adminDiamondPackageController = new AdminDiamondPackageController(adminDiamondPackageService);

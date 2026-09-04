import { Router } from "express";
import { authenticate, authorizeAdmin, adminAiController } from "../config/container.js";
import { validate, validateParams, validateQuery } from "../middlewares/validate.middleware.js";
import {
    aiGenerationIdParamSchema,
    aiGenerationListQuerySchema,
    bulkPublishSchema,
    commitQuestionGenerationSchema,
    commitVocabularyGenerationSchema,
    generateQuestionPreviewSchema,
    generateQuestionsSchema,
    generateVocabularyPreviewSchema,
    topicAiVocabularyParamSchema,
} from "../validators/admin-ai.validator.js";

const adminAiRouter = Router();

adminAiRouter.use(authenticate, authorizeAdmin);

adminAiRouter.get(
    "/generations",
    validateQuery(aiGenerationListQuerySchema),
    adminAiController.listGenerations,
);

adminAiRouter.post(
    "/generations/:generationId/vocabularies/commit",
    validateParams(aiGenerationIdParamSchema),
    validate(commitVocabularyGenerationSchema),
    adminAiController.commitVocabularies,
);

adminAiRouter.post(
    "/generations/:generationId/questions/commit",
    validateParams(aiGenerationIdParamSchema),
    validate(commitQuestionGenerationSchema),
    adminAiController.commitQuestions,
);

adminAiRouter.get(
    "/generations/:generationId",
    validateParams(aiGenerationIdParamSchema),
    adminAiController.getGeneration,
);

adminAiRouter.post(
    "/generate-questions",
    validate(generateQuestionsSchema),
    adminAiController.generateQuestions,
);

adminAiRouter.post(
    "/vocabularies/bulk-publish",
    validate(bulkPublishSchema),
    adminAiController.bulkPublishVocabularies,
);

adminAiRouter.post(
    "/questions/bulk-publish",
    validate(bulkPublishSchema),
    adminAiController.bulkPublishQuestions,
);

adminAiRouter.post(
    "/vocabularies/bulk-delete",
    validate(bulkPublishSchema),
    adminAiController.bulkDeleteVocabularies,
);

adminAiRouter.post(
    "/questions/bulk-delete",
    validate(bulkPublishSchema),
    adminAiController.bulkDeleteQuestions,
);

export default adminAiRouter;

export const adminTopicAiRouter = Router();

adminTopicAiRouter.use(authenticate, authorizeAdmin);
adminTopicAiRouter.post(
    "/topics/:topicId/ai/vocabularies/generate",
    validateParams(topicAiVocabularyParamSchema),
    validate(generateVocabularyPreviewSchema),
    adminAiController.generateVocabularyPreview,
);

adminTopicAiRouter.post(
    "/topics/:topicId/ai/questions/generate",
    validateParams(topicAiVocabularyParamSchema),
    validate(generateQuestionPreviewSchema),
    adminAiController.generateQuestionPreview,
);

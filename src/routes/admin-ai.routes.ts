import { Router } from "express";
import { authenticate, authorizeAdmin, adminAiController } from "../config/container.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
    bulkPublishSchema,
    generateQuestionsSchema,
    generateVocabulariesSchema,
} from "../validators/admin-ai.validator.js";

const adminAiRouter = Router();

adminAiRouter.use(authenticate, authorizeAdmin);

adminAiRouter.post(
    "/generate-vocabularies",
    validate(generateVocabulariesSchema),
    adminAiController.generateVocabularies,
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

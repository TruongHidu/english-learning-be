import { Router } from "express";

import {
    authenticate,
    authorizeAdmin,
    adminVocabularyController,
} from "../config/container.js";
import {
    validate,
    validateParams,
    validateQuery,
} from "../middlewares/validate.middleware.js";
import {
    createVocabularySchema,
    topicIdParamSchema,
    updateVocabularySchema,
    updateVocabularyStatusSchema,
    vocabularyIdParamSchema,
    vocabularyListQuerySchema,
} from "../validators/admin-vocabulary.validator.js";

const adminVocabularyRouter = Router();

adminVocabularyRouter.use(authenticate, authorizeAdmin);

// Topics vocabulary routes
adminVocabularyRouter.get(
    "/topics/:topicId/vocabularies",
    validateParams(topicIdParamSchema),
    validateQuery(vocabularyListQuerySchema),
    adminVocabularyController.getByTopic,
);

adminVocabularyRouter.post(
    "/topics/:topicId/vocabularies",
    validateParams(topicIdParamSchema),
    validate(createVocabularySchema),
    adminVocabularyController.create,
);

// Global & specific vocabulary routes
adminVocabularyRouter.get(
    "/vocabularies",
    validateQuery(vocabularyListQuerySchema),
    adminVocabularyController.getAll,
);

adminVocabularyRouter.get(
    "/vocabularies/:vocabularyId",
    validateParams(vocabularyIdParamSchema),
    adminVocabularyController.getById,
);

adminVocabularyRouter.patch(
    "/vocabularies/:vocabularyId",
    validateParams(vocabularyIdParamSchema),
    validate(updateVocabularySchema),
    adminVocabularyController.update,
);

adminVocabularyRouter.patch(
    "/vocabularies/:vocabularyId/status",
    validateParams(vocabularyIdParamSchema),
    validate(updateVocabularyStatusSchema),
    adminVocabularyController.updateStatus,
);

adminVocabularyRouter.delete(
    "/vocabularies/:vocabularyId",
    validateParams(vocabularyIdParamSchema),
    adminVocabularyController.remove,
);

export default adminVocabularyRouter;

import { Router } from "express";

import {
    authenticate,
    authorizeAdmin,
    adminQuestionController,
} from "../config/container.js";
import {
    validate,
    validateParams,
    validateQuery,
} from "../middlewares/validate.middleware.js";
import {
    assignQuestionsSchema,
    createQuestionSchema,
    lessonIdParamSchema,
    lessonQuestionParamSchema,
    questionIdParamSchema,
    questionListQuerySchema,
    reorderQuestionsSchema,
    updateQuestionSchema,
    updateQuestionStatusSchema,
} from "../validators/admin-question.validator.js";
import { topicIdParamSchema } from "../validators/admin-topic.validator.js";
import {
    parseQuestionMultipartPayload,
    requireListeningAudioOnCreate,
    uploadQuestionMedia,
} from "../middlewares/question-media-upload.middleware.js";

const adminQuestionRouter = Router();

adminQuestionRouter.use(authenticate, authorizeAdmin);

// General Question endpoints
adminQuestionRouter.get(
    "/questions",
    validateQuery(questionListQuerySchema),
    adminQuestionController.getAll,
);

adminQuestionRouter.post(
    "/questions",
    uploadQuestionMedia,
    parseQuestionMultipartPayload,
    validate(createQuestionSchema),
    requireListeningAudioOnCreate,
    adminQuestionController.create,
);

adminQuestionRouter.get(
    "/topics/:topicId/questions",
    validateParams(topicIdParamSchema),
    validateQuery(questionListQuerySchema),
    adminQuestionController.getByTopic,
);

adminQuestionRouter.get(
    "/questions/:questionId",
    validateParams(questionIdParamSchema),
    adminQuestionController.getById,
);

adminQuestionRouter.patch(
    "/questions/:questionId",
    validateParams(questionIdParamSchema),
    uploadQuestionMedia,
    parseQuestionMultipartPayload,
    validate(updateQuestionSchema),
    adminQuestionController.update,
);

adminQuestionRouter.patch(
    "/questions/:questionId/status",
    validateParams(questionIdParamSchema),
    validate(updateQuestionStatusSchema),
    adminQuestionController.updateStatus,
);

adminQuestionRouter.delete(
    "/questions/:questionId",
    validateParams(questionIdParamSchema),
    adminQuestionController.remove,
);

// Lesson Question Assignment endpoints
adminQuestionRouter.get(
    "/lessons/:lessonId/questions",
    validateParams(lessonIdParamSchema),
    adminQuestionController.getByLesson,
);

adminQuestionRouter.post(
    "/lessons/:lessonId/questions",
    validateParams(lessonIdParamSchema),
    validate(assignQuestionsSchema),
    adminQuestionController.assignToLesson,
);

adminQuestionRouter.delete(
    "/lessons/:lessonId/questions/:questionId",
    validateParams(lessonQuestionParamSchema),
    adminQuestionController.removeFromLesson,
);

adminQuestionRouter.patch(
    "/lessons/:lessonId/questions/reorder",
    validateParams(lessonIdParamSchema),
    validate(reorderQuestionsSchema),
    adminQuestionController.reorderInLesson,
);

export default adminQuestionRouter;

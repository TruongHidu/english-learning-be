import { Router } from "express";
import {
    authenticate,
    authorizeUser,
    learningPathController,
} from "../config/container.js";
import { validateParams } from "../middlewares/validate.middleware.js";
import {
    learningSectionIdParamSchema,
    learningTopicIdParamSchema,
} from "../validators/learning.validator.js";

const learningPathRouter = Router();

// GET /api/v1/sections/:sectionId/topics
learningPathRouter.get(
    "/sections/:sectionId/topics",
    authenticate,
    authorizeUser,
    validateParams(learningSectionIdParamSchema),
    learningPathController.getTopicsBySection,
);

// GET /api/v1/topics/:topicId/lessons
learningPathRouter.get(
    "/topics/:topicId/lessons",
    authenticate,
    authorizeUser,
    validateParams(learningTopicIdParamSchema),
    learningPathController.getLessonsByTopic,
);

export default learningPathRouter;

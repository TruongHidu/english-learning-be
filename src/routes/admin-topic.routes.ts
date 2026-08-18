import { Router } from "express";

import {
    authenticate,
    authorizeAdmin,
    adminTopicController,
} from "../config/container.js";
import {
    validate,
    validateParams,
} from "../middlewares/validate.middleware.js";
import {
    sectionIdParamSchema,
    topicIdParamSchema,
    createTopicSchema,
    updateTopicSchema,
    updateTopicStatusSchema,
    reorderTopicsSchema,
} from "../validators/admin-topic.validator.js";

const adminTopicRouter = Router();

adminTopicRouter.use(authenticate, authorizeAdmin);

// Routes with /sections/:sectionId/topics
adminTopicRouter.get(
    "/sections/:sectionId/topics",
    validateParams(sectionIdParamSchema),
    adminTopicController.getBySection,
);

adminTopicRouter.post(
    "/sections/:sectionId/topics",
    validateParams(sectionIdParamSchema),
    validate(createTopicSchema),
    adminTopicController.create,
);

adminTopicRouter.patch(
    "/sections/:sectionId/topics/reorder",
    validateParams(sectionIdParamSchema),
    validate(reorderTopicsSchema),
    adminTopicController.reorder,
);

// Routes with /topics/:topicId
adminTopicRouter.get(
    "/topics/:topicId",
    validateParams(topicIdParamSchema),
    adminTopicController.getById,
);

adminTopicRouter.patch(
    "/topics/:topicId",
    validateParams(topicIdParamSchema),
    validate(updateTopicSchema),
    adminTopicController.update,
);

adminTopicRouter.patch(
    "/topics/:topicId/status",
    validateParams(topicIdParamSchema),
    validate(updateTopicStatusSchema),
    adminTopicController.updateStatus,
);

adminTopicRouter.delete(
    "/topics/:topicId",
    validateParams(topicIdParamSchema),
    adminTopicController.remove,
);

export default adminTopicRouter;

import { Router } from "express";

import {
    authenticate,
    authorizeAdmin,
    adminLessonController,
} from "../config/container.js";
import {
    validate,
    validateParams,
} from "../middlewares/validate.middleware.js";
import {
    topicIdParamSchema,
    lessonIdParamSchema,
    createLessonSchema,
    updateLessonSchema,
    updateLessonStatusSchema,
    reorderLessonsSchema,
} from "../validators/admin-lesson.validator.js";

const adminLessonRouter = Router();

adminLessonRouter.use(authenticate, authorizeAdmin);

// Routes with /topics/:topicId/lessons
adminLessonRouter.get(
    "/topics/:topicId/lessons",
    validateParams(topicIdParamSchema),
    adminLessonController.getByTopic,
);

adminLessonRouter.post(
    "/topics/:topicId/lessons",
    validateParams(topicIdParamSchema),
    validate(createLessonSchema),
    adminLessonController.create,
);

adminLessonRouter.patch(
    "/topics/:topicId/lessons/reorder",
    validateParams(topicIdParamSchema),
    validate(reorderLessonsSchema),
    adminLessonController.reorder,
);

// Routes with /lessons/:lessonId
adminLessonRouter.get(
    "/lessons/:lessonId",
    validateParams(lessonIdParamSchema),
    adminLessonController.getById,
);

adminLessonRouter.patch(
    "/lessons/:lessonId",
    validateParams(lessonIdParamSchema),
    validate(updateLessonSchema),
    adminLessonController.update,
);

adminLessonRouter.patch(
    "/lessons/:lessonId/status",
    validateParams(lessonIdParamSchema),
    validate(updateLessonStatusSchema),
    adminLessonController.updateStatus,
);

adminLessonRouter.delete(
    "/lessons/:lessonId",
    validateParams(lessonIdParamSchema),
    adminLessonController.remove,
);

export default adminLessonRouter;

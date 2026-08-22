import { Router } from "express";
import { authenticate, authorizeUser, learningController } from "../config/container.js";
import { validateParams } from "../middlewares/validate.middleware.js";
import { learningLessonIdParamSchema } from "../validators/learning.validator.js";

const learningRouter = Router();

learningRouter.post(
    "/:lessonId/start",
    authenticate,
    authorizeUser,
    validateParams(learningLessonIdParamSchema),
    learningController.startLesson,
);

export default learningRouter;

import { Router } from "express";

import {
    authenticate,
    courseController,
    learningPathController,
} from "../config/container.js";
import { validateParams } from "../middlewares/validate.middleware.js";
import { courseIdParamSchema } from "../validators/course.validator.js";

const courseRouter = Router();

courseRouter.get("/", authenticate, courseController.getPublishedCourses);
courseRouter.get(
    "/:courseId",
    authenticate,
    validateParams(courseIdParamSchema),
    courseController.getPublishedCourseById,
);
courseRouter.get(
    "/:courseId/sections",
    authenticate,
    validateParams(courseIdParamSchema),
    learningPathController.getSectionsByCourse,
);

export default courseRouter;

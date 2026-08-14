import { Router } from "express";

import {
    authenticate,
    authorizeAdmin,
    courseController,
    sectionController,
} from "../config/container.js";
import {
    validate,
    validateParams,
    validateQuery,
} from "../middlewares/validate.middleware.js";
import {
    courseIdParamSchema,
    courseListQuerySchema,
    createCourseSchema,
    updateCourseSchema,
    updateCourseStatusSchema,
} from "../validators/course.validator.js";
import {
    createSectionSchema,
    sectionListQuerySchema,
} from "../validators/section.validator.js";

const adminCourseRouter = Router();

adminCourseRouter.use(authenticate, authorizeAdmin);

adminCourseRouter.get(
    "/",
    validateQuery(courseListQuerySchema),
    courseController.getAdminCourses,
);
adminCourseRouter.get(
    "/:courseId",
    validateParams(courseIdParamSchema),
    courseController.getAdminCourseById,
);
adminCourseRouter.post(
    "/",
    validate(createCourseSchema),
    courseController.createCourse,
);
adminCourseRouter.patch(
    "/:courseId",
    validateParams(courseIdParamSchema),
    validate(updateCourseSchema),
    courseController.updateCourse,
);
adminCourseRouter.patch(
    "/:courseId/status",
    validateParams(courseIdParamSchema),
    validate(updateCourseStatusSchema),
    courseController.updateCourseStatus,
);
adminCourseRouter.delete(
    "/:courseId",
    validateParams(courseIdParamSchema),
    courseController.deactivateCourse,
);

adminCourseRouter.get(
    "/:courseId/sections",
    validateParams(courseIdParamSchema),
    validateQuery(sectionListQuerySchema),
    sectionController.getAdminSectionsByCourse,
);
adminCourseRouter.post(
    "/:courseId/sections",
    validateParams(courseIdParamSchema),
    validate(createSectionSchema),
    sectionController.createSection,
);

export default adminCourseRouter;

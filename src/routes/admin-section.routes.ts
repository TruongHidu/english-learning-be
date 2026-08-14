import { Router } from "express";

import {
    authenticate,
    authorizeAdmin,
    sectionController,
} from "../config/container.js";
import {
    validate,
    validateParams,
} from "../middlewares/validate.middleware.js";
import {
    sectionIdParamSchema,
    updateSectionSchema,
    updateSectionStatusSchema,
} from "../validators/section.validator.js";

const adminSectionRouter = Router();

adminSectionRouter.use(authenticate, authorizeAdmin);

adminSectionRouter.get(
    "/:sectionId",
    validateParams(sectionIdParamSchema),
    sectionController.getAdminSectionById,
);
adminSectionRouter.patch(
    "/:sectionId",
    validateParams(sectionIdParamSchema),
    validate(updateSectionSchema),
    sectionController.updateSection,
);
adminSectionRouter.patch(
    "/:sectionId/status",
    validateParams(sectionIdParamSchema),
    validate(updateSectionStatusSchema),
    sectionController.updateSectionStatus,
);
adminSectionRouter.delete(
    "/:sectionId",
    validateParams(sectionIdParamSchema),
    sectionController.deactivateSection,
);

export default adminSectionRouter;

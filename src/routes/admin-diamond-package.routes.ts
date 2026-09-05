import { Router } from "express";
import { authenticate, adminDiamondPackageController } from "../config/container.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { validate, validateParams } from "../middlewares/validate.middleware.js";
import {
    diamondPackageIdParamSchema,
    createDiamondPackageSchema,
    updateDiamondPackageSchema,
} from "../validators/diamond-package.validator.js";

const adminDiamondPackageRouter = Router();

adminDiamondPackageRouter.use(authenticate, authorize("ADMIN"));

adminDiamondPackageRouter.get("/", adminDiamondPackageController.getPackages);
adminDiamondPackageRouter.get(
    "/:packageId",
    validateParams(diamondPackageIdParamSchema),
    adminDiamondPackageController.getPackageById,
);
adminDiamondPackageRouter.post(
    "/",
    validate(createDiamondPackageSchema),
    adminDiamondPackageController.createPackage,
);
adminDiamondPackageRouter.patch(
    "/:packageId",
    validateParams(diamondPackageIdParamSchema),
    validate(updateDiamondPackageSchema),
    adminDiamondPackageController.updatePackage,
);
adminDiamondPackageRouter.delete(
    "/:packageId",
    validateParams(diamondPackageIdParamSchema),
    adminDiamondPackageController.deletePackage,
);

export default adminDiamondPackageRouter;

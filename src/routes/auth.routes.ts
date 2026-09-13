import { Router } from "express";

import { authController } from "../config/container.js";
import { validate } from "../middlewares/validate.middleware.js";
import { loginSchema, registerSchema } from "../validators/auth.validator.js";
import { authOrigin } from "../middlewares/auth-origin.middleware.js";

const authRouter = Router();

authRouter.post("/register", validate(registerSchema), authController.register);
authRouter.post("/login", authOrigin, validate(loginSchema), authController.login);
authRouter.post("/refresh", authOrigin, authController.refresh);
authRouter.post("/logout", authOrigin, authController.logout);

export default authRouter;

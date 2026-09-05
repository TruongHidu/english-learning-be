import { Router } from "express";
import { authenticate, authorizeAdmin, adminDiamondController } from "../config/container.js";

const adminDiamondRouter = Router();

adminDiamondRouter.use(authenticate, authorizeAdmin);

adminDiamondRouter.get("/users", adminDiamondController.getUsers);
adminDiamondRouter.post("/users/:userId/adjust-diamonds", adminDiamondController.adjustUserDiamonds);
adminDiamondRouter.get("/diamond-transactions", adminDiamondController.getTransactions);

export default adminDiamondRouter;

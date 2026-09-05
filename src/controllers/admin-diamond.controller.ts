import type { NextFunction, Request, Response } from "express";
import type { AdminDiamondService } from "../services/admin-diamond.service.js";

export class AdminDiamondController {
    constructor(private readonly adminDiamondService: AdminDiamondService) {}

    getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = await this.adminDiamondService.getUsers(req.query);
            res.status(200).json({ success: true, message: "Lấy danh sách người dùng thành công", data });
        } catch (error) {
            next(error);
        }
    };

    adjustUserDiamonds = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = String(req.params.userId);
            const { amount, reason } = req.body;
            const adminId = String(req.user!.id);
            const data = await this.adminDiamondService.adjustUserDiamonds(
                adminId,
                userId,
                Number(amount),
                String(reason ?? ""),
            );
            res.status(200).json({ success: true, message: "Điều chỉnh kim cương thành công", data });
        } catch (error) {
            next(error);
        }
    };

    getTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = await this.adminDiamondService.getTransactions(req.query);
            res.status(200).json({ success: true, message: "Lấy lịch sử giao dịch thành công", data });
        } catch (error) {
            next(error);
        }
    };
}

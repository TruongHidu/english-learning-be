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

    getUserDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = String(req.params.userId);
            const user = await this.adminDiamondService.getUserDetail(userId);
            res.status(200).json({ success: true, message: "Lấy thông tin người dùng thành công", data: { user } });
        } catch (error) {
            next(error);
        }
    };

    getUserProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = String(req.params.userId);
            const progress = await this.adminDiamondService.getUserProgress(userId);
            res.status(200).json({ success: true, message: "Lấy tiến độ học thành công", data: progress });
        } catch (error) {
            next(error);
        }
    };

    getUserVocabularies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = String(req.params.userId);
            const data = await this.adminDiamondService.getUserVocabularies(userId, req.query);
            res.status(200).json({ success: true, message: "Lấy danh sách từ vựng thành công", data });
        } catch (error) {
            next(error);
        }
    };

    updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = String(req.params.userId);
            const adminId = String(req.user!.id);
            const { status, reason } = req.body;
            const data = await this.adminDiamondService.updateUserStatus(adminId, userId, status, reason);
            res.status(200).json({ success: true, message: "Cập nhật trạng thái người dùng thành công", data });
        } catch (error) {
            next(error);
        }
    };
}

import type { NextFunction, Request, Response } from "express";
import type { VocabularyReviewService } from "../services/vocabulary-review.service.js";
import type {
  CreateReviewSessionInput,
  SubmitReviewAnswerInput,
} from "../types/vocabulary-review.types.js";

export class VocabularyReviewController {
  constructor(private readonly service: VocabularyReviewService) {}
  dashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        message: "Lấy tổng quan ôn tập thành công",
        data: await this.service.getDashboard(req.user!.id),
      });
    } catch (error) {
      next(error);
    }
  };
  createSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res
        .status(201)
        .json({
          success: true,
          message: "Tạo phiên ôn tập thành công",
          data: await this.service.createSession(
            req.user!.id,
            req.body as CreateReviewSessionInput,
          ),
        });
    } catch (error) {
      next(error);
    }
  };
  getSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        message: "Lấy phiên ôn tập thành công",
        data: await this.service.getSession(
          req.user!.id,
          String(req.params.sessionId),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  answer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        message: "Đã ghi nhận câu trả lời",
        data: await this.service.answer(
          req.user!.id,
          String(req.params.sessionId),
          req.body as SubmitReviewAnswerInput,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  complete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        message: "Hoàn thành phiên ôn tập",
        data: await this.service.complete(
          req.user!.id,
          String(req.params.sessionId),
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  exit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        message: req.body.finish ? "Đã kết thúc phiên" : "Đã lưu phiên",
        data: await this.service.exit(
          req.user!.id,
          String(req.params.sessionId),
          req.body.finish,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  bookmark = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        message: "Đã cập nhật đánh dấu",
        data: await this.service.setBookmark(
          req.user!.id,
          String(req.params.vocabularyId),
          req.body.isBookmarked,
        ),
      });
    } catch (error) {
      next(error);
    }
  };
  setGoal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        message: "Đã cập nhật mục tiêu",
        data: await this.service.setGoal(req.user!.id, req.body),
      });
    } catch (error) {
      next(error);
    }
  };
  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        message: "Lấy thống kê thành công",
        data: await this.service.getReviewStats(req.user!.id),
      });
    } catch (error) {
      next(error);
    }
  };
}

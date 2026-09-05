import type { Request, Response, NextFunction } from "express";
import type { UserVocabularyService } from "../services/user-vocabulary.service.js";

export class UserVocabularyController {
    constructor(private readonly userVocabularyService: UserVocabularyService) {}

    getLearned = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id;
            const data = await this.userVocabularyService.getLearnedVocabulariesGroupedByLesson(userId!);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách từ đã học thành công",
                data,
            });
        } catch (error) {
            next(error);
        }
    };

    excludeFromReview = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id;
            const vocabularyId = req.params.vocabularyId as string;
            const { exclude } = req.body;
            
            const data = await this.userVocabularyService.excludeFromReview(userId!, vocabularyId, exclude);
            res.status(200).json({
                success: true,
                message: exclude ? "Đã loại trừ từ vựng khỏi ôn tập" : "Đã thêm lại từ vựng vào ôn tập",
                data,
            });
        } catch (error) {
            next(error);
        }
    };
}

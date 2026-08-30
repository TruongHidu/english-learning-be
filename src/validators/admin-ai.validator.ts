import { z } from "zod";

export const generateVocabulariesSchema = z.object({
    topicId: z.string({ error: "topicId là bắt buộc" }).min(1, "topicId không được để trống"),
    lessonId: z.string().optional(),
    level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
    quantity: z.number().int().min(1, "Số lượng phải lớn hơn 0").max(50, "Tối đa 50 từ mỗi lần").default(20),
});

export const generateQuestionsSchema = z.object({
    topicId: z.string({ error: "topicId là bắt buộc" }).min(1, "topicId không được để trống"),
    lessonId: z.string().optional(),
    vocabularyId: z.string().optional(),
    vocabularyIds: z.array(z.string()).optional(),
    questionTypes: z.array(z.enum(["MULTIPLE_CHOICE", "FILL_IN_BLANK", "FILL_BLANK", "TRANSLATION", "MATCHING", "REORDER", "ORDER_SENTENCE"])).min(1, "Phải chọn ít nhất 1 loại câu hỏi"),
    quantity: z.number().int().min(1, "Số lượng phải lớn hơn 0").max(50, "Tối đa 50 câu mỗi lần").default(10),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional().default("EASY"),
});

export const bulkPublishSchema = z.object({
    ids: z.array(z.string().min(1)).min(1, "Phải cung cấp ít nhất 1 ID để duyệt"),
});

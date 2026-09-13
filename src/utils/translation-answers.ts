import { z } from "zod";

export const normalizeTranslationAnswer = (value: string): string =>
    value.trim().toLowerCase().replace(/\s+/g, " ");

export const acceptedAnswersSchema = z.array(
    z.string().trim().max(2000, "Mỗi đáp án dịch không được vượt quá 2000 ký tự"),
).max(20, "Chỉ được nhập tối đa 20 đáp án dịch").transform((answers) => {
    const seen = new Set<string>();
    return answers.filter((answer) => {
        const key = normalizeTranslationAnswer(answer);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
});

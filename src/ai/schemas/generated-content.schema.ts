import { z } from "zod";

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => requiredText(max).optional();
const normalizeSemanticText = (value: string): string => value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1");

export const generatedVocabularyCandidateSchema = z
    .object({
        word: requiredText(100),
        meaning: requiredText(300),
        phonetic: optionalText(100),
        partOfSpeech: optionalText(50),
        example: optionalText(500),
        exampleMeaning: optionalText(500),
    })
    .strict();

export const generatedVocabularyCandidatesSchema = z
    .array(generatedVocabularyCandidateSchema)
    .min(1)
    .max(500);

export const vocabularyPreviewCandidateSchema = generatedVocabularyCandidateSchema
    .extend({
        candidateKey: z.string().regex(/^v[1-9]\d*$/, "candidateKey không hợp lệ"),
    })
    .strict();

export const vocabularyPreviewCandidatesSchema = z
    .array(vocabularyPreviewCandidateSchema)
    .max(20);

export const commitVocabularyItemSchema = vocabularyPreviewCandidateSchema;

export const commitVocabularyItemsSchema = z
    .array(commitVocabularyItemSchema)
    .min(1)
    .max(20)
    .superRefine((items, context) => {
        const keys = items.map((item) => item.candidateKey);
        if (new Set(keys).size !== keys.length) {
            context.addIssue({
                code: "custom",
                message: "candidateKey không được trùng nhau",
            });
        }
    });

const vocabularyIdSchema = optionalText(100);
const vocabularyIdsSchema = z.array(requiredText(100)).min(1).max(100).optional();

const commonQuestionFields = {
    vocabularyId: vocabularyIdSchema,
    vocabularyIds: vocabularyIdsSchema,
    content: requiredText(1_000),
    instruction: optionalText(300),
    explanation: optionalText(2_000),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
};

const previewQuestionFields = {
    candidateKey: z.string().regex(/^q[1-9]\d*$/, "candidateKey không hợp lệ"),
};

const generatedOptionSchema = z
    .object({
        content: requiredText(500),
        isCorrect: z.boolean(),
        orderIndex: z.number().int().min(0).max(500),
    })
    .strict();

const generatedMatchingPairSchema = z
    .object({
        vocabularyId: vocabularyIdSchema,
        leftValue: requiredText(300),
        rightValue: requiredText(300),
        orderIndex: z.number().int().min(0).max(500),
    })
    .strict();

const hasUniqueOrderIndexes = (items: Array<{ orderIndex: number }>): boolean =>
    new Set(items.map((item) => item.orderIndex)).size === items.length;

const refineMultipleChoice = (
    question: {
        correctAnswer: string;
        options: Array<{ content: string; isCorrect: boolean; orderIndex: number }>;
    },
    context: z.core.$RefinementCtx,
): void => {
    const normalizedOptions = question.options.map((option) => normalizeSemanticText(option.content));
    if (new Set(normalizedOptions).size !== normalizedOptions.length) {
        context.addIssue({
            code: "custom",
            path: ["options"],
            message: "Các lựa chọn không được trùng nhau",
            input: question.options,
        });
    }
    if (!hasUniqueOrderIndexes(question.options)) {
        context.addIssue({
            code: "custom",
            path: ["options"],
            message: "orderIndex của lựa chọn không được trùng nhau",
            input: question.options,
        });
    }
    const correctOptions = question.options.filter((option) => option.isCorrect);
    if (correctOptions.length !== 1) {
        context.addIssue({
            code: "custom",
            path: ["options"],
            message: "MULTIPLE_CHOICE phải có đúng một đáp án đúng",
            input: question.options,
        });
    }
    if (correctOptions[0]
        && normalizeSemanticText(correctOptions[0].content)
            !== normalizeSemanticText(question.correctAnswer)) {
        context.addIssue({
            code: "custom",
            path: ["correctAnswer"],
            message: "correctAnswer phải trùng với option đúng",
            input: question.correctAnswer,
        });
    }
};

const multipleChoiceShape = {
    type: z.literal("MULTIPLE_CHOICE"),
    ...commonQuestionFields,
    correctAnswer: requiredText(500),
    options: z.array(generatedOptionSchema).min(2).max(6),
};

export const generatedMultipleChoiceSchema = z
    .object(multipleChoiceShape)
    .strict()
    .superRefine(refineMultipleChoice);

const matchingShape = {
    type: z.literal("MATCHING"),
    ...commonQuestionFields,
    matchingPairs: z.array(generatedMatchingPairSchema).min(2).max(20),
};

const refineMatching = (
    question: { matchingPairs: Array<{ leftValue: string; rightValue: string; orderIndex: number }> },
    context: z.core.$RefinementCtx,
): void => {
    const pairKeys = question.matchingPairs.map(
        (pair) => `${normalizeSemanticText(pair.leftValue)}||${normalizeSemanticText(pair.rightValue)}`,
    );
    const leftValues = question.matchingPairs.map((pair) => normalizeSemanticText(pair.leftValue));
    const rightValues = question.matchingPairs.map((pair) => normalizeSemanticText(pair.rightValue));
    if (new Set(pairKeys).size !== pairKeys.length
        || new Set(leftValues).size !== leftValues.length
        || new Set(rightValues).size !== rightValues.length) {
        context.addIssue({
            code: "custom",
            path: ["matchingPairs"],
            message: "Matching pair không được trùng nhau",
            input: question.matchingPairs,
        });
    }
    if (!hasUniqueOrderIndexes(question.matchingPairs)) {
        context.addIssue({
            code: "custom",
            path: ["matchingPairs"],
            message: "orderIndex của matching pair không được trùng nhau",
            input: question.matchingPairs,
        });
    }
};

export const generatedMatchingSchema = z
    .object(matchingShape)
    .strict()
    .superRefine(refineMatching);

const fillBlankShape = {
    type: z.literal("FILL_BLANK"),
    ...commonQuestionFields,
    correctAnswer: requiredText(500),
};

const refineFillBlank = (
    question: { content: string },
    context: z.core.$RefinementCtx,
): void => {
    if (!/(?:_{3,}|\[\s*blank\s*\]|\.\.\.)/i.test(question.content)) {
        context.addIssue({
            code: "custom",
            path: ["content"],
            message: "FILL_BLANK phải có chỗ trống",
            input: question.content,
        });
    }
};

export const generatedFillBlankSchema = z
    .object(fillBlankShape)
    .strict()
    .superRefine(refineFillBlank);

const orderSentenceShape = {
    type: z.literal("ORDER_SENTENCE"),
    ...commonQuestionFields,
    correctAnswer: requiredText(2_000),
    options: z.array(generatedOptionSchema).min(2).max(100),
};

const refineOrderSentence = (
    question: { correctAnswer: string; options: Array<{ content: string; orderIndex: number }> },
    context: z.core.$RefinementCtx,
): void => {
    if (!hasUniqueOrderIndexes(question.options)) {
        context.addIssue({
            code: "custom",
            path: ["options"],
            message: "orderIndex của word chip không được trùng nhau",
            input: question.options,
        });
    }
    const answerTokens = question.correctAnswer.trim().split(/\s+/).map(normalizeSemanticText);
    const optionTokens = question.options.map((option) => normalizeSemanticText(option.content));
    const counts = (tokens: string[]): Map<string, number> => {
        const result = new Map<string, number>();
        for (const token of tokens) result.set(token, (result.get(token) ?? 0) + 1);
        return result;
    };
    const answerCounts = counts(answerTokens);
    const optionCounts = counts(optionTokens);
    const sameTokens = answerCounts.size === optionCounts.size
        && Array.from(answerCounts.entries()).every(([token, total]) => optionCounts.get(token) === total);
    if (!sameTokens) {
        context.addIssue({
            code: "custom",
            path: ["options"],
            message: "Word chips phải khớp với các từ trong correctAnswer",
            input: question.options,
        });
    }
};

export const generatedOrderSentenceSchema = z
    .object(orderSentenceShape)
    .strict()
    .superRefine(refineOrderSentence);

const translationShape = {
    type: z.literal("TRANSLATION"),
    ...commonQuestionFields,
    correctAnswer: requiredText(2_000),
};

export const generatedTranslationSchema = z
    .object(translationShape)
    .strict();

export const generatedQuestionCandidateSchema = z.discriminatedUnion("type", [
    generatedMultipleChoiceSchema,
    generatedMatchingSchema,
    generatedFillBlankSchema,
    generatedOrderSentenceSchema,
    generatedTranslationSchema,
]);

export const generatedQuestionCandidatesSchema = z
    .array(generatedQuestionCandidateSchema)
    .min(1)
    .max(500);

export const questionPreviewCandidateSchema = z.discriminatedUnion("type", [
    z.object({ ...multipleChoiceShape, ...previewQuestionFields }).strict().superRefine(refineMultipleChoice),
    z.object({ ...matchingShape, ...previewQuestionFields }).strict().superRefine(refineMatching),
    z.object({ ...fillBlankShape, ...previewQuestionFields }).strict().superRefine(refineFillBlank),
    z.object({ ...orderSentenceShape, ...previewQuestionFields }).strict().superRefine(refineOrderSentence),
    z.object({ ...translationShape, ...previewQuestionFields }).strict(),
]);

export const questionPreviewCandidatesSchema = z
    .array(questionPreviewCandidateSchema)
    .max(100);

export const commitQuestionItemsSchema = z
    .array(questionPreviewCandidateSchema)
    .min(1)
    .max(100)
    .superRefine((items, context) => {
        const keys = items.map((item) => item.candidateKey);
        if (new Set(keys).size !== keys.length) {
            context.addIssue({
                code: "custom",
                message: "candidateKey không được trùng nhau",
                input: items,
            });
        }
    });

export type GeneratedVocabularyCandidate = z.infer<typeof generatedVocabularyCandidateSchema>;
export type VocabularyPreviewCandidate = z.infer<typeof vocabularyPreviewCandidateSchema>;
export type CommitVocabularyItem = z.infer<typeof commitVocabularyItemSchema>;
export type GeneratedMultipleChoiceCandidate = z.infer<typeof generatedMultipleChoiceSchema>;
export type GeneratedMatchingCandidate = z.infer<typeof generatedMatchingSchema>;
export type GeneratedFillBlankCandidate = z.infer<typeof generatedFillBlankSchema>;
export type GeneratedTranslationCandidate = z.infer<typeof generatedTranslationSchema>;
export type GeneratedQuestionCandidate = z.infer<typeof generatedQuestionCandidateSchema>;
export type QuestionPreviewCandidate = z.infer<typeof questionPreviewCandidateSchema>;
export type CommitQuestionItem = z.infer<typeof questionPreviewCandidateSchema>;

import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptedAnswersSchema } from "../src/utils/translation-answers.js";
import { createQuestionSchema, updateQuestionSchema } from "../src/validators/admin-question.validator.js";
import { generatedTranslationSchema, commitQuestionItemsSchema } from "../src/ai/schemas/generated-content.schema.js";
import { QuestionModel } from "../src/models/question.model.js";
import { contentFingerprint } from "../src/services/lesson-content.service.js";

test("accepted answers trim, remove blanks and duplicates, preserve Vietnamese accents and validate bounds", () => {
    assert.deepEqual(acceptedAnswersSchema.parse([" Tôi thích táo ", "tôi   thích TÁO", "", "  ", "Toi thich tao"]),
        ["Tôi thích táo", "Toi thich tao"]);
    for (const invalid of [[1], ["x".repeat(2001)], Array(21).fill("answer"), "answer"]) {
        assert.equal(acceptedAnswersSchema.safeParse(invalid).success, false);
    }
    assert.deepEqual(updateQuestionSchema.parse({ acceptedAnswers: [" Hi ", "hi"] }).acceptedAnswers, ["Hi"]);
    const input = { type: "TRANSLATION", content: "Hello", correctAnswer: "Xin chào" };
    assert.equal(createQuestionSchema.safeParse({ ...input, acceptedAnswers: [1] }).success, false);
    assert.equal(createQuestionSchema.safeParse(input).success, true);
});

test("only admin preview/commit accepts alternative translations; raw AI cannot approve them", () => {
    const translation = { type: "TRANSLATION", content: "Hello", correctAnswer: "Xin chào", difficulty: "EASY" };
    assert.equal(generatedTranslationSchema.safeParse({ ...translation, acceptedAnswers: ["Chào"] }).success, false);
    const committed = commitQuestionItemsSchema.parse([{ ...translation, candidateKey: "q1", acceptedAnswers: [" Chào ", "chào"] }]);
    assert.deepEqual(committed[0]?.type === "TRANSLATION" && committed[0].acceptedAnswers, ["Chào"]);
    assert.equal(commitQuestionItemsSchema.safeParse([{ ...translation, candidateKey: "q1", acceptedAnswers: ["x".repeat(2001)] }]).success, false);
});

test("Question persistence defaults old translations to [] and clears alternatives on other types", async () => {
    const question = new QuestionModel({ type: "TRANSLATION", content: "Hello", correctAnswer: "Xin chào" });
    await question.validate();
    assert.deepEqual([...question.acceptedAnswers!], []);
    question.acceptedAnswers = [" Chào ", "chào"];
    await question.validate();
    assert.deepEqual([...question.acceptedAnswers!], ["Chào"]);
    question.type = "FILL_BLANK";
    await question.validate();
    assert.equal(question.acceptedAnswers, undefined);
});

test("accepted-answer edits revise lesson fingerprints without revising legacy empty lists", () => {
    const question = new QuestionModel({ type: "TRANSLATION", content: "Hello", correctAnswer: "Xin chào" });
    const oldFingerprint = contentFingerprint(80, [question]);
    question.acceptedAnswers = [];
    assert.equal(contentFingerprint(80, [question]), oldFingerprint);
    question.acceptedAnswers = ["Chào"];
    assert.notEqual(contentFingerprint(80, [question]), oldFingerprint);
});

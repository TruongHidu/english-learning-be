# Chấm câu dịch khi AI gián đoạn

TRANSLATION ưu tiên so sánh `correctAnswer` và `acceptedAnswers` sau khi trim, lowercase và gộp khoảng trắng. Khớp một đáp án được duyệt thì chấm đúng, không gọi AI. Không khớp thì gọi AI nếu tính năng đang bật; ngưỡng điểm AI giữ nguyên.

Khi evaluator ném `AI_PROVIDER_RATE_LIMITED`, `AI_PROVIDER_TIMEOUT`, `AI_PROVIDER_ERROR`, `AI_PROVIDER_INVALID_RESPONSE` hoặc `AI_PROVIDER_NOT_CONFIGURED`, câu được ghi nhận **sai nhưng không mất tim**. `wrongCount`/`wrongQuestionIds` tăng, câu được đánh dấu đã trả lời; điểm và điều kiện vượt bài vẫn tính câu này là sai. Không có tự động chấm lại. Lỗi không thuộc danh sách và lỗi database vẫn được truyền ra ngoài.

`RecordAnswerData.shouldDeductHeart` do server quyết định, độc lập với `isCorrect`. Cùng quyết định này điều khiển giảm `session.heartRemaining` trong atomic update và gọi `HeartService.deductHeart` cho tài khoản. Client không được gửi quyền miễn trừ tim. Cơ chế chống submit trùng và xử lý hoàn thành bài giữ nguyên.

## Schema và API

- Question TRANSLATION có `acceptedAnswers?: string[]`, mặc định đọc là `[]` với dữ liệu cũ. Tối đa 20 chuỗi, tối đa 2000 ký tự/chuỗi sau trim; bỏ chuỗi rỗng và trùng sau chuẩn hóa.
- Admin tạo/sửa Question hoặc sửa TRANSLATION trong AI preview trước commit có thể nhập các đáp án. Raw AI output không được tự thêm trường này. Các loại câu hỏi khác không lưu trường này.
- Đáp án thay thế được copy vào snapshot lúc bắt đầu lesson. API bắt đầu lesson không trả đáp án chính hoặc thay thế. Sau câu sai chỉ trả đáp án chính như trước.
- Submit answer bổ sung `gradingStatus: NORMAL | AI_UNAVAILABLE_FALLBACK` và `heartDeducted: boolean`. Fallback trả response thành công vì đã ghi nhận đáp án; frontend hiển thị đáp án và thông báo miễn trừ tim, cho bấm Tiếp tục.
- Không cần migration dữ liệu cũ. Việc sửa đáp án dùng luồng cập nhật nội dung/version lesson hiện có.

## Cấu hình

`AI_TRANSLATION_GRADING_ENABLED=false` là chủ động tắt AI: chấm theo đáp án đã duyệt, sai vẫn mất tim, `gradingStatus=NORMAL`.

`AI_TRANSLATION_RATE_LIMIT_COOLDOWN_MS=60000` là thời gian tạm ngừng gọi Gemini sau 429. Trong khoảng này evaluator trả lỗi rate limit ngay, không gọi mạng. Đáp án khớp vẫn đúng; đáp án không khớp dùng fallback. Hết thời gian sẽ cho gọi lại, không retry tự động trong một lần submit.

Cooldown nằm trong memory của evaluator instance, không chia sẻ giữa nhiều backend instance và mất khi restart. Mặc định 60 giây không có nghĩa quota chắc chắn phục hồi sau 60 giây; nếu còn 429 thì cooldown bắt đầu lại.

## Kiểm tra triển khai

- Backend: `npm test` — 160 test pass; `npm run build` — TypeScript pass. Repository không có script/config lint backend.
- Frontend: `npm test` — 60 test pass (13 file); `npm run build` — TypeScript và Vite pass; `npm run lint` — không có lỗi, còn hai cảnh báo sẵn có ở `OrderSentenceQuestion.tsx` (dependency onChange) và `UserLearnedVocabularyPage.tsx` (biến err không dùng).
- Vite còn cảnh báo bundle vượt 500 kB. `git diff --check` không báo lỗi whitespace.
- Các test dùng provider giả lập, repository in-memory và Mongoose validation không kết nối database. Chưa chạy integration MongoDB riêng hoặc gọi Gemini thật trong thay đổi này.

## Danh sách file trong thay đổi này

Đường dẫn backend tương đối với `english-learning-be`:

```text
.env.example
src/ai/providers/gemini-translation-evaluator.ts
src/ai/schemas/generated-content.schema.ts
src/config/container.ts
src/config/translation-grading.config.ts
src/mappers/question.mapper.ts
src/models/learning-session.model.ts
src/models/question.model.ts
src/repositories/implementations/ai-question-commit.repository.ts
src/repositories/implementations/learning-session.repository.ts
src/repositories/implementations/question.repository.ts
src/repositories/interfaces/learning-session.repository.interface.ts
src/services/admin-question.service.ts
src/services/learning.service.ts
src/services/lesson-content.service.ts
src/types/learning.types.ts
src/types/question.types.ts
src/utils/translation-answers.ts
src/validators/admin-question.validator.ts
tests/ai-generation.service.test.ts
tests/learning.service.test.ts
tests/translation-answers.test.ts
tests/translation-evaluator.test.ts
docs/translation-grading-fallback.md
```

Đường dẫn frontend tương đối với `english-learning-fe`:

```text
src/components/admin/AcceptedAnswersField.tsx
src/components/admin/AiQuestionPreview.tsx
src/components/admin/AiQuestionPreview.test.tsx
src/components/admin/QuestionFormModal.tsx
src/components/admin/QuestionFormModal.test.tsx
src/components/admin/QuestionPreviewModal.tsx
src/components/lesson/CheckFooter.tsx
src/pages/admin/AdminAIContentPage.tsx
src/pages/admin/AdminLessonDetailPage.tsx
src/pages/admin/AdminQuestionListPage.tsx
src/pages/admin/AdminTopicDetailPage.tsx
src/pages/learn/StartLessonPage.tsx
src/pages/learn/StartLessonPage.test.tsx
src/services/admin-ai.service.ts
src/types/admin-ai.types.ts
src/types/learning.types.ts
src/types/question.types.ts
src/utils/accepted-answers.ts
src/utils/question-media.ts
```

Các thay đổi xử lý 429 của AI tạo nội dung có sẵn trước lượt triển khai này được giữ nguyên; `.env` không được sửa.

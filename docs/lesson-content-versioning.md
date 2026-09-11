# Version nội dung lesson

## Semantics của API

| Field | Ý nghĩa |
| --- | --- |
| `isCompleted` | Đã từng pass lesson; với Topic/Section là milestone hoàn thành toàn bộ bài học tại một thời điểm trước đây. |
| `currentVersion` | `Lesson.publishedVersion`, khởi đầu từ 1. |
| `completedVersion` | Version cao nhất từng pass, lấy từ `LearningSession.lessonVersion`; chưa pass trả 0. |
| `isCurrentVersionCompleted` | Lesson: `completedVersion >= currentVersion`. Topic/Section: tất cả lesson PUBLISHED hiện tại đã hoàn thành version hiện tại và danh sách không rỗng. |
| `hasNewContent` | `isCompleted && !isCurrentVersionCompleted`. |
| `isLocked` | Chưa có quyền truy cập lịch sử và chưa thỏa prerequisite. Lesson hoàn thành không đồng thời bị khóa. |
| `hasAccess`, `accessGrantedAt` | Quyền truy cập đã cấp; thời gian API trả theo ISO 8601. |
| `isNewForUser` | Lesson chưa pass, không nằm trong danh sách tại lần hoàn thành Topic hoặc Section trước đây. |
| `publishedQuestionCount` | Số assignment liên kết đến question PUBLISHED đang tồn tại. `questionCount` người học là alias của số này. |
| `newLessonCount` | Số lesson mới chưa pass trong Topic/Section. |
| `completedLessonCount` | Số lesson hoàn thành **version hiện tại**, nên Topic từng hoàn thành có thể hiển thị 2/3. |

Các field cũ được giữ. `progressStatus=COMPLETED` giữ thành tích lịch sử, kể cả khi `hasNewContent=true`. Frontend hiển thị badge “Bài mới”, “Đã hoàn thành · Có nội dung mới”, CTA “Ôn nội dung mới”. Path tải lại khi window focus; quiz không dùng hook này.

Ví dụ một lesson từng hoàn thành:

```json
{
  "progressStatus": "COMPLETED",
  "isCompleted": true,
  "isLocked": false,
  "hasAccess": true,
  "accessGrantedAt": "2026-09-01T00:00:00.000Z",
  "currentVersion": 2,
  "completedVersion": 1,
  "isCurrentVersionCompleted": false,
  "hasNewContent": true,
  "isNewForUser": false,
  "questionCount": 3,
  "publishedQuestionCount": 3
}
```

Admin nhận `assignedQuestionCount`, `publishedQuestionCount`, `publishedVersion`; `questionCount` admin vẫn là số assignment để tương thích. Client không thể đặt count độc lập. Tạo trực tiếp lesson PUBLISHED bị từ chối với `LESSON_NOT_READY_TO_PUBLISH`: tạo nháp, gán câu hỏi PUBLISHED rồi publish. Readiness truy vấn assignment thực tế.

Một lesson `PUBLISHED` luôn phải còn ít nhất một question `PUBLISHED`. Gỡ assignment, unpublish/inactivate hoặc xóa question cuối cùng bị từ chối với `409 LESSON_REQUIRES_PUBLISHED_QUESTION`. Với question dùng chung, toàn bộ thao tác bị từ chối nếu bất kỳ lesson `PUBLISHED` liên quan nào sẽ trở thành rỗng. Có thể chuyển lesson về DRAFT trước, hoặc thêm/phát hành một question thay thế. Gỡ question DRAFT vẫn được phép.

## Version, snapshot và tính nhất quán

- Fingerprint gồm danh sách question theo thứ tự, ID question, nội dung, hướng dẫn, đáp án, options, matching pairs, dữ liệu từ vựng dùng trong phiên, media URL, giải thích và requiredScore. Không gồm timestamps, ID subdocument, thông tin quản trị hoặc difficulty không được gửi trong quiz.
- Thêm/gỡ/publish/unpublish/sửa question PUBLISHED và reorder làm tăng version nếu fingerprint thực sự đổi. Question dùng chung cập nhật mọi lesson PUBLISHED liên quan. Gán/reorder câu hỏi DRAFT không tăng version nếu thứ tự các câu PUBLISHED không đổi.
- Fingerprint của lần xuất bản gần nhất được giữ khi lesson chuyển DRAFT. Publish lại sau sửa nội dung nháp vẫn tạo version mới. Retry cùng dữ liệu không tạo thêm version.
- MongoDB replica set hoặc sharded cluster hỗ trợ transaction là yêu cầu triển khai, giống các luồng transaction đang có trong dự án. Không fallback sang ghi nhiều document riêng lẻ. MongoDB standalone sẽ từ chối thao tác transaction và không ghi một phần nội dung.
- `transactionalMethods` trong composition root bao trọn validation và mutation admin. Repository question/assignment/lesson cũng bọc cập nhật nội dung bằng `changeLessonContent`; count, fingerprint, version và dữ liệu nguồn commit cùng transaction. Lock document dùng riêng cho admin content để tránh race giữa gán question và sửa trạng thái question. Media cleanup được thực hiện sau commit.
- Start và submit dùng snapshot transaction riêng, không giữ lock admin. Version, questionIds, totalQuestions, requiredScore và questionSnapshots của session được ghi từ cùng một snapshot database. Session cũ tiếp tục chấm bằng snapshot dù question bị sửa/unpublish. Không đọc lại question sống để chấm.
- Pass giữ `firstCompletedAt` và `completedAt` tương thích, tăng `lastCompletedAt`, dùng `$max` cho `completedVersion` để phiên cũ không ghi lùi version. Replay fail không xóa timestamps, version hay quyền truy cập. Công thức XP/diamond không đổi.
- Milestone và quyền mới được lưu khi đọc progression và ngay trong transaction xử lý pass. Milestone lưu membership tại lần hoàn thành đầu tiên, không thay đổi khi curriculum thêm bài.
- Tất cả ghi nội dung phải đi qua repository/service; sửa document trực tiếp bằng công cụ quản trị DB sẽ bỏ qua cơ chế version.

## Migration triển khai

Script: `src/scripts/migrate-lesson-content.ts`. Không tự chạy lúc server startup và không đọc `.env`.

1. Sao lưu MongoDB. Tạm dừng thay đổi curriculum và request học trong toàn bộ thời gian migration. Chạy trước khi mở traffic cho bản mới; nếu nội dung đã thay đổi trước migration thì không thể khôi phục chính xác milestone curriculum cũ từ dữ liệu hiện có.
2. Đặt `MIGRATION_MONGODB_URI` qua môi trường shell từ cấu hình triển khai của bạn (không commit URI).
3. Trong thư mục backend, chạy `npm.cmd run check:lesson-content` để xem số document; mặc định chỉ đọc.
4. Chạy `npm.cmd run migrate:lesson-content` để áp dụng. Script thêm version=1 cho lesson/session còn thiếu; completedVersion=1 cho progress COMPLETED; backfill first/lastCompletedAt từ completedAt (fallback updatedAt); giữ access cho progress không LOCKED và session hiện có; tính lại count, fingerprint; backfill milestone từ curriculum PUBLISHED.
5. Script ghi marker `curriculummigrations/lesson-content-v1` sau khi hoàn tất. Chạy lại sẽ không thay đổi dữ liệu. Nếu bị ngắt trước marker, giữ traffic tạm dừng rồi chạy lại; các update/upsert là idempotent, không xóa/reset thành tích.
6. Bật traffic, kiểm tra path của tài khoản cũ và tài khoản mới.

Migration phần counters/version chạy transaction; database lớn có thể vượt transaction lifetime mặc định. Cần chạy thử trên bản sao dữ liệu và bố trí giới hạn transaction phù hợp trước triển khai. Không chạy script lên dữ liệu thật chỉ để thử.

Rollback: tạm dừng traffic, rollback ứng dụng và giữ nguyên các field/collection bổ sung để không mất thành tích mới. Bản cũ không hiểu quyền/milestone mới nên có thể khóa ngược; giữ các endpoint học tạm dừng cho đến khi redeploy bản sửa. Nếu cần quay về snapshot DB trước migration, phục hồi **toàn bộ** backup vào môi trường riêng và đánh giá dữ liệu học phát sinh; không `$unset` version hoặc xóa milestone trên DB đang hoạt động.

## Kiểm thử

```powershell
npm.cmd test
npm.cmd run build
$env:TEST_MONGOD_PATH = 'C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
npm.cmd run test:content:integration
```

Integration test tự mở replica set mới ở port ngẫu nhiên, thư mục tạm mới, không đọc `.env` và không kết nối DB dự án. Test dừng MongoDB sau chạy, giữ fixture files ở đường dẫn được in để kiểm tra. Kiểm chứng cả rollback, race gán trùng và migration dry-run/apply/rerun.

Frontend: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`. Backend hiện không có script lint riêng; dùng TypeScript strict và test.

Kết quả kiểm chứng: 141 test backend, 14 test tích hợp MongoDB, 45 test frontend đều pass; BE/FE type-check và build thành công. FE lint không có error, còn 2 warning ở `OrderSentenceQuestion.tsx` và `UserLearnedVocabularyPage.tsx` ngoài phạm vi thay đổi. Vite cảnh báo bundle lớn hơn 500 KB. Migration chỉ được áp dụng trên fixture test, chưa chạy trên DB dự án.

## Tệp đã thay đổi

Các đường dẫn dưới đây liệt kê implementation, migration, type/API mapping, UI và tests của thay đổi này.

### english-learning-be

- [docs/learning-progression.md](../docs/learning-progression.md)
- [docs/lesson-content-versioning.md](../docs/lesson-content-versioning.md)
- [package.json](../package.json)
- [src/config/container.ts](../src/config/container.ts)
- [src/mappers/learning.mapper.ts](../src/mappers/learning.mapper.ts)
- [src/mappers/lesson.mapper.ts](../src/mappers/lesson.mapper.ts)
- [src/models/learning-session.model.ts](../src/models/learning-session.model.ts)
- [src/models/lesson.model.ts](../src/models/lesson.model.ts)
- [src/models/user-curriculum-milestone.model.ts](../src/models/user-curriculum-milestone.model.ts)
- [src/models/user-lesson-progress.model.ts](../src/models/user-lesson-progress.model.ts)
- [src/repositories/implementations/curriculum-milestone.repository.ts](../src/repositories/implementations/curriculum-milestone.repository.ts)
- [src/repositories/implementations/learning-session.repository.ts](../src/repositories/implementations/learning-session.repository.ts)
- [src/repositories/implementations/lesson-question.repository.ts](../src/repositories/implementations/lesson-question.repository.ts)
- [src/repositories/implementations/lesson.repository.ts](../src/repositories/implementations/lesson.repository.ts)
- [src/repositories/implementations/question.repository.ts](../src/repositories/implementations/question.repository.ts)
- [src/repositories/implementations/user-lesson-progress.repository.ts](../src/repositories/implementations/user-lesson-progress.repository.ts)
- [src/repositories/interfaces/curriculum-milestone.repository.interface.ts](../src/repositories/interfaces/curriculum-milestone.repository.interface.ts)
- [src/repositories/interfaces/learning-session.repository.interface.ts](../src/repositories/interfaces/learning-session.repository.interface.ts)
- [src/repositories/interfaces/user-lesson-progress.repository.interface.ts](../src/repositories/interfaces/user-lesson-progress.repository.interface.ts)
- [src/scripts/migrate-lesson-content.ts](../src/scripts/migrate-lesson-content.ts)
- [src/services/admin-lesson.service.ts](../src/services/admin-lesson.service.ts)
- [src/services/admin-question.service.ts](../src/services/admin-question.service.ts)
- [src/services/learning-path.service.ts](../src/services/learning-path.service.ts)
- [src/services/learning-progression.service.ts](../src/services/learning-progression.service.ts)
- [src/services/learning.service.ts](../src/services/learning.service.ts)
- [src/services/lesson-content.service.ts](../src/services/lesson-content.service.ts)
- [src/types/learning-path.types.ts](../src/types/learning-path.types.ts)
- [src/types/learning.types.ts](../src/types/learning.types.ts)
- [src/types/lesson.types.ts](../src/types/lesson.types.ts)
- [src/utils/curriculum-transaction.ts](../src/utils/curriculum-transaction.ts)
- [src/validators/admin-lesson.validator.ts](../src/validators/admin-lesson.validator.ts)
- [tests/lesson-content.mongo.integration.ts](../tests/lesson-content.mongo.integration.ts)


### english-learning-fe

- [src/components/admin/LessonFormModal.tsx](../../english-learning-fe/src/components/admin/LessonFormModal.tsx)
- [src/components/course/SectionCard.tsx](../../english-learning-fe/src/components/course/SectionCard.tsx)
- [src/components/learning/LessonPath.css](../../english-learning-fe/src/components/learning/LessonPath.css)
- [src/components/learning/LessonPath.test.tsx](../../english-learning-fe/src/components/learning/LessonPath.test.tsx)
- [src/components/learning/LessonPath.tsx](../../english-learning-fe/src/components/learning/LessonPath.tsx)
- [src/components/learning/LessonStartPopover.tsx](../../english-learning-fe/src/components/learning/LessonStartPopover.tsx)
- [src/hooks/useWindowFocusRefresh.test.tsx](../../english-learning-fe/src/hooks/useWindowFocusRefresh.test.tsx)
- [src/hooks/useWindowFocusRefresh.ts](../../english-learning-fe/src/hooks/useWindowFocusRefresh.ts)
- [src/pages/admin/AdminLessonDetailPage.tsx](../../english-learning-fe/src/pages/admin/AdminLessonDetailPage.tsx)
- [src/pages/learn/CourseSectionsPage.tsx](../../english-learning-fe/src/pages/learn/CourseSectionsPage.tsx)
- [src/pages/learn/SectionTopicsPage.tsx](../../english-learning-fe/src/pages/learn/SectionTopicsPage.tsx)
- [src/pages/learn/TopicLearningPathPage.tsx](../../english-learning-fe/src/pages/learn/TopicLearningPathPage.tsx)
- [src/services/admin-lesson.service.ts](../../english-learning-fe/src/services/admin-lesson.service.ts)
- [src/services/course.service.ts](../../english-learning-fe/src/services/course.service.ts)
- [src/services/learning-path.service.test.ts](../../english-learning-fe/src/services/learning-path.service.test.ts)
- [src/services/learning-path.service.ts](../../english-learning-fe/src/services/learning-path.service.ts)
- [src/types/course.types.ts](../../english-learning-fe/src/types/course.types.ts)
- [src/types/learning-path.types.ts](../../english-learning-fe/src/types/learning-path.types.ts)
- [src/types/learning.types.ts](../../english-learning-fe/src/types/learning.types.ts)
- [src/types/lesson.types.ts](../../english-learning-fe/src/types/lesson.types.ts)
- [src/utils/learning-path.ts](../../english-learning-fe/src/utils/learning-path.ts)

# Learning progression

## Quy tắc mở khóa

- Chỉ nội dung có trạng thái `PUBLISHED` được tính vào lộ trình.
- Section đầu tiên được mở. Section tiếp theo chỉ mở khi tất cả lesson trong các section phía trước có progress `COMPLETED`.
- Trong một section, lesson được xếp theo `topic.orderIndex`, sau đó theo `lesson.orderIndex`. Lesson sau chỉ mở khi tất cả lesson đứng trước đã `COMPLETED`.
- Lesson đầu của topic sau vẫn phụ thuộc lesson cuối của topic trước.
- Section `PUBLISHED` không có lesson `PUBLISHED` được xem là chưa hoàn thành và sẽ khóa section sau.
- Các quy tắc tuần tự trên áp dụng khi chưa có quyền truy cập lịch sử. `UserCurriculumMilestone` lưu quyền đã cấp cho Lesson, Topic và Section; progress `UNLOCKED`, `IN_PROGRESS`, `COMPLETED` cũng là bằng chứng quyền đã có. Quyền này không bị thu hồi khi chèn hoặc đổi thứ tự bài học.
- Milestone Topic/Section chỉ được ghi hoàn thành khi tất cả lesson đã được pass, không suy đoán từ việc hoàn thành một vài lesson. Milestone lưu danh sách lesson tại lần hoàn thành đầu tiên để nhận biết bài mới.
- Lesson mới trong topic đã hoàn thành được mở để học và không khóa lại nội dung phía sau. Người dùng mới vẫn học tuần tự. Việc unpublish/xóa nội dung là quyết định về khả dụng của admin, khác với khóa prerequisite.

## API dành cho FE

Tất cả request cần `Authorization: Bearer <access_token>` của user.

### Danh sách section

`GET /api/v1/courses/:courseId/sections`

Mỗi section có thêm:

```json
{
  "progressStatus": "LOCKED",
  "isLocked": true,
  "isCompleted": false,
  "completedLessonCount": 0,
  "totalLessonCount": 5
}
```

### Danh sách topic

`GET /api/v1/sections/:sectionId/topics`

Mỗi topic có `progressStatus`, `isLocked`, `isCompleted`, `completedLessonCount`, `lessonCount` và `totalLessonCount`. Hai field count cuối cùng cùng giá trị; `lessonCount` được giữ để tương thích response cũ. API trả `403 SECTION_LOCKED` nếu section chưa đủ điều kiện.

### Danh sách lesson theo topic

`GET /api/v1/topics/:topicId/lessons`

Mỗi lesson có `progressStatus`, `isLocked`, `isCompleted`, `currentVersion`, `completedVersion`, `isCurrentVersionCompleted`, `hasNewContent`, `isNewForUser`, `publishedQuestionCount`, `hasAccess`, `accessGrantedAt`. FE dùng `isLocked` để vô hiệu hóa thao tác bắt đầu; backend vẫn luôn kiểm tra lại. `questionCount` trong API người học bằng `publishedQuestionCount`.

### Bắt đầu lesson

`POST /api/v1/lessons/:lessonId/start`

- `403 LESSON_LOCKED`: lesson trước trong cùng section chưa hoàn thành.
- `403 SECTION_LOCKED`: section phía trước chưa hoàn thành.

Request bị từ chối không tạo learning session hoặc progress `LOCKED` mới.

## Trạng thái pass

Việc chuyển sang `COMPLETED` phải do luồng chấm bài phía server thực hiện sau khi `score >= session.requiredScore`; không nhận cờ `passed` hoặc `score` do client tự khai báo. Replay thất bại không làm mất lịch sử pass. Xem [version nội dung và migration](lesson-content-versioning.md) để biết semantics và quy trình triển khai.

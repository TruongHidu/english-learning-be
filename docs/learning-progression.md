# Learning progression

## Quy tắc mở khóa

- Chỉ nội dung có trạng thái `PUBLISHED` được tính vào lộ trình.
- Section đầu tiên được mở. Section tiếp theo chỉ mở khi tất cả lesson trong các section phía trước có progress `COMPLETED`.
- Trong một section, lesson được xếp theo `topic.orderIndex`, sau đó theo `lesson.orderIndex`. Lesson sau chỉ mở khi tất cả lesson đứng trước đã `COMPLETED`.
- Lesson đầu của topic sau vẫn phụ thuộc lesson cuối của topic trước.
- Section `PUBLISHED` không có lesson `PUBLISHED` được xem là chưa hoàn thành và sẽ khóa section sau.
- Trạng thái `LOCKED`, `UNLOCKED` và `IN_PROGRESS` cũ trong database không thể vượt qua prerequisite. Chỉ `COMPLETED` được dùng làm bằng chứng pass.
- Nếu admin chèn hoặc đổi thứ tự prerequisite mới, nội dung phía sau sẽ bị khóa lại cho đến khi prerequisite mới được hoàn thành. `isCompleted` vẫn giữ lịch sử pass, còn `isLocked` quyết định quyền truy cập hiện tại.

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

Mỗi lesson có `progressStatus`, `isLocked` và `isCompleted`. FE dùng `isLocked` để vô hiệu hóa thao tác bắt đầu; backend vẫn luôn kiểm tra lại.

### Bắt đầu lesson

`POST /api/v1/lessons/:lessonId/start`

- `403 LESSON_LOCKED`: lesson trước trong cùng section chưa hoàn thành.
- `403 SECTION_LOCKED`: section phía trước chưa hoàn thành.

Request bị từ chối không tạo learning session hoặc progress `LOCKED` mới.

## Trạng thái pass

Module progression chỉ tin `UserLessonProgress.status === "COMPLETED"`. Việc chuyển sang `COMPLETED` phải do luồng chấm bài phía server thực hiện sau khi `score >= lesson.requiredScore`; không nhận cờ `passed` hoặc `score` do client tự khai báo.

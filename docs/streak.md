# Streak theo ngày địa phương

Streak mặc định tính theo `Asia/Ho_Chi_Minh`. Có thể đặt `STREAK_TIMEZONE` trong
`.env` rồi khởi động lại backend. Không cần đặt biến này nếu dùng giờ Việt Nam.
Giá trị sai múi giờ sẽ được báo ngay khi khởi động; timezone toàn cục không thay đổi.

## Luồng xử lý

- Bài học đạt yêu cầu hoặc phiên ôn tập cập nhật thành công ít nhất một từ gọi
  `applyLessonCompletionStats()` như trước. Bắt đầu bài, bài thất bại và đăng nhập
  không ghi nhận ngày học mới. Ôn tập trả lời sai vẫn được tính nếu cập nhật hợp lệ.
- Hoạt động đầu tiên bắt đầu ở 1; cùng ngày giữ nguyên; ngày liền sau tăng 1;
  bỏ lỡ một ngày hoàn chỉnh thì bắt đầu lại ở 1. Kỷ lục luôn lấy giá trị lớn nhất.
- Timestamp cũ được xử lý sau timestamp mới, hoặc timestamp trong tương lai,
  không tăng streak và không đẩy `lastStudyDate` lùi về trước. XP/diamond vẫn cộng.
- Login, profile, danh sách user của admin và response thưởng đều tính streak
  hiệu lực khi tạo response. Nếu đã bỏ ngày, trả 0. Nếu lần học gần nhất là hôm nay
  hoặc hôm qua, giữ streak. User không có `lastStudyDate` trả 0 cho đến lần học đầu.
- Việc đọc không ghi reset xuống MongoDB. Vì thế số lưu trong database có thể là
  chuỗi trước khi hết hạn, nhưng số trả qua API là streak hiệu lực. `longestStreak`
  và `lastStudyDate` được giữ nguyên. Không có cron job, endpoint mới hay migration.

## Đồng thời và tương thích

Repository dùng một `findOneAndUpdate` có điều kiện so sánh XP, level, diamond,
current/longest streak và `lastStudyDate` với bản đã đọc (compare-and-set).
Nếu có request thay đổi các giá trị đó, lần ghi không khớp; service đọc lại và tính
lại, tối đa 10 lần ghi. Điều kiện dùng cùng default với Mongoose cho field cũ bị
thiếu. Các field tim không bị ghi đè. Không yêu cầu MongoDB replica set/transaction.

Luồng admin điều chỉnh diamond dùng `$inc` và điều kiện đủ số dư để tránh một
`save()` với số dư cũ ghi đè thưởng vừa cộng. Số dư trước/sau và event được lấy từ
kết quả cập nhật. Các lỗi validation, thiếu user, thiếu số dư giữ status cũ.

URL, method, body và các field response hiện có giữ nguyên; công thức thưởng,
level và điều kiện hoàn thành/ôn tập giữ nguyên. Khi xung đột kéo dài vượt giới hạn
retry, service trả lỗi `USER_STATS_UPDATE_CONFLICT` (409) theo error envelope hiện
có, không báo thưởng đã ghi thành công. Lỗi database/network không được tự retry
khi chưa biết lần ghi trước đã thành công hay chưa. Đây không phải cơ chế bảo đảm
exactly-once cho toàn bộ phiên học hoặc toàn bộ giao dịch nhiều collection.

Các streak đã tích lũy theo UTC trước đây được giữ để tránh thay đổi hàng loạt
dữ liệu. Từ hoạt động tiếp theo, so sánh ngày dựa trên timezone cấu hình; không
khôi phục lại toàn bộ lịch sử streak từ các timestamp tổng hợp hiện có.

## Kiểm chứng

- `npm run build`: đạt.
- `npm test`: 83/83 test đạt, không bỏ qua test.
- `npm run test:streak:integration`: 7/7 test đạt trên MongoDB 8.3 standalone.

Trên PowerShell có execution policy chặn npm.ps1, dùng `npm.cmd`.
Chạy integration với đường dẫn tới binary MongoDB của máy, ví dụ:

```powershell
$env:TEST_MONGOD_PATH = 'C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
npm.cmd run test:streak:integration
```

Integration tự tạo server riêng trên cổng localhost trống, database/thư mục tạm,
dừng server và xóa dữ liệu test khi kết thúc. Không đọc `.env` hoặc `MONGODB_URI`
và không kết nối database của ứng dụng.

Các test kiểm tra ranh giới 00:00 Việt Nam, đổi ngày UTC, năm nhuận/DST, ngày bị
bỏ lỡ, timestamp tương lai, profile/login/review/lesson, response fields và giới
hạn retry. Integration kiểm tra sáu hoạt động đồng thời, user legacy, đọc profile
cũ sau khi đã cộng streak, mua tim, admin chỉnh số dư và thứ tự timestamp.

Lệnh `npm test` trước đây trỏ tới file không tồn tại; nay chạy mọi `*.test.js`.
Test SSE được bổ sung phát event `close` để dọn heartbeat timer, không đổi logic
SSE trong production và không xóa assertion cũ.

## File thay đổi

| File | Thay đổi |
| --- | --- |
| `.env.example` | Khai báo timezone mặc định |
| `package.json` | Chạy toàn bộ unit test và thêm lệnh integration |
| `src/config/streak.config.ts` | Đọc và kiểm tra timezone |
| `src/utils/streak.ts` | Hàm tính ngày, chuyển trạng thái, streak hiệu lực |
| `src/services/user-stats.service.ts` | Refactor tính streak, CAS và retry |
| `src/repositories/interfaces/user.repository.interface.ts` | Bổ sung snapshot mong đợi cho cập nhật stats |
| `src/repositories/implementations/user.repository.ts` | Ghi stats có điều kiện nguyên tử |
| `src/mappers/user.mapper.ts` | Trả streak hiệu lực cho profile |
| `src/services/auth.service.ts` | Trả streak hiệu lực cho login |
| `src/services/admin-diamond.service.ts` | Streak hiệu lực và cộng/trừ số dư nguyên tử |
| `src/services/learning.service.ts` | Streak hiệu lực trong response thưởng |
| `src/services/vocabulary-review.service.ts` | Streak hiệu lực trong response ôn tập |
| `tests/user-stats.test.ts` | Unit/service/response regression tests |
| `tests/user-stats.mongo.integration.ts` | Kiểm thử đồng thời trên MongoDB thật |
| `tests/learning.service.test.ts` | Kiểm thử qua UserStatsService thật |
| `tests/diamond-package.test.ts` | Đóng SSE giả để kết thúc test sạch |
| `docs/streak.md` | Tài liệu cấu hình, hành vi, giới hạn và kiểm chứng |

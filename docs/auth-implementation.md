# Báo cáo triển khai access token và refresh token

## Hành vi mới

Đăng nhập vẫn trả `data.accessToken` và `data.user`, đồng thời đặt refresh token
trong cookie HttpOnly. Access token mặc định sống 15 phút và chỉ lưu trong memory
frontend. Refresh token ngẫu nhiên sống tối đa 30 ngày kể từ đăng nhập; database
chỉ chứa SHA-256 hash. Mỗi lần refresh thay token, giữ lịch sử token cũ để phát hiện
reuse và thu hồi toàn bộ family khi có reuse.

`POST /api/v1/auth/refresh` trả access token mới và cookie mới.
`POST /api/v1/auth/logout` thu hồi family, xóa cookie và hỗ trợ gọi lặp lại.
Đổi mật khẩu, khóa/cấm tài khoản thu hồi tất cả refresh session của user.
Bearer JWT và response nghiệp vụ của các API khác được giữ nguyên.

Frontend khôi phục phiên qua refresh và `/users/me` sau khi tải lại trang. Axios
dùng một refresh promise cho các request đồng thời và chỉ retry mỗi request một lần.
Web Locks đồng bộ thao tác cookie giữa các tab trên trình duyệt có hỗ trợ. Token mới
được thông báo tới React; SSE đóng kết nối cũ và kết nối lại bằng token mới.
Logout luôn xóa state local, chờ refresh đang chạy rồi mới thu hồi cookie tại server.

## File thay đổi hoặc bổ sung

Đường dẫn backend tính từ `english-learning-be/`:

- `.env.example`
- `README.md`
- `package.json`
- `package-lock.json`
- `src/app.ts`
- `src/server.ts`
- `src/config/auth.config.ts`
- `src/config/container.ts`
- `src/controllers/auth.controller.ts`
- `src/middlewares/auth-origin.middleware.ts`
- `src/models/refresh-session.model.ts`
- `src/repositories/interfaces/refresh-session.repository.interface.ts`
- `src/repositories/implementations/refresh-session.repository.ts`
- `src/routes/auth.routes.ts`
- `src/security/jwt-token-service.ts`
- `src/services/refresh-session.service.ts`
- `src/services/user.service.ts`
- `src/services/admin-diamond.service.ts`
- `tests/refresh-session.test.ts`
- `tests/refresh-session.mongo.integration.ts`
- `docs/auth-implementation.md`

Đường dẫn frontend tính từ `english-learning-fe/`:

- `README.md`
- `src/api/axios.ts`
- `src/api/refresh.ts`
- `src/api/auth-refresh.test.ts`
- `src/contexts/AuthProvider.tsx`
- `src/contexts/AuthProvider.test.tsx`
- `src/services/auth.service.ts`
- `src/utils/auth-storage.ts`

## Kiểm chứng

- Backend `npm test`: 148/148 test qua, không skip.
- Backend `npm run test:auth:integration`: 3/3 test qua với MongoDB 8.3 replica set tạm riêng.
- Backend `npm run build`: qua; TypeScript strict kiểm tra trong build/test. Backend không có script lint riêng.
- Frontend `npm test`: 54/54 test qua trong 10 file, gồm StrictMode restore và SSE reconnect.
- Frontend `npm run build`: qua, bao gồm TypeScript; Vite cảnh báo bundle lớn hơn 500 kB.
- Frontend `npm run lint`: qua, còn hai cảnh báo trong file không sửa: `UserLearnedVocabularyPage.tsx:231` và `OrderSentenceQuestion.tsx:51`.
- `git diff --check`: qua cho cả hai repository.

Các test MongoDB dùng thư mục tạm riêng, không kết nối database ứng dụng; dữ liệu
test đã được dọn sau khi chạy. Chưa thực hiện deploy hoặc thử end-to-end trên domain production.

## Cấu hình triển khai

```dotenv
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=30
AUTH_COOKIE_SAME_SITE=lax
AUTH_COOKIE_SECURE=false
FRONTEND_URL=http://localhost:5173
```

`REFRESH_TOKEN_DAYS`, `AUTH_COOKIE_SAME_SITE`, `AUTH_COOKIE_SECURE` là biến mới.
Production dùng HTTPS và `NODE_ENV=production` (luôn ép Secure=true).
Nếu frontend/backend khác site, đặt SameSite=`none`, Secure=`true`; hạn chế cookie
bên thứ ba của trình duyệt vẫn có thể chặn phiên. Ưu tiên triển khai cùng site.
Origin của login/refresh/logout phải khớp chính xác `FRONTEND_URL`; Postman/curl cũng
cần gửi header Origin. MongoDB cần replica set để chạy transaction.

File `.env` hiện tại không được sửa: nếu còn `JWT_EXPIRES_IN=7d`, cần đổi sang `15m`
khi triển khai. Phiên cũ chỉ có localStorage sẽ cần đăng nhập lại sau nâng cấp.

Thu hồi refresh token không vô hiệu hóa access JWT đã cấp ngay lập tức: JWT đó vẫn
hoạt động đến hết hạn. SSE giữ cách truyền access token qua query string theo phạm
vi yêu cầu; cần che query token trong access/proxy logs. Khi logout mất mạng, state
local được xóa nhưng cookie/server session có thể vẫn tồn tại. Trình duyệt thiếu
Web Locks có thể gặp reuse protection khi nhiều tab refresh đồng thời.

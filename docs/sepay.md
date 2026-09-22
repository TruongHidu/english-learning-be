# Thanh toán SePay: VietQR + Webhook

SePay và VNPay cùng sử dụng PaymentTransaction, ví kim cương và DiamondTransaction.
Mỗi user chỉ có một payment PENDING, tính chung cả hai phương thức. Không cần
`sepay-pg-node` hoặc SePay API Token cho luồng QR + webhook này.

## Cấu hình backend

Điền các biến môi trường trên server (xem `.env.example`):

```dotenv
SEPAY_BANK_CODE=Vietcombank
SEPAY_ACCOUNT_NUMBER=YOUR_ACCOUNT_NUMBER
SEPAY_ACCOUNT_NAME=YOUR_ACCOUNT_NAME
SEPAY_WEBHOOK_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
SEPAY_PAYMENT_CODE_PREFIX=EL
SEPAY_EXPIRE_MINUTES=15
```

Secret phải có 32–512 ký tự, nên sinh ngẫu nhiên và dùng đúng cùng giá trị trong
Dashboard. Không commit secret vào Git, không gửi secret xuống frontend.
Tên tài khoản có thể để trống; ngân hàng và số tài khoản là bắt buộc.
Prefix gồm 2–5 chữ cái in hoa. Hạn thanh toán từ 1 đến 60 phút.
Config chỉ được kiểm tra khi gọi SePay; thiếu config không chặn API khác hoặc VNPay.

Backend dùng MongoDB transaction: cần replica set (hoặc MongoDB Atlas).

## Migration trước khi bật SePay

Dừng các instance backend đang ghi payment, chạy kiểm tra trên đúng database:

```sh
npm run check:payment-provider-index
npm run migrate:payment-provider-index
```

Lệnh check chỉ đọc. Lệnh migrate tương đương script với `--apply`:

1. Kiểm tra phương thức thanh toán không hợp lệ và nhóm ID provider trùng.
2. Tạo unique index `uniq_payment_provider_transaction` trên
   `{ paymentMethod: 1, providerTransactionId: 1 }`, áp dụng khi ID là string.
3. Sau khi index mới sẵn sàng, xóa index unique cũ chỉ gồm providerTransactionId.

Script không sửa/xóa payment, không xóa index khác và có thể chạy lại.
Nếu dữ liệu không hợp lệ, script dừng để đối soát thủ công; không tự sửa dữ liệu.
Sau đó khởi động lại backend. Không dùng `syncIndexes()` để thay migration.
Nếu production đã prune devDependencies, dùng bản build:

```sh
node dist/scripts/migrate-payment-provider-index.js
node dist/scripts/migrate-payment-provider-index.js --apply
```

Workflow deploy hiện tại không tự chạy migration này. Phải hoàn tất migration
trước khi đưa SePay vào sử dụng: index cũ còn tồn tại sẽ chặn các ID trùng giữa hai provider.

## Cấu hình SePay Dashboard

1. Đăng ký/đăng nhập https://my.sepay.vn và liên kết tài khoản nhận tiền.
2. Cấu hình Công ty → Cấu hình chung → Cấu trúc mã thanh toán:
   bật nhận diện, prefix `EL`, hậu tố tối thiểu/tối đa đều `16`, loại chữ và số.
   Prefix phải giống `SEPAY_PAYMENT_CODE_PREFIX`.
3. Tích hợp → Webhooks → Thêm. Chọn đúng tài khoản đã cấu hình trong backend,
   sự kiện **Tiền vào**, content-type `application/json`.
4. URL: `https://domain/api/v1/payments/sepay/webhook`.
5. Bật chỉ gửi khi có mã thanh toán; lọc prefix `EL`; bật tự động gửi lại.
6. Chọn **HMAC-SHA256**, nhập cùng secret với `SEPAY_WEBHOOK_SECRET`.
7. Cấu hình cảnh báo lỗi webhook và đồng bộ thời gian server.

Luồng này tạo QR dùng số tài khoản gốc và nội dung là mã payment. Chọn tài khoản
ngân hàng phù hợp. Một số loại liên kết ngân hàng yêu cầu VA hoặc nội dung riêng;
cần đối chiếu [quy tắc QR theo ngân hàng](https://developer.sepay.vn/vi/tien-ich-khac/tao-qr-code)
trước khi bật live. Backend hiện chưa thêm VA/TKP hoặc chuỗi nội dung đặc thù.

## API và frontend

Tạo giao dịch (JWT user, body strict, không gửi giá từ client):

```http
POST /api/v1/payments/sepay/checkout
Authorization: Bearer <access_token>
Content-Type: application/json

{"packageId":"<diamond_package_id>"}
```

Response 201:

```json
{
  "success": true,
  "message": "Tạo thanh toán thành công",
  "data": {
    "paymentId": "...",
    "transactionCode": "EL0123456789ABCDEF",
    "paymentMethod": "SEPAY",
    "status": "PENDING",
    "amount": 19000,
    "currency": "VND",
    "qrUrl": "https://vietqr.app/img?...",
    "bankCode": "Vietcombank",
    "accountNumber": "...",
    "accountName": "...",
    "transferContent": "EL0123456789ABCDEF",
    "expiresAt": "2026-09-22T05:15:00.000Z"
  }
}
```

Hiển thị QR, tài khoản, số tiền, nội dung và đếm ngược. Gọi
`GET /api/v1/payments/:paymentId` bằng JWT mỗi 2–3 giây, dừng khi payment hết
PENDING, trang đóng hoặc lỗi xác thực. Khi SUCCESS, cập nhật số kim cương và hiển thị thành công.
Không xác nhận thanh toán từ nút bấm hoặc trạng thái do frontend gửi lên.

Các endpoint dùng chung vẫn giữ nguyên:

- `GET /api/v1/payments/pending`
- `GET /api/v1/payments/me`
- `GET /api/v1/payments/:paymentId`
- `POST /api/v1/payments/:paymentId/retry`, body `{}`
- `POST /api/v1/payments/:paymentId/cancel`, body `{}`

Retry SePay trả dữ liệu QR như checkout, giữ paymentId, mã, giá và kim cương
snapshot; gia hạn từ thời điểm server xử lý. Retry VNPay vẫn trả paymentUrl.
Frontend cần phân nhánh theo QR/paymentUrl. Detail/pending/history trả metadata
chung; để khôi phục QR sau tải lại trang có thể gọi retry khi payment còn PENDING
(thao tác này gia hạn). Các trạng thái SUCCESS/FAILED/CANCELLED/EXPIRED không retry được.

## Webhook, bảo mật và tính nhất quán

Webhook công khai, không dùng JWT. Route được mount trước `express.json()` trong
`app.ts`, dùng `express.raw` giới hạn 64 KB, không giải nén request. Dữ liệu được
giữ nguyên dưới dạng Buffer, xác minh HMAC xong mới parse JSON và validate Zod.

Header: `X-SePay-Signature: sha256=<64 hex>` và `X-SePay-Timestamp: <unix seconds>`.
Chữ ký là HMAC-SHA256 của `timestamp + '.' + raw bytes`; so sánh bằng
`timingSafeEqual`; timestamp phải trong ±300 giây. Thời gian giao dịch ngân hàng
`transactionDate` được hiểu là giờ Việt Nam, khác với timestamp của lần gửi webhook.

Chỉ tiền vào đúng tài khoản, đúng mã, đúng số tiền nguyên VND và payment SEPAY
mới được cộng kim cương. Giá và kim cương lấy từ snapshot đã lưu.
`providerTransactionId = String(payload.id)`, lưu thêm bankCode, referenceCode,
transactionDate và paidAt. Không ghi raw payload/secret vào log.

Repository cập nhật payment bằng điều kiện trạng thái và phương thức, cộng ví,
ghi ledger trong cùng MongoDB transaction. Compound unique index chống một ID
SePay xác nhận nhiều payment; unique reference ledger và điều kiện trạng thái
chống cộng lại cùng payment. Không ghi cờ “đã xử lý” ngoài transaction.
Rollback giữ payment và ví nguyên trạng để webhook retry được. Thông báo realtime
DIAMOND_UPDATED chỉ gửi sau commit.

| Tình huống | HTTP | Kết quả |
| --- | --- | --- |
| Thiếu/sai HMAC, timestamp quá hạn | 401 | Không xử lý |
| JSON/schema không hợp lệ sau khi xác thực | 400 | Không xử lý |
| Đúng chữ ký nhưng tiền ra/sai account/sai amount/không khớp code/provider | 200 `{"success":true}` | Không cộng tiền |
| Xác nhận thành công hoặc đã SUCCESS | 200 `{"success":true}` | Cộng tối đa một lần |
| Lỗi database/transaction, xung đột ID provider | 500 | SePay có thể gửi lại |

Hết hạn/hủy chỉ là trạng thái nội bộ, không chặn ngân hàng nhận tiền.
Tiền hợp lệ đến trễ cho EXPIRED/CANCELLED vẫn chuyển SUCCESS và cộng đúng một lần.
FAILED không tự phục hồi. Sai số tiền, chuyển thêm lần hai hoặc không có mã cần
đối soát thủ công từ lịch sử ngân hàng/SePay; chưa có tự hoàn tiền, cộng phần dư,
webhook inbox hay cron đối soát trong phiên bản này. Cần kiểm tra nhật ký giao dịch
SePay, không chỉ nhìn HTTP 200 (200 chỉ xác nhận đã tiếp nhận webhook).

Tránh đổi tài khoản nhận/secret khi còn payment đang chờ. Bản này đối chiếu tài khoản
theo config hiện tại; phải xử lý các payment cũ trước khi đổi tài khoản nhận.

## Kiểm thử

Trên Windows PowerShell nếu npm.ps1 bị chặn, dùng `npm.cmd` thay `npm`.

```sh
npm run build
npm test
npm run test:payment:integration
```

Integration yêu cầu biến `TEST_MONGOD_PATH` trỏ tới executable mongod. Test tự tạo
replica set localhost với database/thư mục tạm riêng, không đọc `.env` hay truy cập
database ứng dụng. Test bao gồm VNPay, SePay, concurrent webhook, rollback,
late payment, compound index và migration dry-run/apply lặp lại.

Dùng SePay Test mode cùng backend/database test riêng; cấu hình mã, account,
webhook và secret tương ứng môi trường test. Nếu backend chạy local, expose bằng
public HTTPS tunnel (ngrok/cloudflared), rồi điền URL đó trên Dashboard.
Tạo payment, mô phỏng giao dịch với đúng account, code và amount, kiểm tra SUCCESS
và số kim cương. Replay webhook và xác nhận kim cương không tăng lần hai.
Không dùng webhook giả lập với database live; nút Gửi thử có thể dùng ID mẫu `0`
và sẽ bị validator từ chối. Kiểm tra full flow bằng giao dịch mô phỏng ID dương.

## Tài liệu chính thức

- [QR + webhook](https://developer.sepay.vn/vi/sepay-webhooks/tao-qr-va-form-thanh-toan)
- [Payload và phản hồi](https://developer.sepay.vn/vi/sepay-webhooks/tich-hop-webhook)
- [HMAC-SHA256](https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc)
- [Cấu hình mã thanh toán](https://developer.sepay.vn/vi/sepay-webhooks/cau-hinh-ma-thanh-toan)
- [Bảo mật](https://developer.sepay.vn/vi/sepay-webhooks/bao-mat)

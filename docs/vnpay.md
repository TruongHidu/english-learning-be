# Thanh toán VNPay Sandbox

## Cấu hình

Backend dùng VNPay PAY 2.1.0, HMAC-SHA512 theo
[tài liệu chính thức](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html).
Không cần cài thêm dependency. Database phải là MongoDB replica set.

Đặt trong `.env` local (không commit):

```dotenv
VNPAY_TMN_CODE=YOURCODE
VNPAY_HASH_SECRET=your-sandbox-secret
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://your-tunnel.trycloudflare.com/api/v1/payments/vnpay/return
VNPAY_IPN_URL=https://your-tunnel.trycloudflare.com/api/v1/payments/vnpay/ipn
VNPAY_VERSION=2.1.0
VNPAY_EXPIRE_MINUTES=15
PAYMENT_FRONTEND_RESULT_URL=http://localhost:5173/payment/result
FRONTEND_URL=http://localhost:5173
```

Lấy mã merchant và secret từ tài khoản sandbox của bạn; `YOURCODE` là placeholder.
Config được validate khi sử dụng thanh toán: mã merchant 8 ký tự chữ/số,
secret không rỗng, callback HTTPS, thời hạn 1–60 phút. Module hiện giới hạn URL thanh toán
ở sandbox. Thiếu cấu hình trả `PAYMENT_NOT_CONFIGURED` (503) cho checkout;
các API khác của ứng dụng vẫn chạy. IPN gặp lỗi cấu hình trả HTTP 200/RspCode 99.
Secret không được trả trong API hoặc ghi log.

`VNPAY_IPN_URL` là thông tin để đăng ký với VNPay, không tự động đăng ký và không
được gửi làm tham số trong URL checkout. Hãy khai báo đúng URL với VNPay sandbox
(theo giao diện/thông tin hỗ trợ merchant được cấp).

## Chạy local và tunnel

Mở terminal ở thư mục backend, bảo đảm database đang chạy:

```powershell
npm.cmd run dev
```

Mở terminal thứ hai:

```powershell
cloudflared tunnel --url http://127.0.0.1:5000
```

Copy địa chỉ HTTPS được in dưới dòng `Your quick Tunnel has been created`.
Kiểm tra ở terminal thứ ba (thay hostname ví dụ bằng hostname thực):

```powershell
curl.exe http://127.0.0.1:5000/api/v1/health
curl.exe https://your-tunnel.trycloudflare.com/api/v1/health
```

Cả hai phải trả JSON health thành công. Đặt hostname mới vào hai callback trong `.env`,
cập nhật IPN đã đăng ký với VNPay và restart backend. Giữ backend và tunnel chạy trong suốt
giao dịch. Quick Tunnel có thể đổi URL khi restart; các URL thanh toán cũ vẫn chứa Return URL cũ,
vì vậy tạo checkout mới sau khi cập nhật. Không copy dấu `[]()` của Markdown vào terminal.

Frontend vẫn có thể dùng localhost:5173 và gọi API localhost:5000. CORS vẫn giữ
`FRONTEND_URL` cho trình duyệt; callback server-to-server không cần JWT hay thay CORS.
Tunnel công khai backend, nên dùng tài khoản/database test. Không mở tunnel cho cổng MongoDB.
Quick Tunnel không hỗ trợ SSE: khi test thanh toán hãy dùng polling API trạng thái,
hoặc để frontend gọi backend localhost cho các tính năng realtime.

IP được lấy từ `req.ip`/socket, có thể là loopback khi đi qua tunnel. Không tự tin tưởng
`X-Forwarded-For` do client gửi. Nếu triển khai staging, cấu hình Express `trust proxy`
theo đúng proxy tin cậy và hạn chế truy cập trực tiếp origin trước khi dùng IP forwarded.

## API contract

Các API người dùng yêu cầu `Authorization: Bearer <JWT USER>`.
IPN/Return được khai báo trước middleware đăng nhập.

| API | Quyền | Kết quả |
| --- | --- | --- |
| POST /api/v1/payments/vnpay/checkout | USER | Tạo PENDING và paymentUrl |
| GET /api/v1/payments/vnpay/ipn | Public, xác minh chữ ký | HTTP 200 với RspCode/Message |
| GET /api/v1/payments/vnpay/return | Public, xác minh chữ ký | HTTP 302 về frontend |
| GET /api/v1/payments/me?page=1&limit=20 | USER | Lịch sử của chính user |
| GET /api/v1/payments/:paymentId | USER | Trạng thái của payment thuộc user |

Checkout chỉ chấp nhận:

```json
{ "packageId": "MongoDB ObjectId của gói ACTIVE" }
```

Các trường dư như `amount`, `diamondAmount`, `userId` bị từ chối với HTTP 400.
User phải ACTIVE; gói phải ACTIVE, VND, giá nguyên từ 5.000 đến 9.999.999.999 VND.
Backend lấy giá từ database, nhân 100 khi ký, giữ giá gốc trong payment.
Kim cương nhận bằng số cơ bản cộng thưởng. Giá/số lượng được lưu snapshot,
không thay đổi khi admin sửa hoặc ngừng bán gói sau checkout.

Response HTTP 201:

```json
{
  "success": true,
  "message": "Tạo thanh toán thành công",
  "data": {
    "paymentId": "MongoDB ObjectId của payment",
    "transactionCode": "PAY...",
    "status": "PENDING",
    "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...",
    "expiresAt": "2026-09-07T05:15:00.000Z"
  }
}
```

Frontend lưu paymentId rồi redirect trình duyệt tới `paymentUrl`.
Return hợp lệ redirect đến `PAYMENT_FRONTEND_RESULT_URL` với `signatureValid=true`,
`transactionCode` và `paymentId` nếu tìm thấy. Chữ ký sai chỉ có `signatureValid=false`.
Không dùng các tham số redirect để cộng số dư hoặc kết luận thành công.

Frontend lấy `paymentId` trên URL hoặc ID đã lưu để gọi GET trạng thái.
`data` chứa `paymentId`, `transactionCode`, `packageName`, `amount`, `diamondAmount`,
`currency`, `paymentMethod`, `status`, `createdAt`, `paidAt` (nullable), `expiresAt`.
User khác nhận 404; không trả snapshot nội bộ, raw callback hoặc chữ ký.
Lịch sử trả `data: { payments, total, page, limit, totalPages }`, sắp xếp mới nhất trước.
`page` từ 1 đến 100.000, `limit` từ 1 đến 100.

Nếu Return tới trước IPN, hiển thị “Đang xác nhận thanh toán” và poll trạng thái với
khoảng nghỉ, dừng sau thời gian hữu hạn và cho phép xem lại lịch sử. Đóng tab không
hủy giao dịch: IPN vẫn có thể cộng kim cương khi không còn trình duyệt.

## Xác nhận và tính nhất quán

IPN kiểm tra chữ ký, merchant, mã tham chiếu, số tiền, trạng thái và dữ liệu kết quả.
Chỉ `vnp_ResponseCode=00` và `vnp_TransactionStatus=00` cùng mã giao dịch hợp lệ mới
được SUCCESS. `vnp_PayDate` là tùy chọn theo tài liệu VNPay: nếu có thì phải là thời
gian hợp lệ, nếu thiếu thì không chặn xác nhận. Trạng thái thất bại được ghi FAILED,
không cộng kim cương.
Các callback thất bại có mã giao dịch VNPay bằng 0 không lưu 0 vào unique index.

Response IPN: 00 đã ghi nhận, 01 không tìm thấy, 02 đã xác nhận, 04 sai số tiền,
97 sai chữ ký, 99 lỗi dữ liệu/merchant/database. Tất cả dùng HTTP 200 và JSON
`{ "RspCode": "00", "Message": "Confirm Success" }`, không dùng envelope API thông thường.
RspCode 00 nghĩa là backend đã ghi nhận callback, kể cả khi kết quả thanh toán là FAILED.
Mỗi IPN thật được log an toàn dưới nhãn `[VNPAY_IPN]`, chỉ gồm mã tham chiếu, RspCode
và Message; không log query callback, chữ ký hoặc secret. Không có log này nghĩa là
request chưa tới tiến trình backend.

Conditional update PENDING, unique transactionCode/providerTransactionId và unique
TOP_UP theo referenceId bảo vệ callback trùng. SUCCESS + tăng User.stats.diamond +
ghi DiamondTransaction commit cùng nhau. Lỗi sẽ rollback, trả 99 để VNPay thử lại.
Không có fallback standalone. Tài khoản bị khóa sau checkout vẫn được nhận kim cương
nếu thanh toán hợp lệ; tài khoản không còn tồn tại gây rollback để xử lý/đối soát.

`expiresAt` là hạn URL checkout, không phải TTL xóa payment. Không tự đổi PENDING thành
FAILED/EXPIRED chỉ vì chưa nhận IPN. Callback thành công đến muộn vẫn được xử lý.
CANCELLED/EXPIRED được dự phòng trong enum; hiện kết quả không thành công được ghi FAILED
theo yêu cầu. Chưa có job querydr/đối soát hay hoàn tiền tự động; giao dịch PENDING lâu cần
kiểm tra phía VNPay. Không tự gán SUCCESS từ admin hoặc Return URL.

DELETE gói kim cương nay đặt INACTIVE và giữ bản ghi. Admin vẫn thấy gói trong danh sách,
shop không hiển thị gói đó. SSE DELETED được giữ tương thích để client refresh danh sách.
Không có quản lý phương thức thanh toán trong admin.

Mongoose khai báo unique indexes trong model; đảm bảo indexes tạo thành công trước khi test.
Nếu database đã có TOP_UP/PAYMENT trùng referenceId, xử lý đối soát dữ liệu trước khi tạo index;
không xóa/gộp tự động. Khi tắt autoIndex trong môi trường khác, tạo indexes bằng quy trình migration.

## Kiểm thử

```powershell
npm.cmd run build
npm.cmd test
$env:TEST_MONGOD_PATH='C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
npm.cmd run test:payment:integration
```

Thay TEST_MONGOD_PATH bằng bản mongod đã cài. Integration test tự tạo replica set, port
và thư mục tạm riêng, đóng và dọn sau khi chạy; không đọc `.env` hoặc database ứng dụng.
Test xác minh IPN đồng thời, rollback khi lỗi ledger/wallet, mã provider trùng,
snapshot sau ngừng bán gói, quyền sở hữu và callback thất bại. Test không gọi VNPay thật.

Để test sandbox thủ công: lấy gói từ GET /api/v1/shop, gọi checkout bằng JWT USER,
mở paymentUrl trong trình duyệt, dùng thẻ test theo trang sandbox chính thức,
sau đó kiểm tra status SUCCESS, số dư tăng đúng và đúng một TOP_UP ở database test.
Thử hủy/thất bại và trường hợp đóng tab trước Return URL. Nếu PENDING lâu, kiểm tra
URL IPN đăng ký, tunnel và response IPN; không dựa vào giao diện Return để xác nhận tiền.
Mở IPN trực tiếp không có chữ ký sẽ trả 97, không cộng kim cương.

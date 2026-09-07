# Thanh toán VNPay Sandbox qua Return URL

Luồng dành cho dự án môn học: checkout → VNPay → Return URL backend → frontend.
Backend xác minh và cập nhật database trước khi chuyển hướng trình duyệt về frontend.
Không có IPN, queryDR hoặc job đối soát. Nếu đóng tab, mất mạng hoặc Return không tới
backend, giao dịch có thể vẫn PENDING dù đã thanh toán. Không sử dụng luồng này cho production.

## Cấu hình

Backend dùng VNPay PAY 2.1.0 và HMAC-SHA512. Database phải là MongoDB replica set.
Không có cơ chế fallback ghi rời rạc trên MongoDB standalone.

Đặt trong `.env` local (không commit):

```dotenv
VNPAY_TMN_CODE=YOURCODE
VNPAY_HASH_SECRET=your-sandbox-secret
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:5000/api/v1/payments/vnpay/return
VNPAY_VERSION=2.1.0
VNPAY_EXPIRE_MINUTES=15
PAYMENT_FRONTEND_RESULT_URL=http://localhost:5173/payment/result
FRONTEND_URL=http://localhost:5173
```

Thay YOURCODE và secret bằng thông tin sandbox. Không cần cấu hình hoặc đăng ký IPN.
Return URL phải trỏ tới backend, không trỏ thẳng tới frontend. HTTP chỉ được phép cho
localhost, 127.0.0.1 và [::1]; hostname bên ngoài phải dùng HTTPS. URL cấu hình không
chứa credentials, query hoặc hash. Payment URL chỉ chấp nhận sandbox.
Validation cấu hình chạy khi sử dụng thanh toán; checkout thiếu cấu hình trả
PAYMENT_NOT_CONFIGURED (503), API khác vẫn hoạt động. Không trả hoặc log secret.

## Chạy local

Chạy backend `npm.cmd run dev`, frontend `npm.cmd run dev` trong hai terminal.
Với Return URL localhost, trình duyệt phải chạy trên cùng máy với backend.
Không cần tunnel cho cấu hình này. Nếu thử trên máy khác, dùng Return URL HTTPS
trỏ tới backend có thể truy cập từ trình duyệt đó và cấu hình frontend tương ứng.

Nếu dùng Cloudflare Tunnel tùy chọn:
`cloudflared tunnel --url http://127.0.0.1:5000`.
Cập nhật VNPAY_RETURN_URL với hostname HTTPS mới, restart backend và tạo checkout mới;
URL checkout cũ vẫn chứa Return URL cũ. Chỉ dùng database test, không mở cổng MongoDB.
FRONTEND_URL tiếp tục là origin trình duyệt; Return không yêu cầu JWT.
IP client lấy từ req.ip/socket; không tự tin tưởng X-Forwarded-For của client.

## API contract

| API | Quyền | Kết quả |
| --- | --- | --- |
| POST /api/v1/payments/vnpay/checkout | USER | HTTP 201, tạo PENDING và paymentUrl |
| GET /api/v1/payments/vnpay/return | Public, xác minh callback | HTTP 302 sau khi xử lý |
| GET /api/v1/payments/me?page=1&limit=20 | USER | Lịch sử của chính user |
| GET /api/v1/payments/:paymentId | USER | Trạng thái của payment thuộc user |

Endpoint /api/v1/payments/vnpay/ipn đã được loại bỏ (404).
Checkout chỉ nhận `{ "packageId": "MongoDB ObjectId" }`; trường dư bị từ chối.
User và gói phải ACTIVE. Giá VND nguyên từ 5.000 đến 9.999.999.999.
Backend lưu snapshot giá, tên gói và tổng kim cương (cơ bản + thưởng), ký amount nhân 100.
Không đọc lại giá gói khi xác nhận, kể cả khi admin sửa/ngừng bán gói.

Response checkout có envelope `{ success, message, data }`.
Data gồm paymentId, transactionCode, status, paymentUrl, expiresAt.
Frontend lưu paymentId, transactionCode, createdAt trong sessionStorage trước redirect.

Return xử lý callback rồi redirect tới PAYMENT_FRONTEND_RESULT_URL:

| returnResult | signatureValid | Tham số khác |
| --- | --- | --- |
| processed | true | paymentId, transactionCode |
| invalid | false | Không đưa định danh từ payload không hợp lệ |
| not_found | true | Không có paymentId |
| error | true | paymentId và transactionCode nếu đã xác minh và tìm thấy |

signatureValid=false cũng được dùng khi merchant/payload không hợp lệ.
processed nghĩa là backend đã xử lý hoặc payment đã terminal, không có nghĩa là SUCCESS.
Các tham số redirect chỉ giúp điều hướng/cảnh báo; chúng không phải chứng cứ xác thực ở FE.
Không chuyển raw callback, vnp_SecureHash, secret hoặc trạng thái thanh toán sang FE.

Frontend gọi GET detail có JWT một lần và hiển thị trạng thái từ database.
Người dùng khác nhận 404. PaymentDetail gồm paymentId, transactionCode, packageName,
amount, diamondAmount, currency, paymentMethod, status, createdAt, paidAt (nullable), expiresAt.
Lịch sử trả data { payments, total, page, limit, totalPages }, mới nhất trước.
Giới hạn page 1–100.000, limit 1–100. Không lộ snapshot nội bộ hoặc raw callback.

## Xác minh và trạng thái

Kiểm tra HMAC-SHA512, merchant, mã tham chiếu, số tiền, định dạng mã kết quả,
ngày thanh toán nếu có. SUCCESS cần mã giao dịch VNPay dạng số hợp lệ và khác toàn số 0.

| Điều kiện callback hợp lệ | Trạng thái |
| --- | --- |
| ResponseCode=00 và TransactionStatus=00 | SUCCESS |
| ResponseCode=24 | CANCELLED |
| ResponseCode=11 | EXPIRED |
| Các kết quả hợp lệ khác | FAILED |

Sai chữ ký/payload không thay đổi DB. Không tự hết hạn PENDING dựa trên expiresAt:
expiresAt là hạn checkout, không phải TTL xóa payment. Return hợp lệ đến muộn vẫn xử lý.
Payment terminal không bị ghi đè hoặc hạ cấp bởi callback tiếp theo.

Conditional update PENDING và unique transactionCode/providerTransactionId/TOP_UP referenceId
bảo vệ callback lặp và đồng thời. Chỉ SUCCESS cộng User.stats.diamond và ghi DiamondTransaction;
payment, wallet và ledger commit trong cùng MongoDB transaction. Lỗi rollback toàn bộ.
TransactionNo=0 ở kết quả không thành công không được lưu vào unique provider ID.
Tài khoản bị khóa sau checkout vẫn được cộng nếu giao dịch hợp lệ; thiếu wallet gây rollback.
Bảo đảm unique indexes được tạo; dữ liệu trùng cũ cần đối soát trước, không tự xóa/gộp.

FE tải lại shop và số dư một lần khi API trả SUCCESS. Không tự polling chờ callback.
Nút “Kiểm tra lại” chỉ đọc lại DB; không chạy lại ghi nhận thanh toán.
Nếu commit lỗi, có thể truy cập lại URL Return backend có chữ ký gốc trong trình duyệt
để thử xử lý lại sau khi sửa lỗi. Không lưu/forward URL có chữ ký trong frontend hoặc log.
Không có cơ chế retry từ server VNPay trong luồng này.

## Kiểm thử

Backend:

```powershell
npm.cmd run build
npm.cmd test
$env:TEST_MONGOD_PATH='C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe'
npm.cmd run test:payment:integration
```

Integration tạo replica set, port và thư mục tạm riêng, không đọc .env hay dùng database
ứng dụng; đóng và dọn sau khi chạy. Kiểm tra concurrency, rollback wallet/ledger,
provider ID trùng, snapshot và callback không thành công. Không gọi VNPay thật.

Frontend: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`.

Test sandbox thủ công: đăng nhập USER, mua gói tại shop, hoàn tất/hủy/hết hạn tại VNPay.
Kiểm tra redirect về /payment/result, GET detail trả đúng trạng thái, SUCCESS tăng số dư
đúng snapshot và chỉ có một TOP_UP. Reload Return không cộng lần hai.
Thử sửa query FE để xác nhận không thể giả SUCCESS. Thử đóng tab trước Return để quan sát
giới hạn PENDING. Chỉ dùng tài khoản/thẻ test theo tài liệu sandbox.

Tài liệu tham khảo: [VNPay PAY 2.1.0](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html),
[bảng mã kết quả](https://sandbox.vnpayment.vn/apis/docs/bang-ma-loi/).

# English Learning Backend

Backend API cho ứng dụng học tiếng Anh, sử dụng Express, TypeScript và MongoDB.

## Thanh toán kim cương bằng VNPay Sandbox

Mỗi user chỉ có một PENDING. Lịch sử hỗ trợ thanh toán lại và hủy; thời hạn mặc định
10 phút, tự chuyển EXPIRED khi hết hạn. Retry gia hạn từ giờ server, giữ snapshot và mã
giao dịch. Return SUCCESS hợp lệ đến muộn vẫn cộng đúng một lần sau CANCELLED/EXPIRED.
Trước khi chạy bản mới trên DB cũ: dừng backend, chạy `npm.cmd run check:payment-pending`,
sau đó `npm.cmd run migrate:payment-pending` để xử lý PENDING trùng và tạo unique index.

Hướng dẫn cấu hình local, API contract và kiểm thử: [docs/vnpay.md](docs/vnpay.md).

Checkout lưu giá và số kim cương tại thời điểm mua. Return URL xác minh VNPay rồi cập nhật
payment, số dư và lịch sử TOP_UP trong cùng MongoDB transaction trước khi redirect về frontend.
Frontend đọc trạng thái chính thức từ API một lần. Chức năng yêu cầu replica set.
Luồng chỉ dành cho môn học/sandbox: không có IPN, queryDR hoặc đối soát, nên đóng tab/mất mạng
trước Return có thể khiến giao dịch chuyển EXPIRED dù đã thanh toán.

## Yêu cầu môi trường

- Node.js 20+
- MongoDB 8+
- MongoDB phải chạy dưới dạng replica set vì các API commit AI Vocabulary/Question sử dụng transaction nhiều collection.

## Cấu hình `.env`

Tạo file `.env` ở thư mục backend:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/english_learning?replicaSet=rs0
FRONTEND_URL=http://localhost:5173

GEMINI_API_KEY=
AI_MODEL=gemini-2.0-flash
AI_TIMEOUT_MS=30000
AI_MAX_VOCABULARIES=20
AI_MAX_QUESTIONS=50
```

`GEMINI_API_KEY` chỉ được đặt ở backend. Không commit file `.env` hoặc đưa API key vào frontend.

## Cấu hình MongoDB replica set trên Windows

Mở file `mongod.cfg`, thường nằm tại:

```text
C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg
```

Đảm bảo có cấu hình:

```yaml
replication:
  replSetName: rs0
```

Mở PowerShell bằng quyền Administrator và restart service:

```powershell
Restart-Service MongoDB
```

Khởi tạo replica set một lần:

```powershell
mongosh "mongodb://127.0.0.1:27017/?directConnection=true"
```

Sau đó chạy trong `mongosh`:

```javascript
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "127.0.0.1:27017" }
  ]
})
```

Kiểm tra node đã là Primary:

```javascript
rs.status().myState
```

Kết quả mong đợi là `1`. Nếu chưa có `mongosh`, có thể dùng MongoDB Compass hoặc chạy lệnh `replSetInitiate` bằng MongoDB driver trong Node.js.

## Chạy dự án

```powershell
npm install
npm run dev
```

Server mặc định chạy tại `http://localhost:5000`.

Kiểm tra build và test:

```powershell
npm run build
npm test
```

## AI Vocabulary workflow

Tất cả API bên dưới yêu cầu JWT của tài khoản ADMIN:

```http
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

### Tạo danh sách đề xuất (không ghi Vocabulary vào database)

```http
POST /api/v1/admin/topics/:topicId/ai/vocabularies/generate
```

Body:

```json
{
  "count": 10,
  "requirements": "Ưu tiên từ thông dụng trong giao tiếp"
}
```

Response trả về `generationId` và các candidate có `candidateKey`. Candidate chỉ là dữ liệu preview, chưa phải Vocabulary trong database.

### Commit các candidate đã chọn thành DRAFT

```http
POST /api/v1/admin/ai/generations/:generationId/vocabularies/commit
```

Body:

```json
{
  "items": [
    {
      "candidateKey": "v1",
      "word": "apple",
      "meaning": "quả táo",
      "phonetic": "/ˈæp.əl/",
      "partOfSpeech": "noun",
      "example": "I eat an apple.",
      "exampleMeaning": "Tôi ăn một quả táo."
    }
  ]
}
```

Vocabulary được commit sẽ có `status=DRAFT`, `createdByAi=true` và liên kết với `aiGenerationId`. Commit cùng một generation nhiều lần là idempotent.

### Đọc thông tin generation

```http
GET /api/v1/admin/ai/generations/:generationId
GET /api/v1/admin/ai/generations
```

Endpoint cũ `POST /api/v1/admin/ai/generate-vocabularies` đã được ngừng public. Frontend phải sử dụng workflow preview/commit ở trên.

## AI Question workflow

Luồng quản trị chính thức:

```text
Generate candidates → Preview/chọn/sửa → Commit DRAFT → Gán Lesson → Publish
```

Generate và preview không tạo `Question`, không tạo `LessonQuestion` và không tự Publish. Backend chỉ hỗ trợ bốn loại có thể học/chấm điểm: `MULTIPLE_CHOICE`, `FILL_BLANK`, `MATCHING`, `ORDER_SENTENCE`.

### 1. Generate danh sách đề xuất

```http
POST /api/v1/admin/topics/:topicId/ai/questions/generate
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

Body mẫu:

```json
{
  "lessonId": "optional_lesson_id",
  "vocabularyIds": ["vocabulary_id_1", "vocabulary_id_2"],
  "questionTypes": ["MULTIPLE_CHOICE", "FILL_BLANK", "MATCHING", "ORDER_SENTENCE"],
  "count": 8,
  "difficulty": "EASY",
  "requirements": "Dùng ngữ cảnh giao tiếp hằng ngày"
}
```

`topicId` chỉ lấy từ URL. `lessonId` là ngữ cảnh cho prompt và đích gán trên giao diện; riêng API generate không tạo assignment. Nếu Admin đã chọn Lesson, frontend sẽ tự gọi API assignment sau khi commit thành công. Mọi `vocabularyId` trong kết quả AI phải thuộc Topic và nằm trong tập đầu vào được backend cho phép.

Response rút gọn:

```json
{
  "success": true,
  "message": "Tạo đề xuất câu hỏi thành công",
  "data": {
    "generationId": "generation_id",
    "topicId": "topic_id",
    "lessonId": "lesson_id_or_null",
    "requestedCount": 8,
    "generatedCount": 8,
    "acceptedCount": 7,
    "status": "PARTIAL",
    "candidates": [
      {
        "candidateKey": "q1",
        "type": "FILL_BLANK",
        "vocabularyId": "vocabulary_id_1",
        "content": "I eat an ____ every morning.",
        "correctAnswer": "apple",
        "difficulty": "EASY"
      }
    ]
  }
}
```

Candidate có `candidateKey` nhưng chưa có MongoDB Question ID. `COMPLETED` nghĩa là đủ số lượng hợp lệ; `PARTIAL` nghĩa là chỉ một phần output AI vượt qua schema, kiểm tra tham chiếu và dedupe.

### 2. Commit các candidate đã chọn thành Question DRAFT

```http
POST /api/v1/admin/ai/generations/:generationId/questions/commit
Authorization: Bearer <admin_access_token>
Content-Type: application/json
```

Body mẫu:

```json
{
  "items": [
    {
      "candidateKey": "q1",
      "type": "FILL_BLANK",
      "vocabularyId": "vocabulary_id_1",
      "content": "I eat an ____ every morning.",
      "correctAnswer": "apple",
      "difficulty": "EASY",
      "explanation": "Apple là danh từ phù hợp với ngữ cảnh."
    }
  ]
}
```

Admin được sửa nội dung candidate nhưng toàn bộ item được validate lại. Backend không nhận `status`, `topicId`, `createdByAi` hay `aiGenerationId` từ client. Question được tạo luôn có `status=DRAFT`, `createdByAi=true`, `aiGenerationId=generationId`; chưa có assignment vào Lesson. Commit là idempotent và chạy trong transaction.

### 3. Gán Lesson và Publish

Assignment vẫn là API riêng để bảo đảm Question đã commit không bị mất nếu thao tác gán lỗi. Frontend tự gọi API này ngay sau commit khi Admin đã chọn Lesson; nếu gán thất bại, Question vẫn là DRAFT và giao diện cho phép thử lại. Có thể gọi thủ công bằng `questions[].id` từ response:

```http
POST /api/v1/admin/lessons/:lessonId/questions

{
  "questionIds": ["question_id_1", "question_id_2"]
}
```

Publish từng Question:

```http
PATCH /api/v1/admin/questions/:questionId/status

{
  "status": "PUBLISHED"
}
```

Hoặc bulk publish sau khi tất cả Question đã vượt qua cùng một bước kiểm tra readiness:

```http
POST /api/v1/admin/ai/questions/bulk-publish

{
  "ids": ["question_id_1", "question_id_2"]
}
```

Nếu một Question không hợp lệ, bulk publish dừng trước khi cập nhật nên không tạo trạng thái publish một phần. Endpoint cũ `POST /api/v1/admin/ai/generate-questions` vẫn được giữ tạm thời để tương thích, đã deprecated và hiện chỉ trả preview; endpoint này không còn insert Question. Frontend mới không gọi endpoint cũ.

### Kiểm tra và backfill dedupe Question

Trước khi đồng bộ unique index trên database có dữ liệu cũ, chạy kiểm tra:

```powershell
npm run check:question-duplicates
```

Script chỉ báo Question trùng, Question tham chiếu nhiều Topic và Question chưa thể suy ra Topic; không tự xóa hoặc gộp dữ liệu. Sau khi xử lý các conflict thủ công, chạy:

```powershell
npm run migrate:question-dedupe
```

Migration backfill `topicId`, `normalizedContent`, `dedupeKey` rồi mới gọi `syncIndexes`. Unique index bảo vệ khóa `(topic, type, normalized content)` thông qua `dedupeKey`.

## Admin gán Question vào Lesson

Các endpoint dưới đây yêu cầu tài khoản ADMIN. `topicId` chỉ lấy từ URL và `questionCount` của Lesson luôn được backend tính theo số assignment thực tế.

### Lấy Lesson theo Topic

```http
GET /api/v1/admin/topics/:topicId/lessons
```

### Tạo Lesson để gán Question

```http
POST /api/v1/admin/topics/:topicId/lessons
```

Body mẫu (Lesson mới nên để DRAFT và `questionCount=0`):

```json
{
  "name": "Daily greetings",
  "description": "Basic greetings",
  "orderIndex": 0,
  "requiredScore": 70,
  "xpReward": 50,
  "diamondReward": 5,
  "questionCount": 0,
  "status": "DRAFT"
}
```

### Gán một hoặc nhiều Question

```http
POST /api/v1/admin/lessons/:lessonId/questions
```

```json
{
  "questionIds": ["questionId1", "questionId2"]
}
```

Response gồm Lesson sau cập nhật, danh sách assignment, `assignedCount` và `skippedCount`. Question đã gán sẽ được bỏ qua khi gọi lại; unique index `lessonId + questionId` bảo vệ cả trường hợp request đồng thời. Question liên kết Vocabulary thuộc Topic khác trả `QUESTION_TOPIC_MISMATCH` (400). Question không liên kết Vocabulary được coi là Question dùng chung.

Việc gán không thay đổi trạng thái Question hoặc Lesson. Admin phải gọi API status riêng để Publish.

## Xử lý lỗi thường gặp

- `ReplicaSetNoPrimary` hoặc `Server selection timed out`: MongoDB chưa `rs.initiate()` hoặc chưa có Primary. Kiểm tra `rs.status()` và `MONGODB_URI` có `?replicaSet=rs0`.
- `ERR_CONNECTION_REFUSED` tới cổng `5000`: backend chưa chạy hoặc đã dừng vì không kết nối được MongoDB.
- `AI_PROVIDER_NOT_CONFIGURED`: chưa đặt `GEMINI_API_KEY` ở backend.
- `AI_PROVIDER_TIMEOUT`: provider AI phản hồi quá thời gian cấu hình.

Không hạ cấp transaction xuống các thao tác rời rạc để sửa lỗi replica set, vì có thể tạo Vocabulary trùng khi hai request commit đồng thời.
# Authentication sessions

Login keeps the existing `{ success, message, data: { accessToken, user } }` response
and sets the `lingofox.refresh` HttpOnly cookie. `POST /api/v1/auth/refresh` rotates
that cookie and returns `{ success, message, data: { accessToken } }`.
`POST /api/v1/auth/logout` revokes the cookie's entire session family and clears it;
repeated logout calls are successful. Protected APIs continue to use Bearer JWTs.

Configuration:
- `JWT_EXPIRES_IN=15m`: change existing deployment values too; an old `7d` value still overrides the default.
- `REFRESH_TOKEN_DAYS=30`: absolute session lifetime starting at login; rotation does not extend it.
- `AUTH_COOKIE_SAME_SITE=lax`: accepts `lax`, `strict`, or `none`.
- `AUTH_COOKIE_SECURE=false`: local HTTP only; production always forces Secure.
- `NODE_ENV=production`: deploy over HTTPS.
- `FRONTEND_URL=http://localhost:5173`: exact allowed frontend origin, without a trailing slash or wildcard.

Login, refresh and logout require an `Origin` header matching `FRONTEND_URL`,
including calls from Postman/curl. Browsers supply it automatically on cross-origin
POST requests. CORS permits credentialed requests only from this origin.
For genuinely cross-site deployments use `AUTH_COOKIE_SAME_SITE=none` and
`AUTH_COOKIE_SECURE=true`; browser third-party-cookie restrictions can still block
these cookies. Prefer same-site frontend/backend domains. Do not log Cookie or
Set-Cookie headers. SSE currently carries the short-lived access token in its URL;
redact its query string from proxy/access logs.

Refresh sessions store only SHA-256 hashes. Consumed records remain until absolute
expiry for reuse detection. Rotation and revocation use MongoDB transactions:
MongoDB must run as a replica set (Atlas is suitable), not standalone. Ensure model
indexes exist, including the unique tokenHash and expiresAt TTL indexes. Expiry is
also checked in application code; it does not depend on the TTL deletion schedule.
Reuse revokes the whole family. Password changes and account locks/bans revoke all
refresh sessions. Existing access JWTs remain valid until their own expiry; this
change does not add a JWT denylist or immediate revocation to protected APIs.

Run `npm test` for unit/HTTP tests. For actual transaction/race tests, set
`TEST_MONGOD_PATH` to a local mongod executable and run `npm run test:auth:integration`.
It starts an isolated temporary replica set and removes its test data on completion;
it never connects to the application's database.

Deploy backend and frontend together. Legacy localStorage credentials are discarded,
so existing users without a refresh cookie must log in once after upgrading.

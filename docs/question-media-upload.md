# Upload media cho câu hỏi

API tạo và cập nhật câu hỏi hỗ trợ cả JSON cũ và `multipart/form-data`.

## Cấu hình

Không commit thông tin Cloudinary thật vào Git. Cấu hình trong `.env`:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_rotated_api_secret
```

Nếu secret từng được gửi qua chat, email hoặc commit vào Git, cần rotate secret trước khi sử dụng.

## Tạo câu hỏi có file

```http
POST /api/v1/admin/questions
Authorization: Bearer <admin_access_token>
Content-Type: multipart/form-data
```

Các field:

- `payload`: chuỗi JSON chứa dữ liệu câu hỏi.
- `image`: một file ảnh, không bắt buộc.
- `audio`: một file âm thanh, bắt buộc khi tạo câu hỏi `LISTENING` nếu payload không có `audioUrl`.

Ví dụ JavaScript:

```ts
const formData = new FormData();

formData.append(
  "payload",
  JSON.stringify({
    type: "LISTENING",
    content: "Nghe và chọn đáp án đúng",
    difficulty: "EASY",
  }),
);
formData.append("image", imageFile);
formData.append("audio", audioFile);

await fetch(`${API_BASE_URL}/admin/questions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
  body: formData,
});
```

Không tự đặt header `Content-Type` khi gửi `FormData`; browser sẽ tự thêm multipart boundary.

## Cập nhật câu hỏi có file

```http
PATCH /api/v1/admin/questions/:questionId
Authorization: Bearer <admin_access_token>
Content-Type: multipart/form-data
```

Contract giống API tạo. Quy tắc cập nhật:

- Không gửi `image`/`audio` và không gửi URL tương ứng: giữ nguyên media cũ.
- Gửi file mới: upload file mới, cập nhật URL trong MongoDB và dọn asset Cloudinary cũ.
- Gửi `imageUrl: null`: bỏ ảnh hiện tại.
- Gửi `audioUrl: null`: bỏ âm thanh hiện tại; không hợp lệ nếu kết quả cuối vẫn là câu hỏi `LISTENING`.

## Giới hạn file

Ảnh:

- JPEG, PNG, WebP hoặc GIF.
- Tối đa 5 MB.

Âm thanh:

- MP3/MPEG, WAV, OGG, MP4 audio hoặc WebM audio.
- Tối đa 20 MB.

Backend lưu `secure_url` vào `imageUrl`/`audioUrl`. `imagePublicId` và `audioPublicId` được lưu nội bộ để quản lý lifecycle asset nhưng không được trả cho client.

Các lỗi upload chính:

- `INVALID_MEDIA_TYPE`
- `INVALID_MEDIA_UPLOAD`
- `INVALID_MULTIPART_PAYLOAD`
- `IMAGE_TOO_LARGE`
- `AUDIO_TOO_LARGE`
- `MEDIA_UPLOAD_FAILED`

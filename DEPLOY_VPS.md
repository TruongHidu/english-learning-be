# Deploy English Learning lên VPS (chạy chung với pos-saas)

Hiện trạng VPS (đã kiểm tra):

| | |
|---|---|
| Cổng 80/443 | container `pos-saas-web-1` (**Caddy**, admin API ở 2019) |
| Network của Caddy | `pos-saas_default` |
| Caddyfile | `/root/pos-saas/pos-saas-be/deploy/Caddyfile` (mount vào `/etc/caddy/Caddyfile`) |
| Nginx trên host | không chạy |
| Cổng 5000 / 8080 trên host | trống |
| RAM | 3.8 GB (còn ~2.6 GB) + 6 GB swap |

Vì Caddy của pos-saas đang giữ 80/443, English Learning **dùng chung Caddy đó**: thêm một site block cho domain
English Learning, và nối 2 container `english-learning-be`, `english-learning-fe` vào network của Caddy.

```
Internet ──HTTPS──> pos-saas-web-1 (Caddy, tự cấp SSL)
                      ├── <domain pos-saas>          -> pos-saas (giữ nguyên)
                      └── hiducourse.click
                            ├── /api/*  -> english-learning-be:5000 ─┐ network pos-saas_default
                            └── /*      -> english-learning-fe:80  ──┘
                                           english-learning-be ──> english-learning-mongo (network riêng, không mở port)
```

> Trong hướng dẫn dùng `hiducourse.click`, đổi thành domain/subdomain của bạn.

---

## 1. Push code lên GitHub

Các file Docker (`Dockerfile`, `docker-compose*.yml`, `.dockerignore`, `nginx.conf`, workflow) phải có trên GitHub
thì VPS mới clone được. Lần push đầu, job *Deploy to VPS* sẽ báo lỗi cho đến khi tạo xong secrets ở bước 8;
việc này không ảnh hưởng gì, cứ làm tiếp các bước thủ công bên dưới.

## 2. Trỏ domain

Tạo bản ghi DNS **A**: `hiducourse.click` → IP VPS. Kiểm tra `ping hiducourse.click` ra đúng IP **trước khi** sửa Caddy
(Caddy cần DNS đúng để xin chứng chỉ SSL).

## 3. Lấy code và tạo `.env`

```bash
mkdir -p /var/www/english-learning && cd /var/www/english-learning
git clone https://github.com/TruongHidu/english-learning-be.git
git clone https://github.com/TruongHidu/english-learning-fe.git
```

(Repo private: thêm SSH key của VPS vào GitHub rồi clone bằng `git@github.com:...`.)

**Backend**:

```bash
cd /var/www/english-learning/english-learning-be
cp .env.example .env && nano .env
```

Thêm vào **đầu** file `.env`:

```dotenv
COMPOSE_FILE=docker-compose.yml:docker-compose.proxy.yml
PROXY_NETWORK=pos-saas_default
```

và sửa:

| Biến | Giá trị |
|---|---|
| `MONGODB_URI` | bỏ qua, compose tự đặt |
| `FRONTEND_URL` | `https://hiducourse.click` |
| `VNPAY_RETURN_URL` | `https://hiducourse.click/api/v1/payments/vnpay/return` |
| `PAYMENT_FRONTEND_RESULT_URL` | `https://hiducourse.click/payment/result` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| còn lại | `CLOUDINARY_*`, `GEMINI_API_KEY`, `SEPAY_*`, `VNPAY_*`, `ADMIN_*` |

**Frontend**:

```bash
cd /var/www/english-learning/english-learning-fe
cat > .env <<'EOF'
COMPOSE_FILE=docker-compose.yml:docker-compose.proxy.yml
PROXY_NETWORK=pos-saas_default
VITE_API_BASE_URL=/api/v1
EOF
```

`COMPOSE_FILE` làm cho mọi lệnh `docker compose ...` trong thư mục (kể cả GitHub Actions) tự nối container vào network của Caddy.

## 4. Chạy container

```bash
cd /var/www/english-learning/english-learning-be && docker compose up -d --build
cd /var/www/english-learning/english-learning-fe && docker compose up -d --build

docker ps --filter name=english-learning           # 3 container, đều "healthy"
curl http://127.0.0.1:5000/api/v1/health
curl -I http://127.0.0.1:8080

# Caddy đã thấy 2 container chưa
docker exec pos-saas-web-1 wget -qO- http://english-learning-be:5000/api/v1/health
docker exec pos-saas-web-1 wget -qO- http://english-learning-fe:80 | head -c 200
```

### Dữ liệu

- Có backup (`mongodump --archive`): `docker compose exec -T english-learning-mongo mongorestore --archive < backup.archive`
- Không có → seed: `docker compose exec english-learning-be node dist/seed.js`

(Chạy trong thư mục `english-learning-be`.)

## 5. Thêm site vào Caddy của pos-saas

Block của pos-saas (`{$SITE_ADDRESS} { ... }`) giữ nguyên. Ta chỉ **nối thêm** một site block mới vào cuối file.
Caddy tự cấp và gia hạn SSL cho domain mới.

```bash
DOMAIN=hiducourse.click                               # đổi nếu dùng domain khác
CADDYFILE=/root/pos-saas/pos-saas-be/deploy/Caddyfile

cp "$CADDYFILE" "$CADDYFILE.bak-$(date +%F)"          # backup

cat >> "$CADDYFILE" <<EOF

# ===== English Learning (xem english-learning-be/DEPLOY_VPS.md) =====
$DOMAIN {
	handle /api/* {
		reverse_proxy english-learning-be:5000 {
			flush_interval -1
		}
	}

	handle {
		reverse_proxy english-learning-fe:80
	}
}
EOF

docker exec pos-saas-web-1 tail -15 /etc/caddy/Caddyfile   # container phải thấy block mới
docker exec pos-saas-web-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec pos-saas-web-1 caddy reload   --config /etc/caddy/Caddyfile --adapter caddyfile
```

- Dùng `cat >>` (ghi nối vào đúng file đang mount) thay vì `vim`/`git`. Những cách đó có thể ghi ra file mới,
  khi đó container vẫn đọc bản cũ.
- `validate` báo lỗi → **không reload**. Khôi phục bằng `cat "$CADDYFILE.bak-<ngày>" > "$CADDYFILE"`.
- `reload` áp cấu hình mới mà không làm pos-saas gián đoạn.
- `flush_interval -1` để SSE (cập nhật kim cương realtime) đẩy dữ liệu ngay. Không thêm `encode` vào block này
  vì frontend đã tự gzip, và nén có thể làm SSE bị dồn lại.
- Có `www`: trỏ DNS rồi nối thêm `www.$DOMAIN { redir https://$DOMAIN{uri} permanent }` theo cách trên.

Xem log nếu SSL hoặc route lỗi: `docker logs --tail 50 pos-saas-web-1`.

### Giữ block này khi pos-saas deploy lại

`deploy/Caddyfile` là file **được git theo dõi** trong repo pos-saas-be, nên sau khi sửa:

- `git -C /root/pos-saas/pos-saas-be status` sẽ báo file bị sửa. Nếu bản mới của pos-saas cũng sửa Caddyfile,
  `git pull` sẽ bị từ chối. Nếu quy trình deploy của pos-saas dùng `git reset --hard`, block English Learning sẽ mất
  và site English Learning ngừng chạy.
- **Cách bền vững**: commit chính block này vào `deploy/Caddyfile` trong repo pos-saas-be (với domain thật), push lên.
  Nhờ vậy mỗi lần pos-saas deploy đều giữ nguyên.
- Khi `git pull` thay đổi Caddyfile, git ghi ra file mới nên container vẫn giữ bản cũ.
  Cần chạy `docker restart pos-saas-web-1` (pos-saas gián đoạn vài giây) để Caddy đọc bản mới.

## 6. Cổng thanh toán

- **SePay** → Webhook URL: `https://hiducourse.click/api/v1/payments/sepay/webhook`
- **VNPay** → Return URL: `https://hiducourse.click/api/v1/payments/vnpay/return`

## 7. Kiểm tra

- `https://hiducourse.click` mở được, đăng nhập rồi F5 vẫn còn đăng nhập.
- `https://hiducourse.click/payment/result` mở thẳng không bị 404.
- `https://hiducourse.click/api/v1/health` trả về `"success": true`.
- **pos-saas vẫn chạy bình thường.**

## 8. Tự deploy bằng GitHub Actions

`.github/workflows/deploy.yml` (cả hai repo): push `main` → test → SSH vào VPS → `git pull` + `docker compose up -d --build`
→ đợi container `healthy`. Nhờ `COMPOSE_FILE` trong `.env`, container luôn được nối lại vào network của Caddy.

GitHub repo → **Settings → Secrets and variables → Actions** (giống nhau cho hai repo):

| Secret | Giá trị |
|---|---|
| `VPS_HOST` | IP VPS |
| `VPS_PORT` | `22` (hoặc cổng SSH của bạn) |
| `VPS_USER` | `root` (hoặc user thuộc group `docker`) |
| `VPS_SSH_KEY` | private key bên dưới |
| `VPS_KNOWN_HOSTS` | kết quả `ssh-keyscan -p 22 <IP VPS>` |

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_actions -N ""
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_actions          # dán vào secret VPS_SSH_KEY
```

## 9. Lệnh hay dùng (trong `english-learning-be`)

```bash
docker compose logs -f english-learning-be                  # log backend
docker compose restart english-learning-be                  # sau khi sửa .env
docker compose exec english-learning-be node dist/scripts/migrate-payment-pending.js --apply
docker compose exec english-learning-mongo mongosh          # Mongo shell
docker compose exec -T english-learning-mongo mongodump --archive > ~/el-backup-$(date +%F).archive
docker stats --no-stream                                    # RAM/CPU mọi container
```

> **Không** chạy `docker compose down -v` (xoá dữ liệu Mongo), `docker system prune -a`, `docker volume prune`
> hay `docker network prune` (có thể xoá dữ liệu/network của pos-saas).
> Dọn image cũ an toàn: `docker image prune -f --filter label=project=english-learning`.

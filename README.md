# 🪷 Tam Thế Studio — TikTok Live Temple (9:16 Interactive Sanctuary)

Hệ thống phát trực tiếp tương tác (**Interactive TikTok Live Stream & JSON-RPC 2.0**) chuẩn khung dọc **9:16 (`1080×1920`)** dành cho **OBS Studio / TikTok Live Studio**, chạy trên **Node.js** và tích hợp giọng đọc AI tiếng Việt **ZeroTTS (`zeroweight-ai/ZeroTTS`)**.

Người xem trên TikTok Live tương tác trực tiếp qua **Bình luận (Comment)**, **Thả tim (Like)**, **Chia sẻ / Follow** và **Tặng quà (Gift)** để thực hiện các nghi thức tâm linh trên màn hình Chánh Điện **Đức Phật A Di Đà**:
- 🔥 **Thắp hương & Đảnh lễ Tam Bái (8-Frame Walking & Prostration)**: Nhân vật Phật tử mặc áo lam bước đi từng bước dọc thảm đỏ hoa sen lên trước Lư Hương Đỉnh Đồng, hạ gối quỳ và thực hiện 3 lạy Ngũ thể đầu địa hướng về Đức Phật A Di Đà.
- 🏮 **Thả Đèn Hoa Đăng / Sớ Cầu Nguyện**: Bình luận lời khấn sẽ bay lên thành Đèn Hoa Đăng kèm giọng đọc AI đọc lời cầu nguyện.
- 🎋 **Xin Xăm / Gieo Quẻ Đầu Năm (Đồng bộ Giọng đọc & Tờ Giải Quẻ)**: Tự động lắc ống xăm và mở tờ Giải Quẻ (Thượng Thượng Cát, Đại Cát, Thượng Cát...) đúng thời điểm giọng đọc bắt đầu vang lên.
- 🪵 **Gõ Mõ & 🔔 Thỉnh Đại Hồng Chung**: Thả tim gõ mõ tích điểm Công Đức, chia sẻ/follow thỉnh chuông đồng lan tỏa sóng âm vàng và kích hoạt làn sóng vái lạy của 200 chỗ trong Đạo Tràng (194 chỗ thường và 6 VIP).
- 📜 **Bảng Vàng Công Đức (`TẤM LÒNG THÀNH` & 6 Đệm Quỳ VIP)**: Vinh danh trực tiếp người xem thật có điểm Công Đức cao nhất trên 6 đệm quỳ gấm đỏ trước bàn thờ Phật.

---

## Demo

Ảnh chụp màn hình đã được gỡ khỏi repo để tránh phát tán tên tài khoản và lời cầu nguyện của người xem.

## ⚡ Kiến Trúc & Tối Ưu Hóa Hiệu Suất (Siêu Nhẹ CPU/GPU)

- **Runtime**: Backend chạy trên **Node.js** (`~0.1% CPU` khi chờ).
- **Canvas Particle Engine (`src/views/scripts/particles.ts`)**:
  - Khóa tốc độ vẽ ở **30 FPS** ổn định, tự động tạm dừng khi ẩn tab (`document.hidden`).
  - Pre-render toàn bộ Khói hương, Hạt vàng và Cánh hoa sen ra Offscreen Canvas 1 lần duy nhất lúc khởi tạo (`drawImage`), không gọi `createRadialGradient` hay `shadowBlur` trong vòng lặp frame.
- **Zero-Flicker 8-Frame Sprite Stack (`src/views/scripts/live.ts` & `public/css/live.css`)**:
  - Nạp sẵn cả 8 khung hình chuyển động (`walk1`, `walk2`, `kneelDown`, `kneel`, `forehead`, `bowMid`, `prostrate`, `prostrateDeep`) vào GPU với bóng đổ (drop-shadow) đã bake sẵn trong PNG, loại bỏ hoàn toàn hiện tượng nháy/mất hình khi chuyển tư thế.
- **ZeroTTS Worker (`tts_worker.py`)**:
  - Tiến trình Python thường trú nạp model cục bộ; tải từ Hugging Face chỉ chạy khi bật `ZEROTTS_ALLOW_HUB_DOWNLOAD=1` và dùng revision cố định `18d6681518a4becaed3c125ceb3c7db59905fe86`.
  - Tổng hợp nguyên câu trong 1 lần gọi (`single-pass synthesis`), khử DC offset, chuẩn hóa đỉnh âm lượng (`peak <= 0.90`) và làm mượt 2 đầu sóng âm (`cosine fade-in/out`) chống xước/rè tiếng.
- **Bộ Lọc Chặn Ký Tự Lạ & Spam (`server.js` & `tts_worker.py`)**:
  - Chặn tự động các ký tự Cuneiform (`𒐫`), chữ Ả Rập gây lag, Braille, Zalgo, bình luận chỉ toàn dấu chấm (`...`) hoặc từ ngữ phản cảm.
  - Tự động chuẩn hóa Unicode (`NFKC` → `NFC`) chuyển tên kiểu chữ toán học về tiếng Việt sạch trước khi đọc TTS.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Nhanh

### 1. Yêu cầu hệ thống
- Node.js (`>= 20.19` hoặc `>= 22.12`, chạy Vite dev server và build giao diện)
- Python `3.10+` & [`uv`](https://github.com/astral-sh/uv) (để tạo môi trường `.venv` chạy `zerotts`)

### 2. Cài đặt thư viện
```bash
# Cài đặt dependencies JavaScript
npm install

# Tạo môi trường Python từ lockfile có hash
uv sync --locked
```

Trên Windows, chạy `.\setup.ps1` trong PowerShell để cài hai nhóm dependency và kiểm tra import ZeroTTS. `.\start.ps1` sẽ tự setup nếu thiếu dependency, bật tải model và khởi động app.

Vite transpile các file TypeScript, phục vụ giao diện khi phát triển và build hai trang vào `dist/` cho production. `npm run typecheck` kiểm tra kiểu; `npm run build` chạy kiểm tra này trước khi build.

ZeroTTS dùng model cục bộ nếu có. Nếu muốn tải model đã ghim revision từ Hugging Face, bật rõ tùy chọn này khi chạy:

```powershell
$env:ZEROTTS_ALLOW_HUB_DOWNLOAD = "1"
npm start
```

Model tải lần đầu khoảng **900 MB** và được cache bởi Hugging Face. Giữ biến môi trường này bật khi khởi chạy để worker lấy đúng revision từ cache; lần sau sẽ không tải lại các file đã có.

Worker chỉ tải file phục vụ suy luận, lần lượt từng file. Sau khi tải thành công, model được chép vào `data/models/` để ONNX đọc được dữ liệu ngoài trên Windows. Các lần khởi động sau dùng bộ model đã kiểm tra trên ổ đĩa mà không cần kết nối Hugging Face. Thư mục này không được commit.

Trên Windows, `.\start.ps1` tự đặt biến này rồi chạy `npm start`.

Trên macOS/Linux: `ZEROTTS_ALLOW_HUB_DOWNLOAD=1 npm start`. Có thể dùng model đã tải sẵn bằng cách đặt `ZEROTTS_MODEL_PATH` trỏ tới thư mục chứa `config.json`.

### 3. Khởi chạy Server
```bash
npm start
```

Khi phát triển, chạy một lệnh để mở cả backend, Vite và ZeroTTS:

```bash
npm run dev
```

Mở `http://127.0.0.1:5173` hoặc `http://127.0.0.1:5173/admin`. `Ctrl+C` dừng cả hai server và worker giọng đọc. Backend tự khởi động lại khi sửa mã server; Vite cập nhật giao diện khi sửa view. Dừng server cũ ở cổng 3000/5173 trước khi chạy. Nếu muốn chạy riêng, dùng `npm run dev:server` và `npm run dev:client` trong hai terminal.

Vite chuyển tiếp `/api`, `/rpc`, `/ws` và `/tts-cache` tới backend. Mở `http://127.0.0.1:5173` hoặc `http://127.0.0.1:5173/admin`. Production dùng Express phục vụ các file đã build từ `dist/`.

Server bind vào `127.0.0.1:3000` mặc định và in một RPC token ngẫu nhiên vào terminal. Nhập token này trong trang Admin hoặc thanh điều khiển. Token được lưu trong trình duyệt hiện tại. Với OBS Browser Source, mở URL dạng `http://127.0.0.1:3000/?obs=1#token=<URL_ENCODED_RPC_TOKEN>`; trang sẽ đổi token lấy quyền truy cập rồi xóa token khỏi thanh địa chỉ.

Để dùng token cố định, đặt `TEMPLE_RPC_TOKEN` trước khi chạy; token phải có ít nhất 32 byte. Đặt `TIKTOK_AUTO_CONNECT=1` cùng `TIKTOK_USER=@username` nếu muốn tự kết nối TikTok khi khởi động. Mặc định không tự kết nối.

Nếu cần mở server ra mạng, hãy cấu hình xác thực mạnh, HTTPS ở reverse proxy và `TEMPLE_CORS_ORIGINS` thành danh sách origin cụ thể. Không dùng `*` cho CORS.

Mặc định server chạy tại cổng `3000`:
- **Màn hình Live + Điều khiển nhanh**: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- **Màn hình OBS Browser Source (Sạch 9:16)**: [http://127.0.0.1:3000/?obs=1](http://127.0.0.1:3000/?obs=1) *(Đặt kích thước Browser Source trong OBS là `1080 × 1920`)*
- **Bảng điều khiển Admin & RPC**: [http://127.0.0.1:3000/admin](http://127.0.0.1:3000/admin)

---

## Đạo tràng 200 chỗ

Ảnh nền chánh điện Tam Thế ở `public/assets/tam-the-sanctuary-stage.png` là phần phông tĩnh; giao diện dựng thêm 194 vị trí thường và 6 vị trí VIP. Con số 200 là sức chứa hiển thị của cảnh, không phải số người xem TikTok. API gửi tối đa 200 người trong bảng công đức; số người xem Live lấy riêng từ TikTok.

## 🎮 Bảng Quy Tắc Tương Tác TikTok Live

Trong trang Admin hoặc bảng điều khiển nhanh, mục **Giọng đọc cho các tương tác Live** liệt kê các giọng model đang hỗ trợ: Bảo Trang, Gia Huy, Hà My, Hữu Đức, Kim Oanh, Mai Chi, Quang Minh và Tiến Đạt. Chọn giọng sẽ lưu ngay cho các tương tác tiếp theo, kể cả sau khi khởi động lại. Nút **Nghe thử** chỉ phát tại trình duyệt hiện tại. Các câu đã xếp hàng vẫn giữ giọng lúc tạo câu.

| Sự kiện TikTok Live | Điều kiện / Từ khóa | Nghi thức trên Chánh Điện | Điểm Công Đức |
| :--- | :--- | :--- | :---: |
| **Thả tim (Like)** | Mỗi đợt thả tim | Gõ mõ gỗ tụng kinh + Làn sóng Phật tử vái lạy | `+1` / tim |
| **Follow / Share** | Theo dõi hoặc chia sẻ | Thỉnh Đại Hồng Chung ngân vang + Sóng âm vàng | `+10` |
| **Bình luận Thắp hương** | `thắp hương`, `dâng hương`, `bái phật`, `lạy phật` | Phật tử bước dọc thảm đỏ lên trước Lư Hương, quỳ đảnh lễ 3 lạy + Đọc tên khấn | `+15` |
| **Bình luận Cầu nguyện** | `cầu ...`, `nguyện ...`, `nam mô`, `a di đà phật`, `bình an`, `chúc ...` | Bước lên đảnh lễ + Thả Đèn Hoa Đăng mang lời khấn bay lên trời + Đọc lời cầu nguyện | `+10` |
| **Bình luận Xin xăm** | `xin xăm`, `gieo quẻ`, `rút quẻ`, `quẻ` | Lắc ống xăm + Mở tờ Giải Quẻ đồng bộ đúng lúc giọng đọc bắt đầu vang lên | `+10` |
| **Tặng quà Nhỏ (1–4 xu)** | Hoa hồng (Rose), Heart Me... | Bước lên dâng Đài Hoa Sen Vàng + Thắp 3 nén hương + Đọc lời cảm tạ | `+20` / xu |
| **Tặng quà Vừa (5–99 xu)** | Đèn lưu ly, Mâm ngũ quả... | Dâng Đèn Lưu Ly / Mâm Ngũ Quả + Thỉnh Chuông + Đọc lời chúc phúc | `+30` / xu |
| **Tặng quà Lớn (≥ 100 xu)** | Quà ≥ 100 xu | **Đại Lễ Kim Long Chầu Phật**: Mưa hoa sen vàng, Hào quang vạn trượng, Chuông đồng ngân vang | `+50` / xu |

---

## 🔌 Giao Thức JSON-RPC 2.0 (`POST /rpc` & `ws://localhost:3000/ws`)

Các API cần header `Authorization: Bearer <RPC_TOKEN>`. Token được in trong terminal lúc server khởi động hoặc đọc từ biến môi trường `TEMPLE_RPC_TOKEN`.

```bash
# 1. Thắp hương cầu an
curl -X POST http://127.0.0.1:3000/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <RPC_TOKEN>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "temple.burnIncense",
    "params": {
      "user": "Thí Chủ Minh Tâm",
      "count": 3,
      "wish": "Cầu gia đình bình an, vạn sự cát tường như ý"
    }
  }'

# 2. Xin xăm / Gieo quẻ đầu năm
curl -X POST http://127.0.0.1:3000/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <RPC_TOKEN>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "temple.drawFortune",
    "params": {
      "user": "Thí Chủ Minh Tâm",
      "topic": "Cầu tài lộc và gia đạo bình an"
    }
  }'

# 3. Kết nối bằng @username hoặc URL hồ sơ TikTok HTTPS trực tiếp
curl -X POST http://127.0.0.1:3000/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <RPC_TOKEN>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "live.connect",
    "params": {
      "username": "@your_username"
    }
  }'
```

WebSocket cần nhận frame xác thực đầu tiên trước khi gửi JSON-RPC:

```json
{"jsonrpc":"2.0","method":"auth","params":{"token":"<RPC_TOKEN>"}}
```

Link rút gọn TikTok không được nhận; server không tải URL do người gọi cung cấp.

### Danh sách JSON-RPC Methods hỗ trợ:
- `temple.getState`: Lấy toàn bộ trạng thái Chánh Điện và Bảng Vàng Công Đức.
- `temple.burnIncense`: Thắp nhang & bước lên đảnh lễ (`user`, `avatar`, `count`, `wish`).
- `temple.sendPrayer`: Thả đèn hoa đăng cầu nguyện (`user`, `avatar`, `wish`).
- `temple.drawFortune`: Lắc ống xăm & gieo quẻ (`user`, `avatar`, `topic`).
- `temple.strikeWoodenFish`: Gõ mõ tích công đức (`user`, `count`).
- `temple.ringBell`: Thỉnh Đại Hồng Chung (`user`, `count`, `wish`).
- `temple.offerGift`: Dâng lễ vật (`user`, `giftType`: `lotus` | `fruit` | `lamp` | `dragon`, `coins`, `giftName`).
- `temple.grandCeremony`: Kích hoạt Đại Lễ Kim Long Chầu Phật (`user`, `coins`, `giftName`).
- `temple.updateSettings`: Cập nhật âm lượng nhạc nền (`musicVolume`), giọng đọc (`ttsVolume`), bật/tắt TTS.
- `temple.resetMerit`: Đặt lại bảng thống kê Công Đức.
- `live.connect` / `live.disconnect`: Kết nối / Ngắt kết nối phòng TikTok Live.

---

## 📁 Cấu Trúc Thư Mục

```text
├── server.js                    # Entry point tương thích, gọi src/server.js
├── src/
│   ├── app.js                   # Cấu hình Express và static views
│   ├── server.js                # Lắp các module, khởi động HTTP/WebSocket
│   ├── config.js                # Cổng, host, token và thư mục runtime
│   ├── controllers/             # HTTP, RPC, trạng thái, TTS và WebSocket
│   ├── routes/httpRoutes.js     # Ánh xạ endpoint vào controller
│   ├── middleware/              # Xác thực, CORS origin và rate limit
│   ├── models/                  # Trạng thái công đức và lưu file
│   ├── services/                # Nghi thức, comment, TikTok, TTS, RPC, realtime, giả lập
│   ├── data/fortuneDeck.js      # Bộ nội dung quẻ
│   ├── utils/                   # Chuẩn hóa tên và lời cầu nguyện
│   └── views/
│       ├── index.html           # View Chánh Điện 9:16
│       ├── admin/index.html     # View điều khiển JSON-RPC
│       └── scripts/             # TypeScript và entry của từng trang
├── tts_worker.py                # Tiến trình Python ZeroTTS thường trú
├── pyproject.toml               # Dependency Python trực tiếp
├── uv.lock                      # Dependency Python đã khóa kèm hash
├── data/                        # State runtime và TTS cache, không commit
├── public/
│   ├── css/live.css             # Stylesheet
│   └── assets/                  # Hình nền và sprite
├── dist/                        # Build output của Vite, không commit
├── vite.config.mjs              # Dev server, proxy và multi-page build
└── docs/                        # README và tài liệu thiết kế
```

File trạng thái runtime, audio cache và `.env` được loại khỏi Git; chỉ file mẫu cấu hình được chia sẻ.

## Studio mới: lời dẫn, nhạc và 200 chỗ

Chạy `npm run dev`, mở URL Vite in trong terminal. Vào `/admin`, mở **Kết nối điều khiển** và nhập RPC token của phiên server.

- **Tổng quan**: kết nối tài khoản đang Live, thử nghi thức và bảng chào người vào phòng.
- **Lời dẫn**: 8 giọng ZeroTTS, 30 câu dẫn tự động; mỗi dòng là một biến thể. Sửa rồi bấm **Lưu lời dẫn**. Thông báo tự nhập nằm trong phần mở rộng, không cần dùng khi vận hành bình thường.
- **Nhạc thiền**: 6 bản ambient nguyên bản, chọn bài, nghe thử, chuyển bài tự động. Chọn nhạc chung ở Admin; mở Phòng Live và bấm **Bật âm thanh buổi Live** để phát. File riêng chỉ phát ở tab được chọn, không tự chuyển sang OBS.
- **Thư viện quẻ**: 100 nội dung chiêm nghiệm sáng tác, tìm kiếm, lọc 5 chủ đề, nghe lời giải; không phải bản xăm cổ.
- Phòng Live có 200 chỗ hiển thị và bảng chào nhỏ theo tên người mới vào phòng; bản sạch cho OBS ở `/?obs=1`.

Kiểm tra nhanh: `node scripts/test-studio.cjs` và `npm run build`. Chi tiết thiết kế, nguồn skill và kiểm thử: [docs/studio-ui.md](docs/studio-ui.md).

Avatar người xem hiện trên nhân vật; chat hợp lệ hiện thành bong bóng tại chỗ ngồi trong 6 giây (tối đa 4 cùng lúc). Trong **Phòng Live → Giọng đọc → Âm thanh pháp khí**, bấm **Nghe thử tiếng mõ** và chỉnh âm lượng tiếng mõ. Các nút nghi thức có phản hồi khi bấm; thiết lập giảm chuyển động của hệ điều hành được tôn trọng.

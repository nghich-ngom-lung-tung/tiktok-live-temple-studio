# Dùng HTTPS qua Cloudflare Tunnel cho LIVE Studio

Nếu nguồn trình duyệt của LIVE Studio từ chối URL `http://localhost`/`http://127.0.0.1` nhưng nhận URL HTTPS, dùng tunnel để đưa màn Live local ra một URL HTTPS. Đây là trường hợp đã được người dùng báo trên máy của mình, không phải khẳng định mọi phiên bản LIVE Studio đều bắt buộc Cloudflare. Nếu phần mềm phát đã mở được URL local thì không cần tunnel.

Ứng dụng có chế độ HTTPS tự động. Backend cho phép đúng origin HTTPS do cloudflared cấp; giao diện tự dùng WebSocket `wss:` khi mở qua HTTPS. Tunnel trỏ tới bản build production, không công khai Vite dev server.

## Cách nhanh: một terminal

Cài `cloudflared` theo mục chuẩn bị bên dưới, rồi chạy:

```powershell
npm run start:https
```

Hoặc dùng script Windows có kiểm tra môi trường:

```powershell
.\start.ps1 -Https
```

Lệnh build giao diện, kiểm tra cổng local, chạy cloudflared, lấy hostname Quick Tunnel, truyền hostname vào `TEMPLE_CORS_ORIGINS` rồi khởi động backend. Backend được kiểm tra xác thực local, rồi kiểm tra HTTPS qua Cloudflare trước khi hiện thông báo sẵn sàng. Lúc mới được cấp URL, DNS/đường tunnel có thể cần thêm thời gian. Terminal in hai link nguồn có `profile`, `obs=1` và token để dán vào LIVE Studio, cùng link Quản lý local. Không cần nhập lại origin hoặc khởi động backend lần thứ hai.

Nếu đã đặt `TEMPLE_RPC_TOKEN` thì giữ token đó; nếu chưa có, launcher tạo token riêng cho phiên. Token không được ghi vào mã nguồn hoặc tệp cấu hình. `PORT` mặc định 3000; ví dụ `$env:PORT = '3001'` trước khi chạy nếu cần cổng khác. Launcher chỉ bind backend vào `127.0.0.1`.

Ctrl+C dừng các tiến trình backend/worker/tunnel do lệnh này tạo. Nếu backend hoặc tunnel tự dừng, launcher dừng phần còn lại và báo chạy lại lệnh; không giữ link đã hỏng hoặc tự đổi URL trong nguồn LIVE Studio. Khi chạy lại, Quick Tunnel cấp URL mới nên cần thay link trong nguồn phát. Nếu cổng đang có app khác chạy, launcher báo lỗi, không tắt app đó.

Chế độ Quick Tunnel tự động dùng một tệp cấu hình trống trong thư mục tạm và loại các biến `TUNNEL_*` khỏi môi trường riêng của tiến trình cloudflared, để cấu hình named tunnel cũ không ghi đè URL mới. Cấu hình Cloudflare hiện có trên máy không bị sửa; tệp tạm được dọn khi dừng.

Không tự tải hoặc cài cloudflared. Nếu thiếu, lệnh báo cách cài. Nếu không cấp được URL trong 60 giây, backend chưa sẵn sàng sau 30 giây, hoặc HTTPS chưa truy cập được sau 45 giây, lệnh dừng và dọn tiến trình của phiên. Mốc backend sẵn sàng chỉ xác nhận web/API, không khẳng định ZeroTTS đã tải xong model hay LIVE Studio đã phát tiếng.

Cách hai terminal dưới đây vẫn dùng được khi muốn tự quản lý tunnel hoặc dùng hostname cố định.

## Chuẩn bị

- Cài `cloudflared` theo [trang tải chính thức của Cloudflare](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/), mở lại terminal và kiểm tra bằng `cloudflared --version`.
- Cài dependencies của ứng dụng như README. Không đưa token thật vào mã nguồn/Git.
- Dùng hai terminal PowerShell tại thư mục repository. Giữ cả server và cloudflared chạy trong suốt buổi phát.

## 1. Terminal A: chạy ứng dụng với token giữ nguyên khi khởi động lại

```powershell
$env:TEMPLE_RPC_TOKEN = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
$env:ZEROTTS_ALLOW_HUB_DOWNLOAD = '1'
npm start
```

Lệnh tạo token thực hiện một lần. Khi khởi động lại backend ở bước 3, dùng lại terminal A và giữ giá trị biến này; không chạy lại dòng tạo token. Nếu đã có token riêng đang sử dụng, đặt token đó thay cho việc tạo mới.

Mở `http://127.0.0.1:3000` để xác nhận server chạy trước.

## 2. Terminal B: tạo URL HTTPS

```powershell
cloudflared tunnel --url http://127.0.0.1:3000
```

Lấy URL HTTPS dạng `https://ten-ngau-nhien.trycloudflare.com` từ đầu ra cloudflared. Đây là URL minh họa; phải dùng đúng URL vừa được cấp. Giữ terminal B chạy.

## 3. Terminal A: cho phép đúng origin rồi chạy lại backend

Trong terminal A, nhấn Ctrl+C để dừng **backend**, giữ terminal B nguyên. Đặt đúng URL vừa lấy, không thêm đường dẫn hoặc dấu `/` cuối:

```powershell
$env:TEMPLE_CORS_ORIGINS = 'https://ten-ngau-nhien.trycloudflare.com'
npm start
```

`TEMPLE_RPC_TOKEN` vẫn giữ nguyên trong terminal A. Không dùng `*` hoặc cho phép toàn bộ `trycloudflare.com`; app cần origin cụ thể để xác thực HTTP và WebSocket.

Nếu cần nhiều origin, phân cách bằng dấu phẩy. Mỗi lần tunnel đổi tên miền, cập nhật biến rồi khởi động lại backend.

## 4. Thêm nguồn trong LIVE Studio

Thay tên miền và token của bạn vào URL của hồ sơ cần phát:

| Hồ sơ | URL nguồn trình duyệt |
| --- | --- |
| Phật giáo | `https://ten-ngau-nhien.trycloudflare.com/?profile=phat-giao&obs=1#token=RPC_TOKEN_CUA_BAN` |
| Thiên Chúa giáo | `https://ten-ngau-nhien.trycloudflare.com/?profile=thien-chua-giao&obs=1#token=RPC_TOKEN_CUA_BAN` |

Đặt khung nguồn 1080 × 1920. Lấy token từ biến trong terminal A khi cần sao chép: `$env:TEMPLE_RPC_TOKEN`. Giữ riêng URL có token; URL này cấp quyền điều khiển ứng dụng cho người có token.

Bảng Quản lý có thể tiếp tục dùng local tại `http://127.0.0.1:3000/admin?profile=...`. Màn nguồn HTTPS vẫn cần xác thực riêng vì LIVE Studio có vùng lưu trữ trình duyệt riêng. Phần `#token=...` giúp nguồn xác thực mà không phải nhập form trong nguồn phát.

Mở URL nguồn HTTPS trên trình duyệt trước, bấm một thao tác từ bảng điều khiển local để kiểm tra card/nhân vật thay đổi. Sau đó kiểm tra lại trong nguồn LIVE Studio và nghe âm thanh trên thiết bị người xem; chỉ thấy ảnh nền chưa chứng minh WebSocket hoặc âm thanh đã hoạt động.

## Xử lý lỗi

- **502/Bad Gateway:** backend chưa chạy hoặc cloudflared trỏ sai cổng. Kiểm tra URL local trước; hướng dẫn này dùng 3000, không phải Vite 5173.
- **Ảnh nền hiện nhưng không có nhân vật/thống kê/âm thanh:** kiểm tra token, đúng query `profile`, và `TEMPLE_CORS_ORIGINS`. Khởi động lại backend sau khi đổi biến.
- **403/Origin không được phép, WebSocket không kết nối:** origin cần đúng `https://hostname` vừa được cấp, không có đường dẫn, fragment, dấu `/` cuối hoặc khoảng trắng thừa.
- **401/Token sai:** dùng đúng token của backend hiện tại. Nếu backend tự tạo token mỗi lần chạy do chưa đặt biến, token cũ không còn đúng.
- **URL trước đó không mở được:** Quick Tunnel đổi hostname khi được tạo lại; cập nhật cả URL trong LIVE Studio và origin được backend cho phép.
- **Mở được trong trình duyệt nhưng không phát tiếng trong nguồn:** kiểm tra quyền phát âm thanh và mixer của phần mềm phát, trạng thái giọng/nhạc trong app, rồi nghe đầu ra trên thiết bị người xem.
- **Vite báo host không được phép:** dùng `npm start` và tunnel tới cổng 3000 theo hướng dẫn, thay vì công khai dev server.

## Dùng thử và phát thường xuyên

[Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) không cần tài khoản/domain, tạo URL tạm thời, không có cam kết uptime và dừng hoạt động khi tiến trình cloudflared dừng. Dùng để thử cách LIVE Studio nhận nguồn HTTPS. Nếu cần URL cố định cho các buổi phát thường xuyên, dùng [tunnel có tên miền cố định](https://developers.cloudflare.com/tunnel/) rồi thêm hostname đó vào `TEMPLE_CORS_ORIGINS`.

Tunnel làm URL local truy cập được từ Internet; RPC/state/âm thanh giọng vẫn yêu cầu token của app. Không chia sẻ token hoặc dùng token mẫu. Cloudflare chỉ chuyển tiếp nguồn hình/tiếng và kết nối web; không cấp quyền Go LIVE cho tài khoản TikTok.

Chạy `node scripts/test-https-live.cjs` khi muốn kiểm tra tunnel thật với dữ liệu tạm riêng (cần cloudflared và Internet; script tự dừng tunnel/backend khi kết thúc).

Launcher có kiểm tra tự động với tiến trình giả lập: hostname chính xác, log URL chia nhiều chunk, origin/token, thứ tự khởi động, cổng bận, thiếu cloudflared, timeout, hủy và dọn tiến trình. Đã thử Quick Tunnel công khai thật trên cổng riêng với dữ liệu tạm: HTTPS cho cả hai hồ sơ, kiểm tra bắt buộc token và WebSocket WSS đều qua; tunnel/backend/worker thử được dừng khi kết thúc. Chưa thử trực tiếp nguồn phát trong giao diện LIVE Studio hoặc âm thanh đến thiết bị người xem trong lần tích hợp này.

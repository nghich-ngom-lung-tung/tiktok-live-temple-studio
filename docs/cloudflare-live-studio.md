# Dùng HTTPS qua Cloudflare Tunnel cho LIVE Studio

Nếu nguồn trình duyệt của LIVE Studio từ chối URL `http://localhost`/`http://127.0.0.1` nhưng nhận URL HTTPS, dùng tunnel để đưa màn Live local ra một URL HTTPS. Đây là trường hợp đã được người dùng báo trên máy của mình, không phải khẳng định mọi phiên bản LIVE Studio đều bắt buộc Cloudflare. Nếu phần mềm phát đã mở được URL local thì không cần tunnel.

Ứng dụng hiện **không tự cài hoặc tự chạy cloudflared**. Backend đã hỗ trợ cho phép origin HTTPS cụ thể qua `TEMPLE_CORS_ORIGINS`; giao diện tự dùng WebSocket `wss:` khi mở qua HTTPS. Hướng dẫn dưới đây chạy tunnel bằng tay và dùng bản build production ở cổng 3000.

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

Tài liệu này đã đối chiếu cấu hình origin, xác thực và cách chọn HTTP/WebSocket trong code; chưa khởi tạo tunnel công khai hoặc thử trực tiếp LIVE Studio trong lần cập nhật tài liệu này.

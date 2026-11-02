# Vận hành một buổi Live

## Quyền phát và dữ liệu thử

- Kiểm tra quyền phát của tài khoản trước khi setup nguồn hình. Mở được giao diện LIVE Studio không có nghĩa tài khoản đã được phép Go LIVE. Thông báo “Access not available” cần được xử lý qua TikTok; connector không cấp quyền phát.
- `tiktok-live-connector` là thư viện không chính thức để nhận sự kiện từ phòng đang Live. LIVE Studio/OBS đảm nhận phát hình và tiếng. Chưa xác nhận đường truyền thật cho đến khi thử với một phòng Live và thiết bị người xem.
- Ưu tiên link nội bộ khi phần mềm phát chấp nhận. Cloudflare Tunnel chỉ là phương án HTTPS tùy chọn; dự án không tự khởi động tunnel. Quick Tunnel tạo địa chỉ công khai tạm thời, hết hiệu lực khi dừng tiến trình. Giữ riêng URL có token và chỉ cho phép origin HTTPS cụ thể qua `TEMPLE_CORS_ORIGINS` nếu dùng tunnel.
- Xóa người giả lập chỉ xóa ghế test, không xóa thống kê đã lưu. Chat giả lập không cộng điểm. Hồ sơ Phật giáo có các thao tác ghi Công Đức và chức năng đặt lại bảng Công Đức; kiểm tra hồ sơ đang chọn trước khi đặt lại.
- Hồ sơ Thiên Chúa giáo theo dõi lời cầu nguyện, chia sẻ Kinh Thánh, tri ân và quà; không dùng bảng Công Đức Phật giáo.
- Khi tải màn Phật giáo, nhân vật giữa điện giữ nhãn chờ trung tính; chỉ đổi sang tên người tương tác khi phát nghi thức, không tự lấy người đứng đầu bảng Công Đức.

## Điều khiển và màn phát

- **Phòng Live → Kết nối**: nhập token RPC từ terminal, nhập `@username` đang phát rồi kết nối TikTok. Có trạng thái kết nối, lỗi gần nhất, thời gian thử lại và nút ngắt kết nối.
- Màn phát dùng URL đúng hồ sơ: Phật giáo `http://127.0.0.1:3000/?profile=phat-giao&obs=1#token=TOKEN_CUA_BAN`; Thiên Chúa giáo `http://127.0.0.1:3000/?profile=thien-chua-giao&obs=1#token=TOKEN_CUA_BAN`. Đặt kích thước 1080 × 1920. Token phải thuộc cùng server với bảng điều khiển.
- Giọng đọc, nhạc nền, pháp khí và âm lượng được lưu trên server và đồng bộ đến các màn đã xác thực. Bật/tắt áp dụng cả khi màn OBS dùng hồ sơ trình duyệt riêng.
- Trình duyệt hoặc phần mềm phát có thể yêu cầu tương tác để cho phép âm thanh. Kiểm tra tiếng thực tế trên điện thoại trước buổi Live; trạng thái nút bật tiếng không chứng minh đầu ra TikTok đã nghe được.
- File nhạc tải từ máy vẫn chỉ phát trong tab đã chọn file; thư viện nhạc có sẵn đồng bộ giữa các màn.
- **Đổi ảnh chánh điện (Phật giáo)**: ở **Quản lý → Tổng quan → Chánh điện Tam Thế**, chọn PNG/JPG/WebP tối đa 8 MB, xem trước rồi bấm **Tải lên và áp dụng**. Ảnh mới được lưu trong `data/stage-backgrounds`, giữ lại giữa các lần khởi động và tự đồng bộ sang Phòng Live/OBS; bấm **Ảnh mặc định** để quay lại ảnh ban đầu. Ảnh dọc 9:16 cho khung tốt nhất; ảnh ngang sẽ được cắt cho vừa.

## Hàng đợi nghi thức

Tương tác được ghi nhận khi nhận sự kiện. Các hồ sơ dùng chung đồng hồ bắt đầu/kết thúc để các màn Live, Admin và OBS đồng bộ; mỗi hồ sơ xử lý lượt theo thứ tự và không chạy chồng hoạt ảnh.

**Thiên Chúa giáo:** hoạt ảnh bắt đầu ngay khi lượt được phát. ZeroTTS tổng hợp ở nền; khi xong, lời đọc được ghép vào lượt hiện tại mà không phát lại hoạt ảnh. Các cảnh cầu nguyện/hiệp thông vẫn giữ thời lượng cần thiết cho nhân vật đi lên, cúi đầu và trở về. Nếu màn Live kết nối lại, nó tiếp tục từ trạng thái và mốc thời gian máy chủ hiện tại.

**Phật giáo:** máy chủ chờ tối đa 12 giây để chuẩn bị giọng trước khi bắt đầu nghi thức. Nếu giọng chưa sẵn sàng, lượt vẫn phát hình ảnh và trạng thái hàng đợi báo lỗi giọng đọc.

Mỗi hàng đợi có tối đa 200 lượt đang chờ. Khi hàng Phật giáo đầy, một lượt gõ mõ đang chờ có thể bị bỏ để nhường chỗ cho sự kiện khác; nếu không có lượt gõ mõ để bỏ, sự kiện mới bị bỏ. Hàng Thiên Chúa giáo không có loại lượt gõ mõ để nhường chỗ nên sự kiện mới sẽ bị bỏ khi hàng đầy. Bộ đếm lượt bỏ hiển thị trong bảng điều khiển; thống kê đã ghi nhận vẫn được giữ.

## Tạm dừng khẩn cấp

Nút tạm dừng của hồ sơ đang chọn dừng tiếng/cảnh và xóa hàng chờ trên các màn kết nối. Tương tác tới sau vẫn được ghi vào thống kê hồ sơ nhưng không xếp hình ảnh mới. Nút tiếp tục chỉ cho phép phát tương tác mới; các lượt đã dừng không tự phát lại. Giả lập tương tác cũng bị tắt khi tạm dừng.

## Quà tặng (Phật giáo)

Trong **Nghi thức → Phiên Live và cấu hình quà**, nhập ID quà (dạng số), tên gợi nhớ và chọn một trong sáu nghi thức. ID có thể xem trong danh sách quà vừa nhận. Cấu hình thay đổi hình thức trình diễn, không thay đổi số xu thực nhận hoặc công thức công đức của quà.

Combo tính theo phần tăng của số lượng tích lũy, bỏ gói lặp và gói chốt không tăng số lượng. Quà đơn không bị gộp chỉ vì cùng người gửi/cùng ID quà. Nếu dữ liệu quà đơn không có mã tin nhắn thì không thể phân biệt tuyệt đối một gói lặp với hai lần gửi giống nhau; ứng dụng giữ cả hai để không bỏ sót quà hợp lệ.

Hồ sơ Thiên Chúa giáo ghi nhận lời cảm ơn và thống kê quà theo phiên; cấu hình quà và bảng Công Đức của Phật giáo không áp dụng cho hồ sơ này.

## Kết nối và phiên thống kê

- Mất kết nối TikTok: thử lại sau 2, 4, 8, 16 rồi tối đa 30 giây/lần. Nút ngắt kết nối và sự kiện TikTok kết thúc Live sẽ dừng thử lại.
- Không lấy lại lịch sử tương tác cũ lúc nối vào phòng, để tránh phát lại quà/chat trước khi ứng dụng bắt đầu nghe.
- Phiên thống kê bắt đầu khi kết nối được phòng; nối lại cùng phòng giữ nguyên phiên. Chuyển tài khoản, kết thúc Live hoặc ngắt thủ công sẽ lưu phiên trước.
- **Mở phiên thống kê mới** lưu phiên hiện tại rồi bắt đầu thống kê lại, giữ nguyên công đức tổng đã lưu.
- Phiên có thời lượng, người xem, đỉnh người xem, chat được chấp nhận, tim, follow, chia sẻ và số quà/xu. Phật giáo có thêm thống kê Công Đức; Thiên Chúa giáo có số lời cầu nguyện, chia sẻ Kinh Thánh và lời cảm ơn quà. Giữ tối đa 20 phiên gần nhất; giao diện liệt kê 5 phiên gần nhất.
- User giả lập không tính vào phiên TikTok thật. Giả lập tương tác mặc định tắt sau khi khởi động lại server.
- Ghế dựa trên những người được nhận diện qua sự kiện vào phòng/tương tác, không phải toàn bộ danh sách online của TikTok; tự hết hạn sau 15 phút không có tín hiệu.

## Kiểm tra bản sửa

```powershell
npm run build
node scripts/test-live-runtime.cjs
node scripts/test-live-audio.cjs
node scripts/test-live-runtime-http.cjs
node scripts/test-studio.cjs
npm run test:christian
```

Các bài kiểm tra runtime dùng dữ liệu mẫu và server riêng; không kết nối TikTok thật, không khởi động worker Python, không ghi vào dữ liệu công đức đang dùng. `test-live-runtime-http.cjs --serve` mở bản xem trước riêng ở cổng 5199 để kiểm tra giao diện.

Cần thêm một lượt thử với room TikTok đang Live và đường âm thanh của LIVE Studio/OBS để xác nhận đầu vào/đầu ra thực tế.

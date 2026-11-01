# Vận hành một buổi Live

## Quyền phát và dữ liệu thử

- Kiểm tra quyền phát của tài khoản trước khi setup nguồn hình. Mở được giao diện LIVE Studio không có nghĩa tài khoản đã được phép Go LIVE. Thông báo “Access not available” cần được xử lý qua TikTok; connector không cấp quyền phát.
- `tiktok-live-connector` là thư viện không chính thức để nhận sự kiện từ phòng đang Live. LIVE Studio/OBS đảm nhận phát hình và tiếng. Chưa xác nhận đường truyền thật cho đến khi thử với một phòng Live và thiết bị người xem.
- Ưu tiên link nội bộ khi phần mềm phát chấp nhận. Cloudflare Tunnel chỉ là phương án HTTPS tùy chọn; dự án không tự khởi động tunnel. Quick Tunnel tạo địa chỉ công khai tạm thời, hết hiệu lực khi dừng tiến trình. Giữ riêng URL có token và chỉ cho phép origin HTTPS cụ thể qua `TEMPLE_CORS_ORIGINS` nếu dùng tunnel.
- Xóa người giả lập chỉ xóa ghế test, không xóa công đức đã lưu. Chat giả lập không cộng điểm; các nút nghi thức thủ công có cộng điểm và ghi vào bảng thí chủ. Trang Quản lý có thao tác đặt lại toàn bộ công đức/danh sách thí chủ với hộp xác nhận; thao tác này xóa dữ liệu tích lũy, không chỉ người test.
- Khi tải màn phát, nhân vật giữa điện giữ nhãn chờ trung tính; chỉ đổi sang tên người tương tác khi phát nghi thức, không tự lấy người đứng đầu bảng công đức.

## Điều khiển và màn phát

- **Phòng Live → Kết nối**: nhập token RPC từ terminal, nhập `@username` đang phát rồi kết nối TikTok. Có trạng thái kết nối, lỗi gần nhất, thời gian thử lại và nút ngắt kết nối.
- Màn phát dùng `http://127.0.0.1:3000/?obs=1#token=TOKEN_CUA_BAN`, kích thước 1080 × 1920. Token phải thuộc cùng server với bảng điều khiển.
- Giọng đọc, nhạc nền, pháp khí và âm lượng được lưu trên server và đồng bộ đến các màn đã xác thực. Bật/tắt áp dụng cả khi màn OBS dùng hồ sơ trình duyệt riêng.
- Trình duyệt hoặc phần mềm phát có thể yêu cầu tương tác để cho phép âm thanh. Kiểm tra tiếng thực tế trên điện thoại trước buổi Live; trạng thái nút bật tiếng không chứng minh đầu ra TikTok đã nghe được.
- File nhạc tải từ máy vẫn chỉ phát trong tab đã chọn file; thư viện nhạc có sẵn đồng bộ giữa các màn.
- **Đổi ảnh chánh điện**: ở **Quản lý → Tổng quan → Chánh điện Tam Thế**, chọn PNG/JPG/WebP tối đa 8 MB, xem trước rồi bấm **Tải lên và áp dụng**. Ảnh mới được lưu trong `data/stage-backgrounds`, giữ lại giữa các lần khởi động và tự đồng bộ sang Phòng Live/OBS; bấm **Ảnh mặc định** để quay lại ảnh ban đầu. Ảnh dọc 9:16 cho khung tốt nhất; ảnh ngang sẽ được cắt cho vừa, còn nhân vật và thẻ tương tác vẫn nằm phía trước.

## Hàng đợi nghi thức

Công đức được ghi nhận ngay khi nhận tương tác. Máy chủ chuẩn bị giọng đọc một lần rồi phát từng nghi thức theo thứ tự đến, có mốc thời gian bắt đầu/kết thúc chung cho mọi màn. Một lượt chờ đủ thời lượng động tác và giọng đọc trước khi chuyển người.

Nếu màn phát kết nối lại giữa lượt, nó nhận nhân vật hiện tại và phát tiếng từ vị trí thời gian tương ứng, không chạy lại toàn bộ cảnh đi vào. Nếu giọng đọc chưa sẵn sàng hoặc chuẩn bị quá 12 giây, lượt đó tiếp tục bằng hình ảnh và hiện thông báo ở bảng điều khiển.

Hàng chờ hình ảnh giới hạn 200 lượt. Khi quá tải, ưu tiên giữ quà hơn các lượt gõ mõ trong hàng; số lượt hình ảnh bỏ qua hiển thị công khai trên bảng điều khiển. Điểm và thống kê quà vẫn được ghi nhận, kể cả khi lượt hình ảnh bị bỏ.

## Tạm dừng khẩn cấp

Nút **Tạm dừng toàn bộ hiệu ứng / âm thanh** dừng tiếng đang phát, cảnh đang chạy và xóa hàng chờ trên các màn kết nối. Những tương tác tới sau vẫn được ghi điểm nhưng không xếp thêm hình ảnh. Nút tiếp tục cho phép phát những tương tác mới; các lượt đã dừng không tự phát lại. Giả lập tương tác cũng bị tắt khi tạm dừng.

## Quà tặng

Trong **Nghi thức → Phiên Live và cấu hình quà**, nhập ID quà (dạng số), tên gợi nhớ và chọn một trong sáu nghi thức. ID có thể xem trong danh sách quà vừa nhận. Cấu hình thay đổi hình thức trình diễn, không thay đổi số xu thực nhận hoặc công thức công đức của quà.

Combo tính theo phần tăng của số lượng tích lũy, bỏ gói lặp và gói chốt không tăng số lượng. Quà đơn không bị gộp chỉ vì cùng người gửi/cùng ID quà. Nếu dữ liệu quà đơn không có mã tin nhắn thì không thể phân biệt tuyệt đối một gói lặp với hai lần gửi giống nhau; ứng dụng giữ cả hai để không bỏ sót quà hợp lệ.

## Kết nối và phiên thống kê

- Mất kết nối TikTok: thử lại sau 2, 4, 8, 16 rồi tối đa 30 giây/lần. Nút ngắt kết nối và sự kiện TikTok kết thúc Live sẽ dừng thử lại.
- Không lấy lại lịch sử tương tác cũ lúc nối vào phòng, để tránh phát lại quà/chat trước khi ứng dụng bắt đầu nghe.
- Phiên thống kê bắt đầu khi kết nối được phòng; nối lại cùng phòng giữ nguyên phiên. Chuyển tài khoản, kết thúc Live hoặc ngắt thủ công sẽ lưu phiên trước.
- **Mở phiên thống kê mới** lưu phiên hiện tại rồi bắt đầu thống kê lại, giữ nguyên công đức tổng đã lưu.
- Có thời lượng, số user đã ghi nhận, đỉnh người xem, chat được chấp nhận, tim, follow, chia sẻ, số quà, xu và công đức. Giữ tối đa 20 phiên gần nhất; giao diện liệt kê 5 phiên gần nhất.
- User giả lập không tính vào phiên TikTok thật. Giả lập tương tác mặc định tắt sau khi khởi động lại server.
- Ghế dựa trên những người được nhận diện qua sự kiện vào phòng/tương tác, không phải toàn bộ danh sách online của TikTok; tự hết hạn sau 15 phút không có tín hiệu.

## Kiểm tra bản sửa

```powershell
npm run build
node scripts/test-live-runtime.cjs
node scripts/test-live-audio.cjs
node scripts/test-live-runtime-http.cjs
node scripts/test-studio.cjs
```

Các bài kiểm tra runtime dùng dữ liệu mẫu và server riêng; không kết nối TikTok thật, không khởi động worker Python, không ghi vào dữ liệu công đức đang dùng. `test-live-runtime-http.cjs --serve` mở bản xem trước riêng ở cổng 5199 để kiểm tra giao diện.

Cần thêm một lượt thử với room TikTok đang Live và đường âm thanh của LIVE Studio/OBS để xác nhận đầu vào/đầu ra thực tế.

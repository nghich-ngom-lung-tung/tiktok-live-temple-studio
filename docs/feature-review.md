# Rà soát tính năng hai hồ sơ — 02/11/2026

Phạm vi: Phật giáo và Thiên Chúa giáo, cả điều khiển/API, bảng Quản lý, Live/OBS, nội dung/giọng đọc/nhạc, thống kê và lưu dữ liệu. Đây là ghi nhận kiểm tra chức năng, không phải cam kết không còn mọi lỗi trên mọi máy hoặc chứng nhận đã phát TikTok thật.

## Lỗi phát hiện và đã sửa trong lần rà này

- **Phật giáo:** gói Like trên 50 lượt từng bị cắt điểm còn 50. Nay giữ số lượt nhận được (có giới hạn bảo vệ 1 triệu/lượt), tiếng mõ vẫn giới hạn số nhịp biểu diễn.
- **Combo quà Phật giáo:** cấp điểm/hiệu ứng từng phụ thuộc tổng xu của một gói sự kiện. Nay cấp dựa trên giá mỗi món, tổng điểm/hương/số quà nhân số lượng thực nhận; gom 100 quà 1 xu hoặc nhận từng món cho kết quả thống kê giống nhau.
- **Nhận diện Phật giáo:** không còn nhận chữ `que` trong `quen` thành xin quẻ; từ `hương`/`huong` đứng riêng được nhận đúng 3 nén hương. Bình luận thường vẫn dùng nghi thức mặc định 1 nén, đúng chính sách hiện có.
- **Thiên Chúa giáo:** bộ làm sạch chung từng cắt suy ngẫm, lời nguyện và lời đọc ở 120 ký tự dù giao diện cho phép 240/1000. Nay dùng giới hạn theo loại trường; tham chiếu Kinh Thánh trong lịch sử giữ dấu hai chấm/gạch nối.
- **Giọng đọc hai hồ sơ:** tắt giọng giữa lượt giải phóng phần thời gian chờ tiếng hoặc thời lượng audio dài, giữ thời gian cần cho hoạt ảnh. Christian nhận lại trạng thái có audio sau khi kết nối lại có thể phát theo mốc tiếng riêng, không cần nhận lại notification tiếng đã bị lỡ.
- **Dropdown:** Live Thiên Chúa giáo đã dùng cùng component với ba trang còn lại. Không dựng lại danh sách khi cập nhật về cùng giá trị, tránh mất vị trí bàn phím/lựa chọn đang thao tác do polling.
- **Nhạc riêng Phật giáo:** quay về thư viện dọn URL blob, thanh nghe thử và nhãn/tệp cũ; nhạc riêng lặp trong tab đã chọn tệp. Tệp riêng không được tải lên server hoặc đồng bộ thành file trên OBS.
- **Âm lượng Phật giáo:** bổ sung mức mặc định trên server (nhạc 65%, giọng 95%) để các màn không lấy mức lưu local từ hồ sơ khác làm giá trị mặc định.
- **Thống kê Phật giáo:** hồ sơ mới bắt đầu từ 0 thay vì các số mẫu 108 hương/1080 Công Đức. Đặt lại Công Đức cũng trả số liệu về 0. Không xóa dữ liệu lịch sử đã lưu của người dùng.
- **Lưu dữ liệu:** cả hai hồ sơ ghi snapshot theo thứ tự vào tệp tạm rồi thay thế tệp JSON hoàn chỉnh; Phật giáo bổ sung lưu `recentEvents`, nên lịch sử hoạt động còn sau khi khởi động lại.
- **Bộ kiểm tra:** `npm test` build rồi chạy các suite độc lập, dừng ngay khi có lỗi. Review server dùng dữ liệu/ảnh nền trong thư mục tạm cho cả hai hồ sơ; trước đây chỉ tách riêng tệp state Phật giáo.

Giới hạn chờ giọng Christian: thử thật phát hiện mẫu cần hơn 30 giây để tạo tiếng, nên mặc định đã khớp giới hạn 180 giây của worker; có thể đặt `CHRISTIAN_SPEECH_TIMEOUT_MS` từ 5000 đến 180000. Hoạt ảnh bắt đầu ngay, UI báo rõ đang tạo lời đọc, lượt sau vẫn chờ lượt hiện tại để không chồng nội dung. Đây là thời hạn tối đa, không phải mỗi lượt đều chờ đủ 180 giây. Test fixture dùng chung cấu hình này với production.

## Ma trận đã kiểm tra

| Nhóm tính năng | Phật giáo | Thiên Chúa giáo | Bằng chứng |
| --- | --- | --- | --- |
| Thao tác nghi thức | 7 lệnh: hương, mõ, chuông, hoa đăng, quà, đại lễ, quẻ | 9 lệnh: nguyện, suy ngẫm, nến, chuông, hiệp thông, bình an, tri ân, chào, cảm ơn quà | API thật trên review server, đúng loại event và lịch phát |
| Nội dung | 100 quẻ, chọn theo nhóm, tránh lặp | 100 suy ngẫm/10 nhóm, bản nháp, tham chiếu, chọn ngẫu nhiên | Suite nội dung và runtime; Live tải danh mục |
| Like/Follow/Share/chat/vào phòng | Từ khóa, tính điểm, thông báo, avatar, chat ngắn | Nhận diện, tên/ID/avatar, cooldown, thẻ chào | Dữ liệu sự kiện mẫu, kiểm tra HTTP/WS và trình duyệt |
| Quà | Combo, gói trùng/chốt, cấu hình ID, cấp quà, điểm | Số lượng, xu, cảm ơn, bảng người tặng theo phiên | Kiểm tra tổng hợp/connector giả lập, API thật |
| Hai màn Live/OBS | FIFO, timestamp, pause, thống kê | Timestamp hình/tiếng/về chỗ, pause, hủy tiếng trễ | HTTP/WS hai client; kiểm tra đồng hồ client |
| Nhân vật | Đổi và xoay vòng nhân vật, 200 vị trí, vái lạy | Nam/nữ, 200 vị trí, thứ tự đến, cúi đầu, về chỗ | Suite bố cục/chuyển động; kiểm tra trình duyệt ở lượt sửa trước |
| Nhạc | 6 WAV, đổi bài/tự chuyển, mức âm, tệp riêng | 6 WAV, đổi bài/tự chuyển, mức âm, nghe thử | API và trình duyệt; chống hai màn cùng chuyển bài |
| Giọng thật | Lời đọc dài >160 ký tự, tạo WAV/tải có xác thực | Nghe thử >240 ký tự; lời nguyện thật tạo tiếng với mốc riêng | ZeroTTS local thực trên review server |
| Ảnh nền | Upload PNG, áp dụng, truy cập, khôi phục | Upload PNG, áp dụng, truy cập, khôi phục | API upload với ảnh thật của từng hồ sơ, dữ liệu riêng |
| Lưu dữ liệu | Hoạt động/thống kê/cài đặt | Hoạt động/thống kê/cài đặt | Ghi đồng thời 30 snapshot, khởi tạo lại cả hai model |

Kiểm tra trình duyệt cho dropdown Nhạc Christian: dùng menu tùy biến, chọn “Bình minh ân sủng”, nhãn và dấu chọn cập nhật đúng. Phòng Live Phật giáo tải trạng thái từ server, dùng cùng component dropdown, không có lỗi console trong lượt xem này.

Kết quả cuối đợt: `npm test` qua toàn bộ build/TypeScript và 6 suite. `test-studio-http.cjs` qua với ZeroTTS thật; `test-profile-features.cjs` qua toàn bộ lệnh hai hồ sơ, ảnh nền và cách ly dữ liệu, nghe thử dài, cũng như lời nguyện Christian thật (hình không đợi tiếng, mốc tiếng riêng, thời gian trở về và tạm dừng). Lần thử với giới hạn 30 giây đã thất bại đúng tại giới hạn; sau khi sửa thời hạn theo worker và dùng cùng chính sách cho production/fixture, kiểm tra thật đã chạy qua.

## Cách chạy lại

```powershell
npm test
```

Kiểm tra thêm với ZeroTTS thật (hai terminal):

```powershell
node scripts/review-server.cjs
```

```powershell
node scripts/test-studio-http.cjs
node scripts/test-profile-features.cjs
```

Nhóm kiểm tra thật sử dụng review server riêng tại cổng 3012, giữ dữ liệu/ảnh nền trong thư mục tạm; không dùng phòng TikTok hoặc thống kê Live của người dùng. Model/cache tiếng local vẫn được dùng lại. Tắt review server bằng Ctrl+C sau khi xong.

## Phần chưa kiểm chứng ngoài môi trường local

- Chưa mở buổi TikTok thật để xác nhận đầy đủ số Like/Follow/Share/quà mà connector nhận từ nền tảng.
- Chưa nghe và đối chiếu âm thanh đầu ra trên thiết bị người xem qua OBS/TikTok LIVE Studio trong lần rà này. Tạo/tải WAV thật thành công không thay thế kiểm tra đầu ra phát sóng.
- Chưa kiểm tra trên tất cả cấu hình máy/trình duyệt. Tốc độ ZeroTTS và chính sách tự phát âm thanh phụ thuộc thiết bị.

Trước buổi phát đầu tiên: khởi động lại backend, tải lại Live/OBS, bật âm thanh và thử một lượt nhận tương tác trên room thật. Những giới hạn từ TikTok không được diễn đạt thành bảo đảm không bỏ sót mọi sự kiện.

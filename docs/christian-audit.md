# Rà soát Live Thiên Chúa giáo — 02/11/2026

## Các lỗi đã xử lý

- RPC kết nối/ngắt TikTok gọi sai giao diện của `profileLiveCoordinator`.
- Quản lý chỉ lấy trạng thái mỗi 6 giây; đã nhận WebSocket theo hồ sơ, có polling dự phòng.
- Live chưa đọc `christian.playback`, bỏ qua mốc bắt đầu/kết thúc, không khôi phục lượt đang phát khi tải lại. Đã dùng lịch server, chống phát trùng và truyền thời điểm bắt đầu xuống audio để bù vị trí đọc.
- Tạm dừng chưa xóa hàng đợi. Đã hủy lượt hiện tại/lượt chờ, chặn kết quả TTS đến trễ và dừng hiệu ứng/âm thanh.
- TTS chỉ tạo khi đến lượt, bỏ tiếng nếu vượt 12 giây. Riêng hồ sơ Thiên Chúa giáo chuẩn bị trước một lượt kế tiếp; thời hạn chờ khớp 180 giây của worker. Tốc độ tạo tiếng lần đầu vẫn phụ thuộc máy và độ dài nội dung.
- Thông điệp phát Live từng tạo TTS ngoài hàng đợi, có thể đổi thứ tự. Nay nhận lệnh vào cùng hàng đợi; nghe thử vẫn chỉ phát trên máy đang thao tác.
- Thẻ nến/chuông/đại lễ/bình an từng dùng chung lệnh cầu nguyện. Đã tách hành động, lời dẫn, hiệu ứng SVG/CSS và tiếng nhạc cụ tổng hợp. Đây chưa phải bộ hoạt cảnh nhân vật 8 tư thế mới hay bản thu hợp xướng.
- Tri ân thủ công không còn tạo quà/xu giả; bảng người tặng của phiên không còn cộng doanh số từ các phiên trước.
- Bình luận cầu nguyện mất tên hiển thị do truyền `name` vào hàm nhận `user`.
- Số người xem, trạng thái TTS và mở phiên mới được cập nhật realtime.
- Server cấp vị trí cho từng người; mở lại OBS không tự phân lại hàng theo thứ tự tương tác mới nhất.
- Hai màn kết thúc nhạc đồng thời chỉ chuyển bài một lần.
- Đổi tham chiếu suy ngẫm dùng đúng lời mẫu, giữ bản nháp từng mục, có nút khôi phục. Kho có 100 lời theo chủ đề; đây là bài suy ngẫm, không phải trích nguyên văn Kinh Thánh.
- Theo yêu cầu, bỏ kết nối TikTok và giả lập/chat thử khỏi Quản lý; sử dụng các chức năng này tại Phòng Live.
- Sửa lỗi promise `AudioContext.resume()` bị từ chối khi tạm dừng nhanh; tạo lại context đã đóng.
- Sửa metadata `profileId` bị truyền thành cài đặt nghi thức Phật giáo khiến RPC cập nhật cài đặt báo lỗi.

## Kiểm chứng

- `npm run build` (bao gồm TypeScript).
- `npm run test:christian`: hành động riêng, tên người gửi, tạm dừng, validation không ghi dở cài đặt, thống kê phiên, vị trí ổn định, tạo giọng hơn 12 giây, chuẩn bị trước, hủy kết quả trễ, lịch client và HTTP/WebSocket hai màn.
- `node scripts/test-live-runtime.cjs`, `node scripts/test-live-runtime-http.cjs`, `node scripts/test-live-audio.cjs`, `node scripts/test-studio.cjs`.
- Trình duyệt với fixture riêng: bấm nến, chuông, tri ân, bình an, chào đón, đại lễ và suy ngẫm; đối chiếu hai màn; tạm dừng; 200 người đứng; tải lại giữ vị trí; chat đúng người; đổi tham chiếu/khôi phục bản nháp; Quản lý không còn hai khối bị trùng.
- ZeroTTS thật, một mẫu trên máy: khởi động model 20,8 giây; tạo 4,47 giây tiếng mất 4,335 giây lần đầu; cache đọc lại khoảng 1 ms. Không coi đây là cam kết độ trễ cho mọi nội dung/giọng/máy.

Fixture không kết nối phòng TikTok thật, không ghi trạng thái Live của người dùng. Cần khởi động lại backend đang chạy để nhận mã mới; chưa kiểm chứng luồng phát/âm thanh đầu ra trong TikTok LIVE Studio.

## Cập nhật kho nội dung và giao diện Nhạc

- Đã gộp Kinh Thánh và Giọng đọc thành **Nội dung & giọng đọc**; mở rộng thành [100 lời suy ngẫm / 10 chủ đề](christian-reflections.md), có chọn ngẫu nhiên tránh lặp, nghe thử bản đang soạn và giữ bản nháp khi đổi lựa chọn.
- Tab Nhạc sử dụng cùng `track-list` / `track-row` và bố cục hai cột như trang Phật giáo. Đã sửa vùng thư viện bị trống do lệch ID và thiếu phần tạo hàng bài hát.
- Sáu bài nhạc riêng có số thứ tự, mô tả và thời lượng đo từ WAV: 23,2 giây (hiển thị 0:23). Trình phát luôn hiện, có nghe thử, bài tiếp theo, tự chuyển bài, bật/tắt nhạc và âm lượng Live.
- Bổ sung ba bản phối không lời tự tổng hợp: **Vườn bình an** (đàn hạc gảy), **Sớm mai bình an** (sáo mềm) và **Dòng nước tĩnh lặng** (dây ngân dài); mỗi bản có vòng hợp âm và giai điệu riêng.
- Có mục **Nhạc của bạn**, dùng picker chung, nhận tệp audio tối đa 50 MB để nghe thử trong tab. Chọn lại bài thư viện sẽ giải phóng URL tệp riêng và xóa nhãn tệp cũ; không tải tệp lên server.
- Kiểm tra trình duyệt: chọn hàng bài và dropdown cùng cập nhật; nghe thử đúng WAV (duration 23,2 giây); chuyển bài; chọn WAV cục bộ phát qua blob; quay về thư viện không còn blob/nhãn cũ; không có lỗi console.

## Nhân vật và hoạt cảnh tương tác

- Thay lưới cố định bằng `christianLayoutForCount`: người đến trước ở hàng trên của vùng sàn trống phía trước dãy ghế, người đến sau dàn dần về phía HUD. Với 200 người, chiều cao khung nhân vật là 230–300 px; 12 người dùng khoảng 291–320 px. Giữ đủ 200 vị trí, hai bên lối giữa, theo thứ tự đến do server cấp.
- Trong cảnh đông, bỏ các huy hiệu chữ tròn phủ lên đầu; tên/avatar vẫn có trong nhân vật và hiện khi trỏ, chọn bằng bàn phím hoặc người đó chat. Cảnh ít người vẫn hiện thông tin thường xuyên.
- Thêm lớp trình bày cho cả 8 thao tác nhanh: card có loại nghi thức, người gửi/avatar, tiêu đề, lời nguyện/suy ngẫm; nhân vật đi từ phía dưới lên lối giữa rồi đứng chắp tay; hiệu ứng và âm thanh theo từng loại. Không có người chủ lễ đứng sẵn ở cảnh chờ; cha xứ trong ảnh nền vẫn ở bục.
- Card và nhân vật theo lịch phát của server. Tải lại giữa lượt khôi phục trạng thái hiện tại; hết lượt, tạm dừng hoặc đăng xuất đều dọn nhân vật/card/hiệu ứng. Tôn trọng chế độ giảm chuyển động.
- Bộ ảnh gồm dáng đứng chắp tay, sprite đi bộ 8 khung và hai ảnh cúi đầu cầu nguyện nam/nữ mới tạo bằng imagegen. Nhân vật vẫn đứng, hai chân giữ trên sàn; chuyển lớp ảnh đứng → cúi đầu → đứng lại theo lịch chung. Prompt và đường dẫn tài nguyên được lưu trong [christian-bow-prompts.json](christian-bow-prompts.json).
- Kiểm tra: bố cục 12/200 người bằng ảnh trình duyệt; đủ 200 người đứng, 8 nút đều có đúng card/người gửi và một nhân vật; đo vị trí nhân vật thực sự thay đổi khi đi; tải lại giữa lượt giữ đúng cảnh; tạm dừng dọn actor/card; console không có lỗi. Fixture chỉ dùng dữ liệu thử, chưa kiểm chứng TikTok LIVE Studio thật.

### Cập nhật ngày 02/11/2026

- Thứ tự đến dùng số tăng dần chung cho người thật và người giả lập. Chat lại giữ nguyên thứ tự; người mới không lấy chỗ của người đã rời phòng ở phía trên. Thu nhỏ số người giả lập vẫn giữ thứ tự những người còn lại.
- Thao tác thủ công tạo người thực hiện nghi thức riêng, không tự thêm người xem ảo vào hàng cộng đoàn.
- Nhân vật thực hiện đi 4,6 giây tới tọa độ chân Y=1020 trên sân khấu 1080×1920, gần bậc cung thánh; thu nhỏ theo chiều sâu. Khi khôi phục giữa lượt, giữ cùng điểm đến và thời điểm cúi đầu.
- Cầu nguyện, thắp nến, hiệp thông, chúc bình an và tri ân có cúi đầu đồng bộ cộng đoàn. Ảnh cúi đầu được tải trước; người tới trong lượt tham gia đúng thời điểm hiện tại. Tạm dừng/hết lượt dọn toàn bộ chuyển động, trả tư thế đứng. Lượt nghi thức Thiên Chúa giáo kéo dài tối thiểu 10 giây để đủ đi, cúi đầu và ngẩng lên.
- Đã kiểm tra trình duyệt hai màn Live/OBS: vị trí chân nhân vật từ khoảng 678 px lên 382,5 px ở khung OBS cao 720 px; lớp cúi đầu hiện trên actor và 12 người; tải lại giữ cảnh; tạm dừng trả opacity lớp cúi đầu về 0. Không có lỗi console trong lượt kiểm tra.

### Sửa vị trí giẫm lên ghế

- Bố cục hàng cũ bắt đầu ở Y=1080, trùng dãy ghế của ảnh nền. Dãy ghế cuối kết thúc khoảng Y=1280; hàng cộng đoàn mới bắt đầu ở Y=1340 và kết thúc tối đa Y=1650, chừa khoảng đệm cho chân và bóng nhân vật. Đường vào chỗ rẽ sang hai bên trên vùng sàn phía trước ghế.
- Giữ lối giữa trống để nhân vật nghi thức đi thẳng lên sát bậc cung thánh. Người vào trước vẫn ở hàng trên; người vào sau đứng phía dưới. Kiểm tra hồi quy ràng buộc mọi vị trí chân của 1–200 người nằm ngoài vùng ghế.

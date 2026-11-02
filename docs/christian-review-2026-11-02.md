# Rà soát toàn luồng Thiên Chúa giáo — 02/11/2026

> Cập nhật tiếp theo: [rà tính năng cả hai hồ sơ](feature-review.md) đã kiểm tra ZeroTTS thật và sửa thêm giới hạn ký tự, khôi phục tiếng, dropdown và lưu dữ liệu. Thời hạn giọng hiện mặc định 180 giây (có cấu hình), thay cho 30 giây ghi trong lịch sử sửa bên dưới.

Đợt rà soát này đọc luồng TikTok → service/state/RPC → hàng đợi → Live/Admin/OBS, giọng đọc, nhân vật, thư viện nội dung/nhạc và hướng dẫn. Phần phát hiện bên dưới lưu trạng thái trước khi sửa. Xem phần kết quả sửa cuối tài liệu để biết trạng thái hiện tại. Không dùng phòng TikTok thật hoặc chạy Python/ZeroTTS thật; không thay đổi dữ liệu Live đang lưu.

## Lỗi cần ưu tiên

### 1. P1 — Giọng tạo xong muộn bị cắt đầu hoặc bỏ cả câu

- `src/services/ceremonyQueue.js:93` gửi `christian.speech` với `startsAt` của hoạt ảnh, dù âm thanh vừa được tổng hợp xong.
- `src/views/scripts/christianLive.ts:677` chuyển mốc này sang audio; `src/views/scripts/audio.ts:547` tua theo thời gian đã trôi qua từ mốc đó. Khi thời gian này lớn hơn độ dài WAV, audio bỏ cả clip.
- Tái hiện bằng queue độc lập cấu hình `nonBlockingSpeech: true` giống production: cảnh bắt đầu tại 1250 ms, tiếng sẵn sàng tại 5000 ms, WAV dài 2 giây. Offset được yêu cầu là 3,75 giây → bỏ cả clip.
- Cần có mốc bắt đầu tiếng riêng được máy chủ phát cho mọi màn; khi tải lại chỉ tua theo mốc tiếng, không lấy mốc đi bộ.

### 2. P2 — Nhân vật chưa về tới chỗ đã bị lượt mới cắt ngang

- `src/views/scripts/christianPresentation.ts:105` cho nhân vật đi về trong 2600 ms khi lượt kết thúc.
- Queue chuyển lượt sau khoảng đệm 250 ms (`ceremonyQueue.js:50`), rồi lịch client chờ thêm 250 ms tới lượt mới. `show()` của lượt mới gọi `clear()` (`christianPresentation.ts:119`) trước khi đoạn về hoàn thành.
- Nếu có attendee thật: actor bị xóa, attendee hiện ngay ở vị trí cũ. Nếu là người điều hành: `park()` đưa actor thẳng tới vị trí đích. Do đó khi hàng chờ liên tục, chuyển động về không chạy trọn vẹn.
- Lịch phát cần tính cả thời gian trở về hoặc giữ độc lập từng actor đang về.

### 3. P2 — Một người có thể hiện đồng thời ở chỗ đứng và lối giữa

- `christianPresentation.ts:118` tạo actor nghi thức nhưng chưa ẩn attendee cùng người gửi.
- Attendee chỉ được tìm và thêm `is-ritual-hidden` trong `finish()` ở dòng 77–78, tức lúc bắt đầu về.
- Với người xem thật đang có chỗ trong cộng đoàn, lúc đi lên có thể thấy hai bản của cùng một người. Cần chuyển attendee sang actor từ đầu lượt rồi trả lại sau khi về.

### 4. P2 — Bình luận tự nhiên “cầu bình an” không chạy hành động

- `src/profiles/thien-chua-giao/service.js:185` loại nhánh bình an khi có chữ cầu/nguyện.
- Nhánh lời nguyện ở dòng 190 chỉ nhận cầu nguyện/xin cầu/prayer/pray for. “cầu bình an cho gia đình” không thuộc nhánh nào.
- Đã gọi trực tiếp service với câu này và nhận `null`. Chat vẫn có thể hiện, nhưng không có lời nguyện hay nghi thức.
- Cần thống nhất bộ từ khóa, bổ sung các cách nói tự nhiên và xác định rõ ưu tiên khi câu chứa nhiều loại thao tác.

### 5. P2 — Bộ kiểm tra không còn phản ánh đường production

- `npm run test:christian` thất bại ở `scripts/test-christian-runtime.cjs:194`: mong `/second.wav`, thực tế còn `/first.wav`.
- Bài kiểm tra tiến đồng hồ tới `endsAt`, trong khi queue hiện đợi thêm 250 ms mới kết thúc. Đây là khác biệt giữa kỳ vọng test và lịch mới; riêng thất bại này không chứng minh queue production bị kẹt.
- Fixture Christian vẫn cấu hình luồng chờ tiếng; production ở `src/server.js:54` dùng `nonBlockingSpeech: true`. Do đó phần giọng bất đồng bộ hiện tại chưa được bài kiểm tra này bao phủ đúng.
- `node scripts/test-live-runtime.cjs` cũng thất bại tại dòng 91 vì lịch chuyển lượt tương tự. Các kiểm tra nằm sau assertion thất bại chưa được thực thi trong hai script này.
- Cần cập nhật fixture theo production và kiểm tra âm thanh đến trễ, khôi phục giữa lượt, kết thúc/về chỗ với hàng chờ liên tục.

## Chỗ thiếu hoặc chưa khớp trải nghiệm/hướng dẫn

### 6. Kinh Thánh yêu cầu ngoài danh mục bị đổi thành bài khác

- Parser chỉ tìm tham chiếu trùng chuỗi có sẵn ở `service.js:174`. Nếu không tìm thấy, nó vẫn gọi `shareScripture` với reference trống và chọn bài theo chủ đề/ngẫu nhiên.
- Ví dụ “xin kinh Thi Thiên 999:1” không có thông báo không hỗ trợ; hệ thống sẽ chọn nội dung khác. README nói có thể nêu sách/câu nên cần giới hạn rõ danh mục hỗ trợ hoặc phản hồi khi không tìm được.
- Nếu chỉ nêu tham chiếu dùng chung cho nhiều bài suy ngẫm, `findScripture()` lấy bài đầu tiên cho tham chiếu đó, không xoay vòng các bài cùng tham chiếu.

### 7. Có thể thấy chat nhưng không thấy thao tác, hoặc phải chờ lâu

- Cooldown thao tác bình luận chung là 3500 ms/người (`service.js:170`); bong bóng chat dùng 250 ms. Bình luận thứ hai có thể hiện chat nhưng bị bỏ phần thao tác, chưa có phản hồi riêng giải thích.
- Cầu nguyện/nến/hiệp thông/bình an/tri ân giữ tối thiểu 10 giây mỗi lượt (`ceremonyQueue.js:38`); những người tới sau phải chờ. Tiếng dài hoặc tạo tiếng muộn khi lượt còn chạy có thể kéo dài lượt hơn nữa.
- Đây là chính sách hiện tại, không tự chứng minh lỗi hiệu năng. UI nên phân biệt đã nhận, đang chờ và đang phát; dòng báo “đã đưa lên Live” hiện dễ bị hiểu là cảnh đã bắt đầu.

### 8. Giọng chưa sẵn sàng lúc tới lượt không được thử lại cho lượt đó

- `ceremonyQueue.js:53` chỉ tạo tiếng bất đồng bộ nếu worker đang ready. Nếu worker chưa ready, cảnh vẫn chạy với lỗi giọng đọc; sau khi worker ready không có logic tự tạo lại tiếng cho chính lượt đó.
- Cần ghi rõ hành vi hoặc có chính sách chờ/thử lại hữu hạn mà không chặn hình ảnh.

### 9. Like/Follow/Share không có nghi thức nhân vật riêng; thông tin người gửi bị giảm

- `service.js:129–147` chỉ cập nhật thống kê và phát `christian.activity`; frontend đổi thành bong bóng thông báo (`christianLive.ts:679`). Đây là hoạt động nhẹ, không phải thao tác đi lên/cúi đầu.
- Payload Like chưa kèm uniqueId/avatar. Follow/Share có các trường đó nhưng frontend chỉ truyền tên và nội dung vào `showChat()`. Người trùng tên có thể gắn bong bóng nhầm vị trí, avatar thật không được dùng cho thông báo này.

### 10. Chào khách mới chỉ hiện tên/avatar, lời chào chưa được dùng

- `memberJoined()` gửi trường `greeting`, nhưng `showMember()` chỉ cập nhật tên, avatar và thẻ CHÀO MỪNG. Không phát TTS lời chào tự động ở luồng MEMBER.
- Thẻ chào dùng một timer/element chung: nhiều người vào sát nhau sẽ thay tên người trước thay vì xếp lượt thẻ. Cộng đoàn vẫn có từng người được ghi nhận.

### 11. Tài liệu rà soát cũ đã lỗi thời

- `docs/christian-audit.md` còn mô tả chờ TTS tới 180 giây và dọn nhân vật sau mỗi lượt, trong khi production đã dùng tiếng không chặn hình và có nhân vật trở về/đứng lại.
- README chưa nêu rõ giới hạn nhận dạng tham chiếu, cooldown và hành vi của Like/Follow/Share bên Christian.
- Phiên thống kê có prayerRequests/scriptureShares/giftCount/coins nhưng không có bộ đếm thanksgiving theo phiên; tri ân hiện là số tích lũy. Hướng dẫn không nên mô tả tất cả là thống kê riêng theo phiên.

## Kết quả kiểm tra thực tế của đợt này

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run build` (bao gồm TypeScript) | Qua |
| `npm run test:christian` | Không qua: assertion dòng 194; các phần sau chưa chạy |
| `node scripts/test-live-runtime.cjs` | Không qua: assertion dòng 91; các phần sau chưa chạy |
| `node scripts/test-live-runtime-http.cjs` | Qua |
| `node scripts/test-live-audio.cjs` | Qua |
| `node scripts/test-studio.cjs` | Qua |
| Tái hiện speech bất đồng bộ với queue production | Xác nhận offset 3,75 giây cho WAV 2 giây |
| Gọi parser với “cầu bình an cho gia đình” | Xác nhận không có hành động (`null`) |

Các bài qua đã kiểm tra nhiều phần: danh mục 100 bài/10 chủ đề, tọa độ 200 người, cúi đầu, xác thực HTTP/WebSocket, đồng bộ hai client, xử lý combo quà, hủy âm thanh và mute. Chúng không thay thế kiểm tra giao diện trực quan hoặc âm thanh đầu ra trên TikTok thật. Đợt này chưa chạy trình duyệt trực quan, chưa xác nhận ảnh/sprite thực tế khi đông người hoặc hình/tiếng ra OBS/LIVE Studio.

Thứ tự sửa đề xuất: mốc giọng đọc → lịch trở về và ẩn/hiện đúng người → fixture/test → bộ nhận diện bình luận và tham chiếu → thông tin hoạt động/chào khách → cập nhật hướng dẫn.


## Kết quả sửa sau rà soát

- **1:** Thêm `speechStartsAt` riêng, lưu trong playback để khôi phục OBS; audio chờ đúng mốc tiếng và chỉ tua từ mốc tiếng. Không dùng mốc đi bộ cho WAV mới tạo.
- **2–3:** Lịch máy chủ có `returnsAt` và 2,6 giây trở về trước `endsAt`. Client chạy trở về theo lịch, khôi phục giữa đoạn về bằng offset. Attendee cùng ID được ẩn từ lúc diễn và hiện lại khi về xong. Người thao tác thử không tạo bản sao người giả lập trong danh sách thật.
- **4, 6:** Nhận “cầu bình an”, “xin Chúa”; đọc tham chiếu trên chat gốc để giữ dấu hai chấm/gạch nối. Tham chiếu ngoài thư viện có thông báo, không chọn bài thay thế. Các bài cùng tham chiếu được xoay vòng.
- **5:** Fixture và bài kiểm tra Christian dùng `nonBlockingSpeech: true` như production, giới hạn 30 giây. Lịch chung kết thúc đúng `endsAt`, sửa chênh lệch 250 ms với kiểm tra runtime.
- **7–8:** UI báo nhận/xếp lượt thay vì báo đã phát. Cooldown có thông báo phản hồi; worker chưa ready được thử lại trong hạn 30 giây; quá hạn có lỗi hiển thị, không phát tiếng cũ chen lượt mới.
- **9:** Giữ uniqueId và avatar xuyên suốt thông báo Like/Follow/Share; tiếp tục dùng bong bóng hoạt động nhẹ để không làm đầy hàng đợi nghi thức.
- **10:** Thẻ chào sử dụng greeting được gửi về, xếp hàng tối đa 200 thẻ và dọn khi tạm dừng/đăng xuất. Chào tự động hiển thị lời chào; thao tác chào thủ công có giọng qua hàng đợi nghi thức.
- **11:** README/hướng dẫn vận hành đã mô tả nhận diện, cooldown, mốc tiếng, thời gian trở về và giới hạn chờ tiếng. Bổ sung thanksgiving theo phiên và hiển thị trong trạng thái phiên.

Kiểm chứng sau sửa: build/TypeScript và các bộ test Christian, runtime, HTTP/WS, audio, studio đều qua. Bổ sung kiểm tra mốc tiếng mới khi tổng hợp muộn, worker chuyển sang ready, hủy tiếng trễ sau pause, giữ đủ 2,6 giây trở về, nhận diện bình luận tự nhiên, tham chiếu không hỗ trợ, xoay vòng theo tham chiếu và định danh Like. Kiểm tra trình duyệt dùng fixture độc lập: cộng đoàn 12 người, đúng người gửi trên card, một actor hoạt động và attendee tương ứng được ẩn.

Chưa dùng tài khoản TikTok/ZeroTTS thật trong lần sửa này; cần khởi động lại backend và tải lại Live/OBS để nhận mã mới.

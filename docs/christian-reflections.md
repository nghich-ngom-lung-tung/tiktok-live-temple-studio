# Kho suy ngẫm và giọng đọc Thiên Chúa giáo

Trang Quản lý có một tab **Nội dung & giọng đọc**, thay cho hai tab Kinh Thánh và Giọng đọc. Các URL dùng `tab=scripture` hoặc `tab=voiceSettings` được chuyển về tab mới.

Kho gồm **100 lời suy ngẫm biên soạn riêng**, chia đều 10 chủ đề:

| Chủ đề | Số lời |
| --- | --- |
| Đức tin & chở che | 10 |
| Bình an | 10 |
| Hy vọng & kiên trì | 10 |
| An ủi & nghỉ ngơi | 10 |
| Gia đình & trẻ nhỏ | 10 |
| Yêu thương & nhẫn nại | 10 |
| Tha thứ & hòa giải | 10 |
| Biết ơn & tạ ơn | 10 |
| Khôn ngoan & lựa chọn | 10 |
| Sẻ chia & phục vụ | 10 |

Mỗi lời có ID riêng, số thứ tự, tiêu đề, chủ đề, tham chiếu và nội dung dưới 240 ký tự. Đây là **100 lời suy ngẫm, không phải 100 câu Kinh Thánh trích nguyên văn**. Nhiều lời có thể cùng tham chiếu một đoạn.

Chọn chủ đề, chọn lời mẫu hoặc sửa nội dung, nghe thử bản đang soạn bằng giọng bên phải rồi chia sẻ lên Live. Bản nháp từng lời được giữ khi chuyển lựa chọn trong cùng trang; “Dùng lại lời mẫu” khôi phục nội dung gốc. Lời dẫn tự động cho tương tác nằm trong phần mở rộng bên dưới, sử dụng cùng cấu hình ZeroTTS.

Quản lý và Phòng Live dùng chung kho. Chọn ngẫu nhiên do server quản lý bằng túi xáo trộn: mỗi chủ đề hết 10 lời mới xáo lại; toàn kho hết 100 lời mới xáo lại. Bình luận “xin suy ngẫm Kinh Thánh về gia đình” có thể chọn nội dung theo chủ đề thay vì luôn lấy mục đầu tiên. Các tham chiếu từ phiên bản 4 mẫu vẫn được nhận diện.

Nút nghe thử chỉ phát trên máy đang thao tác; nút chia sẻ đưa bản chỉnh sửa vào hàng đợi hình/tiếng trên Live/OBS. Nút nghe thử cũ trỏ nhầm phần tử audio cũng đã được sửa.

## Nguồn đối chiếu tham chiếu

Các lời suy ngẫm là nội dung gốc, không sao chép bản dịch. Các đoạn nền được đối chiếu tại:

- [Thi Thiên 23](https://www.biblegateway.com/passage/?search=Psalm+23&version=KJV).
- [Giăng 14:27](https://bible.usccb.org/bible/john/14) và [Phi-líp 4:6–7](https://bible.usccb.org/bible/philippians/4).
- [Rô-ma 12:12](https://bible.usccb.org/bible/romans/12).
- [Ma-thi-ơ 11:28](https://bible.usccb.org/bible/matthew/11).
- [Mác 10:14–16](https://bible.usccb.org/bible/mark/10).
- [1 Cô-rinh-tô 13:4–7](https://bible.usccb.org/bible/1corinthians/13).
- [Ê-phê-sô 4:32](https://bible.usccb.org/bible/ephesians/4).
- [1 Tê-sa-lô-ni-ca 5:18](https://bible.usccb.org/bible/1thessalonians/5).
- [Gia-cơ 1:5](https://bible.usccb.org/bible/james/1).
- [Ga-la-ti 6:2](https://bible.usccb.org/bible/galatians/6).

Kiểm tra: `npm run build`, `npm run test:christian`; kiểm thử trình duyệt gồm lọc 10/100 mục, 10 lượt ngẫu nhiên không trùng, giữ bản nháp, khôi phục mẫu, nghe thử nội dung và hiển thị bản chỉnh sửa trên Live.

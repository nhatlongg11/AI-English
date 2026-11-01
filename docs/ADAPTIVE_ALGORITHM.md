# Thuật toán học thích ứng v1

Mục tiêu là minh bạch và tái lập, chưa phải thang đo mastery được chuẩn hóa. Phiên bản `weighted-window-v1`; không dùng neural network hoặc huấn luyện mô hình.

## Điểm kỹ năng

Tách kỹ năng theo `tense:errorCode`. Lấy tối đa 10 attempt **đã có kết luận** gần nhất theo thời gian và ID. Free-text pending (`correct:null`) không làm thay đổi snapshot. Với n câu và câu i theo thứ tự cũ → mới, trọng số i = 1..n:

`mastery = sum(i * correct_i) / sum(i)`

Recent accuracy là tỷ lệ đúng không trọng số trong cửa sổ; recentErrors là số lần sai có mã xác nhận trong cửa sổ. Snapshot lưu tổng lượt có kết luận, mastery, recentAccuracy, recentErrors, độ khó hiện tại, lastPracticedAt. Chưa có dữ liệu thì ưu tiên sử dụng prior 0.5. Ví dụ sai, sai, đúng → mastery = 3/6 = 0.5. Điểm không phải xác suất hiệu chỉnh hoặc bằng chứng tác động giáo dục.

Độ khó 1–5: ba kết quả đúng liên tiếp tăng 1; hai kết quả sai liên tiếp giảm 1; clamp tại 1/5. Thực hiện sau mỗi lượt có kết luận, nên chuỗi thành công dài có thể tiếp tục tăng cho mỗi lượt tiếp theo. Câu fallback có thể thấp hơn độ khó mục tiêu; lý do được ghi lại.

## Chọn adaptive

1. Xét kỹ năng trong bank đã duyệt và snapshots, có thứ tự xác định bằng skillId.
2. `priority = 2*(1-mastery) + 0.2*recentErrors + daysSincePractice/300`, ngày giới hạn 0..30; kỹ năng mới dùng 30 ngày và prior 0.5.
3. Sau mỗi 5 lượt, ưu tiên review kỹ năng mastery ≥ 0.8 với điểm `10 + days/30`.
4. Chọn điểm cao nhất; hòa điểm dùng skillId; chọn câu đúng skill/độ khó, ưu tiên chưa làm, sau đó tránh lặp ngay câu vừa làm. Thứ tự câu dùng ID cố định đã lưu.
5. Nếu thiếu câu exact, ghi `generationRequest` và dùng câu đã duyệt gần độ khó nhất cùng skill; tiếp theo câu khác đã duyệt để duy trì luyện tập. Nếu kho trống trả question null, không lộ draft. `reason.fallback` cho biết độ lệch này.

Ví dụ học sinh sai E01 nhiều lần ở Present Simple: recentErrors tăng, mastery giảm; priority tăng cho `present_simple:E01`. JSON reason lưu skill, điểm, mastery, lỗi gần đây, mục tiêu độ khó và việc có review/fallback. Cùng dữ liệu, bank và thời điểm sẽ có cùng kết quả; không ngẫu nhiên. GET next lặp lại giữ assignment đang chờ; submission có unique decisionId chống tính lặp. Thời gian thực ảnh hưởng spaced review, nên quyết định lưu reason và timestamp để kiểm toán.

## Baseline và nghiên cứu

Baseline đi theo thứ tự ba tense: present_simple → present_continuous → past_simple tại difficulty 1, rồi 2..5. Mỗi bước 4 attempt; sau 60 lượt lặp chu kỳ. Chọn từ **cùng bank đã duyệt** và dùng cùng luật tránh lặp; không dùng mastery để thay đổi bước. Nếu thiếu nội dung, fallback được ghi và đề nghị tạo nội dung mục tiêu. Muốn so sánh công bằng cần giáo viên chuẩn bị đủ nội dung cho mọi bước, độ khó và skill trước thí nghiệm; không xem fallback là tương đương với nội dung đã cân bằng.

Admin gán experimentGroup và mode khi tạo student, lưu xuyên suốt attempts/decisions/export. Phân nhóm ngẫu nhiên, pre/post-test, trình độ đầu vào và phân tích thống kê là thủ tục nghiên cứu sau này, chưa được tự động hóa. Nên chỉ dùng MC đã giáo viên đánh giá ở giai đoạn đầu; pending free text có thể làm baseline bước tiến mà không cập nhật mastery và phải được phân tích riêng.

## Thiếu nội dung

`GET /ai/content-needs` cung cấp yêu cầu cho teacher/admin; nhân sự dùng generate rồi kiểm tra/approve. Luồng học sinh không tự tạo chi phí hay publish câu. GET next trả generationNeeded cả khi có fallback. Các nhu cầu là nhật ký append-only, có thể trùng, giới hạn 100 bản mới nhất; chưa là hàng đợi có worker hoặc trạng thái xử lý. Khi kho đủ, request tiếp theo không ghi nhu cầu mới.

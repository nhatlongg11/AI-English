import type { Tense, Game } from "../types";
export const topics = [
  {
    id: "present_simple" as Tense,
    name: "Present Simple",
    vi: "Thì hiện tại đơn",
    tag: "Thói quen & sự thật",
    color: "lavender",
    symbol: "01",
    structure: "S + V(s/es) + …",
    description:
      "Kể về những điều diễn ra thường xuyên, thói quen và sự thật luôn đúng.",
    uses: ["Thói quen hằng ngày", "Sự thật hiển nhiên", "Lịch trình cố định"],
    example: "She walks to school every day.",
    translation: "Bạn ấy đi bộ đến trường mỗi ngày.",
    mistake: "He go → He goes",
    tip: "Với he, she, it, đừng quên thêm -s hoặc -es vào động từ nhé!",
    signal: "always · usually · every day",
  },
  {
    id: "present_continuous" as Tense,
    name: "Present Continuous",
    vi: "Thì hiện tại tiếp diễn",
    tag: "Điều đang diễn ra",
    color: "mint",
    symbol: "02",
    structure: "S + am/is/are + V-ing + …",
    description:
      "Miêu tả một hành động đang diễn ra ngay lúc nói hoặc trong khoảng thời gian hiện tại.",
    uses: [
      "Hành động ngay lúc nói",
      "Tình huống tạm thời",
      "Sự thay đổi đang diễn ra",
    ],
    example: "She is reading a book now.",
    translation: "Bạn ấy đang đọc một quyển sách.",
    mistake: "She reading → She is reading",
    tip: "Công thức có hai người bạn luôn đi cùng nhau: be và V-ing.",
    signal: "now · right now · at the moment",
  },
  {
    id: "past_simple" as Tense,
    name: "Past Simple",
    vi: "Thì quá khứ đơn",
    tag: "Câu chuyện đã qua",
    color: "peach",
    symbol: "03",
    structure: "S + V-ed / V₂ + …",
    description:
      "Kể về những hành động đã xảy ra và kết thúc ở một thời điểm trong quá khứ.",
    uses: [
      "Sự việc đã kết thúc",
      "Chuỗi hành động quá khứ",
      "Thói quen trong quá khứ",
    ],
    example: "We visited our grandparents yesterday.",
    translation: "Hôm qua chúng mình đã thăm ông bà.",
    mistake: "He goed → He went",
    tip: "Có những động từ không thêm -ed. Hãy ghi nhớ go → went, buy → bought!",
    signal: "yesterday · last week · ago",
  },
];
export const topic = (id: string) =>
  topics.find((t) => t.id === id) ?? topics[0];
export const errors: Record<string, string> = {
  E01: "Hòa hợp chủ ngữ – động từ",
  E02: "Chọn thì phù hợp",
  E03: "Thiếu trợ động từ",
  E04: "Dạng động từ quá khứ",
  E05: "Cấu trúc câu hỏi",
  E06: "Cấu trúc phủ định",
  E07: "Dạng động từ V-ing",
  E08: "Cách dùng trợ động từ",
};
export const games: {
  id: Game;
  name: string;
  vi: string;
  description: string;
  color: string;
}[] = [
  {
    id: "challenge",
    name: "Tense Challenge",
    vi: "Thử thách chọn đáp án",
    description: "Chọn đáp án đúng, hiểu rõ từng quy tắc.",
    color: "lavender",
  },
  {
    id: "builder",
    name: "Sentence Builder",
    vi: "Xếp từ thành câu",
    description: "Kéo, thả và kết nối những mảnh ngôn ngữ.",
    color: "mint",
  },
  {
    id: "detective",
    name: "Grammar Detective",
    vi: "Thám tử ngữ pháp",
    description: "Tìm lỗi sai và viết lại câu thật chuẩn.",
    color: "peach",
  },
];

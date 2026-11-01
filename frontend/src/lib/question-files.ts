import { errors, topics } from "./grammar";
import type { QuestionDraft } from "../types";

export const questionTypeLabels = {
  multiple_choice: "Trắc nghiệm",
  fill_in_blank: "Điền từ",
  error_correction: "Sửa lỗi / xếp câu",
};
const sources: Record<string, string> = {
  teacher_manual: "Tự soạn",
  teacher_import: "Nhập từ tệp",
  gemini: "Gợi ý từ AI",
  mock: "Câu hỏi mẫu",
  synthetic_demo: "Câu hỏi mẫu",
};
export const sourceLabel = (source: string) =>
  Object.hasOwn(sources, source) ? sources[source] : source;
const headers = [
  "Chủ đề",
  "Dạng bài",
  "Độ khó",
  "Câu hỏi",
  "Đáp án A",
  "Đáp án B",
  "Đáp án C",
  "Đáp án D",
  "Đáp án E",
  "Đáp án đúng",
  "Giải thích",
  "Quy tắc",
  "Kỹ năng",
];
const normalize = (text: string) =>
  text
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
const canonical = (value: string, choices: Record<string, string>) =>
  Object.entries(choices).find(
    ([key, label]) =>
      normalize(value) === normalize(key) ||
      normalize(value) === normalize(label),
  )?.[0] ?? value;

export const templateQuestions: QuestionDraft[] = [
  {
    tense: "present_simple",
    questionType: "multiple_choice",
    difficulty: 1,
    content: "Every Friday, my cousin ____ chess after school.",
    options: [
      { text: "plays", errorCode: null },
      { text: "play", errorCode: "E01" },
      { text: "playing", errorCode: null },
    ],
    correctAnswer: "plays",
    explanationVi:
      "My cousin là chủ ngữ số ít, nên động từ play thêm s thành plays.",
    grammarRule: "Chủ ngữ ngôi thứ ba số ít đi với động từ thêm s hoặc es.",
    errorCode: "E01",
  },
  {
    tense: "past_simple",
    questionType: "fill_in_blank",
    difficulty: 1,
    content: "Last Saturday, our family ____ (visit) a museum.",
    options: [],
    correctAnswer: "visited",
    explanationVi:
      "Last Saturday là thời gian đã qua, nên dùng dạng quá khứ visited.",
    grammarRule: "Động từ có quy tắc ở quá khứ đơn thêm ed.",
    errorCode: "E04",
  },
  {
    tense: "present_continuous",
    questionType: "error_correction",
    difficulty: 1,
    content: "Look! The children is playing in the schoolyard.",
    options: [],
    correctAnswer: "Look! The children are playing in the schoolyard.",
    explanationVi:
      "The children là chủ ngữ số nhiều, nên dùng are playing thay cho is playing.",
    grammarRule: "Chủ ngữ số nhiều đi với are trong thì hiện tại tiếp diễn.",
    errorCode: "E01",
  },
];

// Quoted cells can contain commas, semicolons, line breaks and escaped double quotes.
export function readCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, "");
  const separator = text
    .slice(0, text.search(/[\r\n]/) < 0 ? text.length : text.search(/[\r\n]/))
    .includes(";")
    ? ";"
    : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  const pushCell = () => {
    row.push(cell);
    cell = "";
    closed = false;
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value.trim())) rows.push(row);
    row = [];
    if (rows.length > 51)
      throw new Error(
        "Mỗi lần nhập tối đa 50 câu. Hãy chia tệp thành các phần nhỏ hơn.",
      );
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
      continue;
    }
    if (char === '"') {
      if (cell.trim() || closed)
        throw new Error(
          "Dấu ngoặc kép trong tệp CSV chưa đúng. Hãy đối chiếu tệp mẫu.",
        );
      cell = "";
      quoted = true;
    } else if (char === separator) pushCell();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else if (closed) {
      if (!/\s/.test(char))
        throw new Error("Có ký tự thừa sau ô được đặt trong ngoặc kép.");
    } else cell += char;
  }
  if (quoted) throw new Error("Có ô chưa đóng dấu ngoặc kép trong tệp CSV.");
  if (cell || closed || row.length) pushRow();
  return rows;
}

export function parseQuestionFile(filename: string, text: string): unknown[] {
  let questions: unknown[];
  if (filename.toLowerCase().endsWith(".json")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
    } catch {
      throw new Error(
        "Tệp JSON chưa đúng định dạng. Bạn có thể tải tệp mẫu để đối chiếu.",
      );
    }
    questions = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" &&
          parsed !== null &&
          "questions" in parsed &&
          Array.isArray(parsed.questions)
        ? parsed.questions
        : [];
  } else if (filename.toLowerCase().endsWith(".csv")) {
    const [columns, ...rows] = readCsv(text);
    if (!columns)
      throw new Error("Tệp đang trống. Hãy thêm câu hỏi theo tệp mẫu.");
    const names = columns.map(normalize);
    if (new Set(names).size !== names.length)
      throw new Error("Có tên cột bị lặp trong tệp CSV.");
    const aliases: Record<string, string> = {
      tense: "Chủ đề",
      questiontype: "Dạng bài",
      difficulty: "Độ khó",
      content: "Câu hỏi",
      correctanswer: "Đáp án đúng",
      explanationvi: "Giải thích",
      grammarrule: "Quy tắc",
      errorcode: "Kỹ năng",
      optiona: "Đáp án A",
      optionb: "Đáp án B",
      optionc: "Đáp án C",
      optiond: "Đáp án D",
      optione: "Đáp án E",
    };
    const keys = names.map((name) =>
      normalize(Object.hasOwn(aliases, name) ? aliases[name] : name),
    );
    if (keys.some((key) => !headers.map(normalize).includes(key)))
      throw new Error(
        "Có cột chưa được hỗ trợ. Hãy giữ tên cột như trong tệp mẫu.",
      );
    if (new Set(keys).size !== keys.length)
      throw new Error("Có hai cột cùng nghĩa. Hãy giữ một cột theo tệp mẫu.");
    const themes = Object.fromEntries(topics.map((t) => [t.id, t.vi]));
    questions = rows.map((row, index) => {
      if (row.length !== columns.length)
        throw new Error(
          `Câu ${index + 1}: số ô không khớp hàng tiêu đề. Hãy kiểm tra dấu phẩy và dấu ngoặc kép.`,
        );
      const value = (key: string) =>
        row[keys.indexOf(normalize(key))]?.trim() ?? "";
      const type =
        normalize(value("Dạng bài")) === "sua loi"
          ? "error_correction"
          : canonical(value("Dạng bài"), questionTypeLabels);
      const options = ["A", "B", "C", "D", "E"].map((letter) =>
        value(`Đáp án ${letter}`),
      );
      const answer = value("Đáp án đúng");
      return {
        tense:
          topics.find((t) =>
            [t.id, t.name, t.vi].some(
              (name) => normalize(name) === normalize(value("Chủ đề")),
            ),
          )?.id ?? canonical(value("Chủ đề"), themes),
        questionType: type,
        difficulty: Number(value("Độ khó")),
        content: value("Câu hỏi"),
        options: options
          .filter(Boolean)
          .map((text) => ({ text, errorCode: null })),
        correctAnswer:
          type === "multiple_choice" && /^[A-E]$/i.test(answer)
            ? (options[answer.toUpperCase().charCodeAt(0) - 65] ?? "")
            : answer,
        explanationVi: value("Giải thích"),
        grammarRule: value("Quy tắc"),
        errorCode: canonical(value("Kỹ năng"), errors),
      };
    });
  } else
    throw new Error(
      "Hãy chọn tệp .csv hoặc .json. Nếu đang dùng Excel, lưu thành CSV UTF-8 trước khi nhập.",
    );
  if (!questions.length) throw new Error("Chưa có câu hỏi trong tệp.");
  if (questions.length > 50)
    throw new Error(
      "Mỗi lần nhập tối đa 50 câu. Hãy chia tệp thành các phần nhỏ hơn.",
    );
  return questions;
}
export function templateCsv() {
  const cell = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  return (
    "\uFEFF" +
    [
      headers,
      ...templateQuestions.map((q) => [
        topics.find((t) => t.id === q.tense)!.vi,
        questionTypeLabels[q.questionType],
        q.difficulty,
        q.content,
        ...Array.from({ length: 5 }, (_, i) => q.options[i]?.text ?? ""),
        q.questionType === "multiple_choice"
          ? String.fromCharCode(
              65 + q.options.findIndex((o) => o.text === q.correctAnswer),
            )
          : q.correctAnswer,
        q.explanationVi,
        q.grammarRule,
        errors[q.errorCode],
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
export function downloadQuestionTemplate(format: "csv" | "json") {
  const content =
    format === "csv"
      ? templateCsv()
      : JSON.stringify({ questions: templateQuestions }, null, 2);
  const url = URL.createObjectURL(
    new Blob([content], {
      type: format === "csv" ? "text/csv;charset=utf-8" : "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `tenselab-cau-hoi-mau.${format}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

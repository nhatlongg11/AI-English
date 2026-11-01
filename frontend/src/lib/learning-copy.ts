export const learningPaths = [
  {
    value: 'adaptive',
    label: 'Bài tập theo sức học',
    description: 'TenseLab dựa vào những câu đã làm để chọn bài cần luyện thêm và điều chỉnh độ khó.',
  },
  {
    value: 'baseline',
    label: 'Bài tập theo thứ tự',
    description: 'Học sinh làm bài theo thứ tự đã sắp sẵn, không thay đổi theo kết quả từng câu.',
  },
] as const;

export function learningPathLabel(mode: string) {
  return learningPaths.find(path => path.value === mode)?.label ?? 'Chưa có thông tin';
}

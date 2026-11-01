import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "../ui/chart";
import type { Activity, ResearchRow, Summary } from "../../types";
import { errors, topics } from "../../lib/grammar";
import { Card } from "../ui/card";
import { learningPathLabel } from '../../lib/learning-copy';
const config = {
  accuracy: { label: "Độ chính xác", color: "var(--chart-1)" },
  mastery: { label: "Mức thành thạo", color: "var(--chart-2)" },
  count: { label: "Lượt mắc lỗi", color: "var(--chart-3)" },
  adaptive: { label: learningPathLabel('adaptive'), color: "var(--chart-1)" },
  baseline: { label: learningPathLabel('baseline'), color: "var(--chart-2)" },
} satisfies ChartConfig;
export function dailyAccuracy(
  attempts: Pick<Activity, "createdAt" | "correct">[],
) {
  const groups = new Map<string, { total: number; correct: number }>();
  attempts
    .filter((a) => a.correct !== null)
    .forEach((a) => {
      const date = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Bangkok",
      }).format(new Date(a.createdAt));
      const g = groups.get(date) ?? { total: 0, correct: 0 };
      g.total++;
      if (a.correct) g.correct++;
      groups.set(date, g);
    });
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, g]) => ({
      date,
      label: `${date.slice(8)}/${date.slice(5, 7)}`,
      accuracy: Math.round((g.correct / g.total) * 100),
      total: g.total,
    }));
}
export function AccuracyChart({
  attempts,
}: {
  attempts: Pick<Activity, "createdAt" | "correct">[];
}) {
  const data = dailyAccuracy(attempts);
  if (!data.length)
    return (
      <div className="chart-empty">
        Hoàn thành bài tập đầu tiên để xem biểu đồ tiến bộ.
      </div>
    );
  return (
    <ChartContainer
      config={config}
      className="chart"
      aria-label="Độ chính xác theo ngày, đơn vị phần trăm"
    >
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{ left: -18, right: 8, top: 12, bottom: 0 }}
      >
        <defs>
          <linearGradient id="accuracyFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-accuracy)"
              stopOpacity={0.25}
            />
            <stop
              offset="95%"
              stopColor="var(--color-accuracy)"
              stopOpacity={0.01}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
        />
        <YAxis
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        <Area
          type="monotone"
          dataKey="accuracy"
          stroke="var(--color-accuracy)"
          fill="url(#accuracyFill)"
          strokeWidth={2.5}
          dot={data.length === 1}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
export function TenseChart({ summary }: { summary: Summary }) {
  const data = topics.map((t) => {
    const a = summary.attempts.filter(
      (a) => a.question.tense === t.id && a.correct !== null,
    );
    return {
      name: t.name.replace("Present ", "P. "),
      accuracy: a.length
        ? Math.round((a.filter((a) => a.correct).length / a.length) * 100)
        : null,
    };
  });
  return (
    <ChartContainer
      config={config}
      className="chart"
      aria-label="Độ chính xác theo thì, phần trăm"
    >
      <BarChart
        accessibilityLayer
        data={data}
        margin={{ left: -20, right: 5, top: 15 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar
          dataKey="accuracy"
          fill="var(--color-accuracy)"
          radius={[6, 6, 0, 0]}
          maxBarSize={40}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}
export function ErrorChart({
  rows,
}: {
  rows: { errorCode: string | null; correct: boolean | null }[];
}) {
  const data = Object.entries(errors)
    .map(([code, label]) => ({
      name: code,
      label,
      count: rows.filter((a) => a.correct === false && a.errorCode === code)
        .length,
    }))
    .filter((d) => d.count)
    .sort((a, b) => b.count - a.count);
  if (!data.length)
    return (
      <div className="chart-empty">Chưa ghi nhận lỗi đã được phân loại.</div>
    );
  return (
    <ChartContainer
      config={config}
      className="chart"
      aria-label="Số lượt mắc lỗi theo mã ngữ pháp"
    >
      <BarChart
        accessibilityLayer
        layout="vertical"
        data={data}
        margin={{ left: 0, right: 20, top: 10 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="4 4" />
        <YAxis
          type="category"
          dataKey="name"
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <XAxis
          type="number"
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => payload[0]?.payload.label}
            />
          }
        />
        <Bar
          dataKey="count"
          fill="var(--color-count)"
          radius={[0, 6, 6, 0]}
          maxBarSize={24}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}
export function ComparisonChart({ rows }: { rows: ResearchRow[] }) {
  const data = topics.map((t) => ({
    name: t.name.replace("Present ", "P. "),
    ...Object.fromEntries(
      ["adaptive", "baseline"].map((mode) => {
        const group = rows.filter(
          (r) => r.mode === mode && r.tense === t.id && r.correct !== null,
        );
        return [
          mode,
          group.length
            ? Math.round(
                (group.filter((r) => r.correct).length / group.length) * 100,
              )
            : null,
        ];
      }),
    ),
  }));
  return (
    <ChartContainer
      config={config}
      className="chart chart-tall"
      aria-label="So sánh độ chính xác theo cách giao bài, không phải kết quả thực nghiệm"
    >
      <BarChart
        accessibilityLayer
        data={data}
        margin={{ left: -20, right: 0, top: 15 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          axisLine={false}
          tickLine={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="adaptive"
          fill="var(--color-adaptive)"
          radius={[5, 5, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="baseline"
          fill="var(--color-baseline)"
          radius={[5, 5, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}
export function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="panel">
      <div>
        <h3>{title}</h3>
        {subtitle && <p className="small muted mt-1">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

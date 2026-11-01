import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  FileQuestion,
  GraduationCap,
  Sparkles,
  Star,
} from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="TenseLab AI — trang chủ">
      <span className="brand-icon">
        <GraduationCap size={25} />
      </span>
      TenseLab <em>AI</em>
    </Link>
  );
}
export function PaperArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="paper back" />
      <div className="paper">
        <div className="paper-label">A little practice, a big step.</div>
        <div className="paper-sentence">
          She <span>is reading</span> a book.
        </div>
        <div className="line" />
        <div className="line" style={{ width: "65%" }} />
      </div>
      <Star className="art-star" size={42} fill="currentColor" />
      <span className="art-check">
        <Check size={25} strokeWidth={3} />
      </span>
    </div>
  );
}
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function SectionHeading({
  title,
  to,
  link = "Xem tất cả",
}: {
  title: string;
  to?: string;
  link?: string;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {to && (
        <Link className="text-link" to={to}>
          {link}
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
export function Stat({
  icon,
  value,
  label,
  tone = "lavender",
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  tone?: string;
}) {
  return (
    <Card className="stat">
      <div className={`stat-icon tone-${tone}`}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </Card>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "warning";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`notice ${tone}`}
    >
      <AlertCircle />
      {children}
    </div>
  );
}
export function EmptyState({
  title = "Chưa có dữ liệu",
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <FileQuestion size={33} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div role="status" aria-label="Đang tải dữ liệu" className="stack">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-48 w-full rounded-3xl" />
      <div className="loading-page">
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
export function ResourceError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="stack">
      <Notice tone="error">{message}</Notice>
      <Button variant="outline" onClick={retry} className="self-start">
        Thử lại
      </Button>
    </div>
  );
}
export function Choice({
  id,
  value,
  onChange,
  options,
  label,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="notice">
      <Sparkles />
      {children}
    </div>
  );
}
export function BackToLearning() {
  return (
    <Button asChild variant="outline">
      <Link to="/student/grammar">
        <BookOpen />
        Về bài học
      </Link>
    </Button>
  );
}

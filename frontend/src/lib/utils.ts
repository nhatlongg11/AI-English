import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const normalizeAnswer=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export const percent = (value: number) => `${Math.round(value * 100)}%`;
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(
    new Date(value),
  );

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: any, pattern: string = "dd/MM/yyyy HH:mm"): string {
  if (!date) return "--";
  try {
    const d = typeof date.toDate === "function" ? date.toDate() : new Date(date);
    return format(d, pattern, { locale: vi });
  } catch {
    return "--";
  }
}

export function formatRelativeTime(date: any): string {
  if (!date) return "--";
  try {
    const d = typeof date.toDate === "function" ? date.toDate() : new Date(date);
    return formatDistanceToNow(d, { addSuffix: true, locale: vi });
  } catch {
    return "--";
  }
}

export function getRoleBadgeColor(role: string): string {
  switch (role) {
    case "super_admin":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "admin":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "teacher":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "student":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

export function getRoleDisplayName(role: string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Quản trị viên";
    case "teacher":
      return "Giảng viên";
    case "student":
      return "Sinh viên";
    default:
      return "Người dùng";
  }
}

export function getAttendanceStatusText(status: string): string {
  switch (status) {
    case "present":
      return "Có mặt";
    case "late":
      return "Đi trễ";
    case "absent":
      return "Vắng mặt";
    case "excused":
      return "Có phép";
    default:
      return "--";
  }
}

export function getAttendanceStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "present":
      return { label: "Có mặt", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "late":
      return { label: "Đi trễ", className: "bg-amber-50 text-amber-700 border-amber-200" };
    case "absent":
      return { label: "Vắng mặt", className: "bg-rose-50 text-rose-700 border-rose-200" };
    case "excused":
      return { label: "Có phép", className: "bg-blue-50 text-blue-700 border-blue-200" };
    default:
      return { label: "--", className: "bg-slate-50 text-slate-700 border-slate-200" };
  }
}

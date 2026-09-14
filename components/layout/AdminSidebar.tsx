'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UserCheck,
  BookOpen,
  CalendarCheck,
  FileText,
  MessageSquare,
  Bell,
  BarChart3,
  ShieldAlert,
  Settings,
  X,
  FileCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  { href: '/admin/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/admin/sinh-vien', label: 'Sinh viên', icon: Users },
  { href: '/admin/lop-hoc', label: 'Lớp học', icon: GraduationCap },
  { href: '/admin/nghi-phep', label: 'Duyệt nghỉ phép', icon: FileCheck },
  { href: '/admin/diem-danh', label: 'Điểm danh', icon: CalendarCheck },
  { href: '/admin/bai-tap', label: 'Bài tập', icon: FileText },
  { href: '/admin/dien-dan', label: 'Diễn đàn', icon: MessageSquare },
  { href: '/admin/thong-bao', label: 'Thông báo', icon: Bell },
  { href: '/admin/bao-cao', label: 'Báo cáo', icon: BarChart3 },
  { href: '/admin/nhat-ky', label: 'Nhật ký hệ thống', icon: ShieldAlert },
  { href: '/admin/cai-dat', label: 'Cài đặt', icon: Settings },
];

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200/80 bg-white shadow-sm transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100">
          <Link href="/admin/dashboard" className="flex items-center gap-2.5 group">
            <img
              src="/logo.png"
              alt="Logo CĐ Bách Khoa Nam Sài Gòn"
              className="w-10 h-10 object-contain shrink-0"
            />
            <div className="leading-tight">
              <span className="font-extrabold tracking-tight text-slate-900 text-xs block">
                ADMIN PORTAL
              </span>
              <span className="text-[10px] text-slate-500 font-medium block">
                CĐ Bách Khoa Nam Sài Gòn
              </span>
            </div>
          </Link>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all',
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/60'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isActive ? 'text-indigo-600' : 'text-slate-400'
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* System info bottom */}
        <div className="p-4 border-t border-slate-100 text-center">
          <p className="text-[11px] font-medium text-slate-400">
            Hệ thống Quản lý v2.0
          </p>
        </div>
      </aside>
    </>
  );
}

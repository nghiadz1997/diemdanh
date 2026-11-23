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
  { href: '/admin/trac-nghiem', label: 'Kết quả Trắc nghiệm', icon: BookOpen },
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

      {/* Sidebar container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white border-r border-slate-200/80 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100">
          <Link href="/admin/dashboard" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Logo Trường"
              className="w-10 h-10 object-contain shrink-0"
            />
            <div className="leading-tight">
              <span className="font-extrabold text-sm text-slate-900 block tracking-tight">
                CĐ Bách Khoa Nam Sài Gòn
              </span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                Cổng Quản Trị Hệ Thống
              </span>
            </div>
          </Link>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/admin/dashboard'
                ? pathname === '/admin/dashboard'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150',
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-slate-400')} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* User preview footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs ring-2 ring-white">
              A
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">Ban Giám Hiệu / Admin</div>
              <div className="text-[10px] text-slate-500 truncate">admin@nsg.edu.vn</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

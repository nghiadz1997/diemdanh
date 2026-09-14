'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  GraduationCap,
  QrCode,
  FileText,
  FileCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/sinh-vien/dashboard', label: 'Trang chủ', icon: Home },
  { href: '/sinh-vien/lop-hoc', label: 'Lớp học', icon: GraduationCap },
  { href: '/sinh-vien/diem-danh', label: 'Điểm danh', icon: QrCode, isPrimary: true },
  { href: '/sinh-vien/bai-tap', label: 'Bài tập', icon: FileText },
  { href: '/sinh-vien/nghi-phep', label: 'Nghỉ phép', icon: FileCheck },
];

export function StudentBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 bg-white/95 backdrop-blur-md pb-safe lg:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.isPrimary) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-5"
              >
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition-transform active:scale-95',
                    isActive
                      ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-indigo-200'
                      : 'bg-indigo-600 text-white shadow-indigo-100'
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <span
                  className={cn(
                    'mt-1 text-[10px] font-bold',
                    isActive ? 'text-indigo-600' : 'text-slate-500'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center py-1 flex-1"
            >
              <Icon
                className={cn(
                  'h-5 w-5 transition-colors',
                  isActive ? 'text-indigo-600 stroke-[2.5]' : 'text-slate-400'
                )}
              />
              <span
                className={cn(
                  'mt-1 text-[10px]',
                  isActive ? 'font-bold text-indigo-600' : 'font-medium text-slate-500'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

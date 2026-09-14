'use client';

import { Navbar } from '@/components/layout/Navbar';
import { StudentBottomNav } from '@/components/layout/StudentBottomNav';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, GraduationCap, QrCode, FileText, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const topNavLinks = [
    { href: '/sinh-vien/dashboard', label: 'Trang chủ', icon: Home },
    { href: '/sinh-vien/lop-hoc', label: 'Lớp học của tôi', icon: GraduationCap },
    { href: '/sinh-vien/diem-danh', label: 'Điểm danh', icon: QrCode },
    { href: '/sinh-vien/bai-tap', label: 'Bài tập', icon: FileText },
    { href: '/sinh-vien/lich-su-diem-danh', label: 'Lịch sử điểm danh', icon: Clock },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <Navbar />

      {/* Desktop sub-navigation banner for students */}
      <div className="hidden lg:block border-b border-slate-200/80 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {topNavLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all',
                  isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
        {children}
      </main>

      <StudentBottomNav />
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { user, role, mustChangePassword, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/dang-nhap');
      } else if (mustChangePassword) {
        router.replace('/doi-mat-khau');
      } else if (role === 'super_admin' || role === 'admin' || user.email === 'admin@nsg.edu.vn') {
        router.replace('/admin/dashboard');
      } else if (role === 'teacher') {
        router.replace('/giang-vien/dashboard');
      } else {
        router.replace('/sinh-vien/dashboard');
      }
    }
  }, [user, role, mustChangePassword, loading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white shadow-xl border border-slate-100 max-w-xs text-center">
        <div className="w-20 h-20 rounded-2xl bg-white shadow-md p-1.5 flex items-center justify-center">
          <img
            src="/logo.png"
            alt="Logo CĐ Bách Khoa Nam Sài Gòn"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Đang khởi động hệ thống...</span>
        </div>
        <p className="text-[11px] text-slate-400">Trường CĐ Bách Khoa Nam Sài Gòn</p>
      </div>
    </div>
  );
}

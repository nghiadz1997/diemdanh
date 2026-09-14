'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AdminSubjectsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/lop-hoc');
  }, [router]);

  return (
    <div className="py-24 flex flex-col items-center justify-center text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
      <p className="text-xs font-medium">Đang chuyển tiếp tới Quản lý Lớp học...</p>
    </div>
  );
}

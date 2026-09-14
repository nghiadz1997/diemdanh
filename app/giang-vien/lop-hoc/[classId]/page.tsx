'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function TeacherClassRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;

  useEffect(() => {
    if (classId) {
      router.replace('/giang-vien/lop-hoc/' + classId + '/buoi-hoc');
    }
  }, [classId, router]);

  return (
    <div className="py-24 flex flex-col items-center justify-center text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
      <p className="text-xs font-medium">Đang chuyển tiếp tới Buổi học & Điểm danh...</p>
    </div>
  );
}

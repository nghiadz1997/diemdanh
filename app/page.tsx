'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PublicAttendanceForm } from '@/components/attendance/PublicAttendanceForm';
import TracNghiemPortalPage from '@/app/trac-nghiem/page';
import { QrCode, Sparkles } from 'lucide-react';

function HomeContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'trac-nghiem' ? 'trac-nghiem' : 'diem-danh';
  const [activeTab, setActiveTab] = useState<'diem-danh' | 'trac-nghiem'>(initialTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'trac-nghiem') {
      setActiveTab('trac-nghiem');
    } else if (tab === 'diem-danh') {
      setActiveTab('diem-danh');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* THANH TAB ĐIỀU HƯỚNG CỰC KỲ RÕ RÀNG Ở CỔNG NGOÀI (KHÔNG CẦN ĐĂNG NHẬP) */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm py-2 px-4">
        <div className="max-w-xl mx-auto flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('diem-danh')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'diem-danh'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>1. Điểm Danh Sinh Viên</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('trac-nghiem')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'trac-nghiem'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${activeTab === 'trac-nghiem' ? 'text-amber-300' : 'text-blue-600'}`} />
            <span>2. Thi Trắc Nghiệm (300 câu)</span>
          </button>
        </div>
      </div>

      {/* NỘI DUNG TƯƠNG ỨNG VỚI TAB */}
      <div className="flex-1">
        {activeTab === 'diem-danh' ? (
          <PublicAttendanceForm onSwitchToQuiz={() => setActiveTab('trac-nghiem')} />
        ) : (
          <TracNghiemPortalPage />
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-500">Đang tải hệ thống...</div>}>
      <HomeContent />
    </Suspense>
  );
}

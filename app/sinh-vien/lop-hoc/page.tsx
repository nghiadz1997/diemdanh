'use client';

import { useEffect, useState } from 'react';
import { getClasses } from '@/services/classService';
import { ClassItem } from '@/types';
import { GraduationCap, MessageSquare, BookOpen, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function StudentClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getClasses()
      .then((c) => {
        if (isMounted) {
          setClasses(c || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Lỗi nạp danh sách lớp:', err);
        if (isMounted) {
          setClasses([]);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Lớp học của tôi
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Các lớp bạn đang tham gia học tập trong học kỳ
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200/80">
          <GraduationCap className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-600">Chưa được gán vào lớp học nào</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-3xl p-5 shadow-card border border-slate-200/80 flex flex-col justify-between"
            >
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                  {c.classCode}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-2">{c.className}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {c.description || 'Chưa có mô tả'}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  {c.academicYear} • {c.semester}
                </span>
                <Link
                  href={`/lop-hoc/${c.id}/dien-dan`}
                  className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-xl text-xs transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Diễn đàn lớp</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { getClasses } from '@/services/classService';
import { ClassItem } from '@/types';
import { GraduationCap, QrCode, MessageSquare, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function TeacherClassesPage() {
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
          Danh sách các lớp đang phụ trách giảng dạy và tổ chức điểm danh
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200/80">
          <GraduationCap className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-600">Chưa có lớp học nào</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-3xl p-5 shadow-card border border-slate-200/80 flex flex-col justify-between"
            >
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                  {c.classCode}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-2">{c.className}</h3>
                <span className="text-xs text-slate-400 mt-1 block">
                  {c.studentCount || 0} sinh viên • {c.academicYear || '2026'}
                </span>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href={'/giang-vien/lop-hoc/' + c.id + '/buoi-hoc'}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Điểm danh</span>
                </Link>
                <Link
                  href={'/lop-hoc/' + c.id + '/dien-dan'}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Diễn đàn</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

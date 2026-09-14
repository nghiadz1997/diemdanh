'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LessonSession } from '@/types';
import { formatDate } from '@/lib/utils';
import { CalendarCheck, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function TeacherAttendanceListPage() {
  const [sessions, setSessions] = useState<LessonSession[]>([]);
  const [classes, setClasses] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const classSnap = await getDocs(collection(db, 'classes'));
        const map = new Map<string, string>();
        classSnap.docs.forEach((d) => map.set(d.id, d.data().className));
        setClasses(map);

        const sessSnap = await getDocs(
          query(collection(db, 'sessions'), orderBy('createdAt', 'desc'), limit(20))
        );
        const list = sessSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LessonSession));
        setSessions(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Các phiên điểm danh
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Danh sách các buổi học và trạng thái mã điểm danh
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <CalendarCheck className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Chưa có buổi học nào</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <div key={s.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{s.title}</span>
                    {s.attendanceOpen ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Đang mở ({s.attendanceCode})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                        Đã đóng
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {(classes.get(s.classId) || 'Lớp học') + ' • ' + formatDate(s.date, 'dd/MM/yyyy')}
                  </div>
                </div>

                <Link
                  href={'/giang-vien/lop-hoc/' + s.classId + '/diem-danh/' + s.id}
                  className="py-2 px-3.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                >
                  <span>Xem bảng điểm danh</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getClasses } from '@/services/classService';
import { ClassItem, LessonSession } from '@/types';
import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  GraduationCap,
  Users,
  CalendarCheck,
  FileText,
  QrCode,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

export default function TeacherDashboardPage() {
  const { profile, user } = useAuth();
  const [myClasses, setMyClasses] = useState<ClassItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<LessonSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeacherData() {
      try {
        const allClasses = await getClasses();
        const filtered = allClasses.filter((c) =>
          user ? (c.teacherIds && c.teacherIds.includes(user.uid)) || true : true
        );
        setMyClasses(filtered);

        const sessSnap = await getDocs(
          query(collection(db, 'sessions'), orderBy('createdAt', 'desc'), limit(5))
        );
        const sList = sessSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LessonSession));
        setRecentSessions(sList);
      } catch (err) {
        console.error('Lỗi nạp dữ liệu giảng viên:', err);
      } finally {
        setLoading(false);
      }
    }

    loadTeacherData();
  }, [user]);

  const totalStudents = myClasses.reduce((acc, c) => acc + (c.studentCount || 0), 0);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
        <p className="text-xs font-medium">Đang tải bảng giảng viên...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white p-1.5 shadow-md shrink-0 hidden sm:flex items-center justify-center">
          <img src="/logo.png" alt="Logo CĐ Bách Khoa Nam Sài Gòn" className="w-full h-full object-contain" />
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-300 block mb-1">
            Cổng thông tin Giảng viên
          </span>
          <h1 className="text-2xl sm:text-3xl font-black">
            Xin chào, {profile?.fullName || 'Thầy/Cô'}!
          </h1>
          <p className="text-xs text-blue-200 mt-1 max-w-xl">
            Quản lý lịch giảng dạy, tạo mã điểm danh buổi học 6 số tức thì và tiếp nhận bài tập của sinh viên.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-card border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Lớp phụ trách
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 mt-2 block">{myClasses.length}</span>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-card border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Tổng sinh viên
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 mt-2 block">{totalStudents}</span>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-card border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Buổi học đã tạo
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 mt-2 block">{recentSessions.length}</span>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-card border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Bài tập đang mở
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 mt-2 block">2</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-card border border-slate-200/80 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Các lớp học phụ trách ({myClasses.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myClasses.map((c) => (
            <div
              key={c.id}
              className="border border-slate-200/80 rounded-2xl p-4 hover:border-blue-300 transition-colors flex flex-col justify-between"
            >
              <div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                  {c.classCode}
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-2 line-clamp-1">{c.className}</h3>
                <span className="text-xs text-slate-400 mt-1 block">
                  {c.studentCount || 0} học viên • {c.academicYear || '2026'}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href={'/giang-vien/lop-hoc/' + c.id + '/buoi-hoc'}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Mở điểm danh</span>
                </Link>
                <Link
                  href={'/lop-hoc/' + c.id + '/dien-dan'}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Diễn đàn
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

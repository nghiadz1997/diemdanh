'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getClasses } from '@/services/classService';
import { ClassItem, AttendanceRecord } from '@/types';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDate, getAttendanceStatusBadge } from '@/lib/utils';
import {
  GraduationCap,
  QrCode,
  Calendar,
  FileText,
  Clock,
  ArrowRight,
  CheckCircle2,
  Bell,
  Loader2,
  FileCheck,
} from 'lucide-react';
import Link from 'next/link';

export default function StudentDashboardPage() {
  const { profile, user } = useAuth();
  const [enrolledClasses, setEnrolledClasses] = useState<ClassItem[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStudentData() {
      if (!user) return;
      try {
        const allClasses = await getClasses();
        const userClasses = allClasses.filter((c) =>
          profile?.classIds?.includes(c.id) || true
        );
        setEnrolledClasses(userClasses);

        const attSnap = await getDocs(
          query(
            collection(db, 'attendance'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(4)
          )
        );
        const list = attSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
        setRecentAttendance(list);
      } catch (err) {
        console.error('Lỗi tải dữ liệu sinh viên:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStudentData();
  }, [user, profile]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-xs font-medium">Đang nạp dữ liệu sinh viên...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white p-1.5 shadow-md shrink-0 hidden sm:flex items-center justify-center">
              <img src="/logo.png" alt="Logo CĐ Bách Khoa Nam Sài Gòn" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-200 block mb-1">
                Cổng thông tin Sinh viên • {profile?.studentCode || 'SV'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black">
                Xin chào, {profile?.fullName || 'Sinh viên'}!
              </h1>
              <p className="text-xs text-indigo-200 mt-1">
                Hôm nay bạn có buổi học nào cần điểm danh không?
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            <Link
              href="/sinh-vien/nghi-phep"
              className="py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <FileCheck className="w-4 h-4 text-emerald-300" />
              <span>Xin nghỉ phép</span>
            </Link>
            <Link
              href="/sinh-vien/diem-danh"
              className="py-3 px-5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-black/20 transition-transform active:scale-95"
            >
              <QrCode className="w-4 h-4 text-slate-950" />
              <span>ĐIỂM DANH NGAY</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-card border border-slate-200/80">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Lớp đang học
          </span>
          <span className="text-2xl font-black text-slate-900 mt-2 block">
            {enrolledClasses.length}
          </span>
          <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
            Học kỳ hiện tại
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-card border border-slate-200/80">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Buổi học hôm nay
          </span>
          <span className="text-2xl font-black text-slate-900 mt-2 block">1</span>
          <span className="text-[11px] text-indigo-600 font-semibold mt-0.5 block">
            Bắt đầu lúc 08:00
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-card border border-slate-200/80">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Bài tập cần nộp
          </span>
          <span className="text-2xl font-black text-slate-900 mt-2 block">0</span>
          <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
            Đã hoàn thành hết
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-card border border-emerald-100 bg-emerald-50/15">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">
            Tỷ lệ chuyên cần
          </span>
          <span className="text-2xl font-black text-emerald-700 mt-2 block">98%</span>
          <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
            Chuyên cần xuất sắc
          </span>
        </div>
      </div>

      {/* Main Grid Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-card border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Lớp học của tôi
            </h2>
            <Link
              href="/sinh-vien/lop-hoc"
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Xem tất cả
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {enrolledClasses.map((c) => (
              <div
                key={c.id}
                className="border border-slate-200/80 rounded-2xl p-4 hover:border-indigo-300 transition-colors flex flex-col justify-between"
              >
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">
                    {c.classCode}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-2 line-clamp-1">{c.className}</h3>
                  <span className="text-xs text-slate-400 mt-0.5 block">
                    {c.academicYear} • {c.semester}
                  </span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href={`/lop-hoc/${c.id}/dien-dan`}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Vào diễn đàn lớp
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-card border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Điểm danh gần đây
            </h2>
            <Link
              href="/sinh-vien/lich-su-diem-danh"
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Xem lịch sử
            </Link>
          </div>

          {recentAttendance.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4">Chưa có lượt điểm danh nào</p>
          ) : (
            <div className="space-y-3">
              {recentAttendance.map((a) => {
                const badge = getAttendanceStatusBadge(a.status);
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-semibold text-slate-800 block">
                        {formatDate(a.checkInTime || a.createdAt, 'HH:mm dd/MM')}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {a.method === 'code' ? 'Điểm danh qua mã' : 'Giảng viên chấm'}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

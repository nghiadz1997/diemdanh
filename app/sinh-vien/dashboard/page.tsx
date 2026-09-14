'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getClasses } from '@/services/classService';
import { ClassItem, AttendanceRecord, LessonSession } from '@/types';
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
  const [sessions, setSessions] = useState<LessonSession[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceRecord>>({});
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [todaySessionsCount, setTodaySessionsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStudentData() {
      if (!user) return;
      try {
        const studentUid = user.uid;
        const cleanStudentCode = profile?.studentCode?.trim().toUpperCase() || '';

        // 1. Lấy danh sách lớp học
        const allClasses = await getClasses();
        const enrolledClassIds = new Set<string>(profile?.classIds || []);

        try {
          const memQueries = [
            query(collection(db, 'classMembers'), where('userId', '==', studentUid)),
          ];
          if (cleanStudentCode) {
            memQueries.push(
              query(collection(db, 'classMembers'), where('studentCode', '==', cleanStudentCode))
            );
          }
          for (const q of memQueries) {
            const snap = await getDocs(q);
            snap.docs.forEach((d) => {
              const data = d.data();
              if (data.classId && data.active !== false) {
                enrolledClassIds.add(data.classId);
              }
            });
          }
        } catch (errM) {
          console.warn('Lỗi tìm classMembers của sinh viên:', errM);
        }

        const userClasses =
          enrolledClassIds.size > 0
            ? allClasses.filter((c) => enrolledClassIds.has(c.id))
            : allClasses.filter((c) => c.active !== false);
        setEnrolledClasses(userClasses);

        // 2. Tải các buổi học do giảng viên tạo cho các lớp này
        const targetClassIds = userClasses.map((c) => c.id);
        const loadedSessions: LessonSession[] = [];
        for (const cid of targetClassIds) {
          try {
            const sessQ = query(collection(db, 'sessions'), where('classId', '==', cid));
            const sessSnap = await getDocs(sessQ);
            sessSnap.docs.forEach((d) => {
              loadedSessions.push({ id: d.id, ...d.data() } as LessonSession);
            });
          } catch (sessErr) {
            console.warn(`Lỗi tải sessions cho lớp ${cid}:`, sessErr);
          }
        }

        // Sắp xếp: Đang mở điểm danh lên đầu, sau đó theo ngày tạo mới nhất
        loadedSessions.sort((a, b) => {
          if (a.attendanceOpen && !b.attendanceOpen) return -1;
          if (!a.attendanceOpen && b.attendanceOpen) return 1;
          const timeA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate().getTime() : 0;
          const timeB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate().getTime() : 0;
          return timeB - timeA;
        });
        setSessions(loadedSessions);

        // Đếm số buổi học hôm nay
        const todayStr = new Date().toISOString().split('T')[0];
        const todayCount = loadedSessions.filter((s) => {
          if (!s.date) return false;
          try {
            const d = typeof s.date.toDate === 'function' ? s.date.toDate() : new Date(s.date);
            return d.toISOString().split('T')[0] === todayStr;
          } catch {
            return false;
          }
        }).length;
        setTodaySessionsCount(todayCount);

        // 3. Tải danh sách điểm danh của sinh viên
        const attSnap = await getDocs(
          query(
            collection(db, 'attendance'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(10)
          )
        );
        const list = attSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
        setRecentAttendance(list.slice(0, 4));

        const attMap: Record<string, AttendanceRecord> = {};
        list.forEach((a) => {
          if (a.sessionId) attMap[a.sessionId] = a;
        });
        setAttendanceMap(attMap);
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

      {/* Thông báo nếu có buổi học ĐANG MỞ ĐIỂM DANH */}
      {sessions.some((s) => s.attendanceOpen && !attendanceMap[s.id]) && (
        <div className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-indigo-500/15 border-2 border-emerald-500/50 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-600/30">
              <QrCode className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                CÓ BUỔI HỌC ĐANG MỞ ĐIỂM DANH!
              </span>
              <p className="text-xs sm:text-sm font-semibold text-slate-800">
                {sessions.find((s) => s.attendanceOpen && !attendanceMap[s.id])?.title}
              </p>
            </div>
          </div>
          <Link
            href="/sinh-vien/diem-danh"
            className="py-3 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>ĐIỂM DANH NGAY</span>
          </Link>
        </div>
      )}

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
          <span className="text-2xl font-black text-slate-900 mt-2 block">
            {todaySessionsCount}
          </span>
          <span className="text-[11px] text-indigo-600 font-semibold mt-0.5 block">
            {todaySessionsCount > 0 ? 'Có buổi học hôm nay' : 'Không có lịch học'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-card border border-slate-200/80">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Tổng buổi học
          </span>
          <span className="text-2xl font-black text-slate-900 mt-2 block">
            {sessions.length}
          </span>
          <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
            Giảng viên đã tạo
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-card border border-emerald-100 bg-emerald-50/15">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">
            Đã điểm danh
          </span>
          <span className="text-2xl font-black text-emerald-700 mt-2 block">
            {Object.keys(attendanceMap).length}
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
            Buổi đã có mặt
          </span>
        </div>
      </div>

      {/* Main Grid Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cột trái: Buổi học của tôi do Giảng viên tạo */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-card border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Buổi học của tôi (Giảng viên đã tạo)
              </h2>
              <p className="text-[11px] text-slate-500">
                Các buổi học gần nhất theo lịch của giảng viên
              </p>
            </div>
            <Link
              href="/sinh-vien/diem-danh"
              className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
            >
              <span>Xem tất cả & Điểm danh</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {sessions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
              <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-medium text-slate-500">Giảng viên chưa tạo buổi học nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.slice(0, 4).map((s) => {
                const isAttended = !!attendanceMap[s.id];
                const isOpen = s.attendanceOpen === true;
                const cData = enrolledClasses.find((c) => c.id === s.classId);

                return (
                  <div
                    key={s.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isAttended
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : isOpen
                        ? 'border-indigo-300 bg-indigo-50/30 ring-1 ring-indigo-400/30'
                        : 'border-slate-100 bg-slate-50/60'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-100 text-indigo-700">
                          {cData?.classCode || 'LỚP HỌC'}
                        </span>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1">
                          {s.title}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>{formatDate(s.date, 'dd/MM/yyyy')}</span>
                        {s.startTime && (
                          <span>
                            • {formatDate(s.startTime, 'HH:mm')}
                            {s.endTime ? ` - ${formatDate(s.endTime, 'HH:mm')}` : ''}
                          </span>
                        )}
                        {cData && <span>• {cData.className}</span>}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isAttended ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Đã có mặt</span>
                        </span>
                      ) : isOpen ? (
                        <Link
                          href="/sinh-vien/diem-danh"
                          className="py-2 px-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-indigo-200 active:scale-95 transition-all"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>ĐIỂM DANH</span>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Chưa mở</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Lớp học của tôi */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Lớp học đang tham gia ({enrolledClasses.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {enrolledClasses.map((c) => (
                <div
                  key={c.id}
                  className="border border-slate-200/80 rounded-2xl p-3.5 hover:border-indigo-300 transition-colors flex items-center justify-between"
                >
                  <div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">
                      {c.classCode}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{c.className}</h4>
                  </div>
                  <Link
                    href={`/lop-hoc/${c.id}/dien-dan`}
                    className="text-xs font-semibold text-indigo-600 hover:underline shrink-0 ml-2"
                  >
                    Diễn đàn
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cột phải: Điểm danh gần đây */}
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


'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getClassById } from '@/services/classService';
import {
  createSession,
  getSessionsByClass,
  openAttendanceSession,
  closeAttendanceSession,
} from '@/services/attendanceService';
import { ClassItem, LessonSession } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  CalendarCheck,
  Plus,
  Clock,
  Users,
  XCircle,
  ArrowLeft,
  Loader2,
  Sparkles,
  ExternalLink,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function TeacherSessionManagementPage() {
  const params = useParams();
  const classId = params.classId as string;
  const { user } = useAuth();

  const [classData, setClassData] = useState<ClassItem | null>(null);
  const [sessions, setSessions] = useState<LessonSession[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:30');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [activeSession, setActiveSession] = useState<LessonSession | null>(null);
  const [duration, setDuration] = useState<number>(15);
  const [remainingTime, setRemainingTime] = useState<string>('');

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const cData = classData || (await getClassById(classId));
      if (cData && !classData) setClassData(cData);
      const effectiveId = cData?.id || classId;
      const cSessions = await getSessionsByClass(effectiveId);
      setSessions(cSessions || []);
      const openSession = (cSessions || []).find((s) => s.attendanceOpen);
      if (openSession) setActiveSession(openSession);
    } catch (err) {
      console.error('Lỗi nạp buổi học:', err);
      toast.error('Không thể tải thông tin lớp và buổi học');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (classId) fetchData(true);
  }, [classId]);

  useEffect(() => {
    if (!activeSession?.attendanceOpen || !activeSession?.codeExpiresAt) return;

    const interval = setInterval(() => {
      const expires = typeof activeSession.codeExpiresAt.toDate === 'function'
        ? activeSession.codeExpiresAt.toDate().getTime()
        : new Date(activeSession.codeExpiresAt).getTime();
      const diff = expires - Date.now();

      if (diff <= 0) {
        setRemainingTime('Đã hết hạn');
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setRemainingTime(
          mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0')
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !startTime) {
      toast.error('Vui lòng điền đầy đủ tiêu đề và thời gian buổi học');
      return;
    }

    setSubmitting(true);
    try {
      await createSession({
        classId,
        title,
        date,
        startTime,
        endTime,
        description,
        createdBy: user?.uid || 'teacher',
      });
      toast.success('Đã tạo buổi học mới');
      setTitle('');
      setIsModalOpen(false);
      fetchData(false);
    } catch (err: any) {
      toast.error('Lỗi khi tạo buổi học');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAttendance = async (session: LessonSession) => {
    try {
      const { code, expiresAt } = await openAttendanceSession(session.id, duration);
      toast.success('Đã mở điểm danh! Mã: ' + code);
      const updated: LessonSession = {
        ...session,
        attendanceCode: code,
        attendanceOpen: true,
        codeExpiresAt: expiresAt as any,
      };
      setActiveSession(updated);
      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? updated : s))
      );
    } catch (err) {
      toast.error('Lỗi khi mở phiên điểm danh');
    }
  };

  const handleCloseAttendance = async (sessionId: string) => {
    try {
      await closeAttendanceSession(sessionId);
      toast.info('Đã đóng phiên điểm danh');
      if (activeSession?.id === sessionId) {
        setActiveSession((prev) => (prev ? { ...prev, attendanceOpen: false } : null));
      }
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, attendanceOpen: false } : s))
      );
    } catch (err) {
      toast.error('Lỗi khi đóng điểm danh');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/giang-vien/lop-hoc"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại danh sách lớp học</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {classData?.classCode}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              {classData?.className} • Buổi học & Điểm danh
            </h1>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-blue-100 flex items-center gap-2 cursor-pointer active:scale-95 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tạo buổi học mới</span>
          </button>
        </div>
      </div>

      {activeSession && activeSession.attendanceOpen && (
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                ĐANG MỞ ĐIỂM DANH
              </span>
              <h2 className="text-xl sm:text-2xl font-black">{activeSession.title}</h2>
              <p className="text-xs text-indigo-200">
                Yêu cầu sinh viên truy cập mục Điểm danh và nhập 6 chữ số dưới đây
              </p>
            </div>

            <div className="text-center bg-white/10 backdrop-blur-md px-8 py-6 rounded-3xl border border-white/20 shadow-inner">
              <span className="text-xs font-bold tracking-widest uppercase text-indigo-200 block mb-1">
                MÃ ĐIỂM DANH
              </span>
              <div className="text-4xl sm:text-6xl font-mono font-black tracking-widest text-amber-300 drop-shadow-md">
                {activeSession.attendanceCode.slice(0, 3) + ' ' + activeSession.attendanceCode.slice(3)}
              </div>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-indigo-200">
                <Clock className="w-4 h-4 text-amber-300" />
                <span>Còn hiệu lực: </span>
                <span className="font-mono font-bold text-amber-300">
                  {remainingTime || '15:00'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 w-full md:w-auto">
              <Link
                href={'/giang-vien/lop-hoc/' + classId + '/diem-danh/' + activeSession.id}
                className="py-3 px-5 bg-white text-indigo-900 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 hover:bg-indigo-50 shadow-lg shadow-black/20 transition-all cursor-pointer"
              >
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Xem danh sách có mặt Realtime</span>
              </Link>
              <button
                onClick={() => handleOpenAttendance(activeSession)}
                className="py-2.5 px-5 bg-white/10 hover:bg-white/20 border border-white/20 font-semibold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Đổi mã mới / Gia hạn</span>
              </button>
              <button
                onClick={() => handleCloseAttendance(activeSession.id)}
                className="py-2.5 px-5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-400/30 font-semibold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>Đóng điểm danh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Danh sách các buổi học ({sessions.length})
          </h2>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
            <p className="text-xs font-medium">Đang tải buổi học...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <CalendarCheck className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Chưa có buổi học nào</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-sm font-bold text-slate-900">{s.title}</h3>
                    {s.attendanceOpen ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Đang mở điểm danh ({s.attendanceCode})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                        Đã đóng
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>{formatDate(s.date, 'dd/MM/yyyy')}</span>
                    <span>•</span>
                    <span>{formatDate(s.startTime, 'HH:mm')}</span>
                    {s.description && (
                      <>
                        <span>•</span>
                        <span className="text-slate-400 line-clamp-1">{s.description}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {s.attendanceOpen ? (
                    <>
                      <button
                        onClick={() => setActiveSession(s)}
                        className="py-2 px-3.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        Chiếu mã lớn
                      </button>
                      <button
                        onClick={() => handleCloseAttendance(s.id)}
                        className="py-2 px-3.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Đóng
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleOpenAttendance(s)}
                      className="py-2 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-100 transition-all cursor-pointer"
                    >
                      MỞ ĐIỂM DANH
                    </button>
                  )}

                  <Link
                    href={'/giang-vien/lop-hoc/' + classId + '/diem-danh/' + s.id}
                    className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <span>Bảng điểm danh</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-100">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Tạo buổi học mới</h2>
                  <p className="text-xs text-slate-500">Lên lịch bài giảng và điểm danh</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Tiêu đề buổi học
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Buổi 1 - Giới thiệu nhập môn"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Ngày học
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Giờ bắt đầu
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Giờ kết thúc
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Ghi chú buổi học (tuỳ chọn)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nội dung bài giảng, tài liệu cần chuẩn bị..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-100 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer text-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <span>Tạo buổi học</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

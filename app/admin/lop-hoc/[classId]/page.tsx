'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getClassById, getClassMembers, removeStudentFromClass, deleteClass } from '@/services/classService';
import {
  getSessionsByClass,
  createSession,
  openAttendanceSession,
  closeAttendanceSession,
} from '@/services/attendanceService';
import { ClassItem, ClassMember, LessonSession, AssignmentItem, AssignmentAttachment } from '@/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDate } from '@/lib/utils';
import {
  Users,
  CalendarCheck,
  FileText,
  MessageSquare,
  ArrowLeft,
  Trash2,
  BookOpen,
  Loader2,
  Plus,
  X,
  Clock,
  ExternalLink,
  Sparkles,
  XCircle,
  QrCode,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type TabKey = 'overview' | 'students' | 'sessions' | 'forum' | 'assignments';

export default function ClassDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const classId = params.classId as string;
  const initialTab = (searchParams.get('tab') as TabKey) || 'overview';

  const [classData, setClassData] = useState<ClassItem | null>(null);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [sessions, setSessions] = useState<LessonSession[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingClass, setDeletingClass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // Phiên điểm danh đang mở & Mã điểm danh 6 số
  const [activeSession, setActiveSession] = useState<LessonSession | null>(null);
  const [duration, setDuration] = useState<number>(15);
  const [remainingTime, setRemainingTime] = useState<string>('');

  // Modal tạo buổi học
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionStartTime, setSessionStartTime] = useState('08:00');
  const [sessionEndTime, setSessionEndTime] = useState('10:30');
  const [sessionDesc, setSessionDesc] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);

  const [classAssignments, setClassAssignments] = useState<AssignmentItem[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Tải thông tin lớp học
      const cData = await getClassById(classId);
      if (cData) {
        setClassData(cData);
      }

      const effectiveId = cData?.id || classId;

      // 2. Tải thành viên, các buổi học và bài tập một cách an toàn
      const [cMembers, cSessions, cAssignSnap] = await Promise.all([
        getClassMembers(effectiveId).catch(() => []),
        getSessionsByClass(effectiveId).catch(() => []),
        getDocs(query(collection(db, 'assignments'), where('classId', '==', effectiveId))).catch(() => null),
      ]);

      setMembers(cMembers || []);
      setSessions(cSessions || []);

      if (cAssignSnap) {
        setClassAssignments(cAssignSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AssignmentItem)));
      }

      // Nếu có buổi học đang mở điểm danh thì tự động gán vào activeSession
      const openSession = (cSessions || []).find((s) => s.attendanceOpen);
      if (openSession) {
        setActiveSession(openSession);
      }
    } catch (err) {
      console.error('Lỗi nạp thông tin lớp:', err);
      toast.error('Không thể tải thông tin lớp học');
    } finally {
      setLoading(false);
    }
  };

  // Đếm ngược thời gian hết hạn mã điểm danh
  useEffect(() => {
    if (!activeSession?.attendanceOpen || !activeSession?.codeExpiresAt) return;

    const interval = setInterval(() => {
      const expires =
        typeof activeSession.codeExpiresAt.toDate === 'function'
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

  const handleOpenAttendance = async (session: LessonSession, customDuration?: number) => {
    const dur = customDuration || duration;
    try {
      const { code, expiresAt } = await openAttendanceSession(session.id, dur);
      toast.success(`Đã mở điểm danh buổi học! Mã điểm danh: ${code}`);
      setActiveSession({
        ...session,
        attendanceCode: code,
        attendanceOpen: true,
        codeExpiresAt: expiresAt as any,
      });
      fetchData();
    } catch (err: any) {
      console.error('Lỗi mở điểm danh:', err);
      toast.error(err.message || 'Lỗi khi mở phiên điểm danh');
    }
  };

  const handleCloseAttendance = async (sessionId: string) => {
    try {
      await closeAttendanceSession(sessionId);
      toast.info('Đã đóng phiên điểm danh');
      if (activeSession?.id === sessionId) {
        setActiveSession((prev) => (prev ? { ...prev, attendanceOpen: false } : null));
      }
      fetchData();
    } catch (err: any) {
      toast.error('Lỗi khi đóng phiên điểm danh');
    }
  };

  const handleQuickCreateOrOpenAttendance = () => {
    if (sessions.length > 0) {
      // Ưu tiên mở buổi học gần nhất hoặc chuyển sang tab buổi học
      setActiveTab('sessions');
      const targetSess = sessions[0];
      if (!targetSess.attendanceOpen) {
        handleOpenAttendance(targetSess);
      } else {
        setActiveSession(targetSess);
      }
    } else {
      // Chưa có buổi học thì mở modal tạo buổi học
      setIsSessionModalOpen(true);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionTitle.trim() || !sessionDate || !sessionStartTime) {
      toast.error('Vui lòng nhập đầy đủ tiêu đề, ngày và giờ bắt đầu buổi học');
      return;
    }

    setCreatingSession(true);
    try {
      const newSessionId = await createSession({
        classId,
        title: sessionTitle.trim(),
        description: sessionDesc.trim(),
        date: sessionDate,
        startTime: sessionStartTime,
        endTime: sessionEndTime,
        createdBy: 'Admin',
      });
      toast.success('Đã tạo buổi học mới thành công!');
      setIsSessionModalOpen(false);
      setSessionTitle('');
      setSessionDesc('');
      await fetchData();

      // Tự động mở điểm danh ngay cho buổi học mới tạo
      try {
        const { code, expiresAt } = await openAttendanceSession(newSessionId, duration);
        toast.success(`Đã mở điểm danh tự động! Mã điểm danh: ${code}`);
        setActiveSession({
          id: newSessionId,
          classId,
          title: sessionTitle.trim(),
          date: sessionDate,
          startTime: sessionStartTime,
          endTime: sessionEndTime,
          attendanceCode: code,
          attendanceOpen: true,
          codeExpiresAt: expiresAt as any,
          createdBy: 'Admin',
          createdAt: new Date() as any,
          updatedAt: new Date() as any,
        } as unknown as LessonSession);
        setActiveTab('sessions');
      } catch (openErr) {
        console.warn('Lỗi mở điểm danh tự động:', openErr);
      }
    } catch (err: any) {
      console.error('Lỗi tạo buổi học:', err);
      toast.error(err.message || 'Lỗi khi tạo buổi học');
    } finally {
      setCreatingSession(false);
    }
  };

  useEffect(() => {
    if (classId) fetchData();
  }, [classId]);

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm('Bạn có chắc muốn xoá học viên ' + name + ' khỏi lớp này?')) return;
    try {
      await removeStudentFromClass(classId, userId);
      toast.success('Đã xoá học viên khỏi lớp');
      fetchData();
    } catch (err) {
      toast.error('Lỗi khi xoá học viên');
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-xs font-medium">Đang tải thông tin lớp...</p>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm font-semibold text-slate-600">Không tìm thấy lớp học</p>
        <Link
          href="/admin/lop-hoc"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại danh sách</span>
        </Link>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'overview', label: 'Tổng quan', icon: BookOpen },
    { key: 'students', label: 'Sinh viên (' + members.length + ')', icon: Users },
    { key: 'sessions', label: 'Buổi học (' + sessions.length + ')', icon: CalendarCheck },
    { key: 'forum', label: 'Diễn đàn', icon: MessageSquare },
    { key: 'assignments', label: 'Bài tập', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/lop-hoc"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại danh sách lớp học</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {classData.classCode}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {classData.academicYear} • {classData.semester}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              {classData.className}
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleQuickCreateOrOpenAttendance}
              className="py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-emerald-100 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Mở Điểm Danh / Tạo Mã</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSessionModalOpen(true)}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-indigo-100 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Buổi học</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-2xl border border-rose-200 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              title="Xóa lớp học"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Xóa lớp</span>
            </button>
          </div>
        </div>
      </div>

      {/* BANNER MÃ ĐIỂM DANH REALTIME KHI ĐANG MỞ */}
      {activeSession && activeSession.attendanceOpen && (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-indigo-500/30 animate-in fade-in zoom-in-95">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                ĐANG MỞ ĐIỂM DANH
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">{activeSession.title}</h2>
              <p className="text-xs text-indigo-200 max-w-md">
                Sinh viên có thể vào <span className="font-bold text-white">/diem-danh</span> nhập Mã SV và Mã lớp, hoặc nhập 6 chữ số dưới đây để ghi nhận có mặt.
              </p>
            </div>

            <div className="text-center bg-white/10 backdrop-blur-md px-8 py-5 rounded-3xl border border-white/20 shadow-inner">
              <span className="text-[11px] font-bold tracking-widest uppercase text-indigo-300 block mb-1">
                MÃ ĐIỂM DANH BUỔI HỌC
              </span>
              <div className="text-4xl sm:text-5xl font-mono font-black tracking-widest text-amber-300 drop-shadow-md">
                {activeSession.attendanceCode
                  ? activeSession.attendanceCode.slice(0, 3) + ' ' + activeSession.attendanceCode.slice(3)
                  : '------'}
              </div>
              <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-indigo-200">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>Còn hiệu lực: </span>
                <span className="font-mono font-bold text-amber-300">
                  {remainingTime || '15:00'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full md:w-auto">
              <Link
                href={'/giang-vien/lop-hoc/' + classId + '/diem-danh/' + activeSession.id}
                className="py-2.5 px-4 bg-white text-indigo-900 font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-indigo-50 shadow-md transition-all cursor-pointer"
              >
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Bảng điểm danh Realtime</span>
              </Link>
              <button
                type="button"
                onClick={() => handleOpenAttendance(activeSession)}
                className="py-2.5 px-4 bg-white/10 hover:bg-white/20 border border-white/20 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Đổi mã mới / Gia hạn</span>
              </button>
              <button
                type="button"
                onClick={() => handleCloseAttendance(activeSession.id)}
                className="py-2 px-4 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-400/30 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>Đóng điểm danh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex border-b border-slate-200/80 gap-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={'flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ' + (
                isActive
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-card border border-slate-200/80 space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Thông tin chi tiết</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {classData.description || 'Chưa có mô tả chi tiết cho lớp học này.'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Niên khoá</span>
                  <span className="text-xs font-semibold text-slate-800">{classData.academicYear || '--'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Học kỳ</span>
                  <span className="text-xs font-semibold text-slate-800">{classData.semester || '--'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Ngày khởi tạo</span>
                  <span className="text-xs font-semibold text-slate-800">{formatDate(classData.createdAt, 'dd/MM/yyyy')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-6 shadow-card border border-slate-200/80">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Thống kê nhanh
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Tổng sinh viên</span>
                  <span className="text-sm font-bold text-indigo-600">{members.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Số buổi học</span>
                  <span className="text-sm font-bold text-slate-800">{sessions.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">Trạng thái</span>
                  <span className="text-xs font-semibold text-emerald-600">Đang giảng dạy</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl p-5 border border-indigo-100/80 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                Thao tác điểm danh nhanh
              </h3>
              <p className="text-[11px] text-slate-600">
                Mở phiên điểm danh để phát mã 6 chữ số cho sinh viên trong lớp điểm danh có mặt.
              </p>
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleQuickCreateOrOpenAttendance}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>Mở điểm danh / Tạo mã ngay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('sessions')}
                  className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-indigo-700 font-semibold text-xs rounded-xl border border-indigo-200/60 flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>Xem danh sách buổi học ({sessions.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden">
          {members.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-600">Chưa có sinh viên trong lớp</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-3.5 text-center w-10">STT</th>
                    <th className="px-4 py-3.5">Mã SV / CCCD</th>
                    <th className="px-4 py-3.5">Họ và tên</th>
                    <th className="px-3 py-3.5">Giới tính</th>
                    <th className="px-3 py-3.5">Ngày sinh</th>
                    <th className="px-3 py-3.5">Số điện thoại</th>
                    <th className="px-4 py-3.5">Quê quán / Nơi sinh</th>
                    <th className="px-4 py-3.5">Hộ khẩu thường trú</th>
                    <th className="px-3 py-3.5">Ngày tham gia</th>
                    <th className="px-3 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((m, index) => (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-3.5 text-center font-bold text-slate-400">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-indigo-600">
                          {m.studentCode || m.user?.studentCode || '--'}
                        </div>
                        {(m.cccd || m.user?.cccd) && (
                          <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                            CCCD: {m.cccd || m.user?.cccd}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {m.fullName || m.user?.fullName || 'Sinh viên'}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          (m.gender || m.user?.gender) === 'Nữ'
                            ? 'bg-pink-50 text-pink-700 border border-pink-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {m.gender || m.user?.gender || 'Nam'}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-slate-600 font-medium">
                        {m.dateOfBirth || m.user?.dateOfBirth || '--'}
                      </td>
                      <td className="px-3 py-3.5 font-mono text-slate-600">
                        {m.phone || m.user?.phone || '--'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {(m.hometown || m.user?.hometown || m.placeOfBirth || m.user?.placeOfBirth) ? (
                          <div>
                            {(m.hometown || m.user?.hometown) && (
                              <div className="font-medium text-slate-700">{m.hometown || m.user?.hometown}</div>
                            )}
                            {(m.placeOfBirth || m.user?.placeOfBirth) && (
                              <div className="text-[11px] text-slate-400">Nơi sinh: {m.placeOfBirth || m.user?.placeOfBirth}</div>
                            )}
                          </div>
                        ) : (
                          '--'
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 max-w-[160px] truncate" title={m.permanentAddress || m.user?.permanentAddress}>
                        {m.permanentAddress || m.user?.permanentAddress || '--'}
                      </td>
                      <td className="px-3 py-3.5 text-slate-400">
                        {formatDate(m.joinedAt, 'dd/MM/yyyy')}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <button
                          onClick={() => handleRemoveMember(m.userId, m.fullName || m.user?.fullName || '')}
                          className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 cursor-pointer"
                          title="Xoá khỏi lớp"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Danh sách Buổi học</h3>
              <p className="text-xs text-slate-500">
                Các buổi học được tạo cho lớp {classData.className} ({classData.classCode})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSessionModalOpen(true)}
                className="py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-indigo-100 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tạo buổi học mới</span>
              </button>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-card">
              <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700">Chưa có buổi học nào được tạo</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Admin hoặc Giảng viên có thể tạo buổi học để sinh viên điểm danh có mặt trong buổi đó.
              </p>
              <button
                type="button"
                onClick={() => setIsSessionModalOpen(true)}
                className="mt-4 inline-flex items-center gap-2 py-2.5 px-5 bg-indigo-600 text-white rounded-2xl text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo buổi học đầu tiên</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Tiêu đề buổi học</th>
                      <th className="px-5 py-3.5">Ngày học</th>
                      <th className="px-5 py-3.5">Khung giờ</th>
                      <th className="px-5 py-3.5">Điểm danh</th>
                      <th className="px-5 py-3.5 text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-slate-800 block">{s.title}</span>
                          {s.description && (
                            <span className="text-[11px] text-slate-400 block line-clamp-1">
                              {s.description}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-700">
                          {formatDate(s.date, 'dd/MM/yyyy')}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          <div className="flex items-center gap-1 font-mono">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {formatDate(s.startTime, 'HH:mm')} - {s.endTime ? formatDate(s.endTime, 'HH:mm') : '--'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {s.attendanceOpen ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Đang mở ({s.attendanceCode})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Đã đóng
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {s.attendanceOpen ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setActiveSession(s)}
                                  className="py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                  Chiếu mã
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCloseAttendance(s.id)}
                                  className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                  Đóng
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenAttendance(s)}
                                className="py-1.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl text-xs shadow-sm shadow-emerald-100 transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Zap className="w-3 h-3 text-amber-300" />
                                <span>Mở điểm danh (Tạo mã)</span>
                              </button>
                            )}

                            <Link
                              href={'/giang-vien/lop-hoc/' + classId + '/diem-danh/' + s.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                            >
                              <span>Bảng điểm danh</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal Tạo Buổi Học */}
          {isSessionModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50">
              <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
                      <CalendarCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800">Tạo buổi học mới</h3>
                      <p className="text-xs text-slate-500">Lớp: {classData.className} ({classData.classCode})</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSessionModalOpen(false)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white transition-colors"
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
                      value={sessionTitle}
                      onChange={(e) => setSessionTitle(e.target.value)}
                      placeholder="Ví dụ: Buổi 1: Giới thiệu nhập môn & cài đặt môi trường"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Ngày học
                      </label>
                      <input
                        type="date"
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Giờ bắt đầu
                      </label>
                      <input
                        type="time"
                        value={sessionStartTime}
                        onChange={(e) => setSessionStartTime(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Giờ kết thúc (Dự kiến)
                    </label>
                    <input
                      type="time"
                      value={sessionEndTime}
                      onChange={(e) => setSessionEndTime(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Mô tả / Ghi chú buổi học
                    </label>
                    <textarea
                      value={sessionDesc}
                      onChange={(e) => setSessionDesc(e.target.value)}
                      placeholder="Nội dung cần chuẩn bị hoặc tài liệu tham khảo..."
                      rows={2}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
                    />
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsSessionModalOpen(false)}
                      className="w-1/3 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all cursor-pointer text-xs"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={creatingSession}
                      className="flex-1 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60 text-xs"
                    >
                      {creatingSession ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang lưu...</span>
                        </>
                      ) : (
                        <span>+ Xác nhận tạo buổi học</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'forum' && (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/80">
          <MessageSquare className="w-12 h-12 text-purple-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">Diễn đàn trao đổi học tập</h3>
          <p className="text-xs text-slate-500 mt-1">
            Trao đổi bài giảng, thảo luận và thông báo của lớp học.
          </p>
          <Link
            href={'/lop-hoc/' + classId + '/dien-dan'}
            className="mt-4 inline-flex items-center gap-2 py-2.5 px-4 bg-purple-600 text-white rounded-2xl text-xs font-semibold hover:bg-purple-700 transition-all"
          >
            Xem bảng tin diễn đàn lớp
          </Link>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Bài tập của lớp ({classAssignments.length})
              </h3>
              <p className="text-xs text-slate-500">
                Các nhiệm vụ, bài tập theo giáo trình và tài liệu đã giao cho sinh viên lớp này
              </p>
            </div>
            <Link
              href="/admin/bai-tap"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-100 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Giao bài tập mới</span>
            </Link>
          </div>

          {classAssignments.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-card">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700">Chưa có bài tập nào cho lớp này</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Bạn có thể giao bài tập kèm tệp tin Word, Excel, PPTX, hình ảnh hoặc giao theo bài trong giáo trình.
              </p>
              <Link
                href="/admin/bai-tap"
                className="mt-4 inline-flex items-center gap-2 py-2.5 px-5 bg-indigo-600 text-white rounded-2xl text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Giao bài tập ngay</span>
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden divide-y divide-slate-100">
              {classAssignments.map((a) => (
                <div key={a.id} className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">{a.title}</h4>
                    <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Hạn: {formatDate(a.deadline, 'HH:mm dd/MM/yyyy')}
                    </span>
                  </div>

                  {a.textbookReference && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/80 text-amber-800 rounded-xl text-xs font-semibold border border-amber-200/60">
                      <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{a.textbookReference}</span>
                    </div>
                  )}

                  {a.description && (
                    <p className="text-xs text-slate-600 whitespace-pre-line">{a.description}</p>
                  )}

                  {a.attachments && a.attachments.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Tệp đính kèm ({a.attachments.length}):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {a.attachments.map((att, idx) => {
                          const name = typeof att === 'string' ? att : att.name;
                          const url = typeof att === 'string' ? att : att.url;
                          return (
                            <a
                              key={idx}
                              href={url}
                              download={name}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-indigo-500" />
                              <span className="truncate max-w-[180px]">{name}</span>
                              <ExternalLink className="w-3 h-3 ml-0.5 text-slate-400" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA LỚP HỌC */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto ring-4 ring-rose-50">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Xác nhận xóa lớp học này?</h3>
              <p className="text-xs text-slate-500">
                Toàn bộ dữ liệu lớp{' '}
                <strong className="text-rose-600 font-bold">
                  {classData?.className} ({classData?.classCode})
                </strong>{' '}
                bao gồm danh sách sinh viên, các buổi học và điểm danh sẽ bị xóa vĩnh viễn khỏi hệ thống.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deletingClass}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDeletingClass(true);
                  try {
                    await deleteClass(classId);
                    toast.success('Đã xóa lớp học thành công!');
                    router.push('/admin/lop-hoc');
                  } catch (err: any) {
                    toast.error(err.message || 'Lỗi khi xóa lớp học');
                    setDeletingClass(false);
                  }
                }}
                disabled={deletingClass}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-rose-200 cursor-pointer disabled:opacity-50"
              >
                {deletingClass ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xác nhận xóa lớp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

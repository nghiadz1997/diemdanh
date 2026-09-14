'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getClasses } from '@/services/classService';
import { ClassItem, LessonSession, AttendanceRecord } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  School,
  ArrowRight,
  Sparkles,
  Calendar,
  BookOpen,
  X,
  Search,
  Check,
  Radio,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { sendAttendanceTelegramNotification } from '@/services/telegramService';

export default function StudentAttendancePage() {
  const { profile, user } = useAuth();

  // Danh sách lớp & buổi học & lịch sử điểm danh của sinh viên
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sessions, setSessions] = useState<LessonSession[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);

  // Bộ lọc
  const [filterTab, setFilterTab] = useState<'all' | 'open' | 'attended' | 'upcoming'>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form nhập mã nhanh
  const [quickCode, setQuickCode] = useState('');
  const [submittingQuick, setSubmittingQuick] = useState(false);

  // Modal điểm danh cho buổi học cụ thể
  const [targetSession, setTargetSession] = useState<LessonSession | null>(null);
  const [sessionCode, setSessionCode] = useState('');
  const [submittingModal, setSubmittingModal] = useState(false);

  // Màn hình kết quả thành công sau khi điểm danh
  const [result, setResult] = useState<{
    className: string;
    sessionTitle: string;
    checkInTime: string;
    studentName: string;
    studentCode: string;
  } | null>(null);

  // Tải dữ liệu các lớp, buổi học do giảng viên tạo và lịch sử điểm danh của sinh viên
  const loadData = async () => {
    if (!profile?.uid && !user?.uid) return;
    setLoading(true);

    try {
      const studentUid = profile?.uid || user?.uid || '';
      const cleanStudentCode = profile?.studentCode?.trim().toUpperCase() || '';

      // 1. Tải tất cả lớp học
      const allClasses = await getClasses();

      // 2. Lấy danh sách classId mà sinh viên tham gia
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

      // Lọc danh sách lớp học của sinh viên (nếu chưa gán lớp nào thì fallback toàn bộ lớp hoạt động)
      const studentClasses =
        enrolledClassIds.size > 0
          ? allClasses.filter((c) => enrolledClassIds.has(c.id))
          : allClasses.filter((c) => c.active !== false);

      setClasses(studentClasses);

      // 3. Tải các buổi học do giảng viên tạo cho các lớp này
      const targetClassIds = studentClasses.map((c) => c.id);
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

      // Sắp xếp: Buổi học đang mở điểm danh lên đầu tiên, sau đó theo ngày tạo mới nhất
      loadedSessions.sort((a, b) => {
        if (a.attendanceOpen && !b.attendanceOpen) return -1;
        if (!a.attendanceOpen && b.attendanceOpen) return 1;
        const timeA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate().getTime() : 0;
        const timeB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate().getTime() : 0;
        return timeB - timeA;
      });

      setSessions(loadedSessions);

      // 4. Tải các lượt điểm danh của sinh viên này
      const attMap: Record<string, AttendanceRecord> = {};
      try {
        const attQueries = [
          query(collection(db, 'attendance'), where('userId', '==', studentUid)),
        ];
        if (cleanStudentCode) {
          attQueries.push(
            query(collection(db, 'attendance'), where('studentCode', '==', cleanStudentCode))
          );
        }
        for (const aq of attQueries) {
          const attSnap = await getDocs(aq);
          attSnap.docs.forEach((d) => {
            const data = { id: d.id, ...d.data() } as AttendanceRecord;
            if (data.sessionId) {
              attMap[data.sessionId] = data;
            }
          });
        }
      } catch (attErr) {
        console.warn('Lỗi tải attendance của sinh viên:', attErr);
      }

      setAttendanceMap(attMap);
    } catch (err) {
      console.error('Lỗi khởi tạo dữ liệu điểm danh sinh viên:', err);
      toast.error('Không thể tải danh sách buổi học');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile, user]);

  // Tạo map tra cứu thông tin lớp theo classId
  const classMap = useMemo(() => {
    const map = new Map<string, ClassItem>();
    classes.forEach((c) => map.set(c.id, c));
    return map;
  }, [classes]);

  // Lọc danh sách buổi học theo Tab, Lớp và Từ khóa tìm kiếm
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Lọc theo lớp học
      if (selectedClassId !== 'all' && s.classId !== selectedClassId) {
        return false;
      }

      const isAttended = !!attendanceMap[s.id];
      const isOpen = s.attendanceOpen === true;

      // Lọc theo tab
      if (filterTab === 'open' && !isOpen) return false;
      if (filterTab === 'attended' && !isAttended) return false;
      if (filterTab === 'upcoming' && (isOpen || isAttended)) return false;

      // Lọc theo từ khóa tìm kiếm
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cData = classMap.get(s.classId);
        const matchTitle = (s.title || '').toLowerCase().includes(q);
        const matchClass = (cData?.className || '').toLowerCase().includes(q) || (cData?.classCode || '').toLowerCase().includes(q);
        if (!matchTitle && !matchClass) return false;
      }

      return true;
    });
  }, [sessions, attendanceMap, filterTab, selectedClassId, searchQuery, classMap]);

  // Đếm số lượng buổi học đang mở điểm danh mà sinh viên CHƯA điểm danh
  const openPendingSessions = useMemo(() => {
    return sessions.filter((s) => s.attendanceOpen === true && !attendanceMap[s.id]);
  }, [sessions, attendanceMap]);

  // Thực hiện ghi nhận điểm danh vào Firestore
  const recordAttendance = async (session: LessonSession, codeInput: string) => {
    const cleanCode = codeInput.trim().replace(/\D/g, '');
    const cleanStudentCode = profile?.studentCode?.trim().toUpperCase() || user?.email?.split('@')[0].toUpperCase() || 'SV';
    const studentUid = profile?.uid || user?.uid || cleanStudentCode;
    const studentName = profile?.fullName || 'Sinh viên ' + cleanStudentCode;

    if (cleanCode.length !== 6) {
      throw new Error('Vui lòng nhập đầy đủ 6 chữ số mã điểm danh do giảng viên cung cấp');
    }

    // Kiểm tra buổi học có đang mở điểm danh không
    if (!session.attendanceOpen) {
      throw new Error('Buổi học này hiện đã đóng điểm danh hoặc chưa được giảng viên mở');
    }

    // Kiểm tra mã điểm danh có trùng khớp không
    if (session.attendanceCode && session.attendanceCode !== cleanCode) {
      throw new Error(`Mã điểm danh "${cleanCode}" không chính xác cho buổi học này`);
    }

    // Kiểm tra thời hạn mã nếu có
    if (session.codeExpiresAt) {
      const expiresAt = session.codeExpiresAt?.toMillis
        ? session.codeExpiresAt.toMillis()
        : new Date(session.codeExpiresAt).getTime();
      if (expiresAt && Date.now() > expiresAt) {
        throw new Error('Mã điểm danh của buổi học này đã hết hạn. Vui lòng xin giảng viên cấp lại mã');
      }
    }

    // Kiểm tra xem đã điểm danh buổi học này chưa
    const attendanceDocId = `${session.id}_${cleanStudentCode}`;
    const attRef = doc(db, 'attendance', attendanceDocId);
    const existingAtt = await getDoc(attRef);

    const nowTimeStr = new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const cData = classMap.get(session.classId);
    const className = cData?.className || 'Lớp học';
    const classCode = cData?.classCode || '';

    if (existingAtt.exists()) {
      // Cập nhật map cục bộ
      setAttendanceMap((prev) => ({
        ...prev,
        [session.id]: { id: existingAtt.id, ...existingAtt.data() } as AttendanceRecord,
      }));
      throw new Error('Bạn đã được điểm danh CÓ MẶT trong buổi học này trước đó rồi');
    }

    // Ghi nhận điểm danh mới
    await setDoc(attRef, {
      sessionId: session.id,
      sessionTitle: session.title || 'Buổi học',
      classId: session.classId,
      className,
      classCode,
      userId: studentUid,
      studentCode: cleanStudentCode,
      studentName,
      gender: profile?.gender || null,
      dateOfBirth: profile?.dateOfBirth || null,
      phone: profile?.phone || null,
      cccd: profile?.cccd || null,
      placeOfBirth: profile?.placeOfBirth || null,
      hometown: profile?.hometown || null,
      permanentAddress: profile?.permanentAddress || null,
      status: 'present',
      method: 'code',
      checkInTime: serverTimestamp(),
      checkInTimeStr: nowTimeStr,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Đồng bộ vào classMembers của lớp để giảng viên thấy
    try {
      const memberKey = `${session.classId}_${cleanStudentCode}`;
      await setDoc(
        doc(db, 'classMembers', memberKey),
        {
          classId: session.classId,
          userId: studentUid,
          studentCode: cleanStudentCode,
          fullName: studentName,
          gender: profile?.gender || '',
          dateOfBirth: profile?.dateOfBirth || '',
          phone: profile?.phone || '',
          cccd: profile?.cccd || '',
          active: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (memErr) {
      console.warn('Lỗi ghi nhận classMembers:', memErr);
    }

    // Cập nhật state cục bộ
    setAttendanceMap((prev) => ({
      ...prev,
      [session.id]: {
        id: attendanceDocId,
        sessionId: session.id,
        classId: session.classId,
        userId: studentUid,
        studentCode: cleanStudentCode,
        status: 'present',
        checkInTime: nowTimeStr,
        method: 'code',
      } as any,
    }));

    // Tự động gửi thông báo điểm danh về Bot Telegram
    sendAttendanceTelegramNotification({
      studentName,
      studentCode: cleanStudentCode,
      className,
      classCode,
      sessionTitle: session.title || 'Buổi học',
      checkInTime: nowTimeStr,
      phone: profile?.phone || undefined,
      gender: profile?.gender || undefined,
      cccd: profile?.cccd || undefined,
      status: 'present',
      method: 'code',
    });

    return {
      className,
      sessionTitle: session.title || 'Buổi học',
      checkInTime: nowTimeStr,
      studentName,
      studentCode: cleanStudentCode,
    };
  };

  // 1. Xử lý điểm danh nhanh bằng ô nhập mã 6 số
  const handleQuickCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickCode.trim().replace(/\D/g, '');
    if (clean.length !== 6) {
      toast.error('Vui lòng nhập đầy đủ 6 chữ số mã điểm danh');
      return;
    }

    setSubmittingQuick(true);
    try {
      // Tìm buổi học có mã điểm danh này
      const sessQ = query(
        collection(db, 'sessions'),
        where('attendanceCode', '==', clean)
      );
      const sessSnap = await getDocs(sessQ);

      if (sessSnap.empty) {
        toast.error(`Mã điểm danh "${clean}" không tồn tại hoặc buổi học chưa mở điểm danh`);
        setSubmittingQuick(false);
        return;
      }

      const matchDoc = sessSnap.docs.find((d) => d.data().attendanceOpen === true) || sessSnap.docs[0];
      const sessData = { id: matchDoc.id, ...matchDoc.data() } as LessonSession;

      const res = await recordAttendance(sessData, clean);
      setResult(res);
      setQuickCode('');
      toast.success(`Điểm danh thành công cho buổi học "${sessData.title}"!`);
    } catch (err: any) {
      console.error('Lỗi điểm danh nhanh:', err);
      toast.error(err.message || 'Lỗi khi điểm danh');
    } finally {
      setSubmittingQuick(false);
    }
  };

  // 2. Xử lý điểm danh từ Modal theo buổi học được chọn
  const handleModalCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSession) return;

    setSubmittingModal(true);
    try {
      const res = await recordAttendance(targetSession, sessionCode);
      setResult(res);
      setTargetSession(null);
      setSessionCode('');
      toast.success(`Điểm danh thành công: ${targetSession.title}!`);
    } catch (err: any) {
      console.error('Lỗi điểm danh theo buổi:', err);
      toast.error(err.message || 'Lỗi khi điểm danh');
    } finally {
      setSubmittingModal(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2 sm:py-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-white/10 backdrop-blur-md border border-white/20 text-indigo-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Hệ thống điểm danh theo buổi học của Giảng viên</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Điểm Danh & Danh Sách Buổi Học
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200 max-w-xl">
              Sinh viên xem các buổi học do giảng viên khởi tạo cho lớp của bạn, theo dõi trạng thái mở/đóng và bấm xác nhận điểm danh có mặt trực tiếp.
            </p>
          </div>

          {/* Badge thông tin sinh viên */}
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shrink-0 text-right self-start md:self-auto min-w-[200px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block">
              Sinh viên đăng nhập
            </span>
            <span className="text-base font-bold text-white block mt-0.5">
              {profile?.fullName || 'Sinh viên'}
            </span>
            <span className="text-xs font-mono font-bold text-amber-300 block">
              MSSV: {profile?.studentCode || 'Đang cập nhật'}
            </span>
          </div>
        </div>
      </div>

      {/* Thông báo nổi bật nếu có buổi học ĐANG MỞ ĐIỂM DANH */}
      {openPendingSessions.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border-2 border-emerald-500/40 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                CÓ {openPendingSessions.length} BUỔI HỌC ĐANG MỞ ĐIỂM DANH!
              </span>
              <p className="text-xs sm:text-sm font-semibold text-slate-800">
                {openPendingSessions[0].title} ({classMap.get(openPendingSessions[0].classId)?.className || 'Lớp học'})
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setTargetSession(openPendingSessions[0]);
              setSessionCode('');
            }}
            className="py-3 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>ĐIỂM DANH BUỔI NÀY NGAY</span>
          </button>
        </div>
      )}

      {/* Grid: Form nhập mã nhanh (Bên trái) + Lọc tìm kiếm (Bên phải) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Khung Nhập Mã Điểm Danh Nhanh */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-card border border-slate-200/80 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Điểm Danh Bằng Mã Nhanh</h2>
              <p className="text-[11px] text-slate-500">Nhập mã 6 số do giảng viên chiếu trên lớp</p>
            </div>
          </div>

          <form onSubmit={handleQuickCheckIn} className="space-y-4">
            <div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={quickCode}
                onChange={(e) => setQuickCode(e.target.value.replace(/\D/g, ''))}
                placeholder="------"
                className="w-full text-center text-3xl tracking-[0.35em] font-mono font-black py-3.5 bg-slate-50 border-2 border-indigo-100 focus:border-indigo-600 rounded-2xl focus:outline-none focus:bg-white text-slate-900 transition-all placeholder:text-slate-300"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submittingQuick || quickCode.length !== 6}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-md shadow-indigo-200 flex items-center justify-center gap-2 active:scale-98 transition-all disabled:opacity-50 text-xs cursor-pointer"
            >
              {submittingQuick ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xác nhận mã...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác Nhận Điểm Danh Nhanh</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center">
            <Link
              href="/sinh-vien/lich-su-diem-danh"
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              <span>Xem lịch sử chuyên cần của bạn</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Khung Bộ Lọc & Tìm Kiếm Buổi Học */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-6 shadow-card border border-slate-200/80 flex flex-col justify-between gap-4">
          <div>
            <h2 className="text-sm font-black text-slate-900 mb-1">Bộ Lọc & Tìm Kiếm Buổi Học</h2>
            <p className="text-xs text-slate-500 mb-4">
              Lọc buổi học theo môn, lớp học hoặc trạng thái mở điểm danh của giảng viên
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Lọc theo lớp học */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Chọn Lớp Học
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                >
                  <option value="all">Tất cả lớp học ({classes.length} lớp)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.className} ({c.classCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tìm kiếm theo tên */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Tìm Kiếm Buổi Học
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nhập tên buổi học, mã lớp..."
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </div>

          {/* Tabs bộ lọc trạng thái */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setFilterTab('all')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả ({sessions.length})
            </button>
            <button
              onClick={() => setFilterTab('open')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                filterTab === 'open'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Đang mở ({sessions.filter((s) => s.attendanceOpen).length})</span>
            </button>
            <button
              onClick={() => setFilterTab('attended')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterTab === 'attended'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              ✓ Đã điểm danh ({Object.keys(attendanceMap).length})
            </button>
            <button
              onClick={() => setFilterTab('upcoming')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterTab === 'upcoming'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Chưa mở điểm danh
            </button>
          </div>
        </div>
      </div>

      {/* Danh sách các buổi học do Giảng viên tạo */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Buổi Học Thuộc Lớp Của Bạn
            </h2>
            <p className="text-xs text-slate-500">
              Hiển thị {filteredSessions.length} buổi học do giảng viên đã lên lịch và khởi tạo
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Làm mới danh sách</span>
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-xs font-medium">Đang tải danh sách buổi học của giảng viên...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 mx-auto flex items-center justify-center">
              <Calendar className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Không tìm thấy buổi học nào</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Hiện tại chưa có buổi học nào khớp với bộ lọc hoặc giảng viên chưa tạo buổi học mới cho lớp này.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSessions.map((session) => {
              const cData = classMap.get(session.classId);
              const attendanceRecord = attendanceMap[session.id];
              const isAttended = !!attendanceRecord;
              const isOpen = session.attendanceOpen === true;

              return (
                <div
                  key={session.id}
                  className={`bg-white rounded-3xl p-5 shadow-card border transition-all flex flex-col justify-between gap-4 ${
                    isAttended
                      ? 'border-emerald-200 bg-emerald-50/10'
                      : isOpen
                      ? 'border-indigo-300 ring-2 ring-indigo-500/20 shadow-indigo-100/50'
                      : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header Thẻ Buổi Học: Tên lớp & Trạng thái */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {cData?.classCode || 'LỚP HỌC'}
                        </span>
                        <h3 className="text-base font-black text-slate-900 line-clamp-1">
                          {session.title}
                        </h3>
                        <p className="text-xs font-semibold text-slate-600 line-clamp-1">
                          {cData?.className || 'Lớp học'}
                        </p>
                      </div>

                      {/* Badge Trạng Thái */}
                      {isAttended ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Đã điểm danh</span>
                        </span>
                      ) : isOpen ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500 text-white shadow-md shadow-emerald-500/20 shrink-0 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-white" />
                          <span>ĐANG MỞ</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Chưa mở</span>
                        </span>
                      )}
                    </div>

                    {/* Thông tin Thời Gian & Ngày Học */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Ngày học:</span>
                        <span className="font-bold text-slate-800">
                          {formatDate(session.date, 'dd/MM/yyyy')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block">Thời gian:</span>
                        <span className="font-bold text-indigo-700">
                          {session.startTime
                            ? formatDate(session.startTime, 'HH:mm')
                            : '--:--'}
                          {' - '}
                          {session.endTime
                            ? formatDate(session.endTime, 'HH:mm')
                            : 'Kết thúc'}
                        </span>
                      </div>
                    </div>

                    {/* Mô tả / phòng học */}
                    {session.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 italic">
                        {session.description}
                      </p>
                    )}
                  </div>

                  {/* Hành động Điểm Danh dưới chân Thẻ */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    {isAttended ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          Có mặt lúc:{' '}
                          <strong className="font-mono">
                            {attendanceRecord.checkInTime
                              ? formatDate(attendanceRecord.checkInTime, 'HH:mm dd/MM')
                              : (attendanceRecord as any).checkInTimeStr || 'Đã ghi nhận'}
                          </strong>
                        </span>
                      </div>
                    ) : isOpen ? (
                      <button
                        onClick={() => {
                          setTargetSession(session);
                          setSessionCode('');
                        }}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>ĐIỂM DANH BUỔI HỌC NÀY</span>
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 italic">
                        Chờ giảng viên mở cổng điểm danh trên lớp
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Điểm danh cho Buổi học đã chọn */}
      {targetSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 relative">
            <button
              onClick={() => setTargetSession(null)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center absolute top-4 right-4 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1 pt-1">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center shadow-md">
                <QrCode className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-2">
                Xác Nhận Điểm Danh Buổi Học
              </h3>
              <p className="text-xs text-slate-500">
                Nhập mã 6 chữ số do giảng viên trình chiếu trên lớp
              </p>
            </div>

            {/* Thông tin buổi học */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                <span className="text-slate-500">Buổi học:</span>
                <span className="font-bold text-slate-900">{targetSession.title}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                <span className="text-slate-500">Lớp học:</span>
                <span className="font-semibold text-indigo-700">
                  {classMap.get(targetSession.classId)?.className} (
                  {classMap.get(targetSession.classId)?.classCode})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Sinh viên:</span>
                <span className="font-bold text-slate-800">
                  {profile?.fullName} ({profile?.studentCode})
                </span>
              </div>
            </div>

            {/* Form nhập mã */}
            <form onSubmit={handleModalCheckIn} className="space-y-4">
              <div>
                <label className="block text-center text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Mã điểm danh (6 chữ số)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="------"
                  className="w-full text-center text-3xl tracking-[0.4em] font-mono font-black py-3.5 bg-slate-50 border-2 border-indigo-200 focus:border-indigo-600 rounded-2xl focus:outline-none focus:bg-white text-slate-900 transition-all placeholder:text-slate-300"
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetSession(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submittingModal || sessionCode.length !== 6}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 text-xs cursor-pointer"
                >
                  {submittingModal ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang ghi nhận...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Xác Nhận Có Mặt</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP THÀNH CÔNG: Hiển thị kết quả điểm danh chi tiết */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-6 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center ring-8 ring-emerald-50 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ghi nhận thành công</span>
              </span>
              <h3 className="text-2xl font-black text-slate-900 mt-2">
                ĐÃ ĐIỂM DANH CÓ MẶT!
              </h3>
              <p className="text-xs text-slate-500">
                Buổi học của bạn đã được ghi nhận hiện diện trên hệ thống
              </p>
            </div>

            {/* Chi tiết */}
            <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 text-xs border border-slate-100">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                <span className="text-slate-500">Sinh viên:</span>
                <span className="font-bold text-slate-900">{result.studentName}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                <span className="text-slate-500">Mã sinh viên:</span>
                <span className="font-mono font-bold text-indigo-600">{result.studentCode}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                <span className="text-slate-500">Lớp học:</span>
                <span className="font-semibold text-slate-800">{result.className}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                <span className="text-slate-500">Buổi học:</span>
                <span className="font-semibold text-slate-800">{result.sessionTitle}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">Thời gian điểm danh:</span>
                <span className="font-bold text-emerald-700 font-mono">{result.checkInTime}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => setResult(null)}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs transition-colors shadow-md shadow-indigo-200 cursor-pointer"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


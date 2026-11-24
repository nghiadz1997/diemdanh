'use client';

import { useState, useEffect, useMemo } from 'react';
import { getAllQuizHistory, deleteQuizHistory, QuizHistoryRecord } from '@/services/quizService';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, deleteDoc, query, where } from 'firebase/firestore';
import { ClassItem } from '@/types';
import {
  BookOpen,
  Search,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Award,
  Users,
  Filter,
  Check,
  X,
  ExternalLink,
  UserCheck,
  UserX,
  Copy,
  Download,
  AlertTriangle,
  Layers,
  ListOrdered
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface StudentParticipation {
  studentCode: string;
  fullName: string;
  classId?: string;
  className: string;
  phone?: string;
  hasParticipated: boolean;
  hasSubmitted: boolean;
  totalAttempts: number;
  bestScore?: number;
  latestScore?: number;
  lastActiveTime?: string;
  lastQuizTitle?: string;
}

export default function AdminQuizHistoryPage() {
  // Dữ liệu
  const [history, setHistory] = useState<QuizHistoryRecord[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [allStudents, setAllStudents] = useState<StudentParticipation[]>([]);
  const [loading, setLoading] = useState(true);

  // Điều hướng Tab
  const [mainTab, setMainTab] = useState<'roster' | 'logs'>('roster');

  // Bộ lọc
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [participationFilter, setParticipationFilter] = useState<'all' | 'done' | 'not_done'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [logActionFilter, setLogActionFilter] = useState<'all' | 'start' | 'submit'>('all');

  // Tải dữ liệu toàn diện
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Tải logs trắc nghiệm & danh sách lớp song song
      const [historyData, classSnap, memberSnap] = await Promise.all([
        getAllQuizHistory(1000),
        getDocs(collection(db, 'classes')),
        getDocs(collection(db, 'classMembers')),
      ]);

      setHistory(historyData);

      // 2. Map thông tin lớp
      const classList: ClassItem[] = [];
      const classMap = new Map<string, string>();
      classSnap.docs.forEach((d) => {
        const cData = d.data();
        classList.push({ ...(cData as any), id: d.id });
        classMap.set(d.id, cData.className || cData.classCode || 'Lớp học');
      });
      setClasses(classList);

      // 3. Gom danh sách sinh viên theo MSSV
      // Dùng Map để nhóm theo studentCode duy nhất
      const studentMap = new Map<string, StudentParticipation>();

      memberSnap.docs.forEach((d) => {
        const m = d.data();
        const code = (m.studentCode || '').trim().toUpperCase();
        if (!code) return;

        const cName = m.className || classMap.get(m.classId) || 'Lớp chung';

        if (!studentMap.has(code)) {
          studentMap.set(code, {
            studentCode: code,
            fullName: (m.fullName || `Sinh viên ${code}`).trim(),
            classId: m.classId,
            className: cName,
            phone: m.phone || '',
            hasParticipated: false,
            hasSubmitted: false,
            totalAttempts: 0,
          });
        }
      });

      // Nếu có sinh viên trong users mà chưa có trong classMembers
      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
        usersSnap.docs.forEach((d) => {
          const u = d.data();
          const code = (u.studentCode || '').trim().toUpperCase();
          if (code && !studentMap.has(code)) {
            studentMap.set(code, {
              studentCode: code,
              fullName: (u.fullName || u.displayName || `Sinh viên ${code}`).trim(),
              className: 'Sinh viên tự do / Toàn trường',
              phone: u.phone || '',
              hasParticipated: false,
              hasSubmitted: false,
              totalAttempts: 0,
            });
          }
        });
      } catch (uErr) {
        console.warn('Lỗi tải users:', uErr);
      }

      // 4. Đối chiếu với quizHistory để xác định ai đã vào làm, ai chưa vào làm
      // Gom tất cả logs theo studentCode
      const historyByCode = new Map<string, QuizHistoryRecord[]>();
      historyData.forEach((rec) => {
        const code = rec.studentCode.trim().toUpperCase();
        if (!code) return;
        if (!historyByCode.has(code)) {
          historyByCode.set(code, []);
        }
        historyByCode.get(code)!.push(rec);
      });

      // Bổ sung những sinh viên có log làm bài nhưng chưa có trong danh sách lớp ban đầu
      historyByCode.forEach((records, code) => {
        if (!studentMap.has(code)) {
          const latest = records[0];
          studentMap.set(code, {
            studentCode: code,
            fullName: latest.studentName || `Sinh viên ${code}`,
            className: latest.className || 'Chưa phân lớp',
            hasParticipated: true,
            hasSubmitted: records.some((r) => r.action === 'submit'),
            totalAttempts: records.length,
          });
        }
      });

      // Cập nhật chỉ số làm bài cho từng sinh viên
      const finalRoster: StudentParticipation[] = Array.from(studentMap.values()).map((stu) => {
        const records = historyByCode.get(stu.studentCode) || [];
        const submissions = records.filter((r) => r.action === 'submit');

        const bestScore = submissions.length > 0
          ? Math.max(...submissions.map((r) => r.score ?? 0))
          : undefined;

        const latestRecord = records[0];
        const latestSubmission = submissions[0];

        return {
          ...stu,
          hasParticipated: records.length > 0,
          hasSubmitted: submissions.length > 0,
          totalAttempts: records.length,
          bestScore,
          latestScore: latestSubmission?.score,
          lastActiveTime: latestRecord?.timeStr,
          lastQuizTitle: latestRecord?.title,
        };
      });

      // Sắp xếp: Ai chưa làm bài đưa lên đầu hoặc theo tên
      setAllStudents(finalRoster);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu đối chiếu trắc nghiệm:', err);
      toast.error('Không thể tải toàn bộ dữ liệu thống kê');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Xóa log trắc nghiệm
  const handleDeleteLog = async (id: string, name: string, collectionName: 'quizHistory' | 'auditLogs' = 'quizHistory') => {
    if (!confirm(`Bạn có chắc muốn xóa bản ghi nhật ký của "${name}"?`)) return;
    try {
      const ok = await deleteQuizHistory(id, collectionName);
      if (ok) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
        toast.success('Đã xóa bản ghi thành công');
      } else {
        toast.error('Lỗi khi xóa bản ghi');
      }
    } catch (err) {
      toast.error('Lỗi khi xóa bản ghi');
    }
  };

  // Lọc danh sách sinh viên theo Lớp và Trạng thái làm bài
  const filteredStudents = useMemo(() => {
    return allStudents.filter((stu) => {
      // 1. Lọc lớp
      const matchClass = selectedClassId === 'all' || stu.classId === selectedClassId;

      // 2. Lọc trạng thái (Đã làm / Chưa làm)
      let matchStatus = true;
      if (participationFilter === 'done') {
        matchStatus = stu.hasParticipated;
      } else if (participationFilter === 'not_done') {
        matchStatus = !stu.hasParticipated;
      }

      // 3. Tìm kiếm theo MSSV hoặc Tên
      const term = searchTerm.trim().toLowerCase();
      const matchSearch =
        !term ||
        stu.studentCode.toLowerCase().includes(term) ||
        stu.fullName.toLowerCase().includes(term) ||
        stu.className.toLowerCase().includes(term);

      return matchClass && matchStatus && matchSearch;
    });
  }, [allStudents, selectedClassId, participationFilter, searchTerm]);

  // Thống kê nhanh theo lớp đang chọn
  const classStats = useMemo(() => {
    const listInClass = allStudents.filter(
      (stu) => selectedClassId === 'all' || stu.classId === selectedClassId
    );
    const total = listInClass.length;
    const done = listInClass.filter((s) => s.hasParticipated).length;
    const notDone = total - done;
    const submitted = listInClass.filter((s) => s.hasSubmitted).length;
    const donePercent = total > 0 ? Math.round((done / total) * 100) : 0;

    const scores = listInClass.filter((s) => s.bestScore !== undefined).map((s) => s.bestScore!);
    const avgScore = scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : '—';

    return { total, done, notDone, submitted, donePercent, avgScore };
  }, [allStudents, selectedClassId]);

  // Sao chép danh sách sinh viên CHƯA làm bài để gửi Zalo nhắc nhở
  const copyNotDoneList = () => {
    const notDoneList = allStudents.filter((stu) => {
      const matchClass = selectedClassId === 'all' || stu.classId === selectedClassId;
      return matchClass && !stu.hasParticipated;
    });

    if (notDoneList.length === 0) {
      toast.info('Tất cả sinh viên trong danh sách này đều đã vào làm bài!');
      return;
    }

    const currentClassName = selectedClassId === 'all'
      ? 'Toàn trường'
      : classes.find((c) => c.id === selectedClassId)?.className || 'Lớp';

    const textLines = [
      `📢 DANH SÁCH SINH VIÊN CHƯA THI TRẮC NGHIỆM (${currentClassName})`,
      `Tổng số: ${notDoneList.length} bạn`,
      '--------------------------------',
      ...notDoneList.map((s, idx) => `${idx + 1}. ${s.fullName} - MSSV: ${s.studentCode} (${s.className})`),
      '--------------------------------',
      '👉 Các bạn khẩn trương vào làm bài thi trắc nghiệm ngay nhé!',
    ];

    navigator.clipboard.writeText(textLines.join('\n'));
    toast.success(`Đã sao chép danh sách ${notDoneList.length} sinh viên chưa làm bài!`);
  };

  // Lọc nhật ký Logs
  const filteredLogs = useMemo(() => {
    return history.filter((item) => {
      const matchAction = logActionFilter === 'all' || item.action === logActionFilter;
      const term = searchTerm.trim().toLowerCase();
      const matchSearch =
        !term ||
        item.studentCode.toLowerCase().includes(term) ||
        item.studentName.toLowerCase().includes(term) ||
        (item.className && item.className.toLowerCase().includes(term)) ||
        item.title.toLowerCase().includes(term);

      return matchAction && matchSearch;
    });
  }, [history, logActionFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* TIÊU ĐỀ TRANG & HÀNH ĐỘNG NHANH */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-blue-600" />
            <span>Quản Lý &amp; Đối Chiếu Thi Trắc Nghiệm (300 câu)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Nhận diện mã sinh viên để theo dõi chi tiết <strong>ai đã vào làm bài</strong> và <strong>ai chưa vào làm bài</strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs shadow-sm transition active:scale-95 cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới dữ liệu</span>
          </button>
          <Link
            href="/trac-nghiem"
            target="_blank"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition active:scale-95"
          >
            <span>Mở Cổng Trắc Nghiệm</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 4 THẺ KPI ĐỐI CHIẾU SỐ LIỆU */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Sĩ số sinh viên</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{classStats.total}</div>
          <div className="text-xs text-slate-400 mt-1">Danh sách sinh viên trong phạm vi chọn</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Đã vào làm bài</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {classStats.done}
            <span className="text-xs font-bold text-emerald-700 ml-2">({classStats.donePercent}%)</span>
          </div>
          <div className="text-xs text-emerald-600 mt-1">{classStats.submitted} bạn đã nộp bài có điểm</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-gradient-to-br from-white to-rose-50/30 shadow-sm">
          <div className="flex items-center justify-between text-rose-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Chưa vào làm bài</span>
            <UserX className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-600">
            {classStats.notDone}
            <span className="text-xs font-bold text-rose-700 ml-2">
              ({classStats.total > 0 ? 100 - classStats.donePercent : 0}%)
            </span>
          </div>
          <div className="text-xs text-rose-500 mt-1">Cần nhắc nhở tham gia ôn thi</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Điểm cao nhất TB</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {classStats.avgScore}
            {classStats.avgScore !== '—' && <span className="text-xs font-normal text-slate-400">/10</span>}
          </div>
          <div className="text-xs text-slate-400 mt-1">Dựa trên điểm cao nhất của các bạn đã nộp</div>
        </div>
      </div>

      {/* THANH CHUYỂN TAB CHÍNH */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setMainTab('roster')}
          className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            mainTab === 'roster'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Đối Chiếu Theo Lớp (Ai Làm / Ai Chưa Làm)</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
            {classStats.total}
          </span>
        </button>

        <button
          onClick={() => setMainTab('logs')}
          className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            mainTab === 'logs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>Nhật Ký Chi Tiết Từng Lượt Thi</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
            {history.length}
          </span>
        </button>
      </div>

      {/* ===================== TAB 1: ĐỐI CHIẾU AI LÀM / AI CHƯA LÀM ===================== */}
      {mainTab === 'roster' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
          {/* Bộ lọc thanh công cụ */}
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/60">
            {/* Chọn Lớp học */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0">Lớp:</span>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tất cả sinh viên toàn trường ({allStudents.length})</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.className} {c.classCode ? `(${c.classCode})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lọc: Tất cả / Đã làm / Chưa làm */}
              <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold text-slate-600">
                <button
                  onClick={() => setParticipationFilter('all')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    participationFilter === 'all' ? 'bg-white text-blue-600 shadow-sm' : ''
                  }`}
                >
                  Tất cả ({classStats.total})
                </button>
                <button
                  onClick={() => setParticipationFilter('done')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    participationFilter === 'done' ? 'bg-white text-emerald-600 shadow-sm' : ''
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Đã vào làm ({classStats.done})</span>
                </button>
                <button
                  onClick={() => setParticipationFilter('not_done')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    participationFilter === 'not_done' ? 'bg-white text-rose-600 shadow-sm' : ''
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Chưa làm ({classStats.notDone})</span>
                </button>
              </div>
            </div>

            {/* Ô tìm kiếm & Nút copy danh sách chưa làm */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-60">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm theo MSSV, Họ tên..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>

              <button
                type="button"
                onClick={copyNotDoneList}
                title="Sao chép danh sách sinh viên chưa làm để gửi Zalo nhắc nhở"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold shadow-sm transition active:scale-95 shrink-0 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copy DS Chưa làm</span>
              </button>
            </div>
          </div>

          {/* Bảng sinh viên đối chiếu */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">STT</th>
                  <th className="py-3 px-4">Mã sinh viên</th>
                  <th className="py-3 px-4">Họ và Tên</th>
                  <th className="py-3 px-4">Lớp học</th>
                  <th className="py-3 px-4 text-center">Trạng thái tham gia</th>
                  <th className="py-3 px-4 text-center">Số lượt làm</th>
                  <th className="py-3 px-4 text-center">Điểm cao nhất</th>
                  <th className="py-3 px-4">Lần làm gần nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((stu, index) => (
                    <tr
                      key={stu.studentCode}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !stu.hasParticipated ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-mono text-slate-400">{index + 1}</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{stu.studentCode}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {stu.fullName}
                        {stu.phone && <span className="block text-[10px] text-slate-400 font-normal">SĐT: {stu.phone}</span>}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{stu.className}</td>
                      <td className="py-3 px-4 text-center">
                        {stu.hasParticipated ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>ĐÃ VÀO LÀM</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px]">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>CHƯA VÀO LÀM</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {stu.totalAttempts > 0 ? (
                          <span className="font-bold text-slate-700">{stu.totalAttempts} lượt</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {stu.bestScore !== undefined ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-black text-xs">
                            {stu.bestScore} / 10
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {stu.lastActiveTime ? (
                          <div>
                            <div className="font-mono text-slate-600 text-[11px]">{stu.lastActiveTime}</div>
                            {stu.lastQuizTitle && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[180px]" title={stu.lastQuizTitle}>
                                {stu.lastQuizTitle}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-rose-400 font-medium text-[11px]">Chưa có dữ liệu</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      {loading ? 'Đang đối chiếu dữ liệu sinh viên...' : 'Không có sinh viên nào phù hợp bộ lọc'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: NHẬT KÝ CHI TIẾT TỪNG LƯỢT THI ===================== */}
      {mainTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative flex-1 sm:max-w-xs">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo MSSV, Họ tên, Bài làm..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                <button
                  onClick={() => setLogActionFilter('all')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    logActionFilter === 'all' ? 'bg-white text-blue-600 shadow-sm' : ''
                  }`}
                >
                  Tất cả ({history.length})
                </button>
                <button
                  onClick={() => setLogActionFilter('submit')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    logActionFilter === 'submit' ? 'bg-white text-emerald-600 shadow-sm' : ''
                  }`}
                >
                  Đã nộp bài ({history.filter((h) => h.action === 'submit').length})
                </button>
                <button
                  onClick={() => setLogActionFilter('start')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    logActionFilter === 'start' ? 'bg-white text-indigo-600 shadow-sm' : ''
                  }`}
                >
                  Vào làm bài ({history.filter((h) => h.action === 'start').length})
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Mã SV</th>
                  <th className="py-3 px-4">Họ và Tên</th>
                  <th className="py-3 px-4">Lớp</th>
                  <th className="py-3 px-4">Nội dung bài làm</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-center">Điểm số</th>
                  <th className="py-3 px-4 text-center">Kết quả</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500">{row.timeStr}</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{row.studentCode}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{row.studentName}</td>
                      <td className="py-3 px-4 text-slate-600">{row.className || '—'}</td>
                      <td className="py-3 px-4 font-medium text-slate-700 max-w-[200px] truncate" title={row.title}>
                        {row.title}
                      </td>
                      <td className="py-3 px-4">
                        {row.action === 'submit' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[11px]">
                            <Check className="w-3 h-3" />
                            <span>Đã nộp bài</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold text-[11px]">
                            <Clock className="w-3 h-3" />
                            <span>Vào làm bài</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        {row.score !== undefined ? (
                          <span className="text-sm font-black text-slate-900">
                            {row.score}<span className="text-[10px] text-slate-400 font-normal">/10</span>
                            <span className="text-[10px] text-slate-500 font-normal block">
                              ({row.correct}/{row.total} câu)
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.passed !== undefined ? (
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                              row.passed
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {row.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {row.id && (
                          <button
                            onClick={() => handleDeleteLog(row.id!, row.studentName, row._collection)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                            title="Xóa bản ghi này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      {loading ? 'Đang tải nhật ký...' : 'Chưa có bản ghi nào phù hợp'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

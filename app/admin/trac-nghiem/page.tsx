'use client';

import { useState, useEffect } from 'react';
import { getRecentQuizHistory, QuizHistoryRecord } from '@/services/quizService';
import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
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
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function AdminQuizHistoryPage() {
  const [history, setHistory] = useState<QuizHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'start' | 'submit'>('all');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getRecentQuizHistory(100);
      setHistory(data);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải lịch sử làm bài trắc nghiệm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa bản ghi của sinh viên "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'quizHistory', id));
      setHistory((prev) => prev.filter((item) => item.id !== id));
      toast.success('Đã xóa bản ghi thành công');
    } catch (err) {
      toast.error('Lỗi khi xóa bản ghi');
    }
  };

  const filteredHistory = history.filter((item) => {
    const matchAction =
      actionFilter === 'all' || item.action === actionFilter;
    const term = searchTerm.trim().toLowerCase();
    const matchSearch =
      !term ||
      item.studentCode.toLowerCase().includes(term) ||
      item.studentName.toLowerCase().includes(term) ||
      (item.className && item.className.toLowerCase().includes(term)) ||
      item.title.toLowerCase().includes(term);

    return matchAction && matchSearch;
  });

  // Thống kê nhanh
  const totalSubmissions = history.filter((h) => h.action === 'submit').length;
  const uniqueStudents = new Set(history.map((h) => h.studentCode)).size;
  const passedCount = history.filter((h) => h.action === 'submit' && h.passed).length;
  const passRate = totalSubmissions > 0 ? Math.round((passedCount / totalSubmissions) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Tiêu đề trang */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-blue-600" />
            <span>Lịch Sử Làm Bài Trắc Nghiệm (300 câu)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi chi tiết sinh viên nhập mã vào ôn thi và nộp bài trên hệ thống
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs shadow-sm transition active:scale-95 cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
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

      {/* 4 Thẻ KPI thống kê */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Tổng lượt truy cập</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{history.length}</div>
          <div className="text-xs text-slate-400 mt-1">Lượt vào làm bài &amp; nộp bài</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Số sinh viên tham gia</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600">{uniqueStudents}</div>
          <div className="text-xs text-slate-400 mt-1">Mã sinh viên phân biệt</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Số bài đã nộp</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{totalSubmissions}</div>
          <div className="text-xs text-slate-400 mt-1">Hoàn thành &amp; chấm điểm</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Tỷ lệ Đạt (&gt;=5.0)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{passRate}%</div>
          <div className="text-xs text-slate-400 mt-1">{passedCount}/{totalSubmissions} bài đạt yêu cầu</div>
        </div>
      </div>

      {/* Bảng dữ liệu và bộ lọc */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 sm:max-w-xs">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo MSSV, Họ tên, Lớp..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
              <button
                onClick={() => setActionFilter('all')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  actionFilter === 'all' ? 'bg-white text-blue-600 shadow-sm' : ''
                }`}
              >
                Tất cả ({history.length})
              </button>
              <button
                onClick={() => setActionFilter('submit')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  actionFilter === 'submit' ? 'bg-white text-emerald-600 shadow-sm' : ''
                }`}
              >
                Đã nộp bài ({totalSubmissions})
              </button>
              <button
                onClick={() => setActionFilter('start')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  actionFilter === 'start' ? 'bg-white text-indigo-600 shadow-sm' : ''
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
              {filteredHistory.length > 0 ? (
                filteredHistory.map((row) => (
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
                          <span>Đang làm bài</span>
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
                          onClick={() => handleDelete(row.id!, row.studentName)}
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
                    {loading ? 'Đang tải lịch sử...' : 'Chưa có bản ghi nào phù hợp'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

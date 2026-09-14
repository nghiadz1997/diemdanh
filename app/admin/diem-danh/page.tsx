'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, limit, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AttendanceRecord, ClassItem } from '@/types';
import { formatDate, getAttendanceStatusBadge } from '@/lib/utils';
import {
  CalendarCheck,
  Loader2,
  Trash2,
  Search,
  Filter,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');

  // Delete modal
  const [deletingRecord, setDeletingRecord] = useState<AttendanceRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [attSnap, classSnap] = await Promise.all([
        getDocs(query(collection(db, 'attendance'), orderBy('createdAt', 'desc'), limit(150))),
        getDocs(collection(db, 'classes')),
      ]);

      const classList: ClassItem[] = [];
      const classMap = new Map<string, string>();
      classSnap.docs.forEach((d) => {
        const data = d.data();
        classList.push({ ...(data as any), id: d.id });
        classMap.set(d.id, data.className || data.classCode);
      });
      setClasses(classList);

      setRecords(
        attSnap.docs.map((d) => {
          const data = d.data();
          return {
            ...(data as any),
            id: d.id,
            className: (data as any).className || classMap.get(data.classId) || 'Lớp chung',
          } as AttendanceRecord;
        })
      );
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tải dữ liệu điểm danh');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async () => {
    if (!deletingRecord) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'attendance', deletingRecord.id));
      toast.success(`Đã xóa điểm danh của SV ${deletingRecord.studentCode || ''}`);
      setRecords((prev) => prev.filter((r) => r.id !== deletingRecord.id));
      setDeletingRecord(null);
    } catch (err) {
      toast.error('Lỗi khi xóa bản ghi điểm danh');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchSearch =
      (r.studentCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.studentName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchClass = filterClass === 'all' || r.classId === filterClass;
    return matchSearch && matchStatus && matchClass;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Nhật ký Điểm danh Toàn trường
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Tra cứu, kiểm tra và quản lý / xóa các lượt điểm danh trên toàn hệ thống
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl text-xs font-semibold shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo Mã SV hoặc Tên sinh viên..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        <div className="sm:w-52 relative">
          <Filter className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none font-medium cursor-pointer"
          >
            <option value="all">Tất cả lớp học</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.className} ({c.classCode})
              </option>
            ))}
          </select>
        </div>

        <div className="sm:w-44">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="present">Có mặt</option>
            <option value="late">Đi trễ</option>
            <option value="excused">Có phép</option>
            <option value="absent">Vắng</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <CalendarCheck className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Không có dữ liệu điểm danh phù hợp</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Mã SV</th>
                  <th className="px-5 py-3.5">Họ và tên</th>
                  <th className="px-5 py-3.5">Lớp học</th>
                  <th className="px-5 py-3.5">Trạng thái</th>
                  <th className="px-5 py-3.5">Thời gian</th>
                  <th className="px-5 py-3.5">Phương thức</th>
                  <th className="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r) => {
                  const badge = getAttendanceStatusBadge(r.status);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-indigo-600">
                        {r.studentCode || '--'}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">
                        {r.studentName || '--'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-slate-700 text-[11px] font-medium">
                          {(r as any).className || 'Lớp học'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={
                            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ' +
                            badge.className
                          }
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono">
                        {formatDate(r.checkInTime || r.createdAt, 'HH:mm:ss dd/MM/yyyy')}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {r.method === 'code' ? 'Mã số 6 số' : r.method === 'portal' ? 'Cổng điểm danh' : 'Thủ công'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setDeletingRecord(r)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                          title="Xóa bản ghi điểm danh này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CONFIRM DELETE MODAL */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Xác nhận xóa bản ghi điểm danh?</h3>
              <p className="text-xs text-slate-500">
                Xóa lượt điểm danh của sinh viên{' '}
                <strong className="text-indigo-600 font-bold">
                  {deletingRecord.studentName} ({deletingRecord.studentCode})
                </strong>
                . Sau khi xóa, sinh viên sẽ không còn được ghi nhận trong buổi học này.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingRecord(null)}
                disabled={isDeleting}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


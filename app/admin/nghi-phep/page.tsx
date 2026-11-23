'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { LeaveRequest, AssignmentAttachment, ClassItem } from '@/types';
import { getAllLeaveRequests, updateLeaveRequestStatus, deleteLeaveRequest } from '@/services/leaveRequestService';
import { getClasses } from '@/services/classService';
import { formatDate } from '@/lib/utils';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Loader2,
  Paperclip,
  Eye,
  Trash2,
  AlertCircle,
  X,
  Calendar,
  User,
  GraduationCap,
  Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export default function AdminLeaveApprovalPage() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Action states
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<LeaveRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [viewingProof, setViewingProof] = useState<AssignmentAttachment | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [list, cList] = await Promise.all([
        getAllLeaveRequests(),
        getClasses(),
      ]);

      setRequests(list);
      setClasses(cList);
    } catch (err) {
      console.error('Lỗi tải danh sách đơn nghỉ phép:', err);
      toast.error('Không thể tải dữ liệu đơn xin nghỉ phép');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (r: LeaveRequest) => {
    setProcessingId(r.id);
    try {
      // 1. Cập nhật trạng thái đơn thành approved
      await updateLeaveRequestStatus(r, 'approved');

      // 2. Ghi nhận trạng thái chuyên cần có phép (excused) vào attendance nếu có session hoặc ngày cụ thể
      try {
        const attendanceKey = `leave_${r.classId}_${r.studentCode}_${r.fromDate}`;
        await setDoc(
          doc(db, 'attendance', attendanceKey),
          {
            classId: r.classId,
            studentCode: r.studentCode,
            studentName: r.studentName,
            status: 'excused',
            method: 'portal',
            note: `Nghỉ có phép (${r.fromDate} đến ${r.toDate}): ${r.reason}`,
            checkInTime: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (attErr) {
        console.warn('Lỗi đồng bộ bảng điểm danh:', attErr);
      }

      toast.success(`Đã phê duyệt đơn nghỉ phép của sinh viên ${r.studentName} (${r.studentCode})`);
      fetchData();
    } catch (err: any) {
      console.error('Lỗi duyệt đơn:', err);
      toast.error(err.message || 'Lỗi khi phê duyệt đơn');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingRequest) return;
    setProcessingId(rejectingRequest.id);
    try {
      await updateLeaveRequestStatus(
        rejectingRequest,
        'rejected',
        rejectNote.trim() || 'Lý do không hợp lệ hoặc thiếu minh chứng'
      );

      toast.info(`Đã từ chối đơn nghỉ phép của ${rejectingRequest.studentName}`);
      setRejectingRequest(null);
      setRejectNote('');
      fetchData();
    } catch (err: any) {
      console.error('Lỗi từ chối đơn:', err);
      toast.error(err.message || 'Lỗi khi từ chối đơn');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (r: LeaveRequest) => {
    if (!confirm(`Bạn có chắc muốn xóa đơn xin nghỉ phép của ${r.studentName} (${r.studentCode})?`)) return;
    try {
      await deleteLeaveRequest(r);
      toast.success('Đã xóa đơn xin nghỉ phép');
      fetchData();
    } catch (err) {
      toast.error('Lỗi khi xóa đơn');
    }
  };

  const filteredRequests = requests.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchClass = classFilter === 'all' || r.classId === classFilter;
    const matchSearch =
      r.studentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.className && r.className.toLowerCase().includes(searchTerm.toLowerCase())) ||
      r.reason.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchClass && matchSearch;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length;

  const handleExportExcel = () => {
    if (filteredRequests.length === 0) {
      toast.info('Không có dữ liệu đơn nghỉ phép nào để xuất Excel');
      return;
    }

    try {
      const getStatusLabel = (status: string) => {
        if (status === 'approved') return 'Đã phê duyệt';
        if (status === 'rejected') return 'Bị từ chối';
        return 'Chờ phê duyệt';
      };

      const exportData = filteredRequests.map((r, index) => {
        const createdDateStr = r.createdAt
          ? formatDate(r.createdAt, 'HH:mm dd/MM/yyyy')
          : '';

        return {
          'STT': index + 1,
          'Mã sinh viên': r.studentCode || '',
          'Họ và tên': r.studentName || '',
          'Lớp học': r.className || '',
          'Từ ngày': r.fromDate || '',
          'Đến ngày': r.toDate || '',
          'Lý do xin nghỉ': r.reason || '',
          'Trạng thái': getStatusLabel(r.status),
          'Người duyệt': r.approvedBy || '',
          'Ghi chú / Lý do từ chối': r.adminNote || '',
          'Số tệp minh chứng': r.proofUrls?.length || 0,
          'Thời gian nộp': createdDateStr,
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 6 },  // STT
        { wch: 15 }, // Mã SV
        { wch: 25 }, // Họ tên
        { wch: 25 }, // Lớp học
        { wch: 14 }, // Từ ngày
        { wch: 14 }, // Đến ngày
        { wch: 35 }, // Lý do
        { wch: 16 }, // Trạng thái
        { wch: 22 }, // Người duyệt
        { wch: 30 }, // Ghi chú
        { wch: 18 }, // Số minh chứng
        { wch: 20 }, // Thời gian nộp
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DonNghiPhep');
      const filename = `Danh_sach_don_nghi_phep_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success(`Đã xuất ${exportData.length} đơn nghỉ phép ra file Excel thành công!`);
    } catch (err: any) {
      console.error('Lỗi xuất Excel đơn nghỉ phép:', err);
      toast.error('Không thể xuất file Excel: ' + (err.message || 'Lỗi không xác định'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Phê Duyệt Đơn Nghỉ Phép
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Tiếp nhận và duyệt đơn xin nghỉ phép của sinh viên toàn trường
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="py-2 px-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-2xl border border-emerald-200 shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            title="Xuất danh sách đơn nghỉ phép ra file Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Xuất Excel</span>
          </button>
          <span className="px-3 py-1.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>{pendingCount} chờ duyệt</span>
          </span>
          <span className="px-3 py-1.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{approvedCount} đã duyệt</span>
          </span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-3xl shadow-card border border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo Mã SV, Họ tên, Lớp học, Lý do..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        {/* Lớp học */}
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">Tất cả lớp học</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.classCode} - {c.className}
            </option>
          ))}
        </select>

        {/* Status Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chờ duyệt ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              statusFilter === 'approved'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đã duyệt ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              statusFilter === 'rejected'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Từ chối ({rejectedCount})
          </button>
        </div>
      </div>

      {/* Danh sách đơn */}
      <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-xs">Đang tải danh sách đơn xin nghỉ...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <FileCheck className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">Không có đơn xin nghỉ phép nào phù hợp</p>
            <p className="text-xs text-slate-400">
              Các đơn xin nghỉ phép mới của sinh viên sẽ tự động hiển thị ở đây
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRequests.map((r) => {
              const isPending = r.status === 'pending';
              const isApproved = r.status === 'approved';
              const isRejected = r.status === 'rejected';

              return (
                <div key={r.id} className="p-5 sm:p-6 hover:bg-slate-50/70 transition-colors space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{r.studentName}</span>
                        <span className="px-2 py-0.5 rounded-full font-mono font-bold text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {r.studentCode}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          {r.className}
                        </span>
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>Chờ duyệt</span>
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Đã duyệt (Có phép)</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            <span>Từ chối</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">Gửi lúc: {formatDate(r.createdAt)}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 self-start lg:self-auto">
                      {isPending && (
                        <>
                          <button
                            type="button"
                            disabled={processingId === r.id}
                            onClick={() => handleApprove(r)}
                            className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm shadow-emerald-200 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Phê duyệt</span>
                          </button>
                          <button
                            type="button"
                            disabled={processingId === r.id}
                            onClick={() => {
                              setRejectingRequest(r);
                              setRejectNote('');
                            }}
                            className="py-2 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Từ chối</span>
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Xóa đơn"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Nội dung đơn */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Thời gian xin nghỉ phép:</span>
                      <span className="font-bold text-slate-800">
                        {r.fromDate === r.toDate
                          ? `Ngày ${r.fromDate}`
                          : `Từ ngày ${r.fromDate} đến ngày ${r.toDate}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Lý do xin nghỉ:</span>
                      <span className="text-slate-700 font-medium">{r.reason}</span>
                    </div>
                  </div>

                  {/* Minh chứng đính kèm */}
                  {r.proofUrls && r.proofUrls.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                        <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                        Minh chứng kèm theo:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {r.proofUrls.map((p, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setViewingProof(p)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-xl cursor-pointer transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            <span className="max-w-[150px] truncate">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ghi chú phản hồi của admin */}
                  {r.adminNote && (
                    <div className="text-xs bg-rose-50 text-rose-800 p-3 rounded-xl border border-rose-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Lý do từ chối:</strong> {r.adminNote}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Từ Chối Đơn */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto ring-4 ring-rose-50">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Từ chối đơn xin nghỉ phép</h3>
              <p className="text-xs text-slate-500">
                Sinh viên: <strong>{rejectingRequest.studentName} ({rejectingRequest.studentCode})</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Lý do từ chối (Gửi lại sinh viên)
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Ví dụ: Thiếu giấy khám bệnh hợp lệ, hoặc đơn gửi quá muộn..."
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingRequest(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={processingId === rejectingRequest.id}
                onClick={handleReject}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-rose-200"
              >
                {processingId === rejectingRequest.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Xác nhận từ chối</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem Minh Chứng */}
      {viewingProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in-50">
          <div className="bg-white rounded-3xl p-5 max-w-xl w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 truncate">{viewingProof.name}</h3>
              <button
                type="button"
                onClick={() => setViewingProof(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center">
              {viewingProof.type === 'image' ? (
                <img
                  src={viewingProof.url}
                  alt={viewingProof.name}
                  className="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-sm"
                />
              ) : (
                <div className="text-center py-10 space-y-3">
                  <FileCheck className="w-16 h-16 text-indigo-500 mx-auto" />
                  <p className="text-xs text-slate-600">{viewingProof.name}</p>
                  <a
                    href={viewingProof.url}
                    download={viewingProof.name}
                    className="inline-flex items-center gap-2 py-2 px-4 bg-indigo-600 text-white text-xs font-bold rounded-xl"
                  >
                    Tải tệp tin về máy
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { ClassItem, LeaveRequest, AssignmentAttachment } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  FileText,
  Calendar,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Paperclip,
  X,
  Eye,
  AlertCircle,
  ArrowLeft,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function StudentLeaveRequestPage() {
  const { user, profile } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [proofFiles, setProofFiles] = useState<AssignmentAttachment[]>([]);
  const [viewingProof, setViewingProof] = useState<AssignmentAttachment | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Tải danh sách lớp học của sinh viên
      const classesList: ClassItem[] = [];
      const memQ = query(
        collection(db, 'classMembers'),
        where('userId', '==', user.uid)
      );
      const memSnap = await getDocs(memQ);
      for (const mDoc of memSnap.docs) {
        const cId = mDoc.data().classId;
        try {
          const cSnap = await getDoc(doc(db, 'classes', cId));
          if (cSnap.exists()) {
            classesList.push({ id: cSnap.id, ...cSnap.data() } as ClassItem);
          }
        } catch {}
      }

      // Fallback: Nếu sinh viên chưa có classMembers, tải toàn bộ lớp để chọn
      if (classesList.length === 0) {
        const allCSnap = await getDocs(collection(db, 'classes'));
        allCSnap.docs.forEach((d) => {
          classesList.push({ id: d.id, ...d.data() } as ClassItem);
        });
      }
      setClasses(classesList);
      if (classesList.length > 0 && !selectedClassId) {
        setSelectedClassId(classesList[0].id);
      }

      // 2. Tải danh sách đơn xin nghỉ phép của sinh viên
      const reqQ = query(
        collection(db, 'leaveRequests'),
        where('studentId', '==', user.uid)
      );
      const reqSnap = await getDocs(reqQ);
      const list = reqSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LeaveRequest));
      list.sort((a, b) => {
        const tA = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : 0;
        const tB = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : 0;
        return tB - tA;
      });
      setRequests(list);
    } catch (err) {
      console.error('Lỗi tải dữ liệu nghỉ phép:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`Tệp ${file.name} vượt quá 5MB. Vui lòng chọn tệp nhỏ hơn.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Url = event.target?.result as string;
        let fileType = 'other';
        if (file.type.startsWith('image/')) fileType = 'image';
        else if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) fileType = 'word';
        else if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) fileType = 'excel';
        else if (file.name.endsWith('.ppt') || file.name.endsWith('.pptx')) fileType = 'pptx';
        else if (file.name.endsWith('.pdf')) fileType = 'pdf';

        setProofFiles((prev) => [
          ...prev,
          {
            name: file.name,
            url: base64Url,
            type: fileType,
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!selectedClassId) {
      toast.error('Vui lòng chọn lớp học xin nghỉ');
      return;
    }
    if (!fromDate || !toDate) {
      toast.error('Vui lòng chọn ngày xin nghỉ phép');
      return;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      toast.error('Ngày bắt đầu không được lớn hơn ngày kết thúc');
      return;
    }
    if (!reason.trim()) {
      toast.error('Vui lòng nêu rõ lý do xin nghỉ phép');
      return;
    }

    setSubmitting(true);
    try {
      const targetClass = classes.find((c) => c.id === selectedClassId);
      const className = targetClass ? targetClass.className : 'Lớp học';

      await addDoc(collection(db, 'leaveRequests'), {
        studentId: user.uid,
        studentCode: profile?.studentCode || '',
        studentName: profile?.fullName || 'Sinh viên',
        classId: selectedClassId,
        className,
        fromDate,
        toDate,
        reason: reason.trim(),
        proofUrls: proofFiles,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success('Đã gửi đơn xin nghỉ phép thành công! Vui lòng chờ quản trị viên phê duyệt.');
      setIsModalOpen(false);
      setReason('');
      setProofFiles([]);
      fetchData();
    } catch (err: any) {
      console.error('Lỗi gửi đơn xin nghỉ:', err);
      toast.error(err.message || 'Lỗi gửi đơn xin nghỉ');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          label: 'Đã phê duyệt',
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: CheckCircle2,
        };
      case 'rejected':
        return {
          label: 'Bị từ chối',
          className: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: XCircle,
        };
      default:
        return {
          label: 'Chờ phê duyệt',
          className: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: Clock,
        };
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/sinh-vien/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Về trang chủ sinh viên</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Đơn Xin Nghỉ Phép
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Gửi đơn xin nghỉ học có lý do để được bảo lưu buổi học có phép (P)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="py-3 px-5 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Viết đơn xin nghỉ phép</span>
        </button>
      </div>

      {/* Danh sách các đơn đã gửi */}
      <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            Lịch sử gửi đơn xin nghỉ ({requests.length})
          </h2>
          <span className="text-[11px] text-slate-400">
            Cập nhật trạng thái theo thời gian thực
          </span>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-xs">Đang tải lịch sử đơn xin nghỉ...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Calendar className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">Bạn chưa gửi đơn xin nghỉ phép nào</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Khi có lý do đột xuất hoặc ốm đau, hãy bấm "Viết đơn xin nghỉ phép" để gửi cho nhà trường phê duyệt.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((r) => {
              const badge = getStatusBadge(r.status);
              const BadgeIcon = badge.icon;
              return (
                <div key={r.id} className="p-5 sm:p-6 hover:bg-slate-50/70 transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sm text-slate-900">{r.className}</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.className}`}
                      >
                        <BadgeIcon className="w-3.5 h-3.5" />
                        <span>{badge.label}</span>
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      Gửi lúc: {formatDate(r.createdAt)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Thời gian xin nghỉ:</span>
                      <span className="font-bold text-slate-800">
                        {r.fromDate === r.toDate
                          ? `Ngày: ${r.fromDate}`
                          : `Từ ${r.fromDate} đến ${r.toDate}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Lý do:</span>
                      <span className="text-slate-700 font-medium">{r.reason}</span>
                    </div>
                  </div>

                  {r.proofUrls && r.proofUrls.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                        <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                        Minh chứng đính kèm:
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
                            <span className="max-w-[140px] truncate">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.adminNote && (
                    <div className="text-xs bg-amber-50 text-amber-900 p-3 rounded-xl border border-amber-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Ghi chú từ Quản trị viên:</strong> {r.adminNote}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Viết Đơn Xin Nghỉ Phép */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 to-purple-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Đơn xin nghỉ phép</h2>
                  <p className="text-xs text-slate-500">Khai báo thông tin xin phép nghỉ học</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Lớp học xin nghỉ *
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.classCode} - {c.className}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Nghỉ từ ngày *
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Đến hết ngày *
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Lý do xin nghỉ phép *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Nêu rõ lý do (ví dụ: Bị sốt xuất huyết phải nhập viện điều trị, có giấy của bác sĩ kèm theo...)"
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  required
                />
              </div>

              {/* Đính kèm minh chứng */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Minh chứng đính kèm (Ảnh giấy khám bệnh, đơn viết tay...)
                </label>
                <div className="flex items-center gap-2">
                  <label className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-2xl cursor-pointer flex items-center gap-2 transition-colors border border-slate-200">
                    <Paperclip className="w-4 h-4 text-slate-500" />
                    <span>Chọn tệp / Chụp ảnh</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Tối đa 5MB / tệp
                  </span>
                </div>

                {proofFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {proofFiles.map((f, i) => (
                      <div
                        key={i}
                        className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs px-3 py-1.5 rounded-xl font-medium"
                      >
                        <span className="max-w-[160px] truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => setProofFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-indigo-400 hover:text-indigo-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-2xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs rounded-2xl shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang gửi đơn...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Gửi đơn xin nghỉ</span>
                    </>
                  )}
                </button>
              </div>
            </form>
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
                  <FileText className="w-16 h-16 text-indigo-500 mx-auto" />
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

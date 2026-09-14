'use client';

import { useEffect, useState, useRef } from 'react';
import {
  collection,
  query,
  getDocs,
  orderBy,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AssignmentItem, AssignmentAttachment, ClassItem } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  FileText,
  Clock,
  Loader2,
  Plus,
  Trash2,
  BookOpen,
  Paperclip,
  Download,
  X,
  FileSpreadsheet,
  Image as ImageIcon,
  Presentation,
  CheckCircle2,
  Search,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

function getFileCategory(name: string, type?: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['doc', 'docx'].includes(ext) || type?.includes('word')) return 'word';
  if (['xls', 'xlsx', 'csv'].includes(ext) || type?.includes('sheet') || type?.includes('excel')) return 'excel';
  if (['ppt', 'pptx'].includes(ext) || type?.includes('presentation') || type?.includes('powerpoint')) return 'pptx';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || type?.startsWith('image/')) return 'image';
  if (ext === 'pdf' || type?.includes('pdf')) return 'pdf';
  return 'other';
}

function getFileBadge(att: AssignmentAttachment | string) {
  const name = typeof att === 'string' ? att : att.name;
  const url = typeof att === 'string' ? att : att.url;
  const category = typeof att === 'string' ? getFileCategory(name) : (att.type || getFileCategory(name));

  let badgeColor = 'bg-slate-50 text-slate-700 border-slate-200';
  let Icon = FileText;

  if (category === 'word') {
    badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
    Icon = FileText;
  } else if (category === 'excel') {
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    Icon = FileSpreadsheet;
  } else if (category === 'pptx') {
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    Icon = Presentation;
  } else if (category === 'image') {
    badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
    Icon = ImageIcon;
  } else if (category === 'pdf') {
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
    Icon = FileText;
  }

  return (
    <a
      key={name}
      href={url}
      download={name}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all hover:shadow-sm cursor-pointer ${badgeColor}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate max-w-[140px] sm:max-w-[200px]">{name}</span>
      <Download className="w-3 h-3 ml-0.5 opacity-60 hover:opacity-100" />
    </a>
  );
}

export default function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterClass, setFilterClass] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Create Assignment Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [title, setTitle] = useState('');
  const [textbookReference, setTextbookReference] = useState('');
  const [description, setDescription] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('23:59');
  const [allowLate, setAllowLate] = useState(true);
  const [attachments, setAttachments] = useState<AssignmentAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete modal
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assignSnap, classSnap] = await Promise.all([
        getDocs(query(collection(db, 'assignments'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'classes')),
      ]);

      const classMap = new Map<string, string>();
      const cList: ClassItem[] = [];
      classSnap.docs.forEach((d) => {
        const data = d.data();
        classMap.set(d.id, data.className || data.classCode);
        cList.push({ ...(data as any), id: d.id });
      });
      setClasses(cList);

      const aList = assignSnap.docs.map((d) => {
        const data = d.data();
        return {
          ...(data as any),
          id: d.id,
          className: data.className || classMap.get(data.classId) || 'Lớp chung',
        } as AssignmentItem;
      });
      setAssignments(aList);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tải danh sách bài tập');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`File ${file.name} vượt quá 15MB. Vui lòng chọn file nhỏ hơn.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Url = event.target?.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            url: base64Url,
            type: getFileCategory(file.name, file.type),
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) {
      toast.error('Vui lòng chọn lớp học');
      return;
    }
    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề bài tập');
      return;
    }
    if (!deadlineDate) {
      toast.error('Vui lòng chọn hạn nộp bài');
      return;
    }

    setCreating(true);
    try {
      const deadline = new Date(`${deadlineDate}T${deadlineTime || '23:59'}:00`);
      const targetClass = classes.find((c) => c.id === selectedClassId);

      await addDoc(collection(db, 'assignments'), {
        classId: selectedClassId,
        className: targetClass?.className || '',
        title: title.trim(),
        textbookReference: textbookReference.trim() || '',
        description: description.trim(),
        attachments,
        deadline: Timestamp.fromDate(deadline),
        allowLateSubmission: allowLate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success('Giao bài tập mới thành công!');
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi lưu bài tập');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setSelectedClassId('');
    setTitle('');
    setTextbookReference('');
    setDescription('');
    setDeadlineDate('');
    setDeadlineTime('23:59');
    setAllowLate(true);
    setAttachments([]);
  };

  const handleDeleteAssignment = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'assignments', deletingId));
      toast.success('Đã xóa bài tập!');
      setDeletingId(null);
      fetchData();
    } catch (err) {
      toast.error('Lỗi khi xóa bài tập');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    const matchClass = filterClass === 'all' || a.classId === filterClass;
    const matchSearch =
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.textbookReference || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.className || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchClass && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Quản lý Bài tập & Đồ án
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Giao bài tập theo giáo trình, đính kèm tệp tin tài liệu và thu bài nộp của sinh viên
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            if (classes.length > 0) setSelectedClassId(classes[0].id);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-indigo-100 transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Giao bài tập mới</span>
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
            placeholder="Tìm kiếm bài tập, bài trong giáo trình, tên lớp..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="sm:w-64 relative">
          <Filter className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none font-medium cursor-pointer"
          >
            <option value="all">Tất cả các lớp</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.className} ({c.classCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Không có bài tập nào</p>
            <p className="text-xs text-slate-400 mt-1">Bấm &quot;Giao bài tập mới&quot; để tạo bài tập cho sinh viên</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredAssignments.map((a) => (
              <div
                key={a.id}
                className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {a.className || 'Lớp học'}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{a.title}</h3>
                  </div>

                  {/* Textbook reference */}
                  {a.textbookReference && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/80 text-amber-800 rounded-xl text-xs font-semibold border border-amber-200/60">
                      <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{a.textbookReference}</span>
                    </div>
                  )}

                  {a.description && (
                    <p className="text-xs text-slate-600 whitespace-pre-line line-clamp-3">
                      {a.description}
                    </p>
                  )}

                  {/* Attachments */}
                  {a.attachments && a.attachments.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                        <Paperclip className="w-3 h-3" />
                        Tài liệu đính kèm ({a.attachments.length}):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {a.attachments.map((att) => getFileBadge(att))}
                      </div>
                    </div>
                  )}

                  {/* Deadline info */}
                  <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1 text-amber-600 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      Hạn nộp: {formatDate(a.deadline, 'HH:mm dd/MM/yyyy')}
                    </span>
                    {a.allowLateSubmission && (
                      <span className="text-[11px] text-slate-400">
                        (Cho phép nộp trễ)
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => setDeletingId(a.id)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                    title="Xóa bài tập"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL GIAO BÀI TẬP MỚI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Giao bài tập mới</h3>
                  <p className="text-[11px] text-slate-500">Đính kèm tài liệu học tập hoặc bài tập trong sách</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateAssignment} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Chọn Lớp học *
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  required
                >
                  <option value="">-- Chọn lớp học --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.className} ({c.classCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Tiêu đề bài tập *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Bài tập thực hành chương 3: Thiết kế CSDL"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Textbook reference */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Giao bài theo giáo trình (Tùy chọn)
                </label>
                <div className="relative">
                  <BookOpen className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" />
                  <input
                    type="text"
                    value={textbookReference}
                    onChange={(e) => setTextbookReference(e.target.value)}
                    placeholder="Ví dụ: Bài 3, 4 trang 52 giáo trình Công nghệ phần mềm..."
                    className="w-full pl-9 pr-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 font-medium placeholder:text-amber-800/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Mô tả / Yêu cầu chi tiết
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Hướng dẫn sinh viên cách làm bài, tiêu chí chấm điểm..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Deadline */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Hạn nộp (Ngày) *
                  </label>
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Giờ nộp *
                  </label>
                  <input
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    required
                  />
                </div>
              </div>

              {/* File Attachments */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Đính kèm tệp tin (Word, PPT, Excel, Ảnh, PDF)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.pdf,image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="assignment-file-input"
                />
                <label
                  htmlFor="assignment-file-input"
                  className="w-full border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/30 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Paperclip className="w-5 h-5 text-indigo-500" />
                  <span className="text-xs font-bold text-indigo-600">
                    Bấm để tải tệp đính kèm lên
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Hỗ trợ Word (.docx), PowerPoint (.pptx), Excel (.xlsx), PDF, Hình ảnh (Tối đa 15MB/file)
                  </span>
                </label>

                {/* Uploaded attachments list */}
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {attachments.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate font-medium text-slate-700">{file.name}</span>
                          {file.size && (
                            <span className="text-[10px] text-slate-400 shrink-0">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Allow Late */}
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={allowLate}
                  onChange={(e) => setAllowLate(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Cho phép sinh viên nộp trễ hạn (Được đánh dấu &quot;Nộp trễ&quot;)</span>
              </label>

              {/* Form Buttons */}
              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Xác nhận giao bài</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Xác nhận xóa bài tập?</h3>
              <p className="text-xs text-slate-500">
                Bài tập và các tệp đính kèm sẽ bị xóa vĩnh viễn khỏi hệ thống.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                disabled={isDeleting}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteAssignment}
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


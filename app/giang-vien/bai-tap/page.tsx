'use client';

import { useEffect, useState } from 'react';
import { getClasses } from '@/services/classService';
import { ClassItem, AssignmentItem } from '@/types';
import { collection, query, getDocs, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { FileText, Plus, Clock, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TeacherAssignmentsPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [classId, setClassId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [classList, assignSnap] = await Promise.all([
        getClasses(),
        getDocs(query(collection(db, 'assignments'), orderBy('createdAt', 'desc'))),
      ]);
      setClasses(classList);
      setAssignments(assignSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AssignmentItem)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !title || !deadline) {
      toast.error('Vui lòng điền đủ thông tin');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'assignments'), {
        classId,
        teacherId: user?.uid || '',
        title,
        description,
        attachments: [],
        deadline: new Date(deadline),
        allowLateSubmission: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success('Giao bài tập mới thành công!');
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      fetchData();
    } catch (err) {
      toast.error('Lỗi khi tạo bài tập');
    } finally {
      setSubmitting(false);
    }
  };

  const getClassName = (cid: string) => {
    const c = classes.find((cl) => cl.id === cid);
    return c ? (c.classCode + ' - ' + c.className) : cid;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Quản lý Bài tập & Đồ án
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Giao bài tập, thiết lập deadline và tiếp nhận bài nộp trực tuyến
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl flex items-center gap-2 shadow-md shadow-blue-100 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Giao bài tập mới</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Chưa có bài tập nào</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {assignments.map((a) => (
              <div key={a.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                    {getClassName(a.classId)}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">{a.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-1">{a.description}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Hạn nộp: {formatDate(a.deadline, 'HH:mm dd/MM/yyyy')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl">
                    Đang mở nộp bài
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">Tạo bài tập mới</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateAssignment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Chọn lớp học</label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                  required
                >
                  <option value="">-- Chọn lớp --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.classCode} - {c.className}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tiêu đề bài tập</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Bài tập tuần 3 - SQL DDL"
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Hạn nộp bài (Deadline)</label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nội dung yêu cầu</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Mô tả chi tiết yêu cầu bài tập..."
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-2xl text-xs hover:bg-blue-700"
              >
                {submitting ? 'Đang lưu...' : 'Tạo bài tập'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

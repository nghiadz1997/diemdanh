'use client';

import { useEffect, useState } from 'react';
import { getClasses, createClass, deleteClass } from '@/services/classService';
import { getTeachers } from '@/services/studentService';
import { ClassItem, UserProfile } from '@/types';
import {
  GraduationCap,
  Plus,
  Search,
  Users,
  ChevronRight,
  Loader2,
  X,
  BookOpen,
  QrCode,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ClassManagementPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [className, setClassName] = useState('');
  const [description, setDescription] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [semester, setSemester] = useState('Học kỳ 1');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fetchedClasses, fetchedTeachers] = await Promise.all([
        getClasses(),
        getTeachers(),
      ]);
      setClasses(fetchedClasses);
      setTeachers(fetchedTeachers);
    } catch (err) {
      console.error('Lỗi tải danh sách lớp:', err);
      toast.error('Không thể tải dữ liệu lớp học');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classCode || !className) {
      toast.error('Vui lòng nhập mã lớp và tên lớp');
      return;
    }

    setSubmitting(true);
    try {
      await createClass({
        classCode,
        className,
        description,
        academicYear,
        semester,
      });
      toast.success('Tạo lớp học mới thành công!');
      setClassCode('');
      setClassName('');
      setDescription('');
      setIsCreateModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Không thể tạo lớp học');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredClasses = classes.filter(
    (c) =>
      c.classCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.className.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Quản lý Lớp học
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Tạo và quản lý danh sách lớp học, phân công giảng viên và tạo mã điểm danh
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-semibold rounded-2xl shadow-md shadow-indigo-100 flex items-center gap-2 cursor-pointer transition-all active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Tạo lớp học mới</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-3xl shadow-card border border-slate-200/80 flex items-center">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo Mã lớp, Tên lớp (Ví dụ: THUDK26)..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-xs font-medium">Đang nạp danh sách lớp học...</p>
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200/80">
          <GraduationCap className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-600">Chưa có lớp học nào</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Bấm "Tạo lớp học mới" để bắt đầu thiết lập lớp đầu tiên.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClasses.map((c) => (
            <div
              key={c.id}
              className="group bg-white rounded-3xl p-5 shadow-card border border-slate-200/80 hover:shadow-xl hover:border-indigo-200 transition-all flex flex-col justify-between"
            >
              <Link href={'/admin/lop-hoc/' + c.id} className="block">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex items-center justify-center font-bold text-sm">
                    {c.classCode.substring(0, 3)}
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                    {c.classCode}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                  {c.className}
                </h3>
                {c.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {c.description}
                  </p>
                )}

                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <span>{c.studentCount || 0} học viên</span>
                </div>
              </Link>

                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center gap-2">
                <Link
                  href={'/admin/lop-hoc/' + c.id + '?tab=sessions'}
                  className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-emerald-100 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Tạo mã điểm danh</span>
                </Link>
                <Link
                  href={'/admin/lop-hoc/' + c.id}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1 transition-all"
                >
                  <span>Chi tiết</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
                <button
                  type="button"
                  onClick={() => setClassToDelete(c)}
                  title="Xóa lớp học"
                  className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA LỚP HỌC */}
      {classToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto ring-4 ring-rose-50">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Xác nhận xóa lớp học</h3>
              <p className="text-xs text-slate-500">
                Bạn có chắc chắn muốn xóa lớp{' '}
                <strong className="text-rose-600 font-bold">
                  {classToDelete.className} ({classToDelete.classCode})
                </strong>
                ? Toàn bộ danh sách học viên trong lớp, buổi học và dữ liệu điểm danh sẽ bị xóa hoàn toàn.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClassToDelete(null)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!classToDelete) return;
                  setDeleting(true);
                  try {
                    await deleteClass(classToDelete.id);
                    toast.success(`Đã xóa lớp học ${classToDelete.className} thành công!`);
                    setClassToDelete(null);
                    fetchData();
                  } catch (err: any) {
                    toast.error(err.message || 'Lỗi khi xóa lớp học');
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-rose-200 cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xác nhận xóa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Tạo lớp học mới</h2>
                  <p className="text-xs text-slate-500">Khai báo mã lớp và niên khóa</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Mã lớp học
                </label>
                <input
                  type="text"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  placeholder="Ví dụ: THUDK26"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Tên lớp học
                </label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Ví dụ: Tin học ứng dụng K26"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Niên khoá
                  </label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="2025-2026"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Học kỳ
                  </label>
                  <input
                    type="text"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    placeholder="Học kỳ 1"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Mô tả lớp học (tuỳ chọn)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ghi chú về lớp học, ngành đào tạo..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer text-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang tạo lớp...</span>
                  </>
                ) : (
                  <span>Xác nhận tạo lớp học</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

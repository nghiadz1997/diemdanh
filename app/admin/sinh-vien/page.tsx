'use client';

import { useEffect, useState } from 'react';
import { getStudents, toggleStudentStatus } from '@/services/studentService';
import { getClasses } from '@/services/classService';
import { UserProfile, ClassItem } from '@/types';
import { AddStudentModal } from '@/components/students/AddStudentModal';
import { ImportStudentModal } from '@/components/students/ImportStudentModal';
import { formatDate } from '@/lib/utils';
import {
  Users,
  UserPlus,
  Upload,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  Lock,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, deleteDoc, updateDoc, setDoc, increment, serverTimestamp } from 'firebase/firestore';

export default function StudentManagementPage() {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Edit Student State
  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editStudentCode, setEditStudentCode] = useState('');
  const [editGender, setEditGender] = useState<'Nam' | 'Nữ' | 'Khác'>('Nam');
  const [editDateOfBirth, setEditDateOfBirth] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCccd, setEditCccd] = useState('');
  const [editPlaceOfBirth, setEditPlaceOfBirth] = useState('');
  const [editHometown, setEditHometown] = useState('');
  const [editPermanentAddress, setEditPermanentAddress] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fetchedStudents, fetchedClasses] = await Promise.all([
        getStudents(),
        getClasses(),
      ]);
      setStudents(fetchedStudents);
      setClasses(fetchedClasses);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleStatus = async (student: UserProfile) => {
    try {
      await toggleStudentStatus(student.uid, student.active);
      toast.success(
        'Đã ' + (student.active ? 'vô hiệu hoá' : 'kích hoạt lại') + ' tài khoản ' + student.fullName
      );
      setStudents((prev) =>
        prev.map((s) => (s.uid === student.uid ? { ...s, active: !s.active } : s))
      );
    } catch (err) {
      toast.error('Lỗi khi cập nhật trạng thái');
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!confirm('Gửi email liên kết đặt lại mật khẩu tới ' + email + '?')) return;
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Đã gửi email đặt lại mật khẩu tới ' + email);
    } catch (err) {
      toast.error('Không thể gửi email đặt lại mật khẩu');
    }
  };

  const handleOpenEdit = (student: UserProfile) => {
    setEditingStudent(student);
    setEditFullName(student.fullName);
    setEditStudentCode(student.studentCode || '');
    setEditGender((student.gender as any) || 'Nam');
    setEditDateOfBirth(student.dateOfBirth || '');
    setEditPhone(student.phone || '');
    setEditCccd(student.cccd || '');
    setEditPlaceOfBirth(student.placeOfBirth || '');
    setEditHometown(student.hometown || '');
    setEditPermanentAddress(student.permanentAddress || '');
    setEditClassId(student.classIds?.[0] || '');
    setEditActive(student.active !== false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editFullName.trim()) {
      toast.error('Vui lòng nhập họ và tên');
      return;
    }

    setSavingEdit(true);
    try {
      const oldClassId = editingStudent.classIds?.[0];
      const newClassId = editClassId;

      // 1. Cập nhật hồ sơ sinh viên trong Firestore
      await updateDoc(doc(db, 'users', editingStudent.uid), {
        fullName: editFullName.trim(),
        studentCode: editStudentCode.trim().toUpperCase(),
        gender: editGender,
        dateOfBirth: editDateOfBirth.trim(),
        phone: editPhone.trim(),
        cccd: editCccd.trim(),
        placeOfBirth: editPlaceOfBirth.trim(),
        hometown: editHometown.trim(),
        permanentAddress: editPermanentAddress.trim(),
        classIds: newClassId ? [newClassId] : [],
        active: editActive,
        updatedAt: serverTimestamp(),
      });

      // 2. Cập nhật trong classMembers
      if (newClassId) {
        try {
          await updateDoc(doc(db, 'classMembers', `${newClassId}_${editingStudent.uid}`), {
            fullName: editFullName.trim(),
            studentCode: editStudentCode.trim().toUpperCase(),
            gender: editGender,
            dateOfBirth: editDateOfBirth.trim(),
            phone: editPhone.trim(),
            cccd: editCccd.trim(),
            placeOfBirth: editPlaceOfBirth.trim(),
            hometown: editHometown.trim(),
            permanentAddress: editPermanentAddress.trim(),
            active: editActive,
          });
        } catch {
          // Ignore if not yet exists
        }
      }

      // 3. Nếu thay đổi lớp học, điều chỉnh classMembers & studentCount
      if (oldClassId !== newClassId) {
        if (oldClassId) {
          try {
            await deleteDoc(doc(db, 'classMembers', `${oldClassId}_${editingStudent.uid}`));
            await updateDoc(doc(db, 'classes', oldClassId), {
              studentCount: increment(-1),
            });
          } catch (e) {
            // Ignore if missing
          }
        }
        if (newClassId) {
          await setDoc(doc(db, 'classMembers', `${newClassId}_${editingStudent.uid}`), {
            classId: newClassId,
            userId: editingStudent.uid,
            studentCode: editStudentCode.trim().toUpperCase(),
            fullName: editFullName.trim(),
            gender: editGender,
            dateOfBirth: editDateOfBirth.trim(),
            phone: editPhone.trim(),
            cccd: editCccd.trim(),
            placeOfBirth: editPlaceOfBirth.trim(),
            hometown: editHometown.trim(),
            permanentAddress: editPermanentAddress.trim(),
            active: editActive,
            joinedAt: serverTimestamp(),
          });
          await updateDoc(doc(db, 'classes', newClassId), {
            studentCount: increment(1),
          });
        }
      }

      toast.success('Cập nhật thông tin sinh viên thành công!');
      setEditingStudent(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi cập nhật sinh viên');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteStudent = async (student: UserProfile) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn XÓA sinh viên "${student.fullName}" (${student.studentCode || student.email}) khỏi hệ thống?\n\nHành động này không thể hoàn tác.`
      )
    ) {
      return;
    }

    try {
      // 1. Xóa document sinh viên khỏi collection users
      await deleteDoc(doc(db, 'users', student.uid));

      // 2. Xóa khỏi classMembers & giảm sĩ số lớp
      if (student.classIds && student.classIds.length > 0) {
        for (const cid of student.classIds) {
          try {
            await deleteDoc(doc(db, 'classMembers', `${cid}_${student.uid}`));
            await updateDoc(doc(db, 'classes', cid), {
              studentCount: increment(-1),
            });
          } catch {
            // Ignore
          }
        }
      }

      toast.success(`Đã xóa sinh viên ${student.fullName} thành công!`);
      setStudents((prev) => prev.filter((s) => s.uid !== student.uid));
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi xóa sinh viên khỏi hệ thống');
    }
  };

  const filteredStudents = students.filter((s) => {
    const q = searchTerm.toLowerCase().trim();
    const matchSearch =
      !q ||
      (s.studentCode && s.studentCode.toLowerCase().includes(q)) ||
      (s.fullName && s.fullName.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.cccd && s.cccd.toLowerCase().includes(q)) ||
      (s.phone && s.phone.toLowerCase().includes(q)) ||
      (s.hometown && s.hometown.toLowerCase().includes(q)) ||
      (s.placeOfBirth && s.placeOfBirth.toLowerCase().includes(q)) ||
      (s.permanentAddress && s.permanentAddress.toLowerCase().includes(q));

    const matchClass = selectedClassId ? s.classIds?.includes(selectedClassId) : true;

    const matchStatus =
      selectedStatus === 'all'
        ? true
        : selectedStatus === 'active'
        ? s.active === true
        : s.active === false;

    return matchSearch && matchClass && matchStatus;
  });

  const getClassNameById = (classIds?: string[]) => {
    if (!classIds || classIds.length === 0) return 'Chưa phân lớp';
    const firstClass = classes.find((c) => c.id === classIds[0]);
    return firstClass ? firstClass.className : classIds[0];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Quản lý Sinh viên
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Danh sách hồ sơ học viên, tài khoản và thông tin lớp học
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 cursor-pointer transition-all"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Nhập Excel / CSV</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-semibold rounded-2xl shadow-md shadow-indigo-100 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Thêm học viên mới</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl shadow-card border border-slate-200/80 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo Mã SV, Họ tên, CCCD, Quê quán..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all flex-1 md:flex-initial"
          >
            <option value="">Tất cả các lớp</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.classCode} - {c.className}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all flex-1 md:flex-initial"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Đã khoá</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-xs font-medium">Đang tải danh sách sinh viên...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Chưa có sinh viên nào</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Thử tìm kiếm với từ khoá khác hoặc bấm "Thêm học viên mới"
            </p>
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
                  <th className="px-4 py-3.5">Lớp đang học</th>
                  <th className="px-3 py-3.5">Trạng thái</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s, index) => (
                  <tr key={s.uid} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-3.5 text-center font-bold text-slate-400">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-bold text-indigo-600">
                        {s.studentCode || '--'}
                      </div>
                      {s.cccd && (
                        <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                          CCCD: {s.cccd}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      <div>{s.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-normal">{s.email}</div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        s.gender === 'Nữ'
                          ? 'bg-pink-50 text-pink-700 border border-pink-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {s.gender || 'Nam'}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-slate-600 font-medium">
                      {s.dateOfBirth || '--'}
                    </td>
                    <td className="px-3 py-3.5 font-mono text-slate-600">
                      {s.phone || '--'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {s.hometown || s.placeOfBirth ? (
                        <div>
                          {s.hometown && <div className="font-medium text-slate-700">{s.hometown}</div>}
                          {s.placeOfBirth && (
                            <div className="text-[11px] text-slate-400">Nơi sinh: {s.placeOfBirth}</div>
                          )}
                        </div>
                      ) : (
                        '--'
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 max-w-[180px] truncate" title={s.permanentAddress}>
                      {s.permanentAddress || '--'}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-700">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold">
                        {getClassNameById(s.classIds)}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      {s.active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3" />
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3" />
                          Đã khoá
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          title="Chỉnh sửa thông tin sinh viên"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(s)}
                          title="Xóa sinh viên khỏi hệ thống"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(s.email)}
                          title="Gửi email đặt lại mật khẩu"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 cursor-pointer"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(s)}
                          className={'text-xs font-semibold px-2 py-1 rounded-xl transition-all cursor-pointer ' + (
                            s.active
                              ? 'text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          )}
                        >
                          {s.active ? 'Khoá' : 'Mở'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddStudentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        classes={classes}
        onSuccess={fetchData}
      />

      <ImportStudentModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchData}
      />

      {/* Modal Chỉnh sửa sinh viên */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 overflow-y-auto max-h-[92vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Chỉnh Sửa Thông Tin Sinh Viên</h3>
                <p className="text-xs text-slate-400 mt-0.5">{editingStudent.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã sinh viên *</label>
                  <input
                    type="text"
                    required
                    value={editStudentCode}
                    onChange={(e) => setEditStudentCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:border-indigo-600 outline-none uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số CCCD / Căn cước</label>
                  <input
                    type="text"
                    value={editCccd}
                    onChange={(e) => setEditCccd(e.target.value)}
                    placeholder="Ví dụ: 079201012345"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:border-indigo-600 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giới tính</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:border-indigo-600 outline-none"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày sinh</label>
                  <input
                    type="date"
                    value={editDateOfBirth}
                    onChange={(e) => setEditDateOfBirth(e.target.value)}
                    className="w-full px-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="0912345678"
                    className="w-full px-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:border-indigo-600 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nơi sinh</label>
                  <input
                    type="text"
                    value={editPlaceOfBirth}
                    onChange={(e) => setEditPlaceOfBirth(e.target.value)}
                    placeholder="Ví dụ: TP. Hồ Chí Minh"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quê quán</label>
                  <input
                    type="text"
                    value={editHometown}
                    onChange={(e) => setEditHometown(e.target.value)}
                    placeholder="Ví dụ: Bến Tre"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hộ khẩu thường trú</label>
                <input
                  type="text"
                  value={editPermanentAddress}
                  onChange={(e) => setEditPermanentAddress(e.target.value)}
                  placeholder="Ví dụ: 123 Nguyễn Văn Cừ, P.4, Q.5, TP.HCM"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lớp học phụ trách</label>
                <select
                  value={editClassId}
                  onChange={(e) => setEditClassId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 outline-none"
                >
                  <option value="">-- Chưa gán lớp --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.className} ({c.classCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái tài khoản</label>
                <select
                  value={editActive ? 'active' : 'inactive'}
                  onChange={(e) => setEditActive(e.target.value === 'active')}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 outline-none"
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Đã khoá</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer"
                >
                  {savingEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

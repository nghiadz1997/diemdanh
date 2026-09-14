'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ClassItem } from '@/types';
import { UserPlus, X, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { collection, addDoc, doc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassItem[];
  onSuccess: () => void;
}

export function AddStudentModal({
  isOpen,
  onClose,
  classes,
  onSuccess,
}: AddStudentModalProps) {
  const { getToken } = useAuth();
  const [studentCode, setStudentCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'Nam' | 'Nữ' | 'Khác'>('Nam');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [cccd, setCccd] = useState('');
  const [placeOfBirth, setPlaceOfBirth] = useState('');
  const [hometown, setHometown] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [email, setEmail] = useState('');
  const [classId, setClassId] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailCustomized, setIsEmailCustomized] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleStudentCodeChange = (code: string) => {
    setStudentCode(code);
    if (!isEmailCustomized) {
      const clean = code.trim().toLowerCase();
      setEmail(clean ? `${clean}@nsg.edu.vn` : '');
    }
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let generated = 'Sv@';
    for (let i = 0; i < 6; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
    toast.info('Đã tạo mật khẩu cấp tạm thời an toàn');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode.trim() || !fullName.trim() || !email.trim() || !classId || !password) {
      toast.error('Vui lòng điền đầy đủ tất cả các trường');
      return;
    }

    if (password.length < 6) {
      toast.error('Mật khẩu cấp tạm thời phải tối thiểu 6 ký tự');
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Phiên làm việc hết hạn. Vui lòng đăng nhập lại');
        setLoading(false);
        return;
      }

      // 1. Tạo tài khoản trong Firebase Authentication (Authentic Firebase)
      let authUid: string | null = null;
      try {
        const { createAuthUser } = await import('@/lib/firebase');
        authUid = await createAuthUser(
          email.trim().toLowerCase(),
          password,
          fullName.trim()
        );
      } catch (authErr: any) {
        if (authErr?.code === 'auth/email-already-in-use') {
          toast.error('Email "' + email + '" đã tồn tại trong Firebase Authentication!');
          setLoading(false);
          return;
        } else if (authErr?.code === 'auth/weak-password') {
          toast.error('Mật khẩu quá yếu, vui lòng chọn mật khẩu khác (tối thiểu 6 ký tự)');
          setLoading(false);
          return;
        } else if (authErr?.code === 'auth/invalid-email') {
          toast.error('Địa chỉ email không đúng định dạng');
          setLoading(false);
          return;
        }
        console.warn('Lỗi tạo auth trực tiếp, thử qua API:', authErr);
      }

      // Nếu tạo qua client auth chưa được, gọi API server
      if (!authUid) {
        try {
          const res = await fetch('/api/admin/students/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              studentCode: studentCode.trim().toUpperCase(),
              fullName: fullName.trim(),
              email: email.trim().toLowerCase(),
              classId,
              password,
              gender,
              dateOfBirth: dateOfBirth.trim(),
              phone: phone.trim(),
              cccd: cccd.trim(),
              placeOfBirth: placeOfBirth.trim(),
              hometown: hometown.trim(),
              permanentAddress: permanentAddress.trim(),
            }),
          });
          const data = await res.json();
          if (res.ok && data.success && data.data?.uid) {
            authUid = data.data.uid;
          } else if (data.message) {
            toast.error(data.message);
            setLoading(false);
            return;
          }
        } catch {
          // Ignored
        }
      }

      if (!authUid) {
        toast.error('Không thể tạo tài khoản xác thực trong Firebase Auth. Vui lòng kiểm tra kết nối mạng hoặc thử lại.');
        setLoading(false);
        return;
      }

      const uid = authUid;

      // 2. Lưu thông tin hồ sơ vào Cloud Firestore users/{uid}
      await setDoc(doc(db, 'users', uid), {
        uid,
        studentCode: studentCode.trim().toUpperCase(),
        fullName: fullName.trim(),
        gender,
        dateOfBirth: dateOfBirth.trim(),
        phone: phone.trim(),
        cccd: cccd.trim(),
        placeOfBirth: placeOfBirth.trim(),
        hometown: hometown.trim(),
        permanentAddress: permanentAddress.trim(),
        email: email.trim().toLowerCase(),
        role: 'student',
        classIds: [classId],
        active: true,
        mustChangePassword: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Phân quyền thành viên lớp học classMembers
      const memberId = `${classId}_${uid}`;
      await setDoc(doc(db, 'classMembers', memberId), {
        classId,
        userId: uid,
        studentCode: studentCode.trim().toUpperCase(),
        fullName: fullName.trim(),
        gender,
        dateOfBirth: dateOfBirth.trim(),
        phone: phone.trim(),
        cccd: cccd.trim(),
        placeOfBirth: placeOfBirth.trim(),
        hometown: hometown.trim(),
        permanentAddress: permanentAddress.trim(),
        active: true,
        joinedAt: serverTimestamp(),
      });

      // 4. Tăng sĩ số lớp học
      await updateDoc(doc(db, 'classes', classId), {
        studentCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      toast.success('Đã thêm sinh viên vào Firebase Authentication & Lớp học thành công!');
      // Reset form
      setStudentCode('');
      setFullName('');
      setGender('Nam');
      setDateOfBirth('');
      setPhone('');
      setCccd('');
      setPlaceOfBirth('');
      setHometown('');
      setPermanentAddress('');
      setEmail('');
      setPassword('');
      setIsEmailCustomized(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Lỗi tạo sinh viên:', err);
      toast.error(err.message || 'Không thể tạo tài khoản sinh viên');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Thêm học viên mới</h2>
              <p className="text-xs text-slate-500">Cấp tài khoản và đưa vào lớp học</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* MÃ SINH VIÊN */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Mã sinh viên (ID)
            </label>
            <input
              type="text"
              value={studentCode}
              onChange={(e) => handleStudentCodeChange(e.target.value.toUpperCase())}
              placeholder="Ví dụ: SV22001"
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all uppercase"
              required
            />
          </div>

          {/* HỌ VÀ TÊN */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Họ và tên sinh viên
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ví dụ: Trịnh Quốc Bảo"
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              required
            />
          </div>

          {/* GIỚI TÍNH & NGÀY SINH */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Giới tính
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Ngày sinh
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* SỐ CCCD & SỐ ĐIỆN THOẠI */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Số CCCD / Căn cước
              </label>
              <input
                type="text"
                value={cccd}
                onChange={(e) => setCccd(e.target.value)}
                placeholder="Ví dụ: 079201012345"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Số điện thoại
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ví dụ: 0912345678"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-mono"
              />
            </div>
          </div>

          {/* NƠI SINH & QUÊ QUÁN */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Nơi sinh
              </label>
              <input
                type="text"
                value={placeOfBirth}
                onChange={(e) => setPlaceOfBirth(e.target.value)}
                placeholder="Ví dụ: TP. Hồ Chí Minh"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Quê quán
              </label>
              <input
                type="text"
                value={hometown}
                onChange={(e) => setHometown(e.target.value)}
                placeholder="Ví dụ: Bến Tre"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* HỘ KHẨU THƯỜNG TRÚ */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Hộ khẩu thường trú
            </label>
            <input
              type="text"
              value={permanentAddress}
              onChange={(e) => setPermanentAddress(e.target.value)}
              placeholder="Ví dụ: 123 Nguyễn Văn Cừ, P.4, Q.5, TP.HCM"
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* ĐỊA CHỈ EMAIL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Địa chỉ Email (Dùng để xác thực)
              </label>
              {!isEmailCustomized && studentCode && (
                <span className="text-[10px] bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">
                  Mặc định theo Mã SV
                </span>
              )}
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setIsEmailCustomized(true);
                setEmail(e.target.value);
              }}
              placeholder="Ví dụ: sv22001@nsg.edu.vn"
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Sinh viên có thể đăng nhập bằng Mã sinh viên ({studentCode || '...'}) hoặc Email này.
            </p>
          </div>

          {/* MÃ LỚP HỌC */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Mã lớp học
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              required
            >
              <option value="">-- Chọn lớp học --</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.classCode} - {c.className}
                </option>
              ))}
            </select>
          </div>

          {/* MẬT KHẨU CẤP */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Mật khẩu cấp
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tạo ngẫu nhiên</span>
              </button>
            </div>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ví dụ: Sv@2026Secure"
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-mono transition-all"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Sinh viên sẽ bắt buộc phải đổi mật khẩu ở lần đăng nhập đầu tiên.
            </p>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang khởi tạo tài khoản...</span>
                </>
              ) : (
                <span>+ Thêm học viên mới</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

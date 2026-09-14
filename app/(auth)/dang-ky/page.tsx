'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getClasses } from '@/services/classService';
import { ClassItem } from '@/types';
import {
  School,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Form states
  const [studentCode, setStudentCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [classId, setClassId] = useState('');
  const [email, setEmail] = useState('');
  const [isEmailCustomized, setIsEmailCustomized] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Additional fields
  const [gender, setGender] = useState<'Nam' | 'Nữ' | 'Khác'>('Nam');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [cccd, setCccd] = useState('');
  const [placeOfBirth, setPlaceOfBirth] = useState('');
  const [hometown, setHometown] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchClasses() {
      try {
        const list = await getClasses();
        const activeList = list.filter((c) => c.active !== false);
        setClasses(activeList);
        if (activeList.length > 0) {
          setClassId(activeList[0].id);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách lớp:', err);
      } finally {
        setLoadingClasses(false);
      }
    }
    fetchClasses();
  }, []);

  const handleStudentCodeChange = (code: string) => {
    const upper = code.toUpperCase();
    setStudentCode(upper);
    if (!isEmailCustomized) {
      const clean = upper.trim().toLowerCase();
      setEmail(clean ? `${clean}@nsg.edu.vn` : '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCode = studentCode.trim().toUpperCase();
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanCode) {
      toast.error('Vui lòng nhập Mã số sinh viên (MSSV)');
      return;
    }
    if (!cleanName) {
      toast.error('Vui lòng nhập Họ và tên sinh viên');
      return;
    }
    if (!classId) {
      toast.error('Vui lòng chọn Lớp học của bạn');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Vui lòng nhập địa chỉ Email hợp lệ');
      return;
    }
    if (password.length < 6) {
      toast.error('Mật khẩu phải có tối thiểu 6 ký tự');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Kiểm tra Mã sinh viên đã tồn tại chưa
      const codeQuery = query(collection(db, 'users'), where('studentCode', '==', cleanCode));
      const codeSnap = await getDocs(codeQuery);
      if (!codeSnap.empty) {
        toast.error(`Mã sinh viên "${cleanCode}" đã được đăng ký trong hệ thống.`);
        setSubmitting(false);
        return;
      }

      // 2. Tạo tài khoản trong Firebase Authentication
      let uid = '';
      try {
        const { createAuthUser } = await import('@/lib/firebase');
        uid = await createAuthUser(cleanEmail, password, cleanName);
      } catch (authErr: any) {
        if (authErr?.code === 'auth/email-already-in-use') {
          toast.error(`Email "${cleanEmail}" đã được sử dụng. Vui lòng chọn email khác.`);
        } else if (authErr?.code === 'auth/weak-password') {
          toast.error('Mật khẩu quá ngắn hoặc quá đơn giản (tối thiểu 6 ký tự).');
        } else {
          toast.error(authErr.message || 'Lỗi tạo tài khoản xác thực.');
        }
        setSubmitting(false);
        return;
      }

      // 3. Lưu thông tin sinh viên vào Firestore users/{uid}
      await setDoc(doc(db, 'users', uid), {
        uid,
        studentCode: cleanCode,
        fullName: cleanName,
        email: cleanEmail,
        role: 'student',
        gender,
        dateOfBirth: dateOfBirth.trim() || null,
        phone: phone.trim() || null,
        cccd: cccd.trim() || null,
        placeOfBirth: placeOfBirth.trim() || null,
        hometown: hometown.trim() || null,
        permanentAddress: permanentAddress.trim() || null,
        classIds: [classId],
        active: true,
        mustChangePassword: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 4. Thêm vào classMembers/{classId}_{uid}
      await setDoc(doc(db, 'classMembers', `${classId}_${uid}`), {
        classId,
        userId: uid,
        studentCode: cleanCode,
        fullName: cleanName,
        gender,
        dateOfBirth: dateOfBirth.trim() || null,
        phone: phone.trim() || null,
        cccd: cccd.trim() || null,
        placeOfBirth: placeOfBirth.trim() || null,
        hometown: hometown.trim() || null,
        permanentAddress: permanentAddress.trim() || null,
        role: 'student',
        joinedAt: serverTimestamp(),
        active: true,
      });

      // 5. Tăng sĩ số sinh viên lớp
      try {
        await updateDoc(doc(db, 'classes', classId), {
          studentCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      } catch (incErr) {
        console.warn('Lỗi tăng sĩ số lớp:', incErr);
      }

      // 6. Kiểm tra xem người đang thao tác là khách (chưa đăng nhập) hay Admin đang nhập hộ
      if (!auth.currentUser) {
        // Sinh viên tự đăng ký -> Đăng nhập và chuyển vào dashboard sinh viên
        try {
          const { signInWithEmailAndPassword } = await import('firebase/auth');
          await signInWithEmailAndPassword(auth, cleanEmail, password);
        } catch (loginErr) {
          console.warn('Lỗi auto-login sau đăng ký:', loginErr);
        }
        toast.success('Đăng ký tài khoản sinh viên thành công!');
        router.push('/sinh-vien/dashboard');
      } else {
        // Admin hoặc người dùng đã đăng nhập đang tạo giúp sinh viên
        toast.success(`Đã đăng ký tài khoản cho sinh viên ${cleanName} (${cleanCode}) thành công!`);
        // Reset form để có thể tạo tiếp sinh viên khác
        setStudentCode('');
        setFullName('');
        setEmail('');
        setIsEmailCustomized(false);
        setPassword('');
        setConfirmPassword('');
        setPhone('');
        setCccd('');
        setDateOfBirth('');
        setPlaceOfBirth('');
        setHometown('');
        setPermanentAddress('');
      }
    } catch (err: any) {
      console.error('Lỗi đăng ký sinh viên:', err);
      toast.error(err.message || 'Không thể đăng ký tài khoản. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/70">
      <div className="w-full max-w-2xl">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white shadow-xl shadow-slate-200/80 mb-3 ring-4 ring-indigo-50 p-2">
            <img
              src="/logo.png"
              alt="Logo TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 block">
            TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN
          </span>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mt-1">
            ĐĂNG KÝ TÀI KHOẢN SINH VIÊN
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Điền thông tin để đăng ký hồ sơ sinh viên vào hệ thống quản lý & điểm danh
          </p>
        </div>

        {/* Register Card Form */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* NHÓM 1: THÔNG TIN HỌC TẬP & TÀI KHOẢN */}
            <div>
              <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
                <School className="w-4 h-4 text-indigo-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  1. Thông tin học tập & Đăng nhập
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Mã SV */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Mã số sinh viên (MSSV) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={studentCode}
                    onChange={(e) => handleStudentCodeChange(e.target.value)}
                    placeholder="Nhập mã sinh viên"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all uppercase"
                    required
                  />
                </div>

                {/* Họ và tên */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Họ và tên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nhập họ và tên đầy đủ"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    required
                  />
                </div>

                {/* Chọn lớp học */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Lớp học <span className="text-rose-500">*</span>
                  </label>
                  {loadingClasses ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                      <span>Đang tải danh sách lớp học...</span>
                    </div>
                  ) : classes.length > 0 ? (
                    <select
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                      required
                    >
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.classCode} - {cls.className} {cls.academicYear ? `(${cls.academicYear})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      placeholder="Nhập mã lớp học của bạn"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      required
                    />
                  )}
                </div>

                {/* Email */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Email đăng nhập <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setIsEmailCustomized(true);
                      }}
                      placeholder="Email đăng nhập"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                      required
                    />
                  </div>
                </div>

                {/* Mật khẩu */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Mật khẩu <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự"
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Nhập lại mật khẩu */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Xác nhận mật khẩu <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu"
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* NHÓM 2: THÔNG TIN HỒ SƠ SINH VIÊN */}
            <div>
              <div className="flex items-center gap-2 pb-2 mb-4 border-b border-slate-100">
                <User className="w-4 h-4 text-indigo-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  2. Thông tin cá nhân & Liên hệ
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Giới tính */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Giới tính
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                {/* Ngày sinh */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Ngày sinh
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                  />
                </div>

                {/* Số điện thoại */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Số điện thoại"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                  />
                </div>

                {/* Số CCCD */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Số CCCD / Căn cước công dân
                  </label>
                  <input
                    type="text"
                    value={cccd}
                    onChange={(e) => setCccd(e.target.value)}
                    placeholder="Số thẻ CCCD 12 số"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                  />
                </div>

                {/* Nơi sinh */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Nơi sinh
                  </label>
                  <input
                    type="text"
                    value={placeOfBirth}
                    onChange={(e) => setPlaceOfBirth(e.target.value)}
                    placeholder="Tỉnh/Thành phố nơi sinh"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                  />
                </div>

                {/* Quê quán */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Quê quán
                  </label>
                  <input
                    type="text"
                    value={hometown}
                    onChange={(e) => setHometown(e.target.value)}
                    placeholder="Quê quán"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                  />
                </div>

                {/* Hộ khẩu thường trú */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Hộ khẩu thường trú
                  </label>
                  <input
                    type="text"
                    value={permanentAddress}
                    onChange={(e) => setPermanentAddress(e.target.value)}
                    placeholder="Địa chỉ thường trú theo sổ hộ khẩu/CCCD"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Nút Đăng ký */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang khởi tạo tài khoản...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Hoàn tất Đăng ký tài khoản</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quay lại Đăng nhập & Về cổng điểm danh */}
          <div className="text-center mt-6 pt-4 border-t border-slate-100 flex flex-col items-center gap-2.5">
            <div>
              <span className="text-xs text-slate-500">Đã có tài khoản? </span>
              <Link
                href="/dang-nhap"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                Đăng nhập ngay
              </Link>
            </div>
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
              >
                <span>← Trở về Cổng điểm danh nhanh</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Phát triển bởi: Thầy Nguyễn Trọng Nghĩa
        </p>
      </div>
    </div>
  );
}

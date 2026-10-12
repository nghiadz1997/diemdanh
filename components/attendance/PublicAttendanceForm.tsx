'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LessonSession } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Sparkles,
  UserCheck,
  QrCode,
  LogIn,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { sendAttendanceTelegramNotification } from '@/services/telegramService';

interface AttendanceResult {
  studentName: string;
  studentCode: string;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
  cccd?: string;
  placeOfBirth?: string;
  hometown?: string;
  permanentAddress?: string;
  className: string;
  classCode: string;
  sessionTitle: string;
  checkInTime: string;
  alreadyMarked: boolean;
}

export function PublicAttendanceForm() {
  const { user, profile, role } = useAuth();
  const [studentCode, setStudentCode] = useState('');
  const [attendanceCode, setAttendanceCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttendanceResult | null>(null);

  const [referencedName, setReferencedName] = useState<string | null>(null);

  // Tự động điền mã sinh viên nếu sinh viên đã đăng nhập
  useEffect(() => {
    if (profile?.studentCode && !studentCode) {
      setStudentCode(profile.studentCode.toUpperCase());
    }
  }, [profile]);

  // Tự động tham chiếu tên sinh viên bằng Mã sinh viên khi người dùng đang nhập
  useEffect(() => {
    const clean = studentCode.trim().toUpperCase();
    if (clean.length < 2) {
      setReferencedName(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        // 1. Tìm trong users (nguồn tài khoản sinh viên chính thức của trường)
        const snapU = await getDocs(
          query(collection(db, 'users'), where('studentCode', '==', clean))
        );
        if (!snapU.empty) {
          const uData = snapU.docs[0].data();
          const name = (uData.fullName || uData.displayName || '').trim();
          if (name && !name.startsWith('Sinh viên ')) {
            setReferencedName(name);
            return;
          }
        }

        // 2. Tìm trong classMembers chính thức (chỉ nhận hồ sơ có tên người thật)
        const snapM = await getDocs(
          query(collection(db, 'classMembers'), where('studentCode', '==', clean))
        );
        if (!snapM.empty) {
          for (const d of snapM.docs) {
            const mData = d.data();
            const name = (mData.fullName || '').trim();
            if (name && !name.startsWith('Sinh viên ') && mData.userId && !mData.userId.startsWith('sv_')) {
              setReferencedName(name);
              return;
            }
          }
        }

        setReferencedName(null);
      } catch (err) {
        setReferencedName(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [studentCode]);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanStudentCode = studentCode.trim().toUpperCase();
    const cleanAttendanceCode = attendanceCode.trim().replace(/\D/g, '');

    if (!cleanStudentCode) {
      toast.error('Vui lòng nhập Mã số sinh viên (MSSV)');
      return;
    }

    // Kiểm tra độ dài bất thường do gõ lặp / dán đúp mã (như trong trường hợp dán 2 lần)
    if (cleanStudentCode.length > 15) {
      toast.error(`Mã số sinh viên "${cleanStudentCode}" không hợp lệ (độ dài quá 15 ký tự do dán lặp mã). Vui lòng kiểm tra lại!`);
      return;
    }

    if (cleanAttendanceCode.length !== 6) {
      toast.error('Vui lòng nhập đầy đủ 6 chữ số mã điểm danh');
      return;
    }

    setSubmitting(true);
    try {
      // 1. TÌM KIẾM BUỔI HỌC THEO MÃ ĐIỂM DANH 6 CHỮ SỐ
      const sessQuery = query(
        collection(db, 'sessions'),
        where('attendanceCode', '==', cleanAttendanceCode)
      );
      const sessSnap = await getDocs(sessQuery);

      if (sessSnap.empty) {
        toast.error(`Mã điểm danh "${cleanAttendanceCode}" không chính xác hoặc buổi học chưa mở điểm danh.`);
        setSubmitting(false);
        return;
      }

      const matchingSessionDoc = sessSnap.docs.find((d) => d.data().attendanceOpen === true) || sessSnap.docs[0];
      const targetSessionData = matchingSessionDoc.data();

      if (!targetSessionData.attendanceOpen) {
        toast.error('Mã điểm danh này hiện đã đóng hoặc buổi học đã kết thúc. Vui lòng liên hệ Giảng viên.');
        setSubmitting(false);
        return;
      }

      // Kiểm tra thời hạn mã điểm danh nếu có
      if (targetSessionData.codeExpiresAt) {
        const expiresAt = targetSessionData.codeExpiresAt?.toMillis
          ? targetSessionData.codeExpiresAt.toMillis()
          : new Date(targetSessionData.codeExpiresAt).getTime();
        if (expiresAt && Date.now() > expiresAt) {
          toast.error('Mã điểm danh này đã hết hạn. Vui lòng xin giảng viên cấp lại mã mới.');
          setSubmitting(false);
          return;
        }
      }

      const targetSession = { id: matchingSessionDoc.id, ...targetSessionData } as LessonSession;
      const classId = targetSession.classId;

      // 2. LẤY THÔNG TIN LỚP HỌC
      let classDoc: any = null;
      try {
        const classDirect = await getDoc(doc(db, 'classes', classId));
        if (classDirect.exists()) {
          classDoc = { id: classDirect.id, ...classDirect.data() };
        }
      } catch (classErr) {
        console.warn('Lỗi tìm thông tin lớp học:', classErr);
      }

      // 3. XÁC THỰC MÃ SINH VIÊN BẮT BUỘC PHẢI THUỘC DANH SÁCH SINH VIÊN ĐÃ ĐƯỢC NHÀ TRƯỜNG CẤP
      let finalFullName = '';
      let studentUid: string | null = null;
      let userProfileData: any = {};

      // 3.1. Tìm trong collection users (nguồn chính thức của trường)
      try {
        const [snapUUpper, snapULower] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('studentCode', '==', cleanStudentCode))),
          cleanStudentCode !== cleanStudentCode.toLowerCase()
            ? getDocs(query(collection(db, 'users'), where('studentCode', '==', cleanStudentCode.toLowerCase())))
            : Promise.resolve({ empty: true, docs: [] } as any),
        ]);

        const foundUserDoc = !snapUUpper.empty ? snapUUpper.docs[0] : (!snapULower.empty ? snapULower.docs[0] : null);

        if (foundUserDoc) {
          const uData = foundUserDoc.data();
          studentUid = foundUserDoc.id;
          finalFullName = (uData.fullName || uData.displayName || '').trim();
          userProfileData = { ...uData };
        }
      } catch (uErr) {
        console.warn('Lỗi tìm users:', uErr);
      }

      // 3.2. Nếu chưa có trong users, tìm trong classMembers chính thức (chỉ nhận hồ sơ hợp lệ có tên người thật)
      if (!studentUid || !finalFullName) {
        try {
          const snapM = await getDocs(
            query(collection(db, 'classMembers'), where('studentCode', '==', cleanStudentCode))
          );
          if (!snapM.empty) {
            for (const mDoc of snapM.docs) {
              const mData = mDoc.data();
              const fName = (mData.fullName || '').trim();
              if (fName && !fName.startsWith('Sinh viên ') && mData.userId && !mData.userId.startsWith('sv_')) {
                studentUid = mData.userId;
                finalFullName = fName;
                userProfileData = { ...mData };
                break;
              }
            }
          }
        } catch (mErr) {
          console.warn('Lỗi tìm classMembers:', mErr);
        }
      }

      // RÀNG BUỘC NGHIÊM NGẶT: NẾU MSSV KHÔNG TỒN TẠI HOẶC CHƯA ĐƯỢC CẤP -> TỪ CHỐI ĐIỂM DANH!
      if (!studentUid || !finalFullName || finalFullName.startsWith('Sinh viên ')) {
        toast.error(
          `Mã số sinh viên "${cleanStudentCode}" không tồn tại trong danh sách sinh viên được nhà trường cấp. Vui lòng kiểm tra lại chính xác MSSV của bạn hoặc liên hệ Giảng viên/Phòng Đào tạo!`
        );
        setSubmitting(false);
        return;
      }

      // Tự động liên kết sinh viên chính thức vào thành viên lớp nếu chưa có
      try {
        const memberKey = `${classId}_${studentUid}`;
        const memRef = doc(db, 'classMembers', memberKey);
        await setDoc(
          memRef,
          {
            classId: classId,
            userId: studentUid,
            studentCode: cleanStudentCode,
            fullName: finalFullName,
            gender: userProfileData.gender || '',
            dateOfBirth: userProfileData.dateOfBirth || '',
            phone: userProfileData.phone || '',
            cccd: userProfileData.cccd || '',
            placeOfBirth: userProfileData.placeOfBirth || '',
            hometown: userProfileData.hometown || '',
            permanentAddress: userProfileData.permanentAddress || '',
            active: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (memErr) {
        console.warn('Tự động ghi nhận thành viên lớp:', memErr);
      }

      // 4. KIỂM TRA ĐÃ ĐIỂM DANH CHƯA
      const attendanceDocId = `${targetSession.id}_${cleanStudentCode}`;
      const attRef = doc(db, 'attendance', attendanceDocId);
      const existingAtt = await getDoc(attRef);

      const checkInTimeStr = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      if (existingAtt.exists()) {
        const attData = existingAtt.data();
        setResult({
          studentName: attData.studentName || finalFullName,
          studentCode: cleanStudentCode,
          gender: userProfileData.gender,
          dateOfBirth: userProfileData.dateOfBirth,
          phone: userProfileData.phone,
          cccd: userProfileData.cccd,
          placeOfBirth: userProfileData.placeOfBirth,
          hometown: userProfileData.hometown,
          permanentAddress: userProfileData.permanentAddress,
          className: classDoc?.className || 'Lớp học',
          classCode: classDoc?.classCode || '',
          sessionTitle: targetSession.title || 'Buổi học',
          checkInTime: attData.checkInTimeStr || checkInTimeStr,
          alreadyMarked: true,
        });
        toast.info(`Sinh viên ${finalFullName} (${cleanStudentCode}) đã được điểm danh CÓ MẶT trong buổi học này trước đó!`);
        setSubmitting(false);
        return;
      }

      // 5. GHI NHẬN ĐIỂM DANH MỚI
      await setDoc(attRef, {
        sessionId: targetSession.id,
        sessionTitle: targetSession.title || 'Buổi học',
        classId: classId,
        className: classDoc?.className || 'Lớp học',
        classCode: classDoc?.classCode || '',
        studentCode: cleanStudentCode,
        studentName: finalFullName,
        userId: studentUid || `sv_${cleanStudentCode}`,
        gender: userProfileData.gender || null,
        dateOfBirth: userProfileData.dateOfBirth || null,
        phone: userProfileData.phone || null,
        cccd: userProfileData.cccd || null,
        placeOfBirth: userProfileData.placeOfBirth || null,
        hometown: userProfileData.hometown || null,
        permanentAddress: userProfileData.permanentAddress || null,
        status: 'present',
        method: 'portal',
        checkInTime: serverTimestamp(),
        checkInTimeStr,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Tự động gửi thông báo điểm danh về Bot Telegram
      sendAttendanceTelegramNotification({
        studentName: finalFullName,
        studentCode: cleanStudentCode,
        className: classDoc?.className || 'Lớp học',
        classCode: classDoc?.classCode || '',
        sessionTitle: targetSession.title || 'Buổi học',
        checkInTime: checkInTimeStr,
        phone: userProfileData.phone || undefined,
        gender: userProfileData.gender || undefined,
        cccd: userProfileData.cccd || undefined,
        status: 'present',
        method: 'portal',
      });

      setResult({
        studentName: finalFullName,
        studentCode: cleanStudentCode,
        gender: userProfileData.gender,
        dateOfBirth: userProfileData.dateOfBirth,
        phone: userProfileData.phone,
        cccd: userProfileData.cccd,
        placeOfBirth: userProfileData.placeOfBirth,
        hometown: userProfileData.hometown,
        permanentAddress: userProfileData.permanentAddress,
        className: classDoc?.className || 'Lớp học',
        classCode: classDoc?.classCode || '',
        sessionTitle: targetSession.title || 'Buổi học',
        checkInTime: checkInTimeStr,
        alreadyMarked: false,
      });

      toast.success(`Điểm danh thành công! ${finalFullName} (${cleanStudentCode}) - ĐÃ XÁC NHẬN CÓ ĐI HỌC.`);
    } catch (err: any) {
      console.error('Lỗi cổng điểm danh:', err);
      toast.error(err.message || 'Không thể ghi nhận điểm danh. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setStudentCode('');
    setAttendanceCode('');
    setReferencedName(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Navbar Header */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between py-2 px-1 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-white p-1.5 shadow-md border border-slate-100 flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Logo CĐ Bách Khoa Nam Sài Gòn" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-700 block">
              TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-900 block">
              HỆ THỐNG ĐIỂM DANH SINH VIÊN
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <Link
              href={
                role === 'super_admin' || role === 'admin'
                  ? '/admin/dashboard'
                  : role === 'teacher'
                  ? '/giang-vien/dashboard'
                  : '/sinh-vien/dashboard'
              }
              className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <span>Vào Bảng điều khiển</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/dang-ky"
                className="py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all shadow-sm active:scale-95"
              >
                Đăng ký sinh viên
              </Link>
              <Link
                href="/dang-nhap"
                className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition-all shadow-md active:scale-95"
              >
                <span>Đăng nhập</span>
                <LogIn className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md w-full mx-auto my-auto py-4">
        {!result ? (
          /* Check-In Form Card */
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 text-slate-800 border border-slate-100">
            {/* Header Branding with Logo */}
            <div className="text-center space-y-2 mb-6">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-white p-2 shadow-lg shadow-indigo-100 border border-slate-100 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Logo TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 block">
                  TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN
                </span>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mt-0.5">
                  Điểm Danh Buổi Học
                </h1>
              </div>
            </div>

            <form onSubmit={handleCheckIn} className="space-y-4">
              {/* MÃ SỐ SINH VIÊN (MSSV) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Mã số sinh viên (MSSV)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                    placeholder="Nhập mã sinh viên (MSSV)"
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono font-bold text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
                    required
                    autoFocus
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <UserCheck className="w-5 h-5 text-slate-400" />
                  </div>
                </div>

                {referencedName ? (
                  <div className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold animate-in fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>
                      Họ và tên: <strong className="text-emerald-950 font-bold">{referencedName}</strong>
                    </span>
                  </div>
                ) : studentCode.trim().length >= 4 ? (
                  <div className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium animate-in fade-in">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span>Chưa tìm thấy sinh viên có mã này trong danh sách cấp của trường</span>
                  </div>
                ) : null}
              </div>

              {/* MÃ ĐIỂM DANH BUỔI HỌC (6 CHỮ SỐ) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Mã điểm danh buổi học (6 chữ số)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={attendanceCode}
                    onChange={(e) => setAttendanceCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="------"
                    className="w-full px-4 py-3.5 bg-slate-50 border-2 border-indigo-100 rounded-2xl text-slate-900 font-mono font-black text-center text-3xl tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-300 placeholder:tracking-[0.4em]"
                    required
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <QrCode className="w-5 h-5 text-indigo-400" />
                  </div>
                </div>
              </div>

              {/* Nút Điểm Danh */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 px-4 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer text-sm"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Đang xác thực & ghi nhận...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Xác Nhận Điểm Danh</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Success Screen Card */
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 text-slate-800 border border-slate-100 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center ring-8 ring-emerald-50/50 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>{result.alreadyMarked ? 'Đã ghi nhận từ trước' : 'Điểm danh thành công'}</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900">
                {result.alreadyMarked ? 'ĐÃ ĐIỂM DANH CÓ MẶT' : 'GHI NHẬN CÓ ĐI HỌC'}
              </h2>
              <p className="text-xs text-slate-500">
                Buổi học của bạn đã được xác nhận hiện diện trên hệ thống
              </p>
            </div>

            {/* Thông tin chi tiết */}
            <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2.5 text-xs border border-slate-200/80 font-medium">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500">Họ và tên:</span>
                <span className="font-bold text-slate-900 text-sm">{result.studentName}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500">Mã sinh viên:</span>
                <span className="font-mono font-bold text-indigo-600 text-sm">
                  {result.studentCode}
                </span>
              </div>
              {result.cccd && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Số CCCD / Căn cước:</span>
                  <span className="font-mono font-semibold text-slate-800">{result.cccd}</span>
                </div>
              )}
              {result.gender && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Giới tính:</span>
                  <span className="font-semibold text-slate-800">{result.gender}</span>
                </div>
              )}
              {result.dateOfBirth && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Ngày sinh:</span>
                  <span className="font-semibold text-slate-800">{result.dateOfBirth}</span>
                </div>
              )}
              {result.phone && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Số điện thoại:</span>
                  <span className="font-semibold text-slate-800">{result.phone}</span>
                </div>
              )}
              {(result.hometown || result.placeOfBirth) && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Quê quán / Nơi sinh:</span>
                  <span className="font-semibold text-slate-800">
                    {result.hometown || result.placeOfBirth}
                  </span>
                </div>
              )}
              {result.permanentAddress && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Hộ khẩu thường trú:</span>
                  <span className="font-semibold text-slate-800 text-right max-w-[200px] truncate" title={result.permanentAddress}>
                    {result.permanentAddress}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500">Lớp học:</span>
                <span className="font-semibold text-slate-800">
                  {result.className} ({result.classCode})
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-slate-500">Buổi học:</span>
                <span className="font-semibold text-slate-800">{result.sessionTitle}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Thời gian ghi nhận:</span>
                <span className="font-mono text-emerald-700 font-bold">{result.checkInTime}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer transition-all text-xs"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Điểm danh cho sinh viên khác</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-3 text-xs font-medium text-slate-400">
        Phát triển bởi: Thầy Nguyễn Trọng Nghĩa
      </footer>
    </div>
  );
}

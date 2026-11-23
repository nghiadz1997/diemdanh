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
  const { profile } = useAuth();
  const [studentCode, setStudentCode] = useState('');
  const [attendanceCode, setAttendanceCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttendanceResult | null>(null);

  const [referencedName, setReferencedName] = useState<string | null>(null);

  // Tự động điền mã sinh viên nếu sinh viên đã đăng nhập sẵn
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
        // 1. Tìm trong users
        const snapU = await getDocs(
          query(collection(db, 'users'), where('studentCode', '==', clean))
        );
        if (!snapU.empty) {
          const uData = snapU.docs[0].data();
          const name = (uData.fullName || uData.displayName || '').trim();
          if (name) {
            setReferencedName(name);
            return;
          }
        }

        // 2. Tìm trong classMembers
        const snapM = await getDocs(
          query(collection(db, 'classMembers'), where('studentCode', '==', clean))
        );
        if (!snapM.empty) {
          for (const d of snapM.docs) {
            const mData = d.data();
            const name = (mData.fullName || '').trim();
            if (name) {
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

    if (cleanStudentCode.length > 20) {
      toast.error(`Mã số sinh viên "${cleanStudentCode}" không hợp lệ. Vui lòng kiểm tra lại!`);
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

      // 3. XÁC THỰC MÃ SINH VIÊN (CHỈ CẦN MSSV - KHÔNG BẮT ĐĂNG NHẬP)
      let finalFullName = '';
      let studentUid: string | null = null;
      let userProfileData: any = {};

      // 3.1. Tìm trong collection users
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

      // 3.2. Tìm trong classMembers
      if (!studentUid || !finalFullName) {
        try {
          const snapM = await getDocs(
            query(collection(db, 'classMembers'), where('studentCode', '==', cleanStudentCode))
          );
          if (!snapM.empty) {
            for (const mDoc of snapM.docs) {
              const mData = mDoc.data();
              const fName = (mData.fullName || '').trim();
              if (fName) {
                studentUid = mData.userId || mDoc.id;
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

      // 3.3. Nếu chưa có sẵn trong danh sách, vẫn ghi nhận điểm danh theo MSSV (Không bắt đăng nhập)
      if (!finalFullName) {
        finalFullName = `Sinh viên ${cleanStudentCode}`;
      }
      if (!studentUid) {
        studentUid = `sv_${cleanStudentCode.toLowerCase()}`;
      }

      // Tự động ghi nhận/cập nhật sinh viên vào thành viên lớp
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
        const existingData = existingAtt.data();
        setResult({
          studentName: existingData.studentName || finalFullName,
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
          checkInTime: existingData.checkInTime || checkInTimeStr,
          alreadyMarked: true,
        });

        toast.info(`Bạn đã điểm danh buổi học này rồi (${existingData.checkInTime || checkInTimeStr})`);
        setSubmitting(false);
        return;
      }

      // 5. GHI NHẬN ĐIỂM DANH VÀO FIRESTORE
      const attendanceRecord = {
        sessionId: targetSession.id,
        classId: classId,
        studentId: studentUid,
        studentCode: cleanStudentCode,
        studentName: finalFullName,
        status: 'present',
        method: 'code',
        checkInTime: checkInTimeStr,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(attRef, attendanceRecord);

      // Gửi thông báo Telegram nếu được cấu hình
      try {
        await sendAttendanceTelegramNotification({
          studentName: finalFullName,
          studentCode: cleanStudentCode,
          className: classDoc?.className || 'Lớp học',
          sessionTitle: targetSession.title || 'Buổi học',
          checkInTime: checkInTimeStr,
          status: 'present',
        });
      } catch (teleErr) {
        console.warn('Lỗi gửi Telegram:', teleErr);
      }

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
      {/* Main Content (Không có header ngoài, không có nút Đăng nhập) */}
      <main className="max-w-md w-full mx-auto my-auto py-4">
        {!result ? (
          /* Check-In Form Card */
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 text-slate-800 border border-slate-100">
            {/* Header Branding with Logo */}
            <div className="text-center space-y-2 mb-6">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-white p-2 shadow-lg shadow-indigo-100 border border-slate-100 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Logo Trường Cao Đẳng Nghề NSG"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 block">
                  Trường Cao Đẳng Nghề NSG
                </span>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mt-0.5">
                  Hệ Thống Điểm Danh Sinh Viên
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
                    <span>Sinh viên: <strong>{referencedName}</strong></span>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Chỉ cần nhập MSSV của bạn, không cần tài khoản hay mật khẩu đăng nhập.
                  </p>
                )}
              </div>

              {/* MÃ ĐIỂM DANH */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Mã điểm danh (6 chữ số)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={attendanceCode}
                    onChange={(e) => setAttendanceCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="• • • • • •"
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono font-black text-center text-xl tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-300 placeholder:text-sm"
                    required
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <QrCode className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Nhập mã số 6 chữ số do Giảng viên cung cấp tại lớp học.
                </p>
              </div>

              {/* Nút bấm điểm danh */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] mt-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang xác nhận điểm danh...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Xác Nhận Có Mặt</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Success Result Card */
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 text-slate-800 border border-slate-100 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-100">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 block">
                {result.alreadyMarked ? 'Đã Ghi Nhận Trước Đó' : 'Điểm Danh Thành Công!'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                {result.studentName}
              </h2>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2.5 text-left border border-slate-100">
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
      <footer className="text-center py-3 space-y-2.5">
        <div>
          <Link
            href="/trac-nghiem"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/90 border border-slate-200 text-xs font-bold text-blue-600 shadow-sm hover:bg-blue-50 hover:border-blue-300 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Ôn thi Trắc nghiệm CNTT Cơ bản (300 câu)</span>
          </Link>
        </div>
        <div className="text-xs font-medium text-slate-400">
          Phát triển bởi: Thầy Nguyễn Trọng Nghĩa
        </div>
      </footer>
    </div>
  );
}

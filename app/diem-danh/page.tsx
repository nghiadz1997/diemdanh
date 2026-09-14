'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ClassItem, LessonSession } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  GraduationCap,
  CalendarCheck,
  CheckCircle2,
  Loader2,
  Clock,
  ArrowRight,
  RotateCcw,
  Sparkles,
  BookOpen,
  UserCheck,
  QrCode,
} from 'lucide-react';
import { toast } from 'sonner';

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

export default function PublicAttendancePortalPage() {
  const [studentCode, setStudentCode] = useState('');
  const [attendanceCode, setAttendanceCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttendanceResult | null>(null);

  const [referencedName, setReferencedName] = useState<string | null>(null);

  // Tự động tham chiếu tên sinh viên bằng Mã sinh viên khi người dùng đang nhập
  useEffect(() => {
    const clean = studentCode.trim().toUpperCase();
    if (clean.length < 2) {
      setReferencedName(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        // 1. Tìm trong classMembers
        const snapM = await getDocs(
          query(collection(db, 'classMembers'), where('studentCode', '==', clean))
        );
        if (!snapM.empty) {
          setReferencedName(snapM.docs[0].data().fullName);
          return;
        }

        // 2. Tìm trong users
        const snapU = await getDocs(
          query(collection(db, 'users'), where('studentCode', '==', clean))
        );
        if (!snapU.empty) {
          const uData = snapU.docs[0].data();
          setReferencedName(uData.fullName || uData.displayName);
          return;
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

    if (cleanAttendanceCode.length !== 6) {
      toast.error('Vui lòng nhập đầy đủ 6 chữ số mã điểm danh do giảng viên cung cấp trên lớp');
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

      // Ưu tiên buổi học đang mở điểm danh
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

      if (!classDoc) {
        classDoc = { id: classId, className: 'Lớp học', classCode: 'NSG' };
      }

      // 3. THAM CHIẾU TÊN SINH VIÊN VÀ THÔNG TIN DỰA VÀO MÃ SINH VIÊN
      // Không tìm thấy trường mã sinh viên thì vẫn cho điểm danh bình thường (không chặn)!
      let studentInfo: {
        fullName: string;
        studentCode: string;
        gender?: string;
        dateOfBirth?: string;
        phone?: string;
        cccd?: string;
        placeOfBirth?: string;
        hometown?: string;
        permanentAddress?: string;
        userId?: string;
      } | null = null;

      // 3.1. Tìm trong classMembers của lớp này
      try {
        const snapMClass = await getDocs(
          query(
            collection(db, 'classMembers'),
            where('classId', '==', classId),
            where('studentCode', '==', cleanStudentCode)
          )
        );
        if (!snapMClass.empty) {
          const mData = snapMClass.docs[0].data();
          studentInfo = {
            fullName: mData.fullName,
            studentCode: mData.studentCode || cleanStudentCode,
            gender: mData.gender,
            dateOfBirth: mData.dateOfBirth,
            phone: mData.phone,
            cccd: mData.cccd,
            placeOfBirth: mData.placeOfBirth,
            hometown: mData.hometown,
            permanentAddress: mData.permanentAddress,
            userId: mData.userId || snapMClass.docs[0].id,
          };
        }
      } catch (errM1) {
        console.warn('Lỗi tìm classMembers theo lớp:', errM1);
      }

      // 3.2. Nếu chưa thấy trong lớp này, tìm trong toàn bộ classMembers hệ thống
      if (!studentInfo) {
        try {
          const snapAllM = await getDocs(
            query(collection(db, 'classMembers'), where('studentCode', '==', cleanStudentCode))
          );
          if (!snapAllM.empty) {
            const mData = snapAllM.docs[0].data();
            studentInfo = {
              fullName: mData.fullName,
              studentCode: mData.studentCode || cleanStudentCode,
              gender: mData.gender,
              dateOfBirth: mData.dateOfBirth,
              phone: mData.phone,
              cccd: mData.cccd,
              placeOfBirth: mData.placeOfBirth,
              hometown: mData.hometown,
              permanentAddress: mData.permanentAddress,
              userId: mData.userId || snapAllM.docs[0].id,
            };
          }
        } catch (errM2) {
          console.warn('Lỗi tìm toàn bộ classMembers:', errM2);
        }
      }

      // 3.3. Nếu vẫn chưa thấy, tìm trong bộ sưu tập users
      if (!studentInfo) {
        const userQueries = [
          query(collection(db, 'users'), where('studentCode', '==', cleanStudentCode)),
          query(collection(db, 'users'), where('studentCode', '==', studentCode.trim())),
          query(collection(db, 'users'), where('studentCode', '==', studentCode.trim().toLowerCase())),
          query(collection(db, 'users'), where('email', '==', studentCode.trim().toLowerCase())),
        ];
        for (const uQ of userQueries) {
          try {
            const uSnap = await getDocs(uQ);
            if (!uSnap.empty) {
              const uData = uSnap.docs[0].data();
              studentInfo = {
                fullName: uData.fullName || uData.displayName,
                studentCode: uData.studentCode || cleanStudentCode,
                gender: uData.gender,
                dateOfBirth: uData.dateOfBirth,
                phone: uData.phone,
                cccd: uData.cccd,
                placeOfBirth: uData.placeOfBirth,
                hometown: uData.hometown,
                permanentAddress: uData.permanentAddress,
                userId: uSnap.docs[0].id,
              };
              break;
            }
          } catch (uErr) {
            console.warn('Lỗi tìm users:', uErr);
          }
        }
      }

      // 3.4. THAM CHIẾU TÊN HOẶC TỰ ĐỘNG KHỞI TẠO TÊN (BỎ CHẶN KHI KHÔNG TÌM THẤY TRƯỜNG MÃ SV)
      const finalFullName = studentInfo?.fullName || `Sinh viên ${cleanStudentCode}`;
      const finalUserId = studentInfo?.userId || `sv_${cleanStudentCode}`;
      const finalGender = studentInfo?.gender || '';
      const finalDob = studentInfo?.dateOfBirth || '';
      const finalPhone = studentInfo?.phone || '';
      const finalCccd = studentInfo?.cccd || '';
      const finalPlaceOfBirth = studentInfo?.placeOfBirth || '';
      const finalHometown = studentInfo?.hometown || '';
      const finalPermanentAddress = studentInfo?.permanentAddress || '';

      // Tự động thêm/cập nhật sinh viên vào danh sách thành viên lớp classMembers để giảng viên thấy
      try {
        const memberKey = `${classId}_${cleanStudentCode}`;
        const memRef = doc(db, 'classMembers', memberKey);
        await setDoc(
          memRef,
          {
            classId: classId,
            userId: finalUserId,
            studentCode: cleanStudentCode,
            fullName: finalFullName,
            gender: finalGender,
            dateOfBirth: finalDob,
            phone: finalPhone,
            cccd: finalCccd,
            placeOfBirth: finalPlaceOfBirth,
            hometown: finalHometown,
            permanentAddress: finalPermanentAddress,
            active: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (memErr) {
        console.warn('Tự động ghi nhận thành viên lớp:', memErr);
      }

      // 4. KIỂM TRA XEM ĐÃ ĐIỂM DANH BUỔI HỌC NÀY CHƯA (theo Mã SV + Buổi học)
      const attendanceDocId = `${targetSession.id}_${cleanStudentCode}`;
      const attendanceRef = doc(db, 'attendance', attendanceDocId);
      const existingAttendanceSnap = await getDoc(attendanceRef);

      const nowTimeStr = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      if (existingAttendanceSnap.exists()) {
        const existingData = existingAttendanceSnap.data();
        const prevTime = existingData.checkInTime || existingData.createdAt;
        const prevTimeStr = prevTime ? formatDate(prevTime) : nowTimeStr;

        setResult({
          studentName: finalFullName,
          studentCode: cleanStudentCode,
          gender: finalGender,
          dateOfBirth: finalDob,
          phone: finalPhone,
          cccd: finalCccd,
          placeOfBirth: finalPlaceOfBirth,
          hometown: finalHometown,
          permanentAddress: finalPermanentAddress,
          className: classDoc.className,
          classCode: classDoc.classCode,
          sessionTitle: targetSession.title || 'Buổi học',
          checkInTime: prevTimeStr,
          alreadyMarked: true,
        });

        toast.info(
          `Sinh viên ${finalFullName} (${cleanStudentCode}) đã được điểm danh CÓ MẶT trong buổi học này trước đó!`
        );
        return;
      }

      // 5. GHI NHẬN ĐIỂM DANH: CÓ MẶT (CÓ ĐI HỌC)
      await setDoc(attendanceRef, {
        sessionId: targetSession.id,
        sessionTitle: targetSession.title || 'Buổi học',
        classId: classId,
        className: classDoc.className,
        classCode: classDoc.classCode,
        userId: finalUserId,
        studentCode: cleanStudentCode,
        studentName: finalFullName,
        gender: finalGender || null,
        dateOfBirth: finalDob || null,
        phone: finalPhone || null,
        cccd: finalCccd || null,
        placeOfBirth: finalPlaceOfBirth || null,
        hometown: finalHometown || null,
        permanentAddress: finalPermanentAddress || null,
        status: 'present', // Ghi nhận CÓ ĐI HỌC
        method: 'portal',
        checkInTime: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      setResult({
        studentName: finalFullName,
        studentCode: cleanStudentCode,
        gender: finalGender,
        dateOfBirth: finalDob,
        phone: finalPhone,
        cccd: finalCccd,
        placeOfBirth: finalPlaceOfBirth,
        hometown: finalHometown,
        permanentAddress: finalPermanentAddress,
        className: classDoc.className,
        classCode: classDoc.classCode,
        sessionTitle: targetSession.title || 'Buổi học',
        checkInTime: nowTimeStr,
        alreadyMarked: false,
      });

      toast.success(
        `Điểm danh thành công! ${finalFullName} (${cleanStudentCode}) - ĐÃ XÁC NHẬN CÓ ĐI HỌC.`
      );
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6">
      {/* Main Content */}
      <main className="max-w-md w-full mx-auto my-auto py-6">
        {!result ? (
          /* Check-In Form Card */
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-800 border border-white/20 animate-in fade-in zoom-in-95">
            {/* Header Branding with New Logo */}
            <div className="text-center space-y-2 mb-6">
              <div className="w-24 h-24 mx-auto rounded-3xl bg-white p-2 shadow-lg shadow-indigo-500/10 ring-4 ring-indigo-50 flex items-center justify-center">
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

                {referencedName && (
                  <div className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold animate-in fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>
                      Họ và tên: <strong className="text-emerald-950 font-bold">{referencedName}</strong>
                    </span>
                  </div>
                )}
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
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-800 border border-white/20 text-center space-y-6 animate-in zoom-in-95">
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
      <footer className="text-center py-4 text-xs font-medium text-slate-400">
        Phát triển bởi: Thầy Nguyễn Trọng Nghĩa
      </footer>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { QrCode, CheckCircle2, AlertCircle, Loader2, Clock, School, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function StudentAttendancePage() {
  const { profile } = useAuth();
  const [attendanceCode, setAttendanceCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    className: string;
    sessionTitle: string;
    checkInTime: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = attendanceCode.replace(/\s/g, '');
    if (cleanCode.length !== 6) {
      toast.error('Vui lòng nhập đầy đủ 6 chữ số mã điểm danh');
      return;
    }

    if (!profile?.uid) {
      toast.error('Phiên làm việc hết hạn hoặc không tìm thấy sinh viên. Vui lòng đăng nhập lại');
      return;
    }

    setLoading(true);
    try {
      // 1. Find session with attendanceCode and attendanceOpen == true
      const sessionsRef = collection(db, 'sessions');
      const qSession = query(
        sessionsRef,
        where('attendanceCode', '==', cleanCode),
        where('attendanceOpen', '==', true)
      );
      const sessionSnap = await getDocs(qSession);

      if (sessionSnap.empty) {
        throw new Error('Mã điểm danh không đúng hoặc buổi học chưa mở điểm danh');
      }

      const sessionDoc = sessionSnap.docs[0];
      const sessionData = sessionDoc.data();
      const activeSessionId = sessionDoc.id;
      const classId = sessionData.classId;

      // 2. Check expiration
      if (sessionData.codeExpiresAt) {
        const expiresAt = sessionData.codeExpiresAt?.toMillis
          ? sessionData.codeExpiresAt.toMillis()
          : new Date(sessionData.codeExpiresAt).getTime();
        if (expiresAt && Date.now() > expiresAt) {
          throw new Error('Mã điểm danh đã hết hạn');
        }
      }

      // 3. Check membership
      const memberDocId = `${classId}_${profile.uid}`;
      const memberRef = doc(db, 'classMembers', memberDocId);
      const memberSnap = await getDoc(memberRef);

      let isMember = memberSnap.exists();
      if (!isMember && profile.studentCode) {
        const memberQ = query(
          collection(db, 'classMembers'),
          where('classId', '==', classId),
          where('studentCode', '==', profile.studentCode)
        );
        const memberQSnap = await getDocs(memberQ);
        if (!memberQSnap.empty) {
          isMember = true;
        }
      }

      if (!isMember) {
        throw new Error('Bạn không có tên trong danh sách lớp học này');
      }

      // 4. Check existing attendance
      const attendanceDocId = `${activeSessionId}_${profile.uid}`;
      const attendanceRef = doc(db, 'attendance', attendanceDocId);
      const existingAttendance = await getDoc(attendanceRef);

      if (existingAttendance.exists()) {
        throw new Error('Bạn đã điểm danh buổi học này rồi');
      }

      // 5. Get class name
      let className = 'Lớp học';
      try {
        const classSnap = await getDoc(doc(db, 'classes', classId));
        if (classSnap.exists()) {
          className = classSnap.data()?.className || className;
        }
      } catch (err) {
        console.warn('Không thể tải tên lớp:', err);
      }

      // 6. Save attendance
      await setDoc(attendanceRef, {
        sessionId: activeSessionId,
        classId,
        userId: profile.uid,
        studentCode: profile.studentCode || '',
        studentName: profile.fullName || 'Sinh viên',
        status: 'present',
        checkInTime: serverTimestamp(),
        method: 'code',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setResult({
        className,
        sessionTitle: sessionData.title || 'Buổi học',
        checkInTime: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      });
      toast.success('Điểm danh thành công!');
      setAttendanceCode('');
    } catch (err: any) {
      console.error('Lỗi check-in:', err);
      toast.error(err.message || 'Lỗi khi điểm danh');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-6 sm:py-10 space-y-6">
      {/* Header Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-200 ring-4 ring-white">
          <QrCode className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          Điểm danh buổi học
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Nhập mã 6 số do giảng viên hiển thị trên màn hình lớp
        </p>
      </div>

      {result ? (
        /* Success State */
        <div className="bg-white rounded-3xl p-8 shadow-card border border-emerald-100 text-center space-y-5 animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Có mặt
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-2">
              Điểm danh thành công!
            </h2>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-2 text-xs border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Mã sinh viên:</span>
              <span className="font-mono font-bold text-slate-800">{profile?.studentCode}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Họ và tên:</span>
              <span className="font-semibold text-slate-800">{profile?.fullName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Lớp học:</span>
              <span className="font-semibold text-indigo-600">{result.className}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Buổi học:</span>
              <span className="font-medium text-slate-700">{result.sessionTitle}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
              <span className="text-slate-500">Thời gian ghi nhận:</span>
              <span className="font-bold text-slate-800">{result.checkInTime}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => setResult(null)}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl text-xs transition-colors"
            >
              Điểm danh buổi học khác
            </button>
            <Link
              href="/sinh-vien/lich-su-diem-danh"
              className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-indigo-600 hover:underline pt-2"
            >
              <span>Xem lịch sử chuyên cần của bạn</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        /* Form State */
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-slate-200/80 space-y-6">
          {/* Current Student Badge */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 block">
                Mã sinh viên xác nhận
              </span>
              <span className="text-sm font-black font-mono text-indigo-900">
                {profile?.studentCode || 'Đang cập nhật...'}
              </span>
            </div>
            <span className="text-xs font-semibold text-slate-700">
              {profile?.fullName}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-center text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                Nhập mã điểm danh
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={attendanceCode}
                onChange={(e) => setAttendanceCode(e.target.value.replace(/\D/g, ''))}
                placeholder="------"
                className="w-full text-center text-3xl sm:text-4xl tracking-[0.4em] font-mono font-black py-4 bg-slate-50 border-2 border-indigo-200 focus:border-indigo-600 rounded-2xl focus:outline-none focus:bg-white text-slate-900 transition-all placeholder:text-slate-300"
                required
                autoFocus
              />
              <p className="text-center text-[11px] text-slate-400 mt-2">
                Mã gồm 6 chữ số ngẫu nhiên do giảng viên cung cấp
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || attendanceCode.length !== 6}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang xác nhận mã điểm danh...</span>
                </>
              ) : (
                <span>XÁC NHẬN ĐIỂM DANH</span>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getClassById, getClassMembers } from '@/services/classService';
import { getSessionById, updateManualAttendance } from '@/services/attendanceService';
import { ClassItem, LessonSession, ClassMember, AttendanceRecord, AttendanceStatus } from '@/types';
import { formatDate, getAttendanceStatusBadge, compareVietnameseNames } from '@/lib/utils';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Users,
  ArrowLeft,
  Loader2,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function TeacherAttendanceDashboardPage() {
  const params = useParams();
  const classId = params.classId as string;
  const sessionId = params.sessionId as string;
  const { user } = useAuth();

  const [classData, setClassData] = useState<ClassItem | null>(null);
  const [sessionData, setSessionData] = useState<LessonSession | null>(null);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    async function initData() {
      try {
        const [cData, sData, cMembers] = await Promise.all([
          getClassById(classId),
          getSessionById(sessionId),
          getClassMembers(classId),
        ]);
        setClassData(cData);
        setSessionData(sData);
        setMembers(cMembers);
      } catch (err) {
        console.error('Lỗi tải dữ liệu:', err);
        toast.error('Không thể tải thông tin phiên điểm danh');
      } finally {
        setLoading(false);
      }
    }

    if (classId && sessionId) {
      initData();
    }
  }, [classId, sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const q = query(collection(db, 'attendance'), where('sessionId', '==', sessionId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as AttendanceRecord)
        );
        setAttendanceRecords(records);
      },
      (error) => {
        console.error('Lỗi lắng nghe điểm danh:', error);
      }
    );

    return () => unsubscribe();
  }, [sessionId]);

  const studentRows = members.map((m) => {
    const record = attendanceRecords.find(
      (a) =>
        (a.studentCode && m.studentCode && a.studentCode.toUpperCase() === m.studentCode.toUpperCase()) ||
        (a.userId && a.userId === m.userId)
    );
    return {
      member: m,
      record: record || null,
      status: record ? record.status : ('absent' as AttendanceStatus),
      checkInTime: record?.checkInTime,
      method: record?.method || 'manual',
    };
  });

  // Tìm các sinh viên điểm danh qua cổng mà chưa có trong danh sách thành viên ban đầu
  const existingCodes = new Set(members.map((m) => m.studentCode?.toUpperCase()).filter(Boolean));
  const existingUids = new Set(members.map((m) => m.userId).filter(Boolean));

  const extraRows = attendanceRecords
    .filter(
      (a) =>
        (!a.studentCode || !existingCodes.has(a.studentCode.toUpperCase())) &&
        (!a.userId || !existingUids.has(a.userId))
    )
    .map((a) => ({
      member: {
        id: a.id,
        classId: a.classId || classId,
        userId: a.userId || a.studentCode,
        studentCode: a.studentCode,
        fullName: a.studentName || 'Sinh viên ' + a.studentCode,
        gender: (a as any).gender,
        dateOfBirth: (a as any).dateOfBirth,
        phone: (a as any).phone,
        active: true,
      } as unknown as ClassMember,
      record: a,
      status: a.status || ('present' as AttendanceStatus),
      checkInTime: a.checkInTime || a.createdAt,
      method: a.method || 'portal',
    }));

  // Sắp xếp toàn bộ danh sách sinh viên theo thứ tự bảng chữ cái A, B, C (Tên chính, sau đó Họ và Tên đệm)
  const allRows = [...studentRows, ...extraRows].sort((a, b) => {
    const nameA = a.member.fullName || (a.member as any).user?.fullName || '';
    const nameB = b.member.fullName || (b.member as any).user?.fullName || '';
    const cmp = compareVietnameseNames(nameA, nameB);
    if (cmp !== 0) return cmp;
    const codeA = a.member.studentCode || (a.member as any).user?.studentCode || '';
    const codeB = b.member.studentCode || (b.member as any).user?.studentCode || '';
    return codeA.localeCompare(codeB);
  });

  const totalStudents = allRows.length;
  const presentCount = allRows.filter((r) => r.status === 'present').length;
  const lateCount = allRows.filter((r) => r.status === 'late').length;
  const excusedCount = allRows.filter((r) => r.status === 'excused').length;
  const absentCount = totalStudents - presentCount - lateCount - excusedCount;
  const attendanceRate =
    totalStudents > 0
      ? Math.round(((presentCount + lateCount) / totalStudents) * 100)
      : 0;

  const filteredRows = allRows.filter((r) => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  const handleManualChange = async (
    userId: string,
    studentCode: string,
    studentName: string,
    newStatus: AttendanceStatus
  ) => {
    try {
      await updateManualAttendance({
        sessionId,
        classId,
        userId,
        studentCode,
        studentName,
        status: newStatus,
        markedBy: user?.uid || 'teacher',
      });
      toast.success('Đã cập nhật trạng thái: ' + newStatus);
    } catch (err) {
      toast.error('Lỗi khi cập nhật điểm danh');
    }
  };

  const handleDeleteRecord = async (recordId: string, studentCode: string) => {
    if (!confirm(`Bạn có chắc muốn xóa bản ghi điểm danh của sinh viên ${studentCode}?`)) return;
    try {
      await deleteDoc(doc(db, 'attendance', recordId));
      toast.success(`Đã xóa điểm danh của SV ${studentCode}`);
    } catch (err) {
      toast.error('Lỗi khi xóa điểm danh');
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
        <p className="text-xs font-medium">Đang tải bảng điểm danh...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={'/giang-vien/lop-hoc/' + classId + '/buoi-hoc'}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại danh sách buổi học</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {classData?.classCode}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {sessionData && formatDate(sessionData.date, 'dd/MM/yyyy')}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Bảng điểm danh: {sessionData?.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Dữ liệu Realtime
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-200/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Tổng sinh viên
          </span>
          <span className="text-2xl font-black text-slate-800 mt-1 block">
            {totalStudents}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-card border border-emerald-100 bg-emerald-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
            Có mặt
          </span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">
            {presentCount}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-card border border-amber-100 bg-amber-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">
            Đi trễ
          </span>
          <span className="text-2xl font-black text-amber-700 mt-1 block">
            {lateCount}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-card border border-rose-100 bg-rose-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block">
            Vắng mặt
          </span>
          <span className="text-2xl font-black text-rose-700 mt-1 block">
            {absentCount}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-card border border-blue-100 bg-blue-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
            Có phép
          </span>
          <span className="text-2xl font-black text-blue-700 mt-1 block">
            {excusedCount}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-card border border-indigo-100 bg-indigo-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block">
            Tỷ lệ có mặt
          </span>
          <span className="text-2xl font-black text-indigo-700 mt-1 block">
            {attendanceRate}%
          </span>
        </div>
      </div>

      <div className="bg-white p-3 rounded-2xl shadow-card border border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { key: 'all', label: 'Tất cả (' + studentRows.length + ')' },
            { key: 'present', label: 'Có mặt (' + presentCount + ')' },
            { key: 'late', label: 'Đi trễ (' + lateCount + ')' },
            { key: 'absent', label: 'Vắng (' + absentCount + ')' },
            { key: 'excused', label: 'Có phép (' + excusedCount + ')' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ' + (
                filterStatus === tab.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Không có dữ liệu phù hợp</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3.5 text-center w-10">STT</th>
                  <th className="px-4 py-3.5">Mã SV</th>
                  <th className="px-4 py-3.5">Họ và tên</th>
                  <th className="px-3 py-3.5">Giới tính</th>
                  <th className="px-3 py-3.5">Ngày sinh</th>
                  <th className="px-3 py-3.5">Số điện thoại</th>
                  <th className="px-4 py-3.5">Lớp đang học</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="px-4 py-3.5">Thời gian ghi nhận</th>
                  <th className="px-4 py-3.5 text-right">Điều chỉnh thủ công</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((r, index) => {
                  const badge = getAttendanceStatusBadge(r.status);
                  const studentName = r.member.user?.fullName || 'Sinh viên';
                  const studentCode = r.member.studentCode || r.member.user?.studentCode || '--';
                  const studentGender = r.member.user?.gender || 'Nam';
                  const studentBirth = r.member.user?.dateOfBirth || '--';
                  const studentPhone = r.member.user?.phone || '--';

                  return (
                    <tr key={r.member.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-3.5 text-center font-bold text-slate-400">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-indigo-600">
                        {studentCode}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {studentName}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          studentGender === 'Nữ'
                            ? 'bg-pink-50 text-pink-700 border border-pink-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {studentGender}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-slate-600 font-medium">
                        {studentBirth}
                      </td>
                      <td className="px-3 py-3.5 font-mono text-slate-600">
                        {studentPhone}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 font-medium">
                        <span className="px-2 py-1 bg-slate-100 rounded-lg text-slate-700 text-[11px] font-semibold">
                          {classData?.className || classData?.classCode}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ' + badge.className}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 font-mono">
                        {r.checkInTime ? formatDate(r.checkInTime, 'HH:mm:ss dd/MM') : '--'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                          <button
                            onClick={() =>
                              handleManualChange(r.member.userId, studentCode, studentName, 'present')
                            }
                            className={'px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ' + (
                              r.status === 'present'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-emerald-700'
                            )}
                          >
                            Có mặt
                          </button>
                          <button
                            onClick={() =>
                              handleManualChange(r.member.userId, studentCode, studentName, 'late')
                            }
                            className={'px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ' + (
                              r.status === 'late'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-amber-700'
                            )}
                          >
                            Trễ
                          </button>
                          <button
                            onClick={() =>
                              handleManualChange(r.member.userId, studentCode, studentName, 'excused')
                            }
                            className={'px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ' + (
                              r.status === 'excused'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-blue-700'
                            )}
                          >
                            Phép
                          </button>
                          <button
                            onClick={() =>
                              handleManualChange(r.member.userId, studentCode, studentName, 'absent')
                            }
                            className={'px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ' + (
                              r.status === 'absent'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-rose-700'
                            )}
                          >
                            Vắng
                          </button>
                          {r.record && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(r.record!.id, studentCode)}
                              className="px-1.5 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Xóa lượt điểm danh này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

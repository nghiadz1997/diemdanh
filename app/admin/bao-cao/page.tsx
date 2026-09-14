'use client';

import { useEffect, useState } from 'react';
import { getStudents } from '@/services/studentService';
import { getClasses } from '@/services/classService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile, ClassItem, AttendanceRecord } from '@/types';
import { Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export default function AdminReportsPage() {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [sList, cList, aSnap] = await Promise.all([
          getStudents(),
          getClasses(),
          getDocs(collection(db, 'attendance')),
        ]);
        setStudents(sList);
        setClasses(cList);
        setAttendance(aSnap.docs.map((d) => d.data() as AttendanceRecord));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const reportRows = students
    .filter((s) => (selectedClassId ? s.classIds?.includes(selectedClassId) : true))
    .map((s) => {
      const studentAtt = attendance.filter((a) => a.userId === s.uid);
      const totalSessions = studentAtt.length || 1;
      const present = studentAtt.filter((a) => a.status === 'present').length;
      const late = studentAtt.filter((a) => a.status === 'late').length;
      const excused = studentAtt.filter((a) => a.status === 'excused').length;
      const absent = studentAtt.filter((a) => a.status === 'absent').length;
      const rate = Math.round(((present + late) / totalSessions) * 100);

      const targetClass = classes.find((c) => s.classIds?.includes(c.id));

      return {
        studentCode: s.studentCode || '--',
        fullName: s.fullName,
        className: targetClass ? targetClass.className : 'Chưa phân lớp',
        totalSessions,
        present,
        late,
        absent,
        excused,
        rate: rate + '%',
      };
    });

  const handleExportExcel = () => {
    const exportData = reportRows.map((r) => ({
      'Mã sinh viên': r.studentCode,
      'Họ tên': r.fullName,
      'Lớp': r.className,
      'Số buổi': r.totalSessions,
      'Có mặt': r.present,
      'Đi trễ': r.late,
      'Vắng': r.absent,
      'Có phép': r.excused,
      'Tỷ lệ chuyên cần': r.rate,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BaoCaoChuyenCan');
    XLSX.writeFile(wb, 'Bao_cao_chuyen_can_' + Date.now() + '.xlsx');
    toast.success('Đã tải xuống tệp báo cáo Excel');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Báo cáo & Thống kê Chuyên cần
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Tổng hợp dữ liệu điểm danh, vắng mặt và trích xuất file Excel
          </p>
        </div>
        <button
          onClick={handleExportExcel}
          disabled={reportRows.length === 0}
          className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl flex items-center gap-2 shadow-md shadow-emerald-100 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Xuất báo cáo Excel (.xlsx)</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-3xl shadow-card border border-slate-200/80 flex items-center gap-3">
        <span className="text-xs font-bold text-slate-600">Lọc theo lớp:</span>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="py-2 px-3 bg-slate-50 border rounded-xl text-xs font-medium text-slate-700"
        >
          <option value="">Tất cả các lớp học</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.classCode} - {c.className}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Mã SV</th>
                  <th className="px-4 py-3">Họ và tên</th>
                  <th className="px-4 py-3">Lớp</th>
                  <th className="px-4 py-3 text-center">Số buổi</th>
                  <th className="px-4 py-3 text-center text-emerald-600">Có mặt</th>
                  <th className="px-4 py-3 text-center text-amber-600">Trễ</th>
                  <th className="px-4 py-3 text-center text-rose-600">Vắng</th>
                  <th className="px-4 py-3 text-center text-blue-600">Phép</th>
                  <th className="px-4 py-3 text-right">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportRows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600">{r.studentCode}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{r.fullName}</td>
                    <td className="px-4 py-3 text-slate-600">{r.className}</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800">{r.totalSessions}</td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-600">{r.present}</td>
                    <td className="px-4 py-3 text-center font-bold text-amber-600">{r.late}</td>
                    <td className="px-4 py-3 text-center font-bold text-rose-600">{r.absent}</td>
                    <td className="px-4 py-3 text-center font-bold text-blue-600">{r.excused}</td>
                    <td className="px-4 py-3 text-right font-black text-indigo-600">{r.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

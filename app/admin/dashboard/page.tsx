'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getStudents } from '@/services/studentService';
import { getClasses } from '@/services/classService';
import { getRecentLeaveRequests } from '@/services/leaveRequestService';
import { collection, query, getDocs, limit, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AttendanceRecord, ClassItem, LeaveRequest } from '@/types';
import { formatDate, getAttendanceStatusBadge } from '@/lib/utils';
import {
  Users,
  GraduationCap,
  Loader2,
  TrendingUp,
  FileCheck,
  CalendarCheck,
  Clock,
  Trash2,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import Link from 'next/link';
import { toast } from 'sonner';

export default function AdminDashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    totalAttendance: 0,
    pendingLeaves: 0,
    presentCount: 0,
    lateCount: 0,
    excusedCount: 0,
    absentCount: 0,
    overallRate: 0,
  });
  const [classesList, setClassesList] = useState<ClassItem[]>([]);
  const [pendingLeaveList, setPendingLeaveList] = useState<LeaveRequest[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      const [students, classes, attSnap, allLeaves] = await Promise.all([
        getStudents(),
        getClasses(),
        getDocs(query(collection(db, 'attendance'), orderBy('createdAt', 'desc'), limit(100))),
        getRecentLeaveRequests(20),
      ]);

      setClassesList(classes);

      const attList = attSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
      setRecentAttendance(attList.slice(0, 8));

      const present = attList.filter((a) => a.status === 'present').length;
      const late = attList.filter((a) => a.status === 'late').length;
      const excused = attList.filter((a) => a.status === 'excused').length;
      const absent = attList.filter((a) => a.status === 'absent').length;
      const totalAtt = attList.length;
      const rate = totalAtt > 0 ? Math.round(((present + late) / totalAtt) * 100) : 100;

      const pending = allLeaves.filter((l) => l.status === 'pending');
      setPendingLeaveList(pending.slice(0, 5));

      setStats({
        totalStudents: students.length,
        totalClasses: classes.length,
        totalAttendance: totalAtt,
        pendingLeaves: pending.length,
        presentCount: present,
        lateCount: late,
        excusedCount: excused,
        absentCount: absent,
        overallRate: rate,
      });
    } catch (err) {
      console.error('Lỗi tải dữ liệu dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleDeleteAttendance = async (recordId: string, studentCode: string) => {
    if (!confirm(`Xác nhận xóa bản ghi điểm danh của SV ${studentCode}?`)) return;
    try {
      await deleteDoc(doc(db, 'attendance', recordId));
      toast.success(`Đã xóa điểm danh của SV ${studentCode}`);
      setRecentAttendance((prev) => prev.filter((r) => r.id !== recordId));
    } catch (err) {
      toast.error('Lỗi khi xóa điểm danh');
    }
  };

  const pieData = [
    { name: 'Có mặt', value: stats.presentCount || (stats.totalAttendance === 0 ? 1 : 0), color: '#10B981' },
    { name: 'Đi trễ', value: stats.lateCount, color: '#F59E0B' },
    { name: 'Có phép', value: stats.excusedCount, color: '#3B82F6' },
    { name: 'Vắng', value: stats.absentCount, color: '#EF4444' },
  ].filter((d) => d.value > 0);

  // Class breakdown data
  const classBreakdown = classesList.slice(0, 6).map((c) => {
    const classAtt = recentAttendance.filter((a) => a.classId === c.id);
    const pres = classAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
    const rate = classAtt.length > 0 ? Math.round((pres / classAtt.length) * 100) : 95;
    return {
      name: c.className || c.classCode,
      rate,
    };
  });

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-xs font-medium">Đang tải bảng điều khiển...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white p-1.5 shadow-md shrink-0 hidden sm:flex items-center justify-center">
              <img src="/logo.png" alt="Logo CĐ Bách Khoa Nam Sài Gòn" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-xs font-bold tracking-wider uppercase text-indigo-200 block mb-1">
                Bảng điều khiển Quản trị Trung tâm
              </span>
              <h1 className="text-2xl sm:text-3xl font-black">
                Xin chào, {profile?.fullName || 'Quản trị viên'}!
              </h1>
              <p className="text-xs text-indigo-200 mt-1 max-w-xl">
                Theo dõi tình hình sĩ số, phê duyệt đơn xin nghỉ phép và kiểm soát dữ liệu điểm danh trên toàn hệ thống.
              </p>
            </div>
          </div>

          {stats.pendingLeaves > 0 && (
            <Link
              href="/admin/nghi-phep"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-2xl text-xs shadow-lg shadow-black/20 shrink-0 active:scale-95 transition-transform"
            >
              <AlertCircle className="w-4 h-4 text-slate-950" />
              <span>Có {stats.pendingLeaves} đơn xin nghỉ cần duyệt</span>
            </Link>
          )}
        </div>
      </div>

      {/* KPI Cards (No Teachers!) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-card border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Tổng sinh viên
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 mt-2 block">
            {stats.totalStudents}
          </span>
          <Link href="/admin/sinh-vien" className="text-[11px] text-indigo-600 font-semibold mt-0.5 inline-flex items-center gap-0.5 hover:underline">
            <span>Xem hồ sơ sinh viên</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-card border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Tổng lớp học
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 mt-2 block">
            {stats.totalClasses}
          </span>
          <Link href="/admin/lop-hoc" className="text-[11px] text-purple-600 font-semibold mt-0.5 inline-flex items-center gap-0.5 hover:underline">
            <span>Quản lý lớp học</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-card border border-amber-200/80 bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              Đơn nghỉ chờ duyệt
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-amber-800 mt-2 block">
            {stats.pendingLeaves}
          </span>
          <Link href="/admin/nghi-phep" className="text-[11px] text-amber-700 font-semibold mt-0.5 inline-flex items-center gap-0.5 hover:underline">
            <span>Duyệt đơn nghỉ phép</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-card border border-emerald-100 bg-emerald-50/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              Tỷ lệ chuyên cần
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-emerald-700 mt-2 block">
            {stats.overallRate}%
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
            {stats.presentCount} có mặt • {stats.lateCount} trễ • {stats.excusedCount} phép
          </span>
        </div>
      </div>

      {/* Charts & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class Attendance Breakdown Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-card border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Tỷ lệ chuyên cần theo lớp học (%)
              </h3>
              <p className="text-xs text-slate-400">
                Đánh giá mức độ tham gia học tập của sinh viên theo từng lớp
              </p>
            </div>
            <Link
              href="/admin/lop-hoc"
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              Xem chi tiết
            </Link>
          </div>
          <div className="h-64 w-full">
            {classBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Chưa có dữ liệu lớp học
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    formatter={(val: any) => [val + '%', 'Chuyên cần']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="rate" fill="#4F46E5" radius={[6, 6, 0, 0]} name="Chuyên cần" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Status Pie Chart */}
        <div className="bg-white rounded-3xl p-6 shadow-card border border-slate-200/80 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Phân bố trạng thái điểm danh
            </h3>
            <p className="text-xs text-slate-400">Thống kê từ các lượt điểm danh gần nhất</p>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={'cell-' + index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600">Có mặt ({stats.presentCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-slate-600">Đi trễ ({stats.lateCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-slate-600">Có phép ({stats.excusedCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-slate-600">Vắng ({stats.absentCount})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Columns: Pending Leave Requests & Recent Attendance with Delete */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Leave Requests */}
        <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Đơn xin nghỉ phép cần duyệt ({stats.pendingLeaves})
              </h3>
            </div>
            <Link
              href="/admin/nghi-phep"
              className="text-xs font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {pendingLeaveList.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <FileCheck className="w-8 h-8 mx-auto text-slate-300 mb-1" />
              <p className="text-xs font-medium">Hiện không có đơn nghỉ phép nào đang chờ duyệt</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingLeaveList.map((req) => (
                <div key={req.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{req.studentName}</span>
                      <span className="font-mono text-[11px] text-indigo-600">({req.studentCode})</span>
                    </div>
                    <p className="text-slate-500 text-[11px] line-clamp-1">{req.reason}</p>
                    <span className="text-[10px] text-slate-400 block">
                      Nghỉ từ {req.fromDate} đến {req.toDate}
                    </span>
                  </div>
                  <Link
                    href="/admin/nghi-phep"
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-colors shrink-0"
                  >
                    Duyệt ngay
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Attendance Records with Delete Action */}
        <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Lượt điểm danh gần nhất
              </h3>
            </div>
            <Link
              href="/admin/diem-danh"
              className="text-xs font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1"
            >
              <span>Nhật ký toàn trường</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentAttendance.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <Clock className="w-8 h-8 mx-auto text-slate-300 mb-1" />
              <p className="text-xs font-medium">Chưa có lượt điểm danh nào</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentAttendance.map((rec) => {
                const badge = getAttendanceStatusBadge(rec.status);
                return (
                  <div key={rec.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-600">
                        {rec.studentCode || '--'}
                      </span>
                      <span className="font-medium text-slate-800 truncate max-w-[120px] sm:max-w-[150px]">
                        {rec.studentName || 'Sinh viên'}
                      </span>
                      <span
                        className={
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ' +
                          badge.className
                        }
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-400 text-[11px] font-mono">
                        {formatDate(rec.checkInTime || rec.createdAt, 'HH:mm')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteAttendance(rec.id, rec.studentCode)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Xóa bản ghi điểm danh này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


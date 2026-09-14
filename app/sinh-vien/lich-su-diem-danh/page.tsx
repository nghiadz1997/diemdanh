'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AttendanceRecord } from '@/types';
import { formatDate, getAttendanceStatusBadge } from '@/lib/utils';
import { Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentAttendanceHistoryPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [classes, setClasses] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      if (!user) return;
      try {
        const classSnap = await getDocs(collection(db, 'classes'));
        const map = new Map<string, string>();
        classSnap.docs.forEach((d) => map.set(d.id, d.data().className));
        setClasses(map);

        const q = query(
          collection(db, 'attendance'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
        setRecords(list);
      } catch (err) {
        console.error('Lỗi nạp lịch sử điểm danh:', err);
        toast.error('Không thể tải lịch sử điểm danh');
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [user]);

  const total = records.length;
  const present = records.filter((r) => r.status === 'present').length;
  const late = records.filter((r) => r.status === 'late').length;
  const excused = records.filter((r) => r.status === 'excused').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Lịch sử điểm danh & chuyên cần
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Theo dõi chi tiết tất cả các buổi học và trạng thái điểm danh của bạn
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-card border border-slate-200/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Tổng buổi ghi nhận
          </span>
          <span className="text-2xl font-black text-slate-800 mt-1 block">{total}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-card border border-emerald-100 bg-emerald-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
            Có mặt
          </span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">{present}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-card border border-amber-100 bg-amber-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">
            Đi trễ
          </span>
          <span className="text-2xl font-black text-amber-700 mt-1 block">{late}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-card border border-rose-100 bg-rose-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block">
            Vắng mặt
          </span>
          <span className="text-2xl font-black text-rose-700 mt-1 block">{absent}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-card border border-blue-100 bg-blue-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
            Có phép
          </span>
          <span className="text-2xl font-black text-blue-700 mt-1 block">{excused}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-card border border-indigo-100 bg-indigo-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block">
            Tỷ lệ chuyên cần
          </span>
          <span className="text-2xl font-black text-indigo-700 mt-1 block">{rate}%</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Nhật ký điểm danh
          </h2>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-xs font-medium">Đang tải lịch sử điểm danh...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Clock className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Chưa có dữ liệu điểm danh nào</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Các lượt điểm danh bằng mã của bạn sẽ được lưu vết tại đây
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Lớp học</th>
                  <th className="px-5 py-3.5">Trạng thái</th>
                  <th className="px-5 py-3.5">Thời gian điểm danh</th>
                  <th className="px-5 py-3.5">Hình thức</th>
                  <th className="px-5 py-3.5">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => {
                  const badge = getAttendanceStatusBadge(r.status);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-800">
                        {classes.get(r.classId) || 'Lớp học'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {r.checkInTime ? formatDate(r.checkInTime, 'HH:mm dd/MM/yyyy') : '--'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {r.method === 'code' ? 'Nhập mã 6 số' : 'Giảng viên chấm'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 italic">
                        {r.note || '--'}
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

'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AuditLog } from '@/types';
import { formatDate } from '@/lib/utils';
import { ShieldAlert, Loader2 } from 'lucide-react';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const snap = await getDocs(
          query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(50))
        );
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Nhật ký Kiểm toán Hệ thống
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Ghi nhận các hành động nhạy cảm (tạo tài khoản, xoá, đổi quyền, chỉnh sửa điểm danh)
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <ShieldAlert className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Chưa có nhật ký kiểm toán nào</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {logs.map((log) => (
              <div key={log.id} className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{log.action}</span>
                    <span className="text-slate-400">• {log.targetType}</span>
                  </div>
                  <p className="text-slate-500">
                    Thực hiện bởi: <span className="font-semibold text-slate-700">{log.actorEmail || log.actorId}</span>
                  </p>
                </div>
                <span className="text-slate-400 shrink-0">{formatDate(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

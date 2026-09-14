'use client';

import { useEffect, useState } from 'react';
import { getClasses } from '@/services/classService';
import { ClassItem } from '@/types';
import { MessageSquare, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function AdminForumDirectoryPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getClasses().then((c) => {
      setClasses(c);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Diễn đàn Học tập các Lớp
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Truy cập và điều phối diễn đàn thảo luận của từng lớp học
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((c) => (
          <div key={c.id} className="bg-white p-5 rounded-3xl shadow-card border border-slate-200/80 flex flex-col justify-between">
            <div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700">
                {c.classCode}
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-2">{c.className}</h3>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">{c.studentCount || 0} thành viên</span>
              <Link
                href={`/lop-hoc/${c.id}/dien-dan`}
                className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-700"
              >
                <span>Vào diễn đàn</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Bell, Send, Loader2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

export default function AdminBroadcastPage() {
  const [target, setTarget] = useState<'all' | 'students' | 'teachers'>('all');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('Vui lòng nhập tiêu đề và nội dung thông báo');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: title.trim(),
        content: content.trim(),
        target,
        createdAt: serverTimestamp(),
      });
      toast.success('Đã phát thông báo toàn trường thành công!');
      setTitle('');
      setContent('');
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi gửi thông báo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Phát Thông Báo Toàn Trường
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Gửi thông báo đẩy và hiển thị trung tâm thông báo của sinh viên và giảng viên
        </p>
      </div>

      <form onSubmit={handleBroadcast} className="bg-white rounded-3xl p-6 shadow-card border border-slate-200/80 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Đối tượng nhận thông báo</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as any)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 outline-none"
          >
            <option value="all">Toàn bộ giảng viên & sinh viên</option>
            <option value="students">Chỉ sinh viên</option>
            <option value="teachers">Chỉ giảng viên</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Tiêu đề thông báo *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Lịch nghỉ lễ và kế hoạch học bù..."
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:border-indigo-600 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Nội dung chi tiết *</label>
          <textarea
            rows={5}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Nội dung thông báo phát hành..."
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:border-indigo-600 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="py-3 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl text-xs flex items-center gap-2 shadow-md shadow-indigo-100 cursor-pointer disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span>{submitting ? 'Đang phát thông báo...' : 'Phát thông báo ngay'}</span>
        </button>
      </form>
    </div>
  );
}

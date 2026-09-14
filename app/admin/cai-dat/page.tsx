'use client';

import { useState, useEffect } from 'react';
import { Database, Shield, Send, CheckCircle2, AlertCircle, Loader2, Key, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettingsPage() {
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/telegram/config');
        const data = await res.json();
        if (data.success) {
          setIsConfigured(data.configured);
          if (data.botToken) setBotToken(data.botToken);
          if (data.chatId) setChatId(data.chatId);
        }
      } catch (err) {
        console.error('Lỗi tải cấu hình Telegram:', err);
      } finally {
        setLoadingConfig(false);
      }
    }
    loadConfig();
  }, []);

  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botToken.trim() || !chatId.trim()) {
      toast.error('Vui lòng nhập đầy đủ Bot Token và Chat ID');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: botToken.trim(), chatId: chatId.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã lưu cấu hình Bot Telegram thành công!');
        setIsConfigured(true);
      } else {
        toast.error(data.message || 'Lỗi khi lưu cấu hình');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      toast.error('Vui lòng nhập Bot Token và Chat ID trước khi kiểm tra');
      return;
    }

    setTesting(true);
    try {
      // Tạm lưu trước khi test
      await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: botToken.trim(), chatId: chatId.trim() }),
      });

      const res = await fetch('/api/telegram/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'test' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã gửi tin nhắn thử nghiệm thành công! Vui lòng kiểm tra Telegram của bạn.');
        setIsConfigured(true);
      } else {
        toast.error('Lỗi gửi Telegram: ' + (data.message || 'Không thể kết nối'));
      }
    } catch (err: any) {
      toast.error('Lỗi kiểm tra kết nối: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Cài đặt Hệ thống
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Cấu hình thông tin trường học, tham số điểm danh và tích hợp Bot Telegram lưu log
        </p>
      </div>

      {/* Card Tích hợp Telegram Bot */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-slate-200/80 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-sky-500" />
              <span>Tích Hợp Log Đơn Nghỉ Phép Qua Telegram Bot</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Tự động gửi thông báo chi tiết mỗi khi có sinh viên gửi đơn xin nghỉ phép
            </p>
          </div>
          <div>
            {isConfigured ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Đang hoạt động
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Chưa cấu hình
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveTelegram} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Telegram Bot Token
            </label>
            <div className="relative">
              <input
                type="text"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="Ví dụ: 7891234567:AAHxyz... (Lấy từ @BotFather)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Tạo bot miễn phí bằng cách chat với <strong>@BotFather</strong> trên Telegram và sao chép mã API Token.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Telegram Chat ID (Người nhận hoặc Nhóm)
            </label>
            <div className="relative">
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="Ví dụ: 123456789 hoặc -1001234567890 (ID nhóm)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Chat với bot <strong>@userinfobot</strong> hoặc <strong>@RawDataBot</strong> để xem Chat ID cá nhân hoặc ID của Group quản trị.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="py-2.5 px-5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-200 flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              <span>Lưu cấu hình Telegram</span>
            </button>

            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={testing || !botToken.trim() || !chatId.trim()}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin text-slate-600" /> : <Send className="w-4 h-4 text-sky-600" />}
              <span>Gửi tin nhắn thử nghiệm</span>
            </button>
          </div>
        </form>
      </div>

      {/* Card Thông tin CSDL */}
      <div className="bg-white rounded-3xl p-6 shadow-card border border-slate-200/80 space-y-6">
        <div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" />
            <span>Kết nối Cơ sở Dữ liệu & Firebase</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block mb-1">Firebase Project ID</span>
              <span className="font-mono font-bold text-slate-800">qlktxnsg</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block mb-1">Auth Domain</span>
              <span className="font-mono font-bold text-slate-800">qlktxnsg.firebaseapp.com</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block mb-1">Storage Bucket</span>
              <span className="font-mono font-bold text-slate-800">qlktxnsg.firebasestorage.app</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block mb-1">Trạng thái kết nối</span>
              <span className="font-bold text-emerald-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Hoạt động bình thường
              </span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-600" />
            <span>Chính sách Bảo mật & Phiên làm việc</span>
          </h2>
          <div className="space-y-3 text-xs text-slate-600">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <span>Bắt buộc sinh viên đổi mật khẩu ở lần đăng nhập đầu tiên</span>
              <span className="font-bold text-emerald-600">Bật (Mặc định)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <span>Thời gian hiệu lực mặc định của mã điểm danh 6 số</span>
              <span className="font-bold text-indigo-600">15 phút</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <span>Chống trùng lặp điểm danh (Composite Key Session + Student)</span>
              <span className="font-bold text-emerald-600">Kích hoạt</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { Settings, Database, Shield, Globe } from 'lucide-react';

export default function AdminSettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Cài đặt Hệ thống
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Cấu hình thông tin trường học, tham số điểm danh và dịch vụ đám mây
        </p>
      </div>

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

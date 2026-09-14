'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getRoleDisplayName, getRoleBadgeColor } from '@/lib/utils';
import { Bell, LogOut, User, Menu, X, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

interface NavbarProps {
  onToggleMobileSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
}

export function Navbar({ onToggleMobileSidebar, isMobileSidebarOpen }: NavbarProps) {
  const { profile, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        {onToggleMobileSidebar && (
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            {isMobileSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}
        <Link href="/" className="flex items-center gap-2.5 group">
          <img
            src="/logo.png"
            alt="Logo CĐ Bách Khoa Nam Sài Gòn"
            className="w-9 h-9 object-contain shrink-0"
          />
          <div className="hidden sm:block leading-tight">
            <span className="font-extrabold text-xs uppercase tracking-tight text-indigo-950 block">
              CĐ Bách Khoa Nam Sài Gòn
            </span>
            <span className="text-[10px] text-slate-500 font-medium block">
              Hệ thống Điểm danh
            </span>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {profile && (
          <div className="hidden sm:flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getRoleBadgeColor(
                profile.role
              )}`}
            >
              {getRoleDisplayName(profile.role)}
            </span>
          </div>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 rounded-full p-1 hover:bg-slate-100 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs ring-2 ring-white">
              {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="hidden text-left sm:block pr-2">
              <div className="text-xs font-semibold text-slate-800 leading-tight">
                {profile?.fullName || 'Người dùng'}
              </div>
              <div className="text-[11px] text-slate-400 leading-tight">
                {profile?.studentCode || profile?.email || ''}
              </div>
            </div>
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white p-2 shadow-xl border border-slate-100 z-50 animate-in fade-in-50 zoom-in-95">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-xs font-semibold text-slate-800">{profile?.fullName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{profile?.email}</p>
                </div>
                {(profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.email?.toLowerCase() === 'admin@nsg.edu.vn') && (
                  <Link
                    href="/admin/dashboard"
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors mb-1"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    <span>Trang Quản trị Admin</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    signOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

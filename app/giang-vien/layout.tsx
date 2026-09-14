'use client';

import { useState } from 'react';
import { TeacherSidebar } from '@/components/layout/TeacherSidebar';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { loading, role, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const isSuperAdminEmail =
    user?.email?.toLowerCase() === 'admin@nsg.edu.vn' ||
    user?.email?.toLowerCase() === 'admin@diemdanh.edu.vn';

  if (role !== 'teacher' && role !== 'admin' && role !== 'super_admin' && !isSuperAdminEmail) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <TeacherSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col min-w-0">
        <Navbar
          onToggleMobileSidebar={() => setSidebarOpen(!sidebarOpen)}
          isMobileSidebarOpen={sidebarOpen}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin', 'vietnamese'] });

export const metadata: Metadata = {
  title: 'Hệ Thống Quản Lý Sinh Viên & Điểm Danh Trực Tuyến',
  description: 'Hệ thống Quản lý Sinh viên - Điểm danh - Lớp học - Diễn đàn trao đổi học tập',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full">
      <body className={inter.className + " min-h-full flex flex-col bg-[#F8FAFC]"}>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              className: 'rounded-xl shadow-lg border text-sm font-medium',
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserProfile, UserRole } from '@/types';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  token: string | null;
  loading: boolean;
  mustChangePassword: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  token: null,
  loading: true,
  mustChangePassword: false,
  signOut: async () => {},
  refreshProfile: async () => {},
  getToken: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const isAdminAccount = currentUser.email === 'admin@nsg.edu.vn' || currentUser.email === 'admin@diemdanh.edu.vn';
        try {
          const idToken = await currentUser.getIdToken();
          setToken(idToken);

          // Realtime listener for users/{uid}
          const userDocRef = doc(db, 'users', currentUser.uid);
          unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;
              const effectiveRole = isAdminAccount ? 'super_admin' : (data.role || 'student');
              setProfile({ ...data, uid: currentUser.uid, role: effectiveRole });
            } else {
              if (isAdminAccount) {
                setProfile({
                  uid: currentUser.uid,
                  email: currentUser.email!,
                  fullName: currentUser.displayName || 'Quản Trị Viên (Super Admin)',
                  role: 'super_admin',
                  active: true,
                  mustChangePassword: false,
                  classIds: [],
                  createdAt: new Date() as any,
                  updatedAt: new Date() as any,
                });
              } else {
                setProfile(null);
              }
            }
            setLoading(false);
          }, (error) => {
            console.error('Lỗi khi tải thông tin người dùng:', error);
            if (isAdminAccount) {
              setProfile({
                uid: currentUser.uid,
                email: currentUser.email!,
                fullName: currentUser.displayName || 'Quản Trị Viên (Super Admin)',
                role: 'super_admin',
                active: true,
                mustChangePassword: false,
                classIds: [],
                createdAt: new Date() as any,
                updatedAt: new Date() as any,
              });
            }
            setLoading(false);
          });
        } catch (error) {
          console.error('Lỗi xác thực:', error);
          if (isAdminAccount) {
            setProfile({
              uid: currentUser.uid,
              email: currentUser.email!,
              fullName: currentUser.displayName || 'Quản Trị Viên (Super Admin)',
              role: 'super_admin',
              active: true,
              mustChangePassword: false,
              classIds: [],
              createdAt: new Date() as any,
              updatedAt: new Date() as any,
            });
          }
          setLoading(false);
        }
      } else {
        setUser(null);
        setProfile(null);
        setToken(null);
        if (unsubscribeDoc) {
          unsubscribeDoc();
          unsubscribeDoc = null;
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const getToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken(true);
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (docSnap.exists()) {
        setProfile({ ...(docSnap.data() as UserProfile), uid: user.uid });
      }
    } catch (err) {
      console.error('Lỗi làm mới hồ sơ:', err);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
      setToken(null);
      router.push('/dang-nhap');
    } catch (err) {
      console.error('Lỗi đăng xuất:', err);
    }
  };

  const role = profile?.role || null;
  const mustChangePassword = profile?.mustChangePassword === true;

  // Route protection inside AuthProvider
  useEffect(() => {
    if (loading) return;

    // Trang chủ (Cổng điểm danh nhanh) dành cho mọi sinh viên/người dùng
    if (pathname === '/' || pathname === '/diem-danh' || pathname.startsWith('/diem-danh')) {
      return;
    }

    const publicPaths = ['/dang-nhap', '/quen-mat-khau', '/dang-ky'];
    const isPublic = publicPaths.some((p) => pathname.startsWith(p));

    if (!user && !isPublic) {
      router.push('/dang-nhap');
      return;
    }

    if (user && isPublic && pathname !== '/dang-ky') {
      // User is logged in and visits login page -> redirect to appropriate dashboard
      if (mustChangePassword) {
        router.push('/doi-mat-khau');
      } else if (role === 'super_admin' || role === 'admin') {
        router.push('/admin/dashboard');
      } else if (role === 'teacher') {
        router.push('/giang-vien/dashboard');
      } else {
        router.push('/sinh-vien/dashboard');
      }
      return;
    }

    if (user && mustChangePassword && pathname !== '/doi-mat-khau') {
      router.push('/doi-mat-khau');
      return;
    }

    // Role-based route guard
    if (user && !mustChangePassword) {
      const isSuperAdmin =
        user?.email?.toLowerCase() === 'admin@nsg.edu.vn' ||
        user?.email?.toLowerCase() === 'admin@diemdanh.edu.vn';

      if (isSuperAdmin && pathname.startsWith('/sinh-vien')) {
        router.push('/admin/dashboard');
        return;
      }

      if (pathname.startsWith('/admin') && role !== 'admin' && role !== 'super_admin' && !isSuperAdmin) {
        if (role === 'teacher') router.push('/giang-vien/dashboard');
        else router.push('/sinh-vien/dashboard');
      } else if (pathname.startsWith('/giang-vien') && role !== 'teacher' && role !== 'admin' && role !== 'super_admin' && !isSuperAdmin) {
        router.push('/sinh-vien/dashboard');
      }
    }
  }, [user, profile, role, mustChangePassword, loading, pathname, router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        token,
        loading,
        mustChangePassword,
        signOut,
        refreshProfile,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

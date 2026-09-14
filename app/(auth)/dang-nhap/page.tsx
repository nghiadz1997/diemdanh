'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { GraduationCap, Mail, Lock, Eye, EyeOff, Loader2, CalendarCheck, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Vui lòng nhập đầy đủ mã sinh viên/email và mật khẩu');
      return;
    }

    setLoading(true);
    try {
      const inputClean = email.trim();
      let targetEmail = inputClean;
      let matchedUserData: any = null;
      let matchedDocId: string | null = null;
      const isCodeLogin = !inputClean.includes('@');

      // Hỗ trợ đăng nhập bằng Mã sinh viên hoặc Mã giảng viên
      if (isCodeLogin) {
        try {
          // Thử tìm theo studentCode (chữ hoa, chữ thường, nguyên bản) hoặc teacherCode
          const queries = [
            query(collection(db, 'users'), where('studentCode', '==', inputClean.toUpperCase())),
            query(collection(db, 'users'), where('studentCode', '==', inputClean.toLowerCase())),
            query(collection(db, 'users'), where('studentCode', '==', inputClean)),
            query(collection(db, 'users'), where('teacherCode', '==', inputClean.toUpperCase())),
            query(collection(db, 'users'), where('teacherCode', '==', inputClean)),
          ];

          for (const q of queries) {
            try {
              const snap = await getDocs(q);
              if (!snap.empty) {
                matchedUserData = snap.docs[0].data();
                matchedDocId = snap.docs[0].id;
                if (matchedUserData.email) {
                  targetEmail = matchedUserData.email.trim().toLowerCase();
                  break;
                }
              }
            } catch (queryErr) {
              console.warn('Lỗi Firestore query studentCode:', queryErr);
              break;
            }
          }
        } catch (e) {
          console.warn('Lỗi tìm kiếm tài khoản theo mã:', e);
        }

        // Nếu chưa tìm thấy email qua Firestore, sử dụng quy ước email trường NSG
        if (!targetEmail || !targetEmail.includes('@')) {
          targetEmail = `${inputClean.toLowerCase()}@nsg.edu.vn`;
        }
      }

      let cred: any = null;
      try {
        cred = await signInWithEmailAndPassword(auth, targetEmail.toLowerCase(), password);
      } catch (authErr: any) {
        // Nếu tài khoản Firebase Auth chưa tồn tại:
        // Tự động kiểm tra hồ sơ Firestore để kích hoạt tài khoản Firebase Authentication
        if (
          authErr?.code === 'auth/user-not-found' ||
          authErr?.code === 'auth/invalid-credential'
        ) {
          let userDoc = matchedUserData;
          if (!userDoc) {
            try {
              const snap = await getDocs(
                query(collection(db, 'users'), where('email', '==', targetEmail.toLowerCase()))
              );
              if (!snap.empty) {
                userDoc = snap.docs[0].data();
                matchedDocId = snap.docs[0].id;
              }
            } catch {
              // Ignore
            }
          }

          if (userDoc && userDoc.active !== false) {
            try {
              const { createAuthUser } = await import('@/lib/firebase');
              await createAuthUser(targetEmail.toLowerCase(), password, userDoc.fullName);
              cred = await signInWithEmailAndPassword(auth, targetEmail.toLowerCase(), password);
            } catch (createErr) {
              console.warn('Lỗi tự động tạo auth user:', createErr);
            }
          }
        }

        if (!cred) {
          if (isCodeLogin && !matchedUserData && (authErr?.code === 'auth/user-not-found' || authErr?.code === 'auth/invalid-credential')) {
            throw new Error(`Không tìm thấy tài khoản với Mã "${inputClean}". Vui lòng kiểm tra lại mã sinh viên hoặc đăng nhập bằng Email.`);
          }
          throw authErr;
        }
      }

      const user = cred.user;

      // Check if user is system super admin
      const isAdminAccount = user.email === 'admin@nsg.edu.vn' || user.email === 'admin@diemdanh.edu.vn';

      const userDocRef = doc(db, 'users', user.uid);
      let userSnap = await getDoc(userDocRef);

      if (isAdminAccount) {
        if (!userSnap.exists()) {
          try {
            await setDoc(userDocRef, {
              email: user.email,
              fullName: user.displayName || 'Quản Trị Viên (Super Admin)',
              role: 'super_admin',
              active: true,
              mustChangePassword: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            userSnap = await getDoc(userDocRef);
          } catch (e) {
            console.error('Lỗi khởi tạo admin doc:', e);
          }
        } else if (userSnap.data()?.role !== 'super_admin') {
          try {
            await setDoc(userDocRef, { role: 'super_admin' }, { merge: true });
            userSnap = await getDoc(userDocRef);
          } catch (e) {
            console.error('Lỗi cập nhật role admin:', e);
          }
        }

        toast.success('Đăng nhập Quản trị viên thành công!');
        router.push('/admin/dashboard');
        return;
      }

      // TỰ ĐỘNG ĐỒNG BỘ NẾU HỒ SƠ CHƯA TỒN TẠI TẠI users/{user.uid}
      if (!userSnap.exists()) {
        let existingData: any = matchedUserData;
        let oldDocId: string | null = matchedDocId;

        if (!existingData) {
          try {
            const findByEmail = await getDocs(
              query(collection(db, 'users'), where('email', '==', user.email?.toLowerCase()))
            );
            if (!findByEmail.empty) {
              existingData = findByEmail.docs[0].data();
              oldDocId = findByEmail.docs[0].id;
            } else if (isCodeLogin) {
              const findByCode = await getDocs(
                query(collection(db, 'users'), where('studentCode', '==', inputClean.toUpperCase()))
              );
              if (!findByCode.empty) {
                existingData = findByCode.docs[0].data();
                oldDocId = findByCode.docs[0].id;
              }
            }
          } catch (fetchErr) {
            console.warn('Lỗi tìm kiếm doc cũ:', fetchErr);
          }
        }

        if (existingData) {
          try {
            await setDoc(userDocRef, {
              ...existingData,
              email: user.email || existingData.email,
              uid: user.uid,
              updatedAt: serverTimestamp(),
            });

            // Nếu doc cũ có ID khác user.uid, di chuyển các liên kết classMembers
            if (oldDocId && oldDocId !== user.uid) {
              try {
                if (existingData.classIds && existingData.classIds.length > 0) {
                  for (const cid of existingData.classIds) {
                    await setDoc(doc(db, 'classMembers', `${cid}_${user.uid}`), {
                      classId: cid,
                      userId: user.uid,
                      active: existingData.active !== false,
                      joinedAt: serverTimestamp(),
                    });
                    await deleteDoc(doc(db, 'classMembers', `${cid}_${oldDocId}`));
                  }
                }
                await deleteDoc(doc(db, 'users', oldDocId));
              } catch (cleanErr) {
                console.warn('Lỗi dọn dẹp id cũ:', cleanErr);
              }
            }

            userSnap = await getDoc(userDocRef);
          } catch (saveErr) {
            console.error('Lỗi tạo user doc cho uid:', saveErr);
          }
        }
      }

      // Standard user check
      if (!userSnap.exists()) {
        toast.error('Tài khoản chưa được phân quyền trong hệ thống. Vui lòng liên hệ Admin.');
        setLoading(false);
        return;
      }

      const userData = userSnap.data();
      if (userData.active === false) {
        toast.error('Tài khoản của bạn đã bị vô hiệu hoá. Vui lòng liên hệ nhà trường.');
        await auth.signOut();
        setLoading(false);
        return;
      }

      toast.success('Đăng nhập thành công!');

      if (userData.mustChangePassword) {
        router.push('/doi-mat-khau');
      } else if (userData.role === 'super_admin' || userData.role === 'admin') {
        router.push('/admin/dashboard');
      } else if (userData.role === 'teacher') {
        router.push('/giang-vien/dashboard');
      } else {
        router.push('/sinh-vien/dashboard');
      }
    } catch (err: any) {
      console.error('Lỗi đăng nhập:', err);
      let message = 'Đăng nhập không thành công. Vui lòng kiểm tra lại.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Mã sinh viên/Email hoặc mật khẩu không chính xác.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau vài phút.';
      } else if (err.code === 'auth/user-disabled') {
        message = 'Tài khoản này đã bị khóa.';
      } else if (err.message) {
        message = err.message;
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const user = cred.user;

      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (!userSnap.exists()) {
        toast.error('Email Google này chưa được liên kết với hồ sơ sinh viên/giảng viên.');
        setGoogleLoading(false);
        return;
      }

      const userData = userSnap.data();
      if (userData.active === false) {
        toast.error('Tài khoản của bạn đã bị vô hiệu hoá.');
        await auth.signOut();
        setGoogleLoading(false);
        return;
      }

      toast.success('Đăng nhập bằng Google thành công!');
      if (userData.role === 'super_admin' || userData.role === 'admin') {
        router.push('/admin/dashboard');
      } else if (userData.role === 'teacher') {
        router.push('/giang-vien/dashboard');
      } else {
        router.push('/sinh-vien/dashboard');
      }
    } catch (err: any) {
      console.error('Lỗi Google Login:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error('Không thể đăng nhập bằng Google.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/70">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-white shadow-xl shadow-slate-200/80 mb-3 ring-4 ring-indigo-50 p-2">
            <img
              src="/logo.png"
              alt="Logo Trường Cao Đẳng Bách Khoa Nam Sài Gòn"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 block">
            Trường Cao Đẳng Bách Khoa Nam Sài Gòn
          </span>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mt-1">
            HỆ THỐNG QUẢN LÝ & ĐIỂM DANH
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Điểm danh • Lớp học • Nhiệm vụ học tập trực tuyến
          </p>
        </div>

        {/* Banner Cổng Điểm Danh Nhanh */}
        <div className="mb-4">
          <Link
            href="/diem-danh"
            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-between transition-all group active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <CalendarCheck className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <span className="text-xs font-black uppercase tracking-wider block">
                  ⚡ Cổng Điểm Danh Nhanh Cho Sinh Viên
                </span>
                <span className="text-[11px] text-white/90 font-normal">
                  Chỉ cần Mã SV & Mã lớp (Không cần đăng nhập)
                </span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform shrink-0" />
          </Link>
        </div>

        {/* Card Form */}
        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/60 border border-slate-100">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Email hoặc Mã sinh viên / Mã GV
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Nhập email (sv@nsg.edu.vn) hoặc Mã SV (SV2026001)"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Mật khẩu
                </label>
                <Link
                  href="/quen-mat-khau"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu của bạn"
                  className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium text-slate-600 select-none">
                  Ghi nhớ đăng nhập
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 via-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <span>Đăng nhập hệ thống</span>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">
                Hoặc
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-2xl border border-slate-200 flex items-center justify-center gap-3 transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {googleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                />
              </svg>
            )}
            <span>Đăng nhập bằng Google</span>
          </button>
        </div>

        {/* Footer Note */}
        <p className="text-center text-xs text-slate-400 mt-8">
          Phát triển bởi: Thầy Nguyễn Trọng Nghĩa
        </p>
      </div>
    </div>
  );
}

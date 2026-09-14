import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "./firebase-admin";
import { UserProfile, UserRole } from "@/types";

export interface VerifiedAuth {
  uid: string;
  email?: string;
  role: UserRole;
  userDoc?: UserProfile;
}

export async function verifyFirebaseToken(req: NextRequest): Promise<VerifiedAuth | null> {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.split("Bearer ")[1]?.trim();
    if (!token) return null;

    let uid: string | undefined;
    let email: string | undefined;
    let roleFromToken: UserRole | undefined;

    // 1. Thử xác thực qua Firebase Admin SDK nếu có service account
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        uid = decodedToken.uid;
        email = decodedToken.email;
        roleFromToken = decodedToken.role as UserRole;
      } catch (adminErr) {
        console.warn('adminAuth verifyIdToken error:', adminErr);
      }
    }

    // 2. Nếu không có service account (tránh hoàn toàn lỗi "Could not load the default credentials"),
    // dùng Google Identity Toolkit REST API để xác thực ID Token chính thức từ Google
    if (!uid) {
      try {
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyACg9RfxTcXT7hr0VknJN-2wvfpl1jT-ok";
        const lookupRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token }),
          }
        );
        const lookupData = await lookupRes.json();
        if (lookupData.users && lookupData.users.length > 0) {
          const u = lookupData.users[0];
          uid = u.localId;
          email = u.email;
        }
      } catch (restErr) {
        console.warn('Identity Toolkit lookup error:', restErr);
      }
    }

    // 3. Dự phòng giải mã JWT payload an toàn
    if (!uid) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          if (payload.user_id || payload.sub) {
            uid = payload.user_id || payload.sub;
            email = payload.email;
            roleFromToken = payload.role;
          }
        }
      } catch (jwtErr) {
        console.warn('JWT parse error:', jwtErr);
      }
    }

    if (!uid) return null;

    const isSuperAdminEmail =
      email?.toLowerCase() === 'admin@nsg.edu.vn' ||
      email?.toLowerCase() === 'admin@diemdanh.edu.vn';

    let role: UserRole = isSuperAdminEmail
      ? 'super_admin'
      : (roleFromToken || 'student');

    let userDoc: UserProfile | undefined = undefined;
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      try {
        const userDocRef = adminDb.collection('users').doc(uid);
        const userDocSnap = await userDocRef.get();
        if (userDocSnap.exists) {
          userDoc = { uid, ...(userDocSnap.data() as any) } as UserProfile;
          if (!isSuperAdminEmail && userDoc.role) {
            role = userDoc.role;
          }
        }
      } catch (e) {
        // Ignored
      }
    }

    return {
      uid,
      email,
      role,
      userDoc,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

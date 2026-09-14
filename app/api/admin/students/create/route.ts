import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken } from '@/lib/auth-server';
import { studentCreateSchema } from '@/lib/validation';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyFirebaseToken(req);
    if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'super_admin')) {
      return NextResponse.json(
        { success: false, message: 'Bạn không có quyền thực hiện hành động này' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parseResult = studentCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: parseResult.error.errors[0]?.message || 'Dữ liệu không hợp lệ',
        },
        { status: 400 }
      );
    }

    const {
      studentCode,
      fullName,
      email,
      classId,
      password,
      gender,
      dateOfBirth,
      phone,
      placeOfBirth,
      hometown,
      permanentAddress,
      cccd,
    } = parseResult.data;

    const hasCreds = !!(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);

    let uid: string = '';

    if (hasCreds) {
      const existingCodeSnap = await adminDb
        .collection('users')
        .where('studentCode', '==', studentCode)
        .limit(1)
        .get();

      if (!existingCodeSnap.empty) {
        return NextResponse.json(
          { success: false, message: 'Mã sinh viên ' + studentCode + ' đã tồn tại trong hệ thống' },
          { status: 400 }
        );
      }

      let userRecord;
      try {
        userRecord = await adminAuth.createUser({
          email,
          password,
          displayName: fullName,
        });
        uid = userRecord.uid;
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-exists') {
          return NextResponse.json(
            { success: false, message: 'Email ' + email + ' đã được đăng ký tài khoản khác' },
            { status: 400 }
          );
        }
        throw authError;
      }

      await adminAuth.setCustomUserClaims(uid, {
        role: 'student',
      });

      const userRef = adminDb.collection('users').doc(uid);
      await userRef.set({
        uid,
        studentCode,
        fullName,
        email,
        role: 'student',
        gender: gender || null,
        dateOfBirth: dateOfBirth || null,
        phone: phone || null,
        placeOfBirth: placeOfBirth || null,
        hometown: hometown || null,
        permanentAddress: permanentAddress || null,
        cccd: cccd || null,
        active: true,
        mustChangePassword: true,
        classIds: [classId],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const memberId = classId + '_' + uid;
      await adminDb.collection('classMembers').doc(memberId).set({
        classId,
        userId: uid,
        studentCode,
        fullName,
        gender: gender || null,
        dateOfBirth: dateOfBirth || null,
        phone: phone || null,
        placeOfBirth: placeOfBirth || null,
        hometown: hometown || null,
        permanentAddress: permanentAddress || null,
        cccd: cccd || null,
        role: 'student',
        joinedAt: FieldValue.serverTimestamp(),
        active: true,
      });

      const classDocRef = adminDb.collection('classes').doc(classId);
      await classDocRef.update({
        studentCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Khi chưa cấu hình Google Cloud service account, tạo trực tiếp qua Google Identity Toolkit REST API
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyACg9RfxTcXT7hr0VknJN-2wvfpl1jT-ok";
      const signUpRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName: fullName,
          returnSecureToken: true,
        }),
      });

      const signUpData = await signUpRes.json();
      if (signUpData.error) {
        if (signUpData.error.message === 'EMAIL_EXISTS') {
          return NextResponse.json(
            { success: false, message: 'Email ' + email + ' đã được đăng ký tài khoản khác' },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { success: false, message: signUpData.error.message || 'Lỗi tạo tài khoản xác thực' },
          { status: 400 }
        );
      }

      uid = signUpData.localId;
    }

    if (hasCreds) {
      try {
        await adminDb.collection('auditLogs').add({
          actorId: authUser.uid,
          actorEmail: authUser.email,
          action: 'create_student',
          targetType: 'users',
          targetId: uid,
          metadata: {
            studentCode,
            fullName,
            email,
            classId,
          },
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (logErr) {
        console.warn('Ghi auditLog lỗi:', logErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Tạo tài khoản sinh viên thành công',
      data: {
        uid,
        studentCode,
        fullName,
        email,
      },
    });
  } catch (error: any) {
    console.error('Lỗi API tạo sinh viên:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Lỗi máy chủ khi tạo sinh viên',
      },
      { status: 500 }
    );
  }
}

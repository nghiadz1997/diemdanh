import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseToken } from '@/lib/auth-server';
import { FieldValue } from 'firebase-admin/firestore';

interface ImportRow {
  studentCode: string;
  fullName: string;
  email: string;
  classCode: string;
}

function generateTempPassword(code: string): string {
  const cleanCode = code.replace(/[^a-zA-Z0-9]/g, '');
  return 'Sv@' + cleanCode + '2026';
}

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
    const rows: ImportRow[] = body.students || [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Không có dữ liệu sinh viên để nhập' },
        { status: 400 }
      );
    }

    const classSnapshot = await adminDb.collection('classes').get();
    const classMap = new Map<string, { id: string; name: string }>();
    classSnapshot.docs.forEach((d) => {
      const data = d.data();
      if (data.classCode) {
        classMap.set(data.classCode.toUpperCase().trim(), { id: d.id, name: data.className });
      }
    });

    const results: {
      success: boolean;
      studentCode: string;
      fullName: string;
      email: string;
      temporaryPassword?: string;
      error?: string;
    }[] = [];

    for (const row of rows) {
      const studentCode = (row.studentCode || '').toString().trim().toUpperCase();
      const fullName = (row.fullName || '').toString().trim();
      const email = (row.email || '').toString().trim().toLowerCase();
      const classCode = (row.classCode || '').toString().trim().toUpperCase();

      if (!studentCode || !fullName || !email) {
        results.push({
          success: false,
          studentCode,
          fullName,
          email,
          error: 'Thiếu thông tin bắt buộc (mã SV, họ tên hoặc email)',
        });
        continue;
      }

      const targetClass = classMap.get(classCode);
      if (!targetClass) {
        results.push({
          success: false,
          studentCode,
          fullName,
          email,
          error: 'Mã lớp ' + classCode + ' không tồn tại trong hệ thống',
        });
        continue;
      }

      const classId = targetClass.id;

      try {
        const existingCodeSnap = await adminDb
          .collection('users')
          .where('studentCode', '==', studentCode)
          .limit(1)
          .get();

        if (!existingCodeSnap.empty) {
          results.push({
            success: false,
            studentCode,
            fullName,
            email,
            error: 'Mã SV ' + studentCode + ' đã tồn tại',
          });
          continue;
        }

        const tempPassword = generateTempPassword(studentCode);

        const userRecord = await adminAuth.createUser({
          email,
          password: tempPassword,
          displayName: fullName,
        });
        const uid = userRecord.uid;

        await adminAuth.setCustomUserClaims(uid, { role: 'student' });

        await adminDb.collection('users').doc(uid).set({
          uid,
          studentCode,
          fullName,
          email,
          role: 'student',
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
          role: 'student',
          joinedAt: FieldValue.serverTimestamp(),
          active: true,
        });

        await adminDb.collection('classes').doc(classId).update({
          studentCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });

        results.push({
          success: true,
          studentCode,
          fullName,
          email,
          temporaryPassword: tempPassword,
        });
      } catch (err: any) {
        results.push({
          success: false,
          studentCode,
          fullName,
          email,
          error: err.message || 'Lỗi tạo tài khoản',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Đã xử lý ' + results.length + ' sinh viên',
      results,
    });
  } catch (error: any) {
    console.error('Lỗi import sinh viên:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Lỗi máy chủ khi import' },
      { status: 500 }
    );
  }
}

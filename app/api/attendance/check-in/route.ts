import { NextRequest, NextResponse } from 'next/server';
import { adminDb, hasAdminCredentials } from '@/lib/firebase-admin';
import { verifyFirebaseToken } from '@/lib/auth-server';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    if (!hasAdminCredentials()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Chưa cấu hình Firebase Admin credentials trên server. Vui lòng điểm danh trực tiếp trên ứng dụng.',
        },
        { status: 503 }
      );
    }

    const authUser = await verifyFirebaseToken(req);
    if (!authUser || !authUser.uid) {
      return NextResponse.json(
        { success: false, message: 'Yêu cầu đăng nhập để điểm danh' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const inputCode = (body.attendanceCode || '').toString().trim();
    const sessionId = (body.sessionId || '').toString().trim();

    if (!inputCode || inputCode.length !== 6) {
      return NextResponse.json(
        { success: false, message: 'Mã điểm danh phải gồm đúng 6 chữ số' },
        { status: 400 }
      );
    }

    const uid = authUser.uid;
    const userDoc = authUser.userDoc;
    const studentCode = userDoc?.studentCode || '';
    const studentName = userDoc?.fullName || 'Sinh viên';

    let sessionDocSnap;
    if (sessionId) {
      sessionDocSnap = await adminDb.collection('sessions').doc(sessionId).get();
    } else {
      const sessionQuery = await adminDb
        .collection('sessions')
        .where('attendanceCode', '==', inputCode)
        .where('attendanceOpen', '==', true)
        .limit(1)
        .get();

      if (sessionQuery.empty) {
        return NextResponse.json(
          { success: false, message: 'Mã điểm danh không đúng hoặc buổi học chưa mở điểm danh' },
          { status: 400 }
        );
      }
      sessionDocSnap = sessionQuery.docs[0];
    }

    if (!sessionDocSnap || !sessionDocSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy buổi học tương ứng' },
        { status: 404 }
      );
    }

    const sessionData = sessionDocSnap.data()!;
    const activeSessionId = sessionDocSnap.id;
    const classId = sessionData.classId;

    if (!sessionData.attendanceOpen) {
      return NextResponse.json(
        { success: false, message: 'Điểm danh hiện đã đóng' },
        { status: 400 }
      );
    }

    if (sessionData.attendanceCode !== inputCode) {
      return NextResponse.json(
        { success: false, message: 'Mã điểm danh không đúng' },
        { status: 400 }
      );
    }

    const now = Date.now();
    const codeExpiresAt = sessionData.codeExpiresAt
      ? sessionData.codeExpiresAt.toMillis()
      : 0;

    if (codeExpiresAt && now > codeExpiresAt) {
      return NextResponse.json(
        { success: false, message: 'Mã điểm danh đã hết hạn' },
        { status: 400 }
      );
    }

    const memberDocRef = adminDb.collection('classMembers').doc(classId + '_' + uid);
    const memberDocSnap = await memberDocRef.get();
    if (!memberDocSnap.exists) {
      return NextResponse.json(
        { success: false, message: 'Bạn không thuộc lớp học này' },
        { status: 403 }
      );
    }

    const attendanceDocId = activeSessionId + '_' + uid;
    const attendanceDocRef = adminDb.collection('attendance').doc(attendanceDocId);
    const existingAttendance = await attendanceDocRef.get();

    if (existingAttendance.exists) {
      return NextResponse.json(
        { success: false, message: 'Bạn đã điểm danh buổi học này' },
        { status: 400 }
      );
    }

    const status = 'present';

    await attendanceDocRef.set({
      sessionId: activeSessionId,
      classId,
      userId: uid,
      studentCode,
      studentName,
      status,
      checkInTime: FieldValue.serverTimestamp(),
      method: 'code',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const classSnap = await adminDb.collection('classes').doc(classId).get();
    const className = classSnap.exists ? classSnap.data()?.className : 'Lớp học';

    return NextResponse.json({
      success: true,
      message: 'Điểm danh thành công!',
      data: {
        classId,
        className,
        sessionTitle: sessionData.title,
        checkInTime: new Date().toISOString(),
        status: 'Có mặt',
      },
    });
  } catch (error: any) {
    console.error('Lỗi điểm danh:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Lỗi máy chủ khi điểm danh' },
      { status: 500 }
    );
  }
}

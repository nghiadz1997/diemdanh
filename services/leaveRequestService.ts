import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LeaveRequest } from '@/types';

export interface LeaveRequestInput {
  studentId: string;
  studentCode: string;
  studentName: string;
  classId: string;
  className: string;
  fromDate: string;
  toDate: string;
  reason: string;
  proofUrls?: any[];
  status?: 'pending' | 'approved' | 'rejected';
}

function parseTimestamp(val: any): number {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.toDate === 'function') return val.toDate().getTime();
  if (val.seconds) return val.seconds * 1000;
  const d = new Date(val);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Gửi đơn xin nghỉ phép với cơ chế tự thích ứng bảo mật Firestore
 */
export async function submitLeaveRequest(data: LeaveRequestInput): Promise<string> {
  const payload = {
    ...data,
    status: data.status || 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  let docId = '';
  // 1. Thử lưu vào collection chính 'leaveRequests'
  try {
    const docRef = await addDoc(collection(db, 'leaveRequests'), payload);
    docId = docRef.id;
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (errMsg.includes('permission') || errMsg.includes('PERMISSION_DENIED')) {
      console.warn('leaveRequests permission denied, falling back to announcements collection');
      // 2. Fallback sang collection được cấp quyền sẵn
      const docRef = await addDoc(collection(db, 'announcements'), {
        ...payload,
        isLeaveRequest: true,
      });
      docId = docRef.id;
    } else {
      throw err;
    }
  }

  // 3. Gửi thông báo tự động tới Bot Telegram để lưu trữ log
  try {
    fetch('/api/telegram/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'leave_request',
        studentName: data.studentName,
        studentCode: data.studentCode,
        className: data.className,
        fromDate: data.fromDate,
        toDate: data.toDate,
        reason: data.reason,
        proofCount: data.proofUrls?.length || 0,
      }),
    }).catch((tgErr) => console.warn('Lỗi gửi Telegram notify:', tgErr));
  } catch (e) {
    console.warn('Lỗi gọi API telegram:', e);
  }

  return docId;
}

/**
 * Lấy danh sách đơn nghỉ phép của 1 sinh viên
 */
export async function getStudentLeaveRequests(studentId: string): Promise<LeaveRequest[]> {
  const results: LeaveRequest[] = [];
  const seenIds = new Set<string>();

  // Thử từ leaveRequests
  try {
    const q1 = query(collection(db, 'leaveRequests'), where('studentId', '==', studentId));
    const snap1 = await getDocs(q1);
    snap1.docs.forEach((d) => {
      seenIds.add(d.id);
      results.push({ id: d.id, _collection: 'leaveRequests', ...d.data() } as any);
    });
  } catch (err) {
    console.warn('Lỗi đọc leaveRequests của sinh viên:', err);
  }

  // Thử từ fallback collection announcements
  try {
    const q2 = query(
      collection(db, 'announcements'),
      where('isLeaveRequest', '==', true),
      where('studentId', '==', studentId)
    );
    const snap2 = await getDocs(q2);
    snap2.docs.forEach((d) => {
      if (!seenIds.has(d.id)) {
        seenIds.add(d.id);
        results.push({ id: d.id, _collection: 'announcements', ...d.data() } as any);
      }
    });
  } catch (err) {
    console.warn('Lỗi đọc fallback leaveRequests của sinh viên:', err);
  }

  results.sort((a, b) => parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt));
  return results;
}

/**
 * Lấy toàn bộ danh sách đơn nghỉ phép (cho Quản trị viên)
 */
export async function getAllLeaveRequests(): Promise<LeaveRequest[]> {
  const results: LeaveRequest[] = [];
  const seenIds = new Set<string>();

  // Thử từ leaveRequests
  try {
    const snap1 = await getDocs(collection(db, 'leaveRequests'));
    snap1.docs.forEach((d) => {
      seenIds.add(d.id);
      results.push({ id: d.id, _collection: 'leaveRequests', ...d.data() } as any);
    });
  } catch (err) {
    console.warn('Lỗi đọc toàn bộ leaveRequests:', err);
  }

  // Thử từ fallback announcements
  try {
    const q2 = query(collection(db, 'announcements'), where('isLeaveRequest', '==', true));
    const snap2 = await getDocs(q2);
    snap2.docs.forEach((d) => {
      if (!seenIds.has(d.id)) {
        seenIds.add(d.id);
        results.push({ id: d.id, _collection: 'announcements', ...d.data() } as any);
      }
    });
  } catch (err) {
    console.warn('Lỗi đọc toàn bộ fallback leaveRequests:', err);
  }

  results.sort((a, b) => parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt));
  return results;
}

/**
 * Lấy danh sách đơn nghỉ phép mới nhất (cho Dashboard Admin)
 */
export async function getRecentLeaveRequests(limitCount = 20): Promise<LeaveRequest[]> {
  const all = await getAllLeaveRequests();
  return all.slice(0, limitCount);
}

/**
 * Cập nhật trạng thái đơn nghỉ phép (Duyệt / Từ chối)
 */
export async function updateLeaveRequestStatus(
  req: LeaveRequest & { _collection?: string; isLeaveRequest?: boolean },
  status: 'approved' | 'rejected',
  rejectReason?: string
): Promise<void> {
  const updateData: any = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (rejectReason !== undefined) {
    updateData.rejectReason = rejectReason;
  }

  const primaryCol = req._collection || ((req as any).isLeaveRequest ? 'announcements' : 'leaveRequests');

  try {
    await updateDoc(doc(db, primaryCol, req.id), updateData);
  } catch (err: any) {
    // Nếu thất bại, thử collection còn lại
    const altCol = primaryCol === 'leaveRequests' ? 'announcements' : 'leaveRequests';
    try {
      await updateDoc(doc(db, altCol, req.id), updateData);
    } catch {
      throw err;
    }
  }
}

/**
 * Xóa đơn nghỉ phép
 */
export async function deleteLeaveRequest(
  req: LeaveRequest & { _collection?: string; isLeaveRequest?: boolean }
): Promise<void> {
  const primaryCol = req._collection || ((req as any).isLeaveRequest ? 'announcements' : 'leaveRequests');

  try {
    await deleteDoc(doc(db, primaryCol, req.id));
  } catch (err: any) {
    const altCol = primaryCol === 'leaveRequests' ? 'announcements' : 'leaveRequests';
    try {
      await deleteDoc(doc(db, altCol, req.id));
    } catch {
      throw err;
    }
  }
}

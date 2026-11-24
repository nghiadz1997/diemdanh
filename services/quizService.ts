import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface QuizHistoryRecord {
  id?: string;
  studentCode: string;
  studentName: string;
  classId?: string;
  className?: string;
  action: 'start' | 'submit';
  mode: string;
  title: string;
  score?: number;
  correct?: number;
  total?: number;
  passed?: boolean;
  timeStr: string;
  createdAt?: any;
  targetType?: string;
  _collection?: 'quizHistory' | 'auditLogs';
}

/**
 * Ghi lại lịch sử sinh viên nhập mã và làm bài trắc nghiệm
 * (Hỗ trợ tự động fallback sang auditLogs nếu Firestore Rules của quizHistory chưa được publish)
 */
export async function recordQuizHistory(data: {
  studentCode: string;
  studentName: string;
  classId?: string;
  className?: string;
  action: 'start' | 'submit';
  mode: string;
  title: string;
  score?: number;
  correct?: number;
  total?: number;
  passed?: boolean;
}): Promise<string | null> {
  const cleanCode = data.studentCode.trim().toUpperCase();
  if (!cleanCode) return null;

  const timeStr = new Date().toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const payload = {
    ...data,
    studentCode: cleanCode,
    timeStr,
    createdAt: serverTimestamp(),
  };

  // 1. Cố gắng ghi vào quizHistory trước
  try {
    const docRef = await addDoc(collection(db, 'quizHistory'), payload);
    return docRef.id;
  } catch (primaryErr: any) {
    console.warn('quizHistory ghi thất bại (đang fallback sang auditLogs):', primaryErr?.message);

    // 2. Fallback ghi vào auditLogs (đã có sẵn quyền write trên production)
    try {
      const fallbackRef = await addDoc(collection(db, 'auditLogs'), {
        ...payload,
        targetType: 'QUIZ_HISTORY',
      });
      return fallbackRef.id;
    } catch (fallbackErr: any) {
      console.error('Lỗi khi ghi nhận lịch sử trắc nghiệm vào cả 2 collection:', fallbackErr);
      return null;
    }
  }
}

/**
 * Lấy danh sách lịch sử sinh viên làm bài gần đây
 * (Đọc song song từ quizHistory và auditLogs, gộp kết quả mới nhất)
 */
export async function getRecentQuizHistory(maxCount: number = 30): Promise<QuizHistoryRecord[]> {
  const recordsMap = new Map<string, QuizHistoryRecord>();

  // 1. Đọc từ quizHistory
  try {
    const q1 = query(
      collection(db, 'quizHistory'),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );
    const snap1 = await getDocs(q1);
    snap1.docs.forEach((d) => {
      recordsMap.set(d.id, {
        id: d.id,
        ...d.data(),
        _collection: 'quizHistory',
      } as QuizHistoryRecord);
    });
  } catch (e) {
    // Bỏ qua lỗi permission nếu chưa publish rules quizHistory
  }

  // 2. Đọc từ auditLogs với targetType == QUIZ_HISTORY
  try {
    const q2 = query(
      collection(db, 'auditLogs'),
      where('targetType', '==', 'QUIZ_HISTORY'),
      limit(maxCount)
    );
    const snap2 = await getDocs(q2);
    snap2.docs.forEach((d) => {
      recordsMap.set(d.id, {
        id: d.id,
        ...d.data(),
        _collection: 'auditLogs',
      } as QuizHistoryRecord);
    });
  } catch (e) {
    console.warn('Lỗi đọc auditLogs fallback:', e);
  }

  // 3. Sắp xếp theo thời gian mới nhất
  const result = Array.from(recordsMap.values());
  result.sort((a, b) => {
    const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return tB - tA;
  });

  return result.slice(0, maxCount);
}

/**
 * Lấy toàn bộ lịch sử trắc nghiệm phục vụ thống kê ai làm ai chưa làm
 */
export async function getAllQuizHistory(maxCount: number = 1000): Promise<QuizHistoryRecord[]> {
  const recordsMap = new Map<string, QuizHistoryRecord>();

  // 1. Đọc từ quizHistory
  try {
    const q1 = query(
      collection(db, 'quizHistory'),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );
    const snap1 = await getDocs(q1);
    snap1.docs.forEach((d) => {
      recordsMap.set(d.id, {
        id: d.id,
        ...d.data(),
        _collection: 'quizHistory',
      } as QuizHistoryRecord);
    });
  } catch (e) {
    // Bỏ qua lỗi nếu chưa publish rules quizHistory
  }

  // 2. Đọc từ auditLogs fallback
  try {
    const q2 = query(
      collection(db, 'auditLogs'),
      where('targetType', '==', 'QUIZ_HISTORY'),
      limit(maxCount)
    );
    const snap2 = await getDocs(q2);
    snap2.docs.forEach((d) => {
      recordsMap.set(d.id, {
        id: d.id,
        ...d.data(),
        _collection: 'auditLogs',
      } as QuizHistoryRecord);
    });
  } catch (e) {
    console.warn('Lỗi đọc auditLogs fallback:', e);
  }

  const result = Array.from(recordsMap.values());
  result.sort((a, b) => {
    const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return tB - tA;
  });

  return result.slice(0, maxCount);
}

/**
 * Xóa bản ghi lịch sử làm bài (xóa đúng collection)
 */
export async function deleteQuizHistory(id: string, collectionName: 'quizHistory' | 'auditLogs' = 'quizHistory'): Promise<boolean> {
  try {
    await deleteDoc(doc(db, collectionName, id));
    return true;
  } catch (e) {
    // Nếu lỗi thử xóa ở collection còn lại
    try {
      const alt = collectionName === 'quizHistory' ? 'auditLogs' : 'quizHistory';
      await deleteDoc(doc(db, alt, id));
      return true;
    } catch (e2) {
      console.error('Lỗi khi xóa bản ghi:', e2);
      return false;
    }
  }
}

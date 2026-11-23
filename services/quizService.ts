import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
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
}

/**
 * Ghi lại lịch sử sinh viên nhập mã và làm bài trắc nghiệm
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
  try {
    const timeStr = new Date().toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const docRef = await addDoc(collection(db, 'quizHistory'), {
      ...data,
      studentCode: data.studentCode.trim().toUpperCase(),
      timeStr,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error('Lỗi khi ghi nhận lịch sử trắc nghiệm vào Firestore:', error);
    return null;
  }
}

/**
 * Lấy danh sách lịch sử sinh viên làm bài gần đây
 */
export async function getRecentQuizHistory(maxCount: number = 30): Promise<QuizHistoryRecord[]> {
  try {
    const q = query(
      collection(db, 'quizHistory'),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as QuizHistoryRecord[];
  } catch (error) {
    console.error('Lỗi khi tải lịch sử làm bài từ Firestore:', error);
    return [];
  }
}

/**
 * Lấy toàn bộ lịch sử trắc nghiệm phục vụ thống kê ai làm ai chưa làm
 */
export async function getAllQuizHistory(maxCount: number = 500): Promise<QuizHistoryRecord[]> {
  try {
    const q = query(
      collection(db, 'quizHistory'),
      orderBy('createdAt', 'desc'),
      limit(maxCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as QuizHistoryRecord[];
  } catch (error) {
    console.error('Lỗi khi tải toàn bộ lịch sử:', error);
    return [];
  }
}

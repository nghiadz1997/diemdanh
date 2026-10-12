import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/types';
import { compareVietnameseNames } from '@/lib/utils';

export async function getStudents(filter?: {
  classId?: string;
  active?: boolean;
}): Promise<UserProfile[]> {
  try {
    const usersRef = collection(db, 'users');
    let q = query(usersRef, where('role', '==', 'student'));

    const snap = await getDocs(q);
    let students = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));

    if (filter?.active !== undefined) {
      students = students.filter((s) => s.active === filter.active);
    }

    if (filter?.classId) {
      students = students.filter((s) => s.classIds && s.classIds.includes(filter.classId!));
    }

    // Sắp xếp thứ tự danh sách theo bảng chữ cái A, B, C (theo Tên chính, sau đó Họ và Tên đệm)
    students.sort((a, b) => {
      const cmp = compareVietnameseNames(a.fullName, b.fullName);
      if (cmp !== 0) return cmp;
      return (a.studentCode || '').localeCompare(b.studentCode || '');
    });

    return students;
  } catch (err) {
    console.error('getStudents error:', err);
    return [];
  }
}

export async function toggleStudentStatus(uid: string, currentActive: boolean): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    active: !currentActive,
    updatedAt: serverTimestamp(),
  });
}

export async function getTeachers(): Promise<UserProfile[]> {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('role', '==', 'teacher'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
}

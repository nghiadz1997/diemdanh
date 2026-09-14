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

    students.sort((a, b) => {
      const tA = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : ((a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : 0);
      const tB = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : ((b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : 0);
      return tB - tA;
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

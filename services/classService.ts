import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ClassItem, ClassMember, UserProfile } from '@/types';
import { compareVietnameseNames } from '@/lib/utils';

export async function getClasses(): Promise<ClassItem[]> {
  try {
    const classesRef = collection(db, 'classes');
    let docs: any[] = [];
    try {
      const q = query(classesRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      docs = snap.docs;
    } catch {
      const snap = await getDocs(classesRef);
      docs = snap.docs;
    }
    const list = docs.map((d) => ({ id: d.id, ...d.data() } as ClassItem));
    list.sort((a, b) => {
      const tA = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : ((a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : 0);
      const tB = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : ((b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : 0);
      return tB - tA;
    });
    return list;
  } catch (err) {
    console.error('getClasses error:', err);
    return [];
  }
}

export async function getClassById(classId: string): Promise<ClassItem | null> {
  try {
    const docRef = doc(db, 'classes', classId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as ClassItem;
    }

    // Thử tìm theo classCode nếu docRef theo ID chưa tìm thấy
    const q = query(collection(db, 'classes'), where('classCode', '==', classId.toUpperCase()));
    const codeSnap = await getDocs(q);
    if (!codeSnap.empty) {
      const firstDoc = codeSnap.docs[0];
      return { id: firstDoc.id, ...firstDoc.data() } as ClassItem;
    }

    return null;
  } catch (err) {
    console.error('getClassById error:', err);
    return null;
  }
}

export async function createClass(data: {
  classCode: string;
  className: string;
  description?: string;
  academicYear?: string;
  semester?: string;
  teacherIds?: string[];
}): Promise<string> {
  const classesRef = collection(db, 'classes');
  const docRef = await addDoc(classesRef, {
    classCode: data.classCode.trim().toUpperCase(),
    className: data.className.trim(),
    description: data.description || '',
    academicYear: data.academicYear || '',
    semester: data.semester || '',
    teacherIds: data.teacherIds || [],
    studentCount: 0,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateClass(
  classId: string,
  data: Partial<ClassItem>
): Promise<void> {
  const docRef = doc(db, 'classes', classId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function getClassMembers(classId: string): Promise<ClassMember[]> {
  try {
    const membersRef = collection(db, 'classMembers');
    const q = query(membersRef, where('classId', '==', classId));
    const snap = await getDocs(q);

    // Tải dữ liệu người dùng song song qua Promise.all giúp tải siêu tốc, không bị lag/chờ lâu
    const activeDocs = snap.docs.filter((d) => (d.data() as any).active !== false);

    const members: ClassMember[] = await Promise.all(
      activeDocs.map(async (d) => {
        const memberData = { id: d.id, ...d.data() } as ClassMember;
        try {
          if (memberData.userId) {
            const userDoc = await getDoc(doc(db, 'users', memberData.userId));
            if (userDoc.exists()) {
              memberData.user = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
            }
          }
        } catch {
          // ignore
        }
        return memberData;
      })
    );

    // Sắp xếp danh sách sinh viên lớp theo thứ tự A, B, C bảng chữ cái chuẩn Việt Nam
    members.sort((a, b) => {
      const nameA = a.fullName || a.user?.fullName || '';
      const nameB = b.fullName || b.user?.fullName || '';
      const cmp = compareVietnameseNames(nameA, nameB);
      if (cmp !== 0) return cmp;
      const codeA = a.studentCode || a.user?.studentCode || '';
      const codeB = b.studentCode || b.user?.studentCode || '';
      return codeA.localeCompare(codeB);
    });

    return members;
  } catch (err) {
    console.error('getClassMembers error:', err);
    return [];
  }
}

export async function removeStudentFromClass(
  classId: string,
  userId: string
): Promise<void> {
  const memberId = `${classId}_${userId}`;
  const memberRef = doc(db, 'classMembers', memberId);
  try {
    await deleteDoc(memberRef);
  } catch {}
  try {
    await deleteDoc(doc(db, 'classMembers', userId));
  } catch {}
  if (userId.startsWith('sv_')) {
    try {
      await deleteDoc(doc(db, 'classMembers', `${classId}_${userId.replace('sv_', '')}`));
    } catch {}
  }

  const classRef = doc(db, 'classes', classId);
  try {
    await updateDoc(classRef, {
      studentCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  } catch {}

  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const currentClassIds: string[] = userSnap.data()?.classIds || [];
    const updated = currentClassIds.filter((cid) => cid !== classId);
    await updateDoc(userRef, {
      classIds: updated,
      updatedAt: serverTimestamp(),
    });
  }
}

export async function deleteClass(classId: string): Promise<void> {
  // 1. Xóa classMembers
  try {
    const memQ = query(collection(db, 'classMembers'), where('classId', '==', classId));
    const memSnap = await getDocs(memQ);
    for (const d of memSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Lỗi xóa classMembers khi xóa lớp:', err);
  }

  // 2. Xóa sessions
  try {
    const sessQ = query(collection(db, 'sessions'), where('classId', '==', classId));
    const sessSnap = await getDocs(sessQ);
    for (const d of sessSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Lỗi xóa sessions khi xóa lớp:', err);
  }

  // 3. Xóa attendance
  try {
    const attQ = query(collection(db, 'attendance'), where('classId', '==', classId));
    const attSnap = await getDocs(attQ);
    for (const d of attSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Lỗi xóa attendance khi xóa lớp:', err);
  }

  // 4. Xóa document lớp học chính
  await deleteDoc(doc(db, 'classes', classId));
}


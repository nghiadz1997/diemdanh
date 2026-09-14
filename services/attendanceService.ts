import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LessonSession, AttendanceRecord, AttendanceStatus } from '@/types';

export function generateRandom6DigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createSession(data: {
  classId: string;
  subjectId?: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime?: string;
  createdBy: string;
}): Promise<string> {
  const sessionsRef = collection(db, 'sessions');
  const docRef = await addDoc(sessionsRef, {
    classId: data.classId,
    subjectId: data.subjectId || '',
    title: data.title,
    description: data.description || '',
    date: new Date(data.date),
    startTime: new Date(`${data.date}T${data.startTime}`),
    endTime: data.endTime ? new Date(`${data.date}T${data.endTime}`) : null,
    attendanceCode: '',
    attendanceOpen: false,
    codeExpiresAt: null,
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function openAttendanceSession(
  sessionId: string,
  durationMinutes: number = 15
): Promise<{ code: string; expiresAt: Date }> {
  const code = generateRandom6DigitCode();
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  const sessionRef = doc(db, 'sessions', sessionId);
  await updateDoc(sessionRef, {
    attendanceCode: code,
    attendanceOpen: true,
    codeExpiresAt: Timestamp.fromDate(expiresAt),
    updatedAt: serverTimestamp(),
  });

  return { code, expiresAt };
}

export async function closeAttendanceSession(sessionId: string): Promise<void> {
  const sessionRef = doc(db, 'sessions', sessionId);
  await updateDoc(sessionRef, {
    attendanceOpen: false,
    updatedAt: serverTimestamp(),
  });
}

export async function getSessionById(sessionId: string): Promise<LessonSession | null> {
  const docRef = doc(db, 'sessions', sessionId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as LessonSession;
}

export async function getSessionsByClass(classId: string): Promise<LessonSession[]> {
  try {
    const sessionsRef = collection(db, 'sessions');
    const q = query(sessionsRef, where('classId', '==', classId));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LessonSession));
    return list.sort((a, b) => {
      const timeA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate().getTime() : 0;
      const timeB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate().getTime() : 0;
      return timeB - timeA;
    });
  } catch (err) {
    console.error('getSessionsByClass error:', err);
    return [];
  }
}

export async function updateManualAttendance(params: {
  sessionId: string;
  classId: string;
  userId: string;
  studentCode: string;
  studentName?: string;
  status: AttendanceStatus;
  markedBy: string;
  note?: string;
}): Promise<void> {
  const attendanceId = `${params.sessionId}_${params.userId}`;
  const attRef = doc(db, 'attendance', attendanceId);
  const attSnap = await getDoc(attRef);

  if (attSnap.exists()) {
    await updateDoc(attRef, {
      status: params.status,
      method: 'manual',
      markedBy: params.markedBy,
      note: params.note || '',
      updatedAt: serverTimestamp(),
    });
  } else {
    await addDoc(collection(db, 'attendance'), {
      sessionId: params.sessionId,
      classId: params.classId,
      userId: params.userId,
      studentCode: params.studentCode,
      studentName: params.studentName || '',
      status: params.status,
      checkInTime: serverTimestamp(),
      method: 'manual',
      markedBy: params.markedBy,
      note: params.note || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

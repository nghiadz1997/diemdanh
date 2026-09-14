import { Timestamp } from 'firebase/firestore';

export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'student';

export interface UserProfile {
  uid: string;
  studentCode?: string;
  teacherCode?: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  phone?: string;
  gender?: 'Nam' | 'Nữ' | 'Khác' | string;
  dateOfBirth?: string;
  placeOfBirth?: string; // Nơi Sinh
  hometown?: string; // Quê Quán
  permanentAddress?: string; // Hộ Khẩu Thường Trú
  cccd?: string; // Số CCCD
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
  classIds: string[];
  createdAt: any;
  updatedAt: any;
}

export interface ClassItem {
  id: string;
  classCode: string;
  className: string;
  description?: string;
  academicYear?: string;
  semester?: string;
  teacherIds: string[];
  studentCount: number;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface ClassMember {
  id: string;
  classId: string;
  userId: string;
  studentCode?: string;
  fullName?: string;
  gender?: string;
  dateOfBirth?: string;
  placeOfBirth?: string; // Nơi Sinh
  hometown?: string; // Quê Quán
  permanentAddress?: string; // Hộ Khẩu Thường Trú
  cccd?: string; // Số CCCD
  phone?: string;
  role: 'student' | 'teacher';
  joinedAt: any;
  active: boolean;
  user?: UserProfile;
}

export interface SubjectItem {
  id: string;
  subjectCode: string;
  subjectName: string;
  teacherId: string;
  classId: string;
  description?: string;
  createdAt: any;
}

export interface LessonSession {
  id: string;
  classId: string;
  subjectId?: string;
  title: string;
  description?: string;
  date: any;
  startTime: any;
  endTime?: any;
  attendanceCode: string;
  attendanceOpen: boolean;
  codeExpiresAt: any;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';
export type AttendanceMethod = 'code' | 'manual' | 'portal';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  classId: string;
  userId: string;
  studentCode: string;
  status: AttendanceStatus;
  checkInTime?: any;
  method: AttendanceMethod;
  markedBy?: string;
  note?: string;
  createdAt: any;
  updatedAt: any;
  studentName?: string;
}

export type PostType = 'announcement' | 'discussion' | 'assignment' | 'document';

export interface ForumPost {
  id: string;
  classId: string;
  authorId: string;
  authorName: string;
  authorRole?: UserRole;
  type: PostType;
  title: string;
  content: string;
  attachmentUrls: string[];
  pinned: boolean;
  commentsCount: number;
  createdAt: any;
  updatedAt: any;
}

export interface ForumComment {
  id: string;
  postId: string;
  classId: string;
  authorId: string;
  authorName: string;
  authorRole?: UserRole;
  content: string;
  createdAt: any;
  updatedAt?: any;
}

export interface AssignmentAttachment {
  name: string;
  url: string;
  type: string; // 'word' | 'excel' | 'pptx' | 'image' | 'pdf' | 'other'
  size?: number;
}

export interface AssignmentItem {
  id: string;
  classId: string;
  className?: string;
  teacherId?: string;
  title: string;
  description: string;
  textbookReference?: string; // Ví dụ: "Bài 3, 4 trang 52 giáo trình"
  attachments: (AssignmentAttachment | string)[];
  deadline: any;
  allowLateSubmission: boolean;
  createdAt: any;
  updatedAt: any;
}

export type SubmissionStatus = 'submitted' | 'late' | 'graded';

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  classId: string;
  studentId: string;
  studentCode: string;
  content?: string;
  fileUrls: string[];
  attachments?: AssignmentAttachment[];
  linkUrls: string[];
  submittedAt: any;
  status: SubmissionStatus;
  score?: number;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: any;
  studentName?: string;
}

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  classId: string;
  className?: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  reason: string;
  proofUrls?: AssignmentAttachment[];
  status: LeaveRequestStatus;
  adminNote?: string;
  approvedBy?: string;
  createdAt: any;
  updatedAt: any;
}

export type NotificationType = 'announcement' | 'assignment' | 'attendance' | 'deadline' | 'system';

export interface AppNotification {
  id: string;
  userId: string;
  classId?: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: any;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, any>;
  createdAt: any;
}

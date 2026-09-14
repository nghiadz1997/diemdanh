import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Địa chỉ email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
  rememberMe: z.boolean().optional().default(false),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6, "Vui lòng nhập mật khẩu hiện tại"),
    newPassword: z
      .string()
      .min(8, "Mật khẩu mới tối thiểu 8 ký tự")
      .regex(/[A-Z]/, "Cần ít nhất 1 chữ cái in hoa")
      .regex(/[a-z]/, "Cần ít nhất 1 chữ cái thường")
      .regex(/[0-9]/, "Cần ít nhất 1 chữ số"),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu mới"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

export const studentCreateSchema = z.object({
  studentCode: z
    .string()
    .min(2, "Mã sinh viên tối thiểu 2 ký tự")
    .transform((val) => val.trim().toUpperCase()),
  fullName: z.string().min(2, "Họ và tên tối thiểu 2 ký tự"),
  email: z.string().email("Email sinh viên không hợp lệ"),
  classId: z.string().min(1, "Vui lòng chọn mã lớp học"),
  password: z
    .string()
    .min(6, "Mật khẩu tối thiểu 6 ký tự"),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  phone: z.string().optional(),
  placeOfBirth: z.string().optional(),
  hometown: z.string().optional(),
  permanentAddress: z.string().optional(),
  cccd: z.string().optional(),
});

export const classCreateSchema = z.object({
  classCode: z
    .string()
    .min(2, "Mã lớp tối thiểu 2 ký tự")
    .transform((val) => val.trim().toUpperCase()),
  className: z.string().min(3, "Tên lớp tối thiểu 3 ký tự"),
  description: z.string().optional(),
  academicYear: z.string().optional(),
  semester: z.string().optional(),
  teacherIds: z.array(z.string()).default([]),
});

export const sessionCreateSchema = z.object({
  classId: z.string().min(1, "Vui lòng chọn lớp học"),
  subjectId: z.string().optional(),
  title: z.string().min(3, "Tiêu đề buổi học tối thiểu 3 ký tự"),
  description: z.string().optional(),
  date: z.string().min(1, "Vui lòng chọn ngày học"),
  startTime: z.string().min(1, "Vui lòng chọn giờ bắt đầu"),
  endTime: z.string().optional(),
  durationMinutes: z.number().min(5).max(180).default(15),
});

export const attendanceCheckInSchema = z.object({
  attendanceCode: z
    .string()
    .length(6, "Mã điểm danh phải gồm đúng 6 chữ số")
    .regex(/^[0-9]+$/, "Mã điểm danh chỉ bao gồm số"),
});

export const postCreateSchema = z.object({
  classId: z.string().min(1, "Vui lòng chọn lớp học"),
  title: z.string().min(3, "Tiêu đề tối thiểu 3 chữ cái"),
  content: z.string().min(5, "Nội dung bài viết tối thiểu 5 chữ cái"),
  type: z.enum(["announcement", "discussion", "assignment", "document"]),
  pinned: z.boolean().default(false),
});

export const commentCreateSchema = z.object({
  content: z.string().min(1, "Nội dung bình luận không được để trống"),
});

export const assignmentCreateSchema = z.object({
  classId: z.string().min(1, "Vui lòng chọn lớp học"),
  title: z.string().min(3, "Tiêu đề bài tập tối thiểu 3 ký tự"),
  description: z.string().min(5, "Nội dung yêu cầu bài tập tối thiểu 5 ký tự"),
  deadline: z.string().min(1, "Vui lòng chọn thời hạn nộp"),
  allowLateSubmission: z.boolean().default(true),
});

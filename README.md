# HỆ THỐNG QUẢN LÝ SINH VIÊN - ĐIỂM DANH - LỚP HỌC - DIỄN ĐÀN

Hệ thống ứng dụng Web giáo dục chất lượng cao (Education SaaS) phục vụ đào tạo, quản lý sinh viên, điểm danh thời gian thực qua mã số 6 số, diễn đàn trao đổi và giao nộp bài tập trực tuyến.

Ứng dụng được xây dựng trên nền tảng **Next.js App Router**, **TypeScript**, **Tailwind CSS**, **Firebase Authentication**, **Cloud Firestore**, **Firebase Storage** và **Firebase Admin SDK**.

---

## 1. Công nghệ & Tính năng nổi bật

- **Kiến trúc Next.js App Router & TypeScript**: Đảm bảo hiệu năng cao, type-safety tuyệt đối, server actions & API route bảo mật.
- **Firebase Authentication & Custom Claims**: Phân quyền 4 vai trò: super_admin, dmin, 	eacher, student.
- **Cơ chế Bắt buộc Đổi Mật Khẩu lần đầu**: Tài khoản học viên do Admin cấp bắt buộc phải đổi mật khẩu ở lần đăng nhập đầu tiên (mustChangePassword: true) trước khi được phép truy cập hệ thống.
- **Mở Điểm danh 6 số & Countdown Timer**: Giảng viên tạo mã 6 số ngẫu nhiên kèm thời hạn hiệu lực (5, 10, 15, 30 phút). Sinh viên xác nhận mã điểm danh trên thiết bị di động.
- **Bảng theo dõi Điểm danh Realtime**: Giảng viên quan sát danh sách có mặt / đi trễ / vắng tức thì theo thời gian thực và có thể điều chỉnh thủ công có ghi vết uditLogs.
- **Diễn đàn lớp học riêng biệt (Private Class Forum)**: Mỗi lớp có một bảng tin riêng, bảo mật bằng Firestore Rules, phân loại Thông báo, Thảo luận, Bài tập, Tài liệu.
- **Giao bài tập & Nộp bài trực tuyến**: Học viên nộp bài làm qua văn bản hoặc đường dẫn đính kèm; Giảng viên theo dõi và chấm điểm.
- **Giao diện hiện đại (Mobile-First)**: Tone màu tím/chàm (#4F46E5, #6D5DFB, #7C3AED), bo góc lớn mềm mại, tối ưu trải nghiệm trên điện thoại thông minh, máy tính bảng và máy tính để bàn.

---

## 2. Cấu trúc Thư mục

`	ext
├── app/
│   ├── (auth)/
│   │   ├── dang-nhap/          # Trang đăng nhập Email/Password & Google
│   │   ├── quen-mat-khau/      # Gửi email khôi phục mật khẩu
│   │   └── doi-mat-khau/       # Đổi mật khẩu bắt buộc ở lần đầu đăng nhập
│   ├── admin/
│   │   ├── dashboard/          # Bảng điều khiển quản trị & biểu đồ Recharts
│   │   ├── sinh-vien/          # Quản lý sinh viên, tạo tài khoản, nhập Excel/CSV
│   │   ├── lop-hoc/            # Quản lý lớp học & chi tiết lớp theo Tabs
│   │   ├── bao-cao/            # Báo cáo chuyên cần & xuất file Excel
│   │   ├── nhat-ky/            # Nhật ký kiểm toán auditLogs
│   │   └── cai-dat/            # Cài đặt hệ thống
│   ├── giang-vien/
│   │   ├── dashboard/          # Bảng điều khiển giảng viên
│   │   ├── lop-hoc/            # Danh sách lớp & mở phiên điểm danh
│   │   └── bai-tap/            # Quản lý bài tập & chấm điểm
│   ├── sinh-vien/
│   │   ├── dashboard/          # Bảng điều khiển sinh viên
│   │   ├── diem-danh/          # Nhập mã điểm danh 6 số
│   │   ├── lich-su-diem-danh/  # Lịch sử chuyên cần cá nhân
│   │   └── bai-tap/            # Nộp bài tập
│   ├── lop-hoc/[classId]/dien-dan/ # Diễn đàn trao đổi riêng của từng lớp
│   └── api/
│       ├── admin/students/create/  # API tạo sinh viên an toàn qua Admin SDK
│       ├── admin/students/import/  # API nhập danh sách CSV/Excel & sinh mật khẩu
│       └── attendance/check-in/    # API xác thực điểm danh 6 số server-side
├── components/
│   ├── layout/                 # Navbar, AdminSidebar, TeacherSidebar, StudentBottomNav
│   └── students/               # Form thêm sinh viên & Modal nhập Excel
├── lib/
│   ├── firebase.ts             # Cấu hình Client Firebase SDK
│   ├── firebase-admin.ts       # Cấu hình Server Firebase Admin SDK
│   └── auth-server.ts          # Helper xác thực Bearer Token & quyền hạn
├── scripts/
│   └── create-admin.ts         # Script khởi tạo Super Admin ban đầu
├── firestore.rules             # Quy tắc bảo mật Cloud Firestore
├── storage.rules               # Quy tắc bảo mật Firebase Storage
└── package.json
`

---

## 3. Hướng dẫn Cài đặt & Triển khai

### Bước 1: Cài đặt thư viện phụ thuộc
`ash
npm install
`

### Bước 2: Cấu hình biến môi trường
Tạo file .env.local tại thư mục gốc (hoặc tham khảo .env.example):
`env
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyACg9RfxTcXT7hr0VknJN-2wvfpl1jT-ok
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=qlktxnsg.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=qlktxnsg
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=qlktxnsg.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=476374592242
NEXT_PUBLIC_FIREBASE_APP_ID=1:476374592242:web:422231147b3fb3591b7e6b
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-FHLX18HE64

# Firebase Admin SDK (Lấy từ Firebase Console -> Project Settings -> Service Accounts)
FIREBASE_PROJECT_ID=qlktxnsg
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@qlktxnsg.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBA...-----END PRIVATE KEY-----\n"

# Thông tin tài khoản Super Admin ban đầu
ADMIN_EMAIL=admin@diemdanh.edu.vn
ADMIN_PASSWORD=Admin@2026Secure!
ADMIN_NAME=Super Administrator
`

### Bước 3: Triển khai Firebase Rules
Sử dụng Firebase CLI để triển khai quy tắc bảo mật:
`ash
firebase deploy --only firestore:rules,storage:rules
`

### Bước 4: Khởi tạo tài khoản Super Admin đầu tiên
Chạy lệnh script tích hợp sẵn:
`ash
npm run create-admin
`

### Bước 5: Chạy ứng dụng trên môi trường nội bộ
`ash
npm run dev
`
Truy cập [http://localhost:3000](http://localhost:3000).

---

## 4. Triển khai lên Vercel

1. Đẩy mã nguồn lên kho chứa GitHub / GitLab.
2. Đăng nhập Vercel và chọn **Add New Project** -> Chọn repository.
3. Trong phần **Environment Variables**, điền đầy đủ các biến từ .env.local (chú ý giá trị FIREBASE_PRIVATE_KEY cần giữ nguyên ký tự xuống dòng \n).
4. Bấm **Deploy**. Vercel sẽ tự động build và xuất bản ứng dụng.

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    });
  }
}

loadEnv();

const email = process.env.ADMIN_EMAIL || 'admin@diemdanh.edu.vn';
const password = process.env.ADMIN_PASSWORD || 'Admin@2026Secure!';
const displayName = process.env.ADMIN_NAME || 'Super Administrator';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'qlktxnsg';
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (admin.apps.length === 0) {
  if (clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  } else {
    admin.initializeApp({ projectId });
  }
}

async function createSuperAdmin() {
  console.log(`=== BẮT ĐẦU KHỞI TẠO SUPER ADMIN ===`);
  console.log(`Email: ${email}`);
  console.log(`Họ tên: ${displayName}`);

  try {
    let uid: string;
    try {
      const existingUser = await admin.auth().getUserByEmail(email);
      uid = existingUser.uid;
      console.log(`Tài khoản Auth đã tồn tại với UID: ${uid}`);
      await admin.auth().updateUser(uid, {
        password,
        displayName,
      });
    } catch (notFound) {
      const newUser = await admin.auth().createUser({
        email,
        password,
        displayName,
      });
      uid = newUser.uid;
      console.log(`Đã tạo tài khoản Auth mới với UID: ${uid}`);
    }

    await admin.auth().setCustomUserClaims(uid, {
      role: 'super_admin',
    });
    console.log(`Đã gán Custom Claim: { role: 'super_admin' }`);

    await admin.firestore().collection('users').doc(uid).set(
      {
        uid,
        fullName: displayName,
        email,
        role: 'super_admin',
        active: true,
        mustChangePassword: false,
        classIds: [],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`Đã lưu hồ sơ người dùng Firestore tại users/${uid}`);
    console.log(`=== KHỞI TẠO SUPER ADMIN THÀNH CÔNG! ===`);
  } catch (error) {
    console.error('Lỗi khởi tạo Super Admin:', error);
  }
}

createSuperAdmin();

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyACg9RfxTcXT7hr0VknJN-2wvfpl1jT-ok",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "qlktxnsg.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "qlktxnsg",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "qlktxnsg.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "476374592242",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:476374592242:web:422231147b3fb3591b7e6b",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-FHLX18HE64",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export async function createAuthUser(email: string, password: string, displayName?: string): Promise<string> {
  const secondaryAppName = "SecondaryAuthInstance";
  const secondaryApp = getApps().find((a) => a.name === secondaryAppName) || initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  if (displayName) {
    await updateProfile(userCredential.user, { displayName });
  }
  const uid = userCredential.user.uid;
  await signOut(secondaryAuth);
  return uid;
}

export { app, auth, db, storage };

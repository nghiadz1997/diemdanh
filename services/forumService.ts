import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PostType, UserRole } from '@/types';

export async function createForumPost(params: {
  classId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  type: PostType;
  title: string;
  content: string;
  attachmentUrls?: string[];
  pinned?: boolean;
}): Promise<string> {
  const postsRef = collection(db, 'posts');
  const docRef = await addDoc(postsRef, {
    classId: params.classId,
    authorId: params.authorId,
    authorName: params.authorName,
    authorRole: params.authorRole,
    type: params.type,
    title: params.title.trim(),
    content: params.content.trim(),
    attachmentUrls: params.attachmentUrls || [],
    pinned: params.pinned || false,
    commentsCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function togglePinPost(postId: string, currentPinned: boolean): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    pinned: !currentPinned,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteForumPost(postId: string): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  await deleteDoc(postRef);
}

export async function addForumComment(params: {
  postId: string;
  classId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
}): Promise<string> {
  const commentsRef = collection(db, 'comments');
  const docRef = await addDoc(commentsRef, {
    postId: params.postId,
    classId: params.classId,
    authorId: params.authorId,
    authorName: params.authorName,
    authorRole: params.authorRole,
    content: params.content.trim(),
    createdAt: serverTimestamp(),
  });

  // Increment commentsCount on the post
  const postRef = doc(db, 'posts', params.postId);
  await updateDoc(postRef, {
    commentsCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function deleteForumComment(commentId: string, postId: string): Promise<void> {
  const commentRef = doc(db, 'comments', commentId);
  await deleteDoc(commentRef);

  // Decrement commentsCount on the post
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    commentsCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
}

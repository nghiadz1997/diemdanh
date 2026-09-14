'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getClassById } from '@/services/classService';
import {
  createForumPost,
  togglePinPost,
  deleteForumPost,
  addForumComment,
} from '@/services/forumService';
import { ClassItem, ForumPost, ForumComment, PostType } from '@/types';
import { formatRelativeTime, getRoleBadgeColor, getRoleDisplayName } from '@/lib/utils';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  MessageSquare,
  Send,
  Pin,
  Trash2,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ClassForumPage() {
  const params = useParams();
  const classId = params.classId as string;
  const { user, profile, role } = useAuth();

  const [classData, setClassData] = useState<ClassItem | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | PostType>('all');
  const [loading, setLoading] = useState(true);

  // New Post Form
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<PostType>('discussion');
  const [submittingPost, setSubmittingPost] = useState(false);

  // Expanded Post for Comments
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    async function fetchClass() {
      try {
        const c = await getClassById(classId);
        setClassData(c);
      } catch (err) {
        console.error('Lỗi tải lớp:', err);
      } finally {
        setLoading(false);
      }
    }
    if (classId) fetchClass();
  }, [classId]);

  // Realtime listener for posts
  useEffect(() => {
    if (!classId) return;

    const q = query(
      collection(db, 'posts'),
      where('classId', '==', classId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ForumPost));
        list.sort((a, b) => {
          if (b.pinned !== a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
          const tA = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : ((a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : 0);
          const tB = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : ((b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : 0);
          return tB - tA;
        });
        setPosts(list);
      },
      (error) => {
        console.error('Lỗi lắng nghe bài đăng:', error);
      }
    );

    return () => unsubscribe();
  }, [classId]);

  // Realtime listener for comments of expanded post
  useEffect(() => {
    if (!expandedPostId) {
      setComments([]);
      return;
    }

    const q = query(
      collection(db, 'comments'),
      where('postId', '==', expandedPostId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ForumComment));
        list.sort((a, b) => {
          const tA = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : ((a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : 0);
          const tB = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : ((b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : 0);
          return tA - tB;
        });
        setComments(list);
      },
      (error) => {
        console.error('Lỗi lắng nghe bình luận:', error);
      }
    );

    return () => unsubscribe();
  }, [expandedPostId]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error('Vui lòng nhập tiêu đề và nội dung bài đăng');
      return;
    }

    if (!user || !profile) return;

    setSubmittingPost(true);
    try {
      await createForumPost({
        classId,
        authorId: user.uid,
        authorName: profile.fullName || 'Thành viên',
        authorRole: profile.role,
        type: newType,
        title: newTitle,
        content: newContent,
      });

      toast.success('Đã đăng bài viết lên diễn đàn lớp!');
      setNewTitle('');
      setNewContent('');
      if (role === 'student') setNewType('discussion');
    } catch (err: any) {
      toast.error('Không thể đăng bài viết');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!newCommentText.trim() || !user || !profile) return;

    setSubmittingComment(true);
    try {
      await addForumComment({
        postId,
        classId,
        authorId: user.uid,
        authorName: profile.fullName || 'Thành viên',
        authorRole: profile.role,
        content: newCommentText,
      });

      setNewCommentText('');
      toast.success('Đã gửi bình luận');
    } catch (err) {
      toast.error('Lỗi khi gửi bình luận');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleTogglePin = async (post: ForumPost) => {
    try {
      await togglePinPost(post.id, post.pinned);
      toast.success(post.pinned ? 'Đã bỏ ghim bài viết' : 'Đã ghim bài viết lên đầu');
    } catch (err) {
      toast.error('Lỗi khi ghim bài viết');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Bạn có chắc muốn xoá bài viết này?')) return;
    try {
      await deleteForumPost(postId);
      toast.success('Đã xoá bài viết');
      if (expandedPostId === postId) setExpandedPostId(null);
    } catch (err) {
      toast.error('Lỗi khi xoá bài');
    }
  };

  const isTeacherOrAdmin = role === 'teacher' || role === 'admin' || role === 'super_admin';

  const filteredPosts = posts.filter((p) => {
    if (activeTab === 'all') return true;
    return p.type === activeTab;
  });

  const getPostTypeBadge = (type: PostType) => {
    switch (type) {
      case 'announcement':
        return { label: 'Thông báo', className: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'assignment':
        return { label: 'Bài tập', className: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'document':
        return { label: 'Tài liệu', className: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'discussion':
      default:
        return { label: 'Thảo luận', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 mb-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>
        <div className="flex items-center justify-between">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {classData?.classCode}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Diễn đàn lớp: {classData?.className}
            </h1>
          </div>
        </div>
      </div>

      {/* Post Composer */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-card border border-slate-200/80 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Tạo bài đăng mới
        </h2>

        <form onSubmit={handleCreatePost} className="space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Tiêu đề bài viết..."
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            required
          />

          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Chia sẻ thông tin, đặt câu hỏi hoặc nội dung trao đổi cùng cả lớp..."
            rows={3}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            required
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Chuyên mục:</span>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as PostType)}
                className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="discussion">Thảo luận</option>
                {isTeacherOrAdmin && (
                  <>
                    <option value="announcement">Thông báo chung</option>
                    <option value="document">Tài liệu học tập</option>
                    <option value="assignment">Bài tập giao</option>
                  </>
                )}
              </select>
            </div>

            <button
              type="submit"
              disabled={submittingPost}
              className="py-2.5 px-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-indigo-100 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all disabled:opacity-60"
            >
              {submittingPost ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Đăng bài</span>
            </button>
          </div>
        </form>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-200/80 gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'Tất cả bài viết' },
          { key: 'announcement', label: 'Thông báo' },
          { key: 'discussion', label: 'Thảo luận' },
          { key: 'assignment', label: 'Bài tập' },
          { key: 'document', label: 'Tài liệu' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Posts Feed */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-xs font-medium">Đang tải bảng tin diễn đàn...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-slate-200/80">
            <MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Chưa có bài viết nào</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Hãy là người đầu tiên bắt đầu cuộc thảo luận trong lớp!
            </p>
          </div>
        ) : (
          filteredPosts.map((post) => {
            const typeBadge = getPostTypeBadge(post.type);
            const isAuthor = user?.uid === post.authorId;
            const isExpanded = expandedPostId === post.id;

            return (
              <div
                key={post.id}
                className={`bg-white rounded-3xl p-5 sm:p-6 shadow-card border transition-all ${
                  post.pinned
                    ? 'border-indigo-300 ring-2 ring-indigo-50'
                    : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                      {post.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {post.authorName}
                        </span>
                        {post.authorRole && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getRoleBadgeColor(
                              post.authorRole
                            )}`}
                          >
                            {getRoleDisplayName(post.authorRole)}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {formatRelativeTime(post.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${typeBadge.className}`}
                    >
                      {typeBadge.label}
                    </span>

                    {isTeacherOrAdmin && (
                      <button
                        onClick={() => handleTogglePin(post)}
                        className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                          post.pinned
                            ? 'text-indigo-600 bg-indigo-50'
                            : 'text-slate-400 hover:bg-slate-100'
                        }`}
                        title={post.pinned ? 'Bỏ ghim' : 'Ghim bài'}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                    )}

                    {(isAuthor || isTeacherOrAdmin) && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-slate-100 cursor-pointer"
                        title="Xoá bài viết"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3.5 space-y-2">
                  <h3 className="text-sm font-bold text-slate-900">{post.title}</h3>
                  <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                    {post.content}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{post.commentsCount || 0} bình luận</span>
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-3 animate-in fade-in-50">
                    <div className="space-y-2.5 max-h-72 overflow-y-auto">
                      {comments.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">
                          Chưa có bình luận nào. Hãy gửi bình luận đầu tiên!
                        </p>
                      ) : (
                        comments.map((c) => (
                          <div
                            key={c.id}
                            className="bg-slate-50 rounded-2xl p-3 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800">
                                {c.authorName}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatRelativeTime(c.createdAt)}
                              </span>
                            </div>
                            <p className="text-slate-700">{c.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <input
                        type="text"
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(post.id);
                        }}
                        placeholder="Viết câu trả lời hoặc bình luận..."
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        disabled={submittingComment || !newCommentText.trim()}
                        className="py-2 px-3 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                      >
                        Gửi
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

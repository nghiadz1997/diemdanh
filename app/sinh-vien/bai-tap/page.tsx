'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { collection, query, getDocs, orderBy, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AssignmentItem, AssignmentSubmission, AssignmentAttachment } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  FileText,
  Clock,
  CheckCircle2,
  Loader2,
  X,
  BookOpen,
  Paperclip,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Presentation,
  Link as LinkIcon,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

function getFileCategory(name: string, type?: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['doc', 'docx'].includes(ext) || type?.includes('word')) return 'word';
  if (['xls', 'xlsx', 'csv'].includes(ext) || type?.includes('sheet') || type?.includes('excel')) return 'excel';
  if (['ppt', 'pptx'].includes(ext) || type?.includes('presentation') || type?.includes('powerpoint')) return 'pptx';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || type?.startsWith('image/')) return 'image';
  if (ext === 'pdf' || type?.includes('pdf')) return 'pdf';
  return 'other';
}

function renderFileBadge(att: AssignmentAttachment | string, key: any) {
  const name = typeof att === 'string' ? att : att.name;
  const url = typeof att === 'string' ? att : att.url;
  const category = typeof att === 'string' ? getFileCategory(name) : (att.type || getFileCategory(name));

  let badgeColor = 'bg-slate-50 text-slate-700 border-slate-200';
  let Icon = FileText;

  if (category === 'word') {
    badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
    Icon = FileText;
  } else if (category === 'excel') {
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    Icon = FileSpreadsheet;
  } else if (category === 'pptx') {
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    Icon = Presentation;
  } else if (category === 'image') {
    badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
    Icon = ImageIcon;
  } else if (category === 'pdf') {
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
    Icon = FileText;
  }

  return (
    <a
      key={key}
      href={url}
      download={name}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all hover:shadow-sm cursor-pointer ${badgeColor}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate max-w-[140px] sm:max-w-[200px]">{name}</span>
      <Download className="w-3 h-3 ml-0.5 opacity-60 hover:opacity-100" />
    </a>
  );
}

export default function StudentAssignmentsPage() {
  const { user, profile } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [submissions, setSubmissions] = useState<Map<string, AssignmentSubmission>>(new Map());
  const [loading, setLoading] = useState(true);

  // Submit Modal
  const [activeAssignment, setActiveAssignment] = useState<AssignmentItem | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [studentAttachments, setStudentAttachments] = useState<AssignmentAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View submission modal
  const [viewSubmission, setViewSubmission] = useState<{
    assignment: AssignmentItem;
    submission: AssignmentSubmission;
  } | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [assignSnap, subSnap] = await Promise.all([
        getDocs(query(collection(db, 'assignments'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'submissions')),
      ]);

      const aList = assignSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AssignmentItem));
      setAssignments(aList);

      const subMap = new Map<string, AssignmentSubmission>();
      subSnap.docs.forEach((d) => {
        const data = d.data() as AssignmentSubmission;
        if (data.studentId === user.uid) {
          subMap.set(data.assignmentId, { ...data, id: d.id });
        }
      });
      setSubmissions(subMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`File ${file.name} vượt quá 15MB. Vui lòng chọn file nhỏ hơn.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Url = event.target?.result as string;
        setStudentAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            url: base64Url,
            type: getFileCategory(file.name, file.type),
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setStudentAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignment || !user) return;

    if (!submissionText.trim() && !submissionLink.trim() && studentAttachments.length === 0) {
      toast.error('Vui lòng nhập nội dung, đính kèm file hoặc đường link bài làm');
      return;
    }

    setSubmitting(true);
    try {
      const submissionId = `${activeAssignment.id}_${user.uid}`;
      const now = new Date();
      const deadlineDate =
        activeAssignment.deadline && typeof activeAssignment.deadline.toDate === 'function'
          ? activeAssignment.deadline.toDate()
          : new Date(activeAssignment.deadline);

      const status = now > deadlineDate ? 'late' : 'submitted';

      await setDoc(doc(db, 'submissions', submissionId), {
        assignmentId: activeAssignment.id,
        classId: activeAssignment.classId,
        studentId: user.uid,
        studentCode: profile?.studentCode || '',
        studentName: profile?.fullName || '',
        content: submissionText,
        linkUrls: submissionLink ? [submissionLink] : [],
        fileUrls: studentAttachments.map((a) => a.url),
        attachments: studentAttachments,
        submittedAt: serverTimestamp(),
        status,
      });

      toast.success(status === 'late' ? 'Đã nộp bài (Trễ hạn)' : 'Nộp bài tập thành công!');
      setActiveAssignment(null);
      setSubmissionText('');
      setSubmissionLink('');
      setStudentAttachments([]);
      fetchData();
    } catch (err) {
      toast.error('Lỗi khi nộp bài tập');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Bài tập & Nhiệm vụ học tập
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Theo dõi bài tập giáo trình, tải tài liệu đính kèm và nộp bài trực tuyến
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-card border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Chưa có bài tập nào cần làm</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {assignments.map((a) => {
              const submission = submissions.get(a.id);
              const isSubmitted = !!submission;

              return (
                <div
                  key={a.id}
                  className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {a.className || 'Lớp học'}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">{a.title}</h3>
                    </div>

                    {/* Textbook Reference */}
                    {a.textbookReference && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/80 text-amber-800 rounded-xl text-xs font-semibold border border-amber-200/60">
                        <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{a.textbookReference}</span>
                      </div>
                    )}

                    {a.description && (
                      <p className="text-xs text-slate-600 whitespace-pre-line line-clamp-3">
                        {a.description}
                      </p>
                    )}

                    {/* Teacher Attachments (Word, PPT, Excel, Images, PDF) */}
                    {a.attachments && a.attachments.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          Tài liệu đính kèm của giáo viên ({a.attachments.length}):
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {a.attachments.map((att, idx) => renderFileBadge(att, idx))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Hạn chót: {formatDate(a.deadline, 'HH:mm dd/MM/yyyy')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {isSubmitted ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {submission.status === 'late' ? 'Đã nộp (Trễ)' : 'Đã nộp bài'}
                          </span>
                        </span>
                        {submission?.score !== undefined && (
                          <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-200">
                            Điểm: {submission.score}/10
                          </span>
                        )}
                        <button
                          onClick={() => setViewSubmission({ assignment: a, submission })}
                          className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl border border-indigo-100 transition-all cursor-pointer"
                          title="Xem lại bài nộp"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setSubmissionText('');
                          setSubmissionLink('');
                          setStudentAttachments([]);
                          setActiveAssignment(a);
                        }}
                        className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-indigo-100 cursor-pointer active:scale-95 transition-all"
                      >
                        Nộp bài tập
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL NỘP BÀI TẬP */}
      {activeAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Nộp bài tập</h3>
                <p className="text-xs text-indigo-600 font-semibold line-clamp-1">{activeAssignment.title}</p>
                {activeAssignment.textbookReference && (
                  <p className="text-[11px] text-amber-700 mt-0.5">{activeAssignment.textbookReference}</p>
                )}
              </div>
              <button
                onClick={() => setActiveAssignment(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Nội dung bài làm / Trả lời câu hỏi
                </label>
                <textarea
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  rows={4}
                  placeholder="Nhập nội dung bài làm, câu trả lời..."
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Tệp đính kèm nộp bài (Word, Excel, PPTX, Ảnh, PDF) */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Đính kèm tệp bài làm (Word, Excel, PowerPoint, PDF, Hình ảnh)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.pdf,image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="student-assignment-file"
                />
                <label
                  htmlFor="student-assignment-file"
                  className="w-full border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/30 rounded-2xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  <Paperclip className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-indigo-600">Chọn tệp đính kèm từ máy</span>
                  <span className="text-[10px] text-slate-400">Word, PowerPoint, Excel, PDF hoặc Ảnh bài làm</span>
                </label>

                {studentAttachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {studentAttachments.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate font-medium text-slate-700">{f.name}</span>
                          {f.size && (
                            <span className="text-[10px] text-slate-400 shrink-0">
                              ({(f.size / 1024).toFixed(1)} KB)
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Đường link đính kèm (Google Drive / GitHub / Docs)
                </label>
                <div className="relative">
                  <LinkIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    value={submissionLink}
                    onChange={(e) => setSubmissionLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveAssignment(null)}
                  className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-100 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang nộp bài...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Xác nhận nộp bài</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XEM LẠI BÀI NỘP */}
      {viewSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Chi tiết bài nộp của bạn</h3>
                <p className="text-xs text-indigo-600 font-semibold line-clamp-1">
                  {viewSubmission.assignment.title}
                </p>
              </div>
              <button
                onClick={() => setViewSubmission(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold mb-1">Trạng thái:</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {viewSubmission.submission.status === 'late' ? 'Nộp trễ hạn' : 'Đã nộp đúng hạn'}
                </span>
              </div>

              {viewSubmission.submission.content && (
                <div>
                  <span className="text-slate-400 block font-semibold mb-1">Nội dung bài làm:</span>
                  <div className="p-3 bg-slate-50 rounded-xl text-slate-800 whitespace-pre-line border border-slate-200">
                    {viewSubmission.submission.content}
                  </div>
                </div>
              )}

              {/* Attached files */}
              {viewSubmission.submission.attachments &&
                viewSubmission.submission.attachments.length > 0 && (
                  <div>
                    <span className="text-slate-400 block font-semibold mb-1">Tệp đã nộp:</span>
                    <div className="flex flex-wrap gap-2">
                      {viewSubmission.submission.attachments.map((att, idx) =>
                        renderFileBadge(att, idx)
                      )}
                    </div>
                  </div>
                )}

              {viewSubmission.submission.linkUrls &&
                viewSubmission.submission.linkUrls.length > 0 && (
                  <div>
                    <span className="text-slate-400 block font-semibold mb-1">Link đính kèm:</span>
                    <div className="space-y-1">
                      {viewSubmission.submission.linkUrls.map((lnk, idx) => (
                        <a
                          key={idx}
                          href={lnk}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline flex items-center gap-1 break-all"
                        >
                          <LinkIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{lnk}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

              {viewSubmission.submission.score !== undefined && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1">
                  <span className="font-bold text-indigo-900 block">
                    Điểm số: {viewSubmission.submission.score}/10
                  </span>
                  {viewSubmission.submission.feedback && (
                    <p className="text-indigo-700">
                      Nhận xét: {viewSubmission.submission.feedback}
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setViewSubmission(null)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


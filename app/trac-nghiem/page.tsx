'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { MODULES, QUESTIONS, QuestionItem } from '@/lib/quiz-data';
import { QuizVisual } from '@/components/quiz/QuizVisual';
import { recordQuizHistory, getRecentQuizHistory, QuizHistoryRecord } from '@/services/quizService';
import { toast } from 'sonner';
import {
  Clock,
  CheckCircle2,
  BookOpen,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Sun,
  Moon,
  UserCheck,
  User,
  GraduationCap,
  Sparkles,
  Shuffle,
  Search,
  Check,
  X,
  RotateCcw,
  History,
  Award,
  Users
} from 'lucide-react';

interface IdentifiedStudent {
  studentCode: string;
  fullName: string;
  classId?: string;
  className?: string;
  classCode?: string;
}

interface ExamRecord {
  date: string;
  studentCode: string;
  studentName: string;
  correct: number;
  total: number;
  score: number;
  passed: boolean;
}

const STORAGE_STATS_KEY = 'bk_cntt_300_stats_v2';
const STORAGE_STUDENT_KEY = 'bk_cntt_300_student_v2';

export default function TracNghiemPortalPage() {
  const { profile } = useAuth();

  // 1. Quản lý nhận diện sinh viên (Chỉ cần MSSV, không bắt buộc đăng nhập)
  const [student, setStudent] = useState<IdentifiedStudent | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [customName, setCustomName] = useState('');
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [detectedStudent, setDetectedStudent] = useState<IdentifiedStudent | null>(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<((s: IdentifiedStudent) => void) | null>(null);

  // 2. Trạng thái Quiz & Navigation
  const [view, setView] = useState<'HOME' | 'QUIZ' | 'RESULT' | 'SEARCH'>('HOME');
  const [mode, setMode] = useState<'PRACTICE' | 'EXAM' | 'WRONG'>('PRACTICE');
  const [title, setTitle] = useState('');
  const [quizList, setQuizList] = useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showKeyMode, setShowKeyMode] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 phút = 1800s
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 3. Tiến độ học tập & Thống kê
  const [wrongIds, setWrongIds] = useState<number[]>([]);
  const [masteredIds, setMasteredIds] = useState<number[]>([]);
  const [examHistory, setExamHistory] = useState<ExamRecord[]>([]);

  // Lịch sử thời gian thực lưu trên Firestore
  const [liveHistory, setLiveHistory] = useState<QuizHistoryRecord[]>([]);
  const [loadingLiveHistory, setLoadingLiveHistory] = useState(false);

  // 4. Tìm kiếm
  const [searchQuery, setSearchQuery] = useState('');
  const [searchModule, setSearchModule] = useState(0);

  // 5. Custom Confirm Modal
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Tải lịch sử làm bài từ Firestore
  const fetchLiveHistory = useCallback(async () => {
    setLoadingLiveHistory(true);
    try {
      const records = await getRecentQuizHistory(10);
      setLiveHistory(records);
    } catch (e) {
      console.warn('Không thể tải lịch sử làm bài:', e);
    } finally {
      setLoadingLiveHistory(false);
    }
  }, []);

  // Khởi tạo DarkMode, LocalStorage & Live History
  useEffect(() => {
    const isDark =
      document.documentElement.classList.contains('dark') ||
      localStorage.getItem('bk_theme') === 'dark';
    setIsDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');

    // Thống kê đã lưu
    try {
      const rawStats = localStorage.getItem(STORAGE_STATS_KEY);
      if (rawStats) {
        const parsed = JSON.parse(rawStats);
        if (parsed.wrongIds) setWrongIds(parsed.wrongIds);
        if (parsed.masteredIds) setMasteredIds(parsed.masteredIds);
        if (parsed.examHistory) setExamHistory(parsed.examHistory);
      }
    } catch (e) {}

    // Nhận diện sinh viên đã lưu từ trước (không cần đăng nhập lại)
    try {
      const rawStudent = localStorage.getItem(STORAGE_STUDENT_KEY);
      if (rawStudent) {
        const s = JSON.parse(rawStudent);
        setStudent(s);
        setInputCode(s.studentCode || '');
      }
    } catch (e) {}

    // Tải lịch sử nộp bài toàn trường
    fetchLiveHistory();
  }, [fetchLiveHistory]);

  // Tự động nhận diện nếu sinh viên đang đăng nhập sẵn trên máy
  useEffect(() => {
    if (profile?.role === 'student' && profile.studentCode) {
      const currentStu: IdentifiedStudent = {
        studentCode: profile.studentCode,
        fullName: profile.fullName || 'Sinh viên',
      };
      setStudent(currentStu);
      localStorage.setItem(STORAGE_STUDENT_KEY, JSON.stringify(currentStu));
    }
  }, [profile]);

  // Lưu thống kê vào localStorage khi có cập nhật
  const saveStatsToStorage = useCallback(
    (wIds: number[], mIds: number[], eHist: ExamRecord[]) => {
      try {
        localStorage.setItem(
          STORAGE_STATS_KEY,
          JSON.stringify({ wrongIds: wIds, masteredIds: mIds, examHistory: eHist })
        );
      } catch (e) {}
    },
    []
  );

  // Tra cứu sinh viên theo MSSV thời gian thực khi người dùng gõ
  useEffect(() => {
    const code = inputCode.trim().toUpperCase();
    if (code.length < 2) {
      setDetectedStudent(null);
      return;
    }

    setSearchingStudent(true);
    const timer = setTimeout(async () => {
      try {
        // 1. Tìm trong classMembers
        const snapM = await getDocs(
          query(collection(db, 'classMembers'), where('studentCode', '==', code))
        );
        if (!snapM.empty) {
          const mData = snapM.docs[0].data();
          let cName = mData.className;
          let cCode = mData.classCode;
          if (!cName && mData.classId) {
            try {
              const cSnap = await getDoc(doc(db, 'classes', mData.classId));
              if (cSnap.exists()) {
                cName = cSnap.data().className;
                cCode = cSnap.data().classCode;
              }
            } catch (e) {}
          }
          const found: IdentifiedStudent = {
            studentCode: code,
            fullName: (mData.fullName || `Sinh viên ${code}`).trim(),
            classId: mData.classId,
            className: cName,
            classCode: cCode,
          };
          setDetectedStudent(found);
          setSearchingStudent(false);
          return;
        }

        // 2. Tìm trong users
        const snapU = await getDocs(
          query(collection(db, 'users'), where('studentCode', '==', code))
        );
        if (!snapU.empty) {
          const uData = snapU.docs[0].data();
          const found = {
            studentCode: code,
            fullName: uData.fullName || uData.displayName || `Sinh viên ${code}`,
          };
          setDetectedStudent(found);
          setSearchingStudent(false);
          return;
        }

        setDetectedStudent(null);
      } catch (err) {
        setDetectedStudent(null);
      } finally {
        setSearchingStudent(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputCode]);

  // Xác nhận lưu thông tin sinh viên chỉ bằng Mã SV (không cần đăng nhập)
  const handleConfirmStudent = (overrideCode?: string) => {
    const code = (overrideCode || inputCode).trim().toUpperCase();
    if (!code) {
      toast.error('Vui lòng nhập Mã số sinh viên (MSSV)');
      setShowStudentModal(true);
      return null;
    }

    const finalStudent: IdentifiedStudent = detectedStudent && detectedStudent.studentCode === code
      ? detectedStudent
      : {
          studentCode: code,
          fullName: customName.trim() || (detectedStudent?.fullName) || `Sinh viên ${code}`,
        };

    setStudent(finalStudent);
    localStorage.setItem(STORAGE_STUDENT_KEY, JSON.stringify(finalStudent));
    setShowStudentModal(false);
    toast.success(`Đã nhận diện: ${finalStudent.fullName} (${finalStudent.studentCode})`);

    // Lưu sự kiện nhập mã vào làm bài vào Firestore
    recordQuizHistory({
      studentCode: finalStudent.studentCode,
      studentName: finalStudent.fullName,
      classId: finalStudent.classId,
      className: finalStudent.className,
      action: 'start',
      mode: 'PORTAL',
      title: 'Nhập mã vào cổng ôn thi trắc nghiệm',
    });

    // Thực thi hành động đang chờ nếu có (ví dụ: bấm thi thử)
    if (pendingAction) {
      pendingAction(finalStudent);
      setPendingAction(null);
    }

    return finalStudent;
  };

  // Mở modal đổi sinh viên
  const handleChangeStudent = () => {
    setInputCode(student?.studentCode || '');
    setCustomName(student?.fullName || '');
    setShowStudentModal(true);
  };

  // Toggle Theme
  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('bk_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('bk_theme', 'light');
    }
  };

  // Đếm ngược thời gian khi thi thử
  useEffect(() => {
    if (view === 'QUIZ' && mode === 'EXAM' && !reviewMode) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            finishExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [view, mode, reviewMode]);

  // Phím tắt bàn phím
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view !== 'QUIZ') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      if (key === 'arrowright') {
        setCurrentIndex((prev) => Math.min(prev + 1, quizList.length - 1));
      } else if (key === 'arrowleft') {
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
      } else if (key === 'a' || key === '1') {
        handleSelectOption(0);
      } else if (key === 'b' || key === '2') {
        handleSelectOption(1);
      } else if (key === 'c' || key === '3') {
        handleSelectOption(2);
      } else if (key === 'd' || key === '4') {
        handleSelectOption(3);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, quizList, currentIndex, answers, reviewMode, mode]);

  // Format thời gian mm:ss
  const formatTime = (sec: number) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // Bắt đầu luyện tập
  const startPractice = (moduleId: number = 0, shuffle: boolean = false) => {
    let currentStu = student;
    if (!currentStu) {
      if (inputCode.trim()) {
        currentStu = handleConfirmStudent();
        if (!currentStu) return;
      } else {
        setPendingAction(() => (s: IdentifiedStudent) => {
          setStudent(s);
          executeStartPractice(moduleId, shuffle, s);
        });
        setShowStudentModal(true);
        return;
      }
    }
    executeStartPractice(moduleId, shuffle, currentStu);
  };

  const executeStartPractice = (moduleId: number, shuffle: boolean, activeStudent: IdentifiedStudent) => {
    let list = moduleId === 0 ? [...QUESTIONS] : QUESTIONS.filter((q) => q.module === moduleId);
    if (shuffle) {
      list = [...list].sort(() => Math.random() - 0.5);
    }

    const titleText =
      moduleId === 0
        ? shuffle
          ? 'Ôn tập 300 câu (Xáo trộn ngẫu nhiên)'
          : 'Ôn tập trọn bộ 300 câu CNTT Cơ bản'
        : `Ôn tập ${MODULES[moduleId - 1].name}: ${MODULES[moduleId - 1].title}`;

    setMode('PRACTICE');
    setTitle(titleText);
    setQuizList(list);
    setCurrentIndex(0);
    setAnswers({});
    setShowKeyMode(false);
    setReviewMode(false);
    setView('QUIZ');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Lưu vào lịch sử Firestore
    recordQuizHistory({
      studentCode: activeStudent.studentCode,
      studentName: activeStudent.fullName,
      classId: activeStudent.classId,
      className: activeStudent.className,
      action: 'start',
      mode: 'PRACTICE',
      title: titleText,
    });
  };

  // Bắt đầu ôn các câu làm sai
  const startWrongPractice = () => {
    let currentStu = student;
    if (!currentStu) {
      if (inputCode.trim()) {
        currentStu = handleConfirmStudent();
        if (!currentStu) return;
      } else {
        setPendingAction(() => (s: IdentifiedStudent) => {
          setStudent(s);
          executeStartWrongPractice(s);
        });
        setShowStudentModal(true);
        return;
      }
    }
    executeStartWrongPractice(currentStu);
  };

  const executeStartWrongPractice = (activeStudent: IdentifiedStudent) => {
    const list = QUESTIONS.filter((q) => wrongIds.includes(q.id));
    if (list.length === 0) {
      toast.info('Bạn chưa có câu nào làm sai. Hãy bắt đầu luyện tập hoặc thi thử trước nhé!');
      return;
    }
    const titleText = `Ôn lại ${list.length} câu đã làm sai`;
    setMode('WRONG');
    setTitle(titleText);
    setQuizList(list);
    setCurrentIndex(0);
    setAnswers({});
    setShowKeyMode(false);
    setReviewMode(false);
    setView('QUIZ');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    recordQuizHistory({
      studentCode: activeStudent.studentCode,
      studentName: activeStudent.fullName,
      classId: activeStudent.classId,
      className: activeStudent.className,
      action: 'start',
      mode: 'WRONG',
      title: titleText,
    });
  };

  // Bắt đầu thi thử chuẩn (30 câu - 30 phút, 5 câu mỗi Module)
  const startExam = () => {
    let currentStu = student;
    if (!currentStu) {
      if (inputCode.trim()) {
        currentStu = handleConfirmStudent();
        if (!currentStu) return;
      } else {
        setPendingAction(() => (s: IdentifiedStudent) => {
          setStudent(s);
          executeStartExam(s);
        });
        setShowStudentModal(true);
        return;
      }
    }
    executeStartExam(currentStu);
  };

  const executeStartExam = (activeStudent: IdentifiedStudent) => {
    let examList: QuestionItem[] = [];
    for (let m = 1; m <= 6; m++) {
      const pool = QUESTIONS.filter((q) => q.module === m).sort(() => Math.random() - 0.5);
      examList.push(...pool.slice(0, 5));
    }
    examList.sort(() => Math.random() - 0.5);

    const titleText = 'Thi thử chuẩn ĐH Bách Khoa (30 câu - 30 phút)';
    setMode('EXAM');
    setTitle(titleText);
    setQuizList(examList);
    setCurrentIndex(0);
    setAnswers({});
    setShowKeyMode(false);
    setReviewMode(false);
    setTimeLeft(1800);
    setView('QUIZ');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Lưu vào lịch sử Firestore
    recordQuizHistory({
      studentCode: activeStudent.studentCode,
      studentName: activeStudent.fullName,
      classId: activeStudent.classId,
      className: activeStudent.className,
      action: 'start',
      mode: 'EXAM',
      title: titleText,
    });
  };

  // Chọn đáp án
  const handleSelectOption = (optIdx: number) => {
    if (reviewMode) return;
    const currentQ = quizList[currentIndex];
    if (mode !== 'EXAM' && answers[currentIndex] !== undefined) return;

    const newAnswers = { ...answers, [currentIndex]: optIdx };
    setAnswers(newAnswers);

    // Cập nhật câu đúng / sai trong chế độ luyện tập
    if (mode !== 'EXAM') {
      const isCorrect = optIdx === currentQ.correct;
      let newMastered = [...masteredIds];
      let newWrong = [...wrongIds];

      if (isCorrect) {
        if (!newMastered.includes(currentQ.id)) newMastered.push(currentQ.id);
        newWrong = newWrong.filter((id) => id !== currentQ.id);
      } else {
        if (!newWrong.includes(currentQ.id)) newWrong.push(currentQ.id);
      }

      setMasteredIds(newMastered);
      setWrongIds(newWrong);
      saveStatsToStorage(newWrong, newMastered, examHistory);
    }
  };

  // Nộp bài thi
  const confirmFinishExam = () => {
    const answeredCount = Object.keys(answers).length;
    const total = quizList.length;
    const msg =
      answeredCount < total
        ? `Bạn mới trả lời ${answeredCount}/${total} câu. Bạn có chắc chắn muốn nộp bài ngay bây giờ?`
        : `Bạn đã hoàn thành tất cả ${total}/${total} câu. Xác nhận nộp bài để chấm điểm?`;

    setConfirmModal({
      open: true,
      title: 'Nộp bài thi thử',
      message: msg,
      onConfirm: () => finishExam(),
    });
  };

  // Chấm điểm và lưu kết quả
  const finishExam = () => {
    let correctCount = 0;
    let newMastered = [...masteredIds];
    let newWrong = [...wrongIds];

    quizList.forEach((q, i) => {
      if (answers[i] === q.correct) {
        correctCount++;
        if (!newMastered.includes(q.id)) newMastered.push(q.id);
        newWrong = newWrong.filter((id) => id !== q.id);
      } else {
        if (!newWrong.includes(q.id)) newWrong.push(q.id);
      }
    });

    const score10 = Number(((correctCount / quizList.length) * 10).toFixed(2));
    const passed = score10 >= 5;

    const newRecord: ExamRecord = {
      date: new Date().toLocaleString('vi-VN'),
      studentCode: student?.studentCode || 'N/A',
      studentName: student?.fullName || 'Sinh viên',
      correct: correctCount,
      total: quizList.length,
      score: score10,
      passed,
    };

    const newHistory = [newRecord, ...examHistory].slice(0, 10);
    setExamHistory(newHistory);
    setMasteredIds(newMastered);
    setWrongIds(newWrong);
    saveStatsToStorage(newWrong, newMastered, newHistory);

    // LƯU LỊCH SỬ NỘP BÀI VÀO FIRESTORE (HỆ THỐNG GHI NHẬN VÀ LƯU VĨNH VIỄN)
    recordQuizHistory({
      studentCode: student?.studentCode || 'N/A',
      studentName: student?.fullName || 'Sinh viên',
      classId: student?.classId,
      className: student?.className,
      action: 'submit',
      mode: 'EXAM',
      title: title || 'Thi thử chuẩn ĐH Bách Khoa (30 câu)',
      score: score10,
      correct: correctCount,
      total: quizList.length,
      passed,
    }).then(() => {
      fetchLiveHistory();
    });

    setView('RESULT');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Xác nhận quay về trang chủ
  const confirmGoHome = () => {
    if (view === 'QUIZ' && mode === 'EXAM' && !reviewMode) {
      setConfirmModal({
        open: true,
        title: 'Thoát bài thi thử?',
        message: 'Tiến trình bài thi hiện tại sẽ bị hủy nếu bạn thoát lúc này. Bạn có chắc chắn muốn về Trang chủ?',
        onConfirm: () => {
          setView('HOME');
          fetchLiveHistory();
        },
      });
    } else {
      setView('HOME');
      fetchLiveHistory();
    }
  };

  // Reset tiến độ học tập
  const clearProgress = () => {
    setConfirmModal({
      open: true,
      title: 'Xóa dữ liệu tiến độ?',
      message: 'Toàn bộ thống kê câu đã thuộc, câu làm sai và lịch sử thi thử sẽ được đặt lại về 0.',
      onConfirm: () => {
        setWrongIds([]);
        setMasteredIds([]);
        setExamHistory([]);
        saveStatsToStorage([], [], []);
        toast.success('Đã đặt lại tiến độ ôn tập');
      },
    });
  };

  // Lọc câu hỏi tìm kiếm
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return QUESTIONS.filter((item) => {
      const matchMod = searchModule === 0 || item.module === searchModule;
      if (!matchMod) return false;
      if (!q) return true;
      return (
        String(item.id) === q ||
        item.text.toLowerCase().includes(q) ||
        item.options.some((o) => o.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, searchModule]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => confirmGoHome()} className="flex items-center gap-2.5 text-left group">
              <img
                src="/logo.png"
                alt="Logo Trường"
                className="w-10 h-10 object-contain shrink-0 group-hover:scale-105 transition"
              />
              <div>
                <h1 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                  Ôn thi CNTT Cơ bản (300 câu)
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Trường Cao Đẳng Nghề NSG
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Thẻ hiển thị sinh viên ở Header */}
            {student ? (
              <div
                onClick={handleChangeStudent}
                className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition text-left"
                title="Nhấp để đổi MSSV khác"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="hidden sm:block leading-tight">
                  <div className="font-bold text-xs text-blue-900 dark:text-blue-100">
                    {student.fullName}
                  </div>
                  <div className="text-[10px] text-blue-600 dark:text-blue-300 font-medium">
                    MSSV: {student.studentCode} {student.className ? `• ${student.className}` : ''}
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowStudentModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition"
              >
                <UserCheck className="w-4 h-4" />
                <span>Nhập Mã Sinh Viên</span>
              </button>
            )}

            {/* Đồng hồ Timer khi đang thi thử */}
            {view === 'QUIZ' && mode === 'EXAM' && !reviewMode && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-mono font-bold text-sm">
                <Clock className="w-4 h-4 animate-pulse" />
                <span>{formatTime(timeLeft)}</span>
              </div>
            )}

            {/* Nút về Trang chủ */}
            {view !== 'HOME' && (
              <button
                onClick={confirmGoHome}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs sm:text-sm font-semibold transition"
              >
                Trang chủ
              </button>
            )}

            {/* Nút đổi Giao diện Sáng/Tối */}
            <button
              onClick={toggleTheme}
              title="Đổi giao diện Sáng / Tối"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-grow max-w-6xl w-full mx-auto px-4 py-6 sm:py-8">
        {/* ===================== VIEW: HOME ===================== */}
        {view === 'HOME' && (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
            {/* Banner chính */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-600 to-indigo-900 text-white p-6 sm:p-8 shadow-xl shadow-blue-600/15">
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-bold uppercase tracking-wider mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Chứng chỉ Ứng dụng CNTT Cơ bản • Trọn bộ 300 câu</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-2">
                    Cổng Luyện thi Trắc nghiệm CNTT Chuẩn
                  </h2>
                  <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
                    Đầy đủ 300 câu hỏi chia theo 6 Module chuẩn. Sinh viên chỉ cần nhập Mã số sinh viên (MSSV) là có thể thi thử và ôn tập ngay lập tức mà không cần đăng nhập tài khoản.
                  </p>
                </div>

                {/* Thẻ tiến độ của sinh viên */}
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 min-w-[250px]">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-semibold text-blue-100">Tiến độ đã nắm vững</span>
                    <span className="text-2xl font-black">
                      {masteredIds.length}
                      <span className="text-sm font-normal text-blue-200">/300</span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((masteredIds.length / 300) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-blue-100">
                    <span>Đạt: <strong>{Math.round((masteredIds.length / 300) * 100)}%</strong></span>
                    <span>Hay sai: <strong className="text-amber-300">{wrongIds.length} câu</strong></span>
                  </div>
                </div>
              </div>
            </section>

            {/* FORM NHẬP MÃ SINH VIÊN TRỰC TIẾP (KHÔNG CẦN ĐĂNG NHẬP) */}
            {!student ? (
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border-2 border-blue-200 dark:border-blue-800/60 shadow-md">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                        Nhập Mã Sinh Viên để làm bài (Không cần tài khoản)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Chỉ cần nhập MSSV của bạn, hệ thống sẽ tự động tra cứu tên và cấp đề thi ngay
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleConfirmStudent();
                    }}
                    className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
                  >
                    <div className="relative flex-1 sm:w-64">
                      <input
                        type="text"
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                        placeholder="Nhập MSSV (VD: 21CD001)..."
                        className="w-full px-4 py-2.5 rounded-xl border border-blue-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase shadow-inner"
                      />
                      {searchingStudent && (
                        <div className="absolute right-3 top-2.5 text-xs text-slate-400 animate-spin">
                          ⏳
                        </div>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={!inputCode.trim()}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition whitespace-nowrap cursor-pointer"
                    >
                      Bắt đầu làm bài ngay
                    </button>
                  </form>
                </div>

                {/* Hiển thị tên tự động tìm thấy */}
                {detectedStudent ? (
                  <div className="mt-3.5 pt-3 border-t border-blue-200/60 dark:border-slate-800 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>
                      Đã nhận diện: <strong>{detectedStudent.fullName}</strong>
                      {detectedStudent.className && ` • Lớp: ${detectedStudent.className}`}
                    </span>
                  </div>
                ) : inputCode.trim().length >= 2 && !searchingStudent ? (
                  <div className="mt-3.5 pt-3 border-t border-blue-200/60 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <UserCheck className="w-4 h-4 shrink-0 text-blue-500" />
                    <span>Bấm &quot;Bắt đầu làm bài ngay&quot; để vào ôn tập và làm bài thi với mã này.</span>
                  </div>
                ) : null}
              </div>
            ) : (
              /* Thẻ sinh viên đã được nhận diện */
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Sinh viên đang làm bài:
                    </div>
                    <div className="text-base font-extrabold text-slate-900 dark:text-white">
                      {student.fullName} — <span className="text-blue-600 dark:text-blue-400 font-mono">{student.studentCode}</span>
                      {student.className && <span className="text-slate-500 font-normal text-xs ml-2">({student.className})</span>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleChangeStudent}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 transition cursor-pointer"
                >
                  Đổi Mã Sinh Viên
                </button>
              </div>
            )}

            {/* 4 Chế độ chính */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={startExam}
                className="group text-left p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500/30 hover:border-emerald-500 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base mb-1 text-slate-900 dark:text-white">Thi thử 30 câu</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  30 phút • Random 5 câu/Module chuẩn cấu trúc đề thi chính thức.
                </p>
              </button>

              <button
                onClick={() => startPractice(0, false)}
                className="group text-left p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base mb-1 text-slate-900 dark:text-white">Ôn trọn bộ 300 câu</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Làm lần lượt từ câu 1 đến 300, có chế độ hiện đáp án đúng tức thì.
                </p>
              </button>

              <button
                onClick={startWrongPractice}
                className="group text-left p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base mb-1 text-slate-900 dark:text-white">
                  Ôn câu làm sai ({wrongIds.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Lọc ra những câu bạn từng chọn sai để làm lại cho đến khi thuộc.
                </p>
              </button>

              <button
                onClick={() => setView('SEARCH')}
                className="group text-left p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base mb-1 text-slate-900 dark:text-white">Tra cứu &amp; Học thuộc</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Tìm nhanh theo từ khóa, xem danh sách 300 câu và đáp án chuẩn.
                </p>
              </button>
            </section>

            {/* Danh sách 6 Module */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Ôn tập theo từng Module (50 câu / Module)
                </h3>
                <button
                  onClick={() => startPractice(0, true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Trộn ngẫu nhiên 300 câu</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {MODULES.map((m) => {
                  const mQs = QUESTIONS.filter((q) => q.module === m.id);
                  const mDone = mQs.filter((q) => masteredIds.includes(q.id)).length;
                  const mPct = Math.round((mDone / mQs.length) * 100);

                  return (
                    <div
                      key={m.id}
                      className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 transition flex flex-col justify-between gap-4 shadow-sm"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            {m.name}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">{m.range}</span>
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-base mb-3">{m.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                          <span>Đã thuộc: <strong>{mDone}/{mQs.length}</strong></span>
                          <span className="ml-auto font-semibold">{mPct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${mPct}%` }} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startPractice(m.id, false)}
                          className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
                        >
                          Ôn tuần tự
                        </button>
                        <button
                          onClick={() => startPractice(m.id, true)}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold transition cursor-pointer"
                          title="Xáo trộn câu hỏi"
                        >
                          Trộn đề
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* LỊCH SỬ SINH VIÊN LÀM BÀI TRÊN TOÀN TRƯỜNG (LƯU TRÊN FIRESTORE) */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-bold text-sm uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Lịch sử sinh viên vào làm bài gần đây (Lưu trên hệ thống)
                  </h3>
                </div>
                <button
                  onClick={fetchLiveHistory}
                  disabled={loadingLiveHistory}
                  className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${loadingLiveHistory ? 'animate-spin' : ''}`} />
                  <span>Cập nhật</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-2">Thời gian</th>
                      <th className="py-2">Mã SV</th>
                      <th className="py-2">Họ và tên</th>
                      <th className="py-2">Nội dung</th>
                      <th className="py-2">Trạng thái</th>
                      <th className="py-2 text-center">Điểm số</th>
                      <th className="py-2 text-center">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {liveHistory.length > 0 ? (
                      liveHistory.map((h, i) => (
                        <tr key={h.id || i}>
                          <td className="py-2.5 font-mono text-slate-400">{h.timeStr}</td>
                          <td className="py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                            {h.studentCode}
                          </td>
                          <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">
                            {h.studentName}
                            {h.className && <span className="font-normal text-slate-400 ml-1">({h.className})</span>}
                          </td>
                          <td className="py-2.5 font-medium text-slate-600 dark:text-slate-400">
                            {h.title}
                          </td>
                          <td className="py-2.5">
                            {h.action === 'submit' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                                <Check className="w-3 h-3" />
                                <span>Đã nộp bài</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold text-[10px]">
                                <Clock className="w-3 h-3" />
                                <span>Vào làm bài</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-center font-bold">
                            {h.score !== undefined ? (
                              <span className="text-slate-900 dark:text-white font-black">
                                {h.score}<span className="text-[10px] text-slate-400 font-normal">/10</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 text-center">
                            {h.passed !== undefined ? (
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                  h.passed
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                }`}
                              >
                                {h.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">
                          {loadingLiveHistory ? 'Đang tải lịch sử...' : 'Chưa có lượt làm bài nào được ghi nhận'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ===================== VIEW: QUIZ ===================== */}
        {view === 'QUIZ' && quizList.length > 0 && (
          <div className="flex flex-col lg:flex-row gap-6 items-start animate-in fade-in duration-200">
            {/* Cột trái: Nội dung câu hỏi */}
            <div className="w-full lg:w-[68%] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-xs font-semibold text-slate-400 block">{title}</span>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Câu {currentIndex + 1}{' '}
                    <span className="text-sm font-normal text-slate-400">/ {quizList.length}</span>
                    <span className="ml-2 text-xs font-semibold text-slate-400">
                      (Mã gốc: #{quizList[currentIndex].id})
                    </span>
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    Module {quizList[currentIndex].module}
                  </span>
                  {mode !== 'EXAM' && !reviewMode && (
                    <button
                      onClick={() => setShowKeyMode(!showKeyMode)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
                        showKeyMode
                          ? 'bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {showKeyMode ? '👁️ Đang hiện đáp án' : '👁️ Học thuộc nhanh'}
                    </button>
                  )}
                </div>
              </div>

              {/* Tên câu hỏi */}
              <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed mb-5">
                {quizList[currentIndex].text}
              </p>

              {/* Hình ảnh / bảng minh họa nếu có */}
              {quizList[currentIndex].visual && (
                <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center overflow-x-auto">
                  <QuizVisual visualKey={quizList[currentIndex].visual!} />
                </div>
              )}

              {/* 4 Lựa chọn đáp án */}
              <div className="space-y-3">
                {quizList[currentIndex].options.map((opt, i) => {
                  const letters = ['A', 'B', 'C', 'D'];
                  const isSelected = answers[currentIndex] === i;
                  const isCorrect = i === quizList[currentIndex].correct;
                  const isExam = mode === 'EXAM' && !reviewMode;
                  const showResultNow = !isExam && (answers[currentIndex] !== undefined || showKeyMode || reviewMode);

                  let btnCls =
                    'border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20';
                  let badgeCls =
                    'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
                  let icon = null;

                  if (showResultNow) {
                    if (isCorrect) {
                      btnCls =
                        'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-semibold ring-1 ring-emerald-500';
                      badgeCls = 'bg-emerald-600 text-white border-emerald-600';
                      icon = <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 font-bold shrink-0" />;
                    } else if (isSelected && !isCorrect) {
                      btnCls =
                        'border-red-500 bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-200 ring-1 ring-red-500';
                      badgeCls = 'bg-red-600 text-white border-red-600';
                      icon = <X className="w-5 h-5 text-red-500 font-bold shrink-0" />;
                    } else {
                      btnCls = 'border-slate-100 dark:border-slate-800 opacity-60';
                    }
                  } else if (isSelected) {
                    btnCls = 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 ring-2 ring-blue-600/30 font-semibold';
                    badgeCls = 'bg-blue-600 text-white border-blue-600';
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleSelectOption(i)}
                      className={`w-full text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all flex items-center justify-between gap-3 cursor-pointer ${btnCls}`}
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold border ${badgeCls}`}
                        >
                          {letters[i]}
                        </span>
                        <span className="text-sm sm:text-base leading-snug">{opt}</span>
                      </div>
                      {icon}
                    </button>
                  );
                })}
              </div>

              {/* Nút điều hướng câu hỏi */}
              <div className="mt-7 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <button
                  onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={currentIndex === 0}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-bold disabled:opacity-40 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Câu trước</span>
                </button>
                <button
                  onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, quizList.length - 1))}
                  disabled={currentIndex === quizList.length - 1}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-40 transition shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  <span>Câu tiếp</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cột phải: Bảng điều hướng câu hỏi */}
            <div className="w-full lg:w-[32%] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Bảng câu hỏi ({Object.keys(answers).length}/{quizList.length})
                </h3>
              </div>

              <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-5 gap-1.5 max-h-[340px] overflow-y-auto p-1 custom-scroll">
                {quizList.map((item, i) => {
                  const ans = answers[i];
                  const isCurr = i === currentIndex;
                  const isExam = mode === 'EXAM' && !reviewMode;

                  let btnCls =
                    'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100';
                  if (ans !== undefined) {
                    if (isExam) {
                      btnCls = 'bg-blue-600 text-white border-blue-600';
                    } else {
                      btnCls =
                        ans === item.correct
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-red-500 text-white border-red-500';
                    }
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      className={`h-9 rounded-lg text-xs font-bold border transition cursor-pointer ${btnCls} ${
                        isCurr
                          ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900 scale-105'
                          : ''
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                {mode === 'EXAM' && !reviewMode && (
                  <button
                    onClick={confirmFinishExam}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition cursor-pointer"
                  >
                    Nộp bài &amp; Chấm điểm
                  </button>
                )}
                {reviewMode && (
                  <button
                    onClick={() => setView('RESULT')}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition cursor-pointer"
                  >
                    Quay lại bảng điểm
                  </button>
                )}
                <button
                  onClick={confirmGoHome}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Về Trang chủ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== VIEW: RESULT ===================== */}
        {view === 'RESULT' && (
          <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-9 text-center shadow-lg animate-in fade-in duration-300">
            {(() => {
              let correctCount = 0;
              quizList.forEach((q, i) => {
                if (answers[i] === q.correct) correctCount++;
              });
              const total = quizList.length;
              const score10 = Number(((correctCount / total) * 10).toFixed(1));
              const isPassed = score10 >= 5;

              return (
                <>
                  <div
                    className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center text-3xl mb-4 ${
                      isPassed
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'
                        : 'bg-red-100 dark:bg-red-900/40 text-red-600'
                    }`}
                  >
                    {isPassed ? '🎉' : '📚'}
                  </div>
                  <h2 className="text-2xl font-extrabold mb-1">
                    {isPassed ? 'CHÚC MỪNG BẠN ĐÃ ĐẠT!' : 'CHƯA ĐẠT — CỐ GẮNG THÊM NHÉ!'}
                  </h2>

                  {/* Thông tin sinh viên trên kết quả thi */}
                  {student && (
                    <div className="inline-block px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 mb-4">
                      Thí sinh: <span className="text-blue-600 dark:text-blue-400">{student.fullName}</span> (MSSV:{' '}
                      <span className="font-mono">{student.studentCode}</span>)
                    </div>
                  )}

                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    Điểm chuẩn đạt yêu cầu chứng chỉ CNTT Cơ bản là từ 5.0/10 trở lên.
                  </p>

                  <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 mb-7">
                    <div>
                      <div className="text-[11px] uppercase font-bold text-slate-400 mb-1">Số câu đúng</div>
                      <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                        {correctCount}/{total}
                      </div>
                    </div>
                    <div className="border-x border-slate-200 dark:border-slate-700">
                      <div className="text-[11px] uppercase font-bold text-slate-400 mb-1">Điểm số</div>
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {score10}/10
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase font-bold text-slate-400 mb-1">Đánh giá</div>
                      <div
                        className={`text-lg font-extrabold mt-1 ${
                          isPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                        }`}
                      >
                        {isPassed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setReviewMode(true);
                        setCurrentIndex(0);
                        setView('QUIZ');
                      }}
                      className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition cursor-pointer"
                    >
                      Xem lại chi tiết đáp án từng câu
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={startExam}
                        className="py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold text-sm transition cursor-pointer"
                      >
                        Thi đề mới
                      </button>
                      <button
                        onClick={() => {
                          setView('HOME');
                          fetchLiveHistory();
                        }}
                        className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-sm transition cursor-pointer"
                      >
                        Về Trang chủ
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ===================== VIEW: SEARCH ===================== */}
        {view === 'SEARCH' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <h2 className="text-lg font-extrabold mb-3">Tra cứu &amp; Học thuộc nhanh 300 câu hỏi</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nhập từ khóa hoặc số thứ tự câu (VD: VLOOKUP, RAM, 246)..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <select
                  value={searchModule}
                  onChange={(e) => setSearchModule(Number(e.target.value))}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold"
                >
                  <option value={0}>Tất cả 6 Module (300 câu)</option>
                  {MODULES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}: {m.title}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-400 mt-2.5">
                Tìm thấy <strong>{searchResults.length}</strong> câu hỏi phù hợp.
              </p>
            </div>

            <div className="space-y-3">
              {searchResults.slice(0, 100).map((item) => {
                const letters = ['A', 'B', 'C', 'D'];
                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold">
                        Câu {item.id}
                      </span>
                      <span className="text-xs text-slate-400">Module {item.module}</span>
                    </div>
                    <p className="font-bold text-sm sm:text-base mb-3">${item.text}</p>
                    {item.visual && (
                      <div className="mb-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 overflow-x-auto">
                        <QuizVisual visualKey={item.visual} />
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                      {item.options.map((opt, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg border flex items-center justify-between ${
                            idx === item.correct
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                              : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <div>
                            <span className="font-bold mr-1.5">{letters[idx]}.</span>
                            {opt}
                          </div>
                          {idx === item.correct && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {searchResults.length > 100 && (
                <p className="text-center text-xs text-slate-400 py-4">
                  Đang hiển thị 100 kết quả đầu tiên. Hãy nhập từ khóa hoặc chọn Module để xem chính xác hơn.
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
        Bộ đề 300 câu Trắc nghiệm Chuẩn CNTT Cơ bản • Trường Cao Đẳng Nghề NSG • Hỗ trợ phím tắt{' '}
        <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 font-mono">
          A-D
        </kbd>{' '}
        &amp;{' '}
        <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 font-mono">
          ← →
        </kbd>
      </footer>

      {/* ===================== MODAL: NHẬP MÃ SINH VIÊN ===================== */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center font-bold">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nhập Mã Sinh Viên (MSSV)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Không cần tài khoản hay mật khẩu đăng nhập
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  Mã số sinh viên (MSSV) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="VD: 21CD001, SV001..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-base tracking-wider uppercase"
                    autoFocus
                  />
                  {searchingStudent && (
                    <div className="absolute right-3.5 top-3.5 text-xs text-slate-400 animate-spin">
                      ⏳
                    </div>
                  )}
                </div>
              </div>

              {/* Thông tin tra cứu được hoặc cho phép nhập tên nếu mã mới */}
              {detectedStudent ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã nhận diện sinh viên:</span>
                  </div>
                  <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {detectedStudent.fullName}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Mã SV: <span className="font-mono font-bold">{detectedStudent.studentCode}</span>
                    {detectedStudent.className && ` • Lớp: ${detectedStudent.className}`}
                  </div>
                </div>
              ) : inputCode.trim().length >= 2 && !searchingStudent ? (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                    Họ và tên của bạn (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Nhập họ và tên để in lên bài thi..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Chưa thấy mã trong dữ liệu trường, bạn vẫn làm bài thi bình thường với họ tên tự chọn này.
                  </p>
                </div>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmStudent()}
                  disabled={!inputCode.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition cursor-pointer"
                >
                  Xác nhận &amp; Bắt đầu làm bài
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: XÁC NHẬN CHUNG ===================== */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-semibold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  setConfirmModal((prev) => ({ ...prev, open: false }));
                  confirmModal.onConfirm();
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 transition cursor-pointer"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

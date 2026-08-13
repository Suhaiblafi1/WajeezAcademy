/**
 * نموذج بيانات بوابة الطالب — Student Portal Store
 * -------------------------------------------------------
 * محاكاة محلية كاملة (localStorage). عند النقل إلى Replit تستبدل الدوال
 * load/save بنداءات API — الأنواع والحالات مطابقة للوثيقة (القسم ٩–١٣).
 */

import { courseById, courseDetails, courseTrainer, pathwayCourses, type Course } from "./courses";
import { pathwayById } from "./pathways";

/* ─────────── الأنواع ─────────── */
export type CourseStatus = "locked" | "available" | "in_progress" | "needs_action" | "completed";
export type Attendance = "present" | "late" | "absent" | "excused" | null;

export interface LessonState { pct: number; } // 0-100
export interface QuizState { attempts: number; best: number; passed: boolean; }
export interface AssignmentState {
  status: "none" | "submitted" | "under_review" | "approved" | "revision";
  fileName?: string;
  feedback?: string;
  grade?: number;
}
export interface CourseProgress {
  lessons: Record<string, LessonState>;
  quiz: QuizState;
  assignment: AssignmentState;
  attendance: Attendance;
  bookQuiz: Record<string, { passed: boolean; score: number }>;
}
export type ProjectStatus = "not_open" | "open" | "draft" | "submitted" | "under_review" | "revision" | "passed" | "failed";
export interface ProjectState {
  status: ProjectStatus;
  kind?: "file" | "video" | "audio" | "link";
  fields?: { problem: string; solution: string; tools: string; role: string; evidence: string; reflection: string };
  feedback?: string;
  rubricScores?: Record<string, number>;
}
export interface SessionItem {
  id: string; courseId: string; courseName: string; title: string;
  date: string; // YYYY-MM-DD
  time: string; type: "live" | "workshop" | "mentoring"; status: "confirmed" | "open";
}
export interface PortalNotification { id: string; text: string; kind: "session" | "content" | "grade" | "payment" | "certificate"; read: boolean; }
export interface PortalState {
  pathwayId: string;
  startedAt: number;
  courses: Record<string, CourseProgress>;
  project: ProjectState;
  notifications: PortalNotification[];
}

/* ─────────── هيكل الدورة التعليمي (مشتق deterministic من بيانات الكتالوج) ─────────── */
export interface Lesson { id: string; title: string; minutes: number; kind: "video" | "reading" | "activity"; }
export interface QuizQuestion { q: string; options: string[]; correct: number; explain: string; }

export function courseLessons(c: Course): Lesson[] {
  const d = courseDetails(c);
  return d.topics.map((t, i) => ({
    id: `${c.id}-L${i + 1}`,
    title: t,
    minutes: 8 + ((c.id.charCodeAt(i % c.id.length) + i * 7) % 14),
    kind: i % 3 === 2 ? "activity" : "video",
  }));
}

export function courseQuiz(c: Course): QuizQuestion[] {
  const d = courseDetails(c);
  const t = d.topics;
  return [
    { q: `ما الترتيب الصحيح للبدء في «${t[0] ?? c.skill}»؟`, options: ["الفهم ثم التطبيق ثم المراجعة", "التطبيق فورا دون فهم", "الحفظ ثم النسيان", "الانتظار حتى تتضح الرؤية"], correct: 0, explain: "الفهم أولا يجعل التطبيق موجها لا عشوائيا — وهذا منهج وجيز في كل دورة." },
    { q: `أي مما يلي دليل إتقان حقيقي لمهارة «${c.skill}»؟`, options: ["مشاهدة كل الدروس", "مخرج عملي راجعه المدرب", "حفظ المصطلحات", "حضور الجلسات فقط"], correct: 1, explain: "المشاهدة نشاط، والإتقان مخرج — لذلك تُقيم واجباتك بشريا." },
    { q: `عندما تتعثر في «${t[1] ?? c.skill}»، ما التصرف الأصح داخل المسار؟`, options: ["تخطي الدرس نهائيا", "إعادة المشاهدة بسرعة أعلى فقط", "طرح سؤال في قناة الدورة أو حجز استشارة", "الانتقال لدورة أخرى"], correct: 2, explain: "قناة الأسئلة والاستشارة جزء من التصميم — التعثر المعلن يُعالج أسرع." },
    { q: `ما أفضل طريقة لترسيخ «${t[2] ?? c.skill}» بعد الدرس؟`, options: ["تلخيصه صوتيا لنفسك", "تطبيقه على حالة من واقعك خلال 48 ساعة", "قراءة المصطلحات مرة أخرى", "مشاركة الرابط مع الأصدقاء"], correct: 1, explain: "التطبيق خلال 48 ساعة يرفع التثبيت بشكل موثق في أدبيات التعلم." },
  ];
}

export const QUIZ_PASS = 70; // درجة النجاح
export const QUIZ_MAX_ATTEMPTS = 3;

/* ─────────── الجلسات المباشرة (زووم) ─────────── */
export function courseSessions(c: Course, startDate: Date): SessionItem[] {
  const mk = (offset: number, title: string, type: SessionItem["type"]): SessionItem => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + offset);
    return {
      id: `${c.id}-S${offset}`, courseId: c.id, courseName: c.name, title,
      date: d.toISOString().slice(0, 10), time: "7:00–8:30 م", type, status: "confirmed",
    };
  };
  return [mk(2, "الجلسة الافتتاحية", "live"), mk(Math.max(5, c.weeks * 4), "ورشة تطبيقية", "workshop")];
}

/* ─────────── المتجر المحلي ─────────── */
const storeKey = (pathwayId: string) => `wajeez_portal_${pathwayId}`;

function emptyCourseProgress(): CourseProgress {
  return { lessons: {}, quiz: { attempts: 0, best: 0, passed: false }, assignment: { status: "none" }, attendance: null, bookQuiz: {} };
}

export function seedPortal(pathwayId: string): PortalState {
  const ids = pathwayCourses[pathwayId] ?? [];
  const state: PortalState = {
    pathwayId,
    startedAt: Date.now(),
    courses: Object.fromEntries(ids.map((id) => [id, emptyCourseProgress()])),
    project: { status: "not_open" },
    notifications: [
      { id: "n1", text: "أهلا بك في مسارك! أكمل ملفك وابدأ أول درس.", kind: "content", read: false },
      { id: "n2", text: "تم تأكيد شعبتك — الجلسة الافتتاحية في جدولك.", kind: "session", read: false },
      { id: "n3", text: "وصلت فاتورتك وتأكيد الدفع على بريدك.", kind: "payment", read: true },
    ],
  };
  savePortal(state);
  return state;
}

export function loadPortal(pathwayId: string): PortalState {
  try {
    const raw = localStorage.getItem(storeKey(pathwayId));
    if (raw) return JSON.parse(raw) as PortalState;
  } catch { /* ignore */ }
  return seedPortal(pathwayId);
}

export function savePortal(s: PortalState) {
  localStorage.setItem(storeKey(s.pathwayId), JSON.stringify(s));
}

/* ─────────── قواعد الحالة والفتح (القسم 9.2 — US-05) ─────────── */
export function coursePercent(c: Course, p: CourseProgress): number {
  const lessons = courseLessons(c);
  if (!lessons.length) return 0;
  const lessonPct = lessons.reduce((s, l) => s + (p.lessons[l.id]?.pct ?? 0), 0) / lessons.length;
  const quizPct = p.quiz.passed ? 100 : 0;
  const assignPct = p.assignment.status === "approved" ? 100 : p.assignment.status === "submitted" || p.assignment.status === "under_review" ? 50 : 0;
  return Math.round(lessonPct * 0.6 + quizPct * 0.25 + assignPct * 0.15);
}

export function isCourseComplete(c: Course, p: CourseProgress): boolean {
  const lessonsDone = courseLessons(c).every((l) => (p.lessons[l.id]?.pct ?? 0) >= 90);
  return lessonsDone && p.quiz.passed && (p.assignment.status === "approved" || p.assignment.status === "submitted" || p.assignment.status === "under_review");
}

export interface CourseGate { status: CourseStatus; lockReason?: string; unlockHint?: string; }

export function courseGate(pathwayId: string, courseId: string, state: PortalState): CourseGate {
  const ids = pathwayCourses[pathwayId] ?? [];
  const idx = ids.indexOf(courseId);
  const c = courseById(courseId);
  if (!c || idx === -1) return { status: "locked", lockReason: "الدورة غير موجودة في مسارك" };
  const p = state.courses[courseId] ?? emptyCourseProgress();
  if (isCourseComplete(c, p)) return { status: "completed" };
  if (idx === 0) {
    const started = Object.keys(p.lessons).length > 0;
    if (p.assignment.status === "revision") return { status: "needs_action" };
    return { status: started ? "in_progress" : "available" };
  }
  const prevId = ids[idx - 1];
  const prev = courseById(prevId);
  const prevP = state.courses[prevId] ?? emptyCourseProgress();
  if (prev && !isCourseComplete(prev, prevP)) {
    return {
      status: "locked",
      lockReason: `مقفلة — تفتح بعد إكمال «${prev.name}» (دروسها + اختبارها + واجبها)`,
      unlockHint: "أكمل الدورة السابقة",
    };
  }
  const started = Object.keys(p.lessons).length > 0;
  if (p.assignment.status === "revision") return { status: "needs_action" };
  return { status: started ? "in_progress" : "available" };
}

/* ─────────── «التالي الآن» — إجراء واحد ذو أولوية (US-04) ─────────── */
export interface NextAction { label: string; detail: string; courseId?: string; cta: string; }
export function nextAction(pathwayId: string, state: PortalState): NextAction {
  const ids = pathwayCourses[pathwayId] ?? [];
  for (const id of ids) {
    const c = courseById(id);
    if (!c) continue;
    const gate = courseGate(pathwayId, id, state);
    if (gate.status === "locked" || gate.status === "completed") continue;
    const p = state.courses[id] ?? emptyCourseProgress();
    if (p.assignment.status === "revision")
      return { label: `راجع ملاحظات واجب «${c.name}»`, detail: "مدربك طلب تعديلا — أعد التسليم لتكمل", courseId: id, cta: "افتح الواجب" };
    const lessons = courseLessons(c);
    const nextLesson = lessons.find((l) => (p.lessons[l.id]?.pct ?? 0) < 90);
    if (nextLesson)
      return { label: `أكمل درس «${nextLesson.title}»`, detail: `${c.name} · ${nextLesson.minutes} دقيقة تقريبا`, courseId: id, cta: "أكمل الدرس" };
    if (!p.quiz.passed)
      return { label: `اختبار «${c.name}» بانتظارك`, detail: `درجة النجاح ${QUIZ_PASS}% — لديك ${QUIZ_MAX_ATTEMPTS - p.quiz.attempts} محاولات`, courseId: id, cta: "ابدأ الاختبار" };
    if (p.assignment.status === "none")
      return { label: `سلّم واجب «${c.name}»`, detail: "التطبيق العملي هو دليل إتقانك — يُراجعه مدربك بشريا", courseId: id, cta: "ارفع الواجب" };
    if (p.assignment.status === "submitted" || p.assignment.status === "under_review")
      return { label: `واجب «${c.name}» قيد المراجعة`, detail: "سيصلك إشعار فور اعتماد مدربك", courseId: id, cta: "تابع الحالة" };
  }
  if (state.project.status === "not_open")
    return { label: "مشروع التخرج يُفتح قريبا", detail: "أكمل متطلبات المسار ليفتح لك التسليم", cta: "شروط الفتح" };
  if (state.project.status === "open" || state.project.status === "revision")
    return { label: "مشروع تخرجك بانتظارك", detail: "سلّم مشروعك لتُصدر شهادة المسار", cta: "افتح المشروع" };
  return { label: "مسارك مكتمل — مبارك!", detail: "شهادتك جاهزة في صفحة الشهادات", cta: "شهاداتي" };
}

/* ─────────── تقدم المسار الكلي ─────────── */
export function pathwayPercent(pathwayId: string, state: PortalState): number {
  const ids = pathwayCourses[pathwayId] ?? [];
  if (!ids.length) return 0;
  const parts = ids.map((id) => {
    const c = courseById(id);
    return c ? coursePercent(c, state.courses[id] ?? emptyCourseProgress()) : 0;
  });
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/* ─────────── مشروع التخرج (الجدول 30 — شروط الفتح) ─────────── */
export interface ProjectCondition { label: string; met: boolean; }
export function projectConditions(pathwayId: string, state: PortalState): ProjectCondition[] {
  const ids = pathwayCourses[pathwayId] ?? [];
  const courses = ids.map((id) => ({ c: courseById(id)!, p: state.courses[id] ?? emptyCourseProgress() })).filter((x) => x.c);
  const allLessons = courses.every(({ c, p }) => courseLessons(c).every((l) => (p.lessons[l.id]?.pct ?? 0) >= 90));
  const allQuizzes = courses.every(({ p }) => p.quiz.passed);
  const allAssignments = courses.every(({ p }) => ["submitted", "under_review", "approved"].includes(p.assignment.status));
  return [
    { label: "إكمال دروس كل الدورات الأساسية (100%)", met: allLessons },
    { label: "اجتياز كل الاختبارات النهائية", met: allQuizzes },
    { label: "تسليم الواجبات الإلزامية", met: allAssignments },
    { label: "الحضور يحقق الحد الأدنى للمسار", met: courses.every(({ p }) => p.attendance !== "absent") },
    { label: "الحساب المالي غير متعثر", met: true },
  ];
}

export function maybeOpenProject(state: PortalState): PortalState {
  if (state.project.status === "not_open" && projectConditions(state.pathwayId, state).every((c) => c.met)) {
    state.project.status = "open";
    state.notifications.unshift({
      id: `n-${Date.now()}`, text: "فُتح مشروع التخرج! اقرأ الموجز وسلّم قبل الموعد.", kind: "content", read: false,
    });
  }
  return state;
}

/* ─────────── Rubric موحد (الجدول 32) ─────────── */
export const PROJECT_RUBRIC: { key: string; label: string; weight: number }[] = [
  { key: "problem", label: "فهم المشكلة والسياق", weight: 15 },
  { key: "skills", label: "تطبيق مهارات المسار", weight: 30 },
  { key: "quality", label: "جودة الحل/المخرج", weight: 25 },
  { key: "analysis", label: "التحليل والقرارات", weight: 15 },
  { key: "presentation", label: "التواصل والعرض", weight: 10 },
  { key: "originality", label: "الأصالة والالتزام", weight: 5 },
];

/* ─────────── الشهادات (القسم 12.5) ─────────── */
export interface Certificate {
  number: string; // WJ-2026-XXXXX
  holder: string; courseOrPath: string; kind: "course" | "pathway";
  issuedAt: string; status: "valid" | "revoked";
}
const CERT_KEY = "wajeez_certificates";

export function loadCertificates(): Certificate[] {
  try { return JSON.parse(localStorage.getItem(CERT_KEY) ?? "[]") as Certificate[]; } catch { return []; }
}
export function issueCertificate(holder: string, title: string, kind: Certificate["kind"]): Certificate {
  const certs = loadCertificates();
  const num = `WJ-${new Date().getFullYear()}-${String(10000 + certs.length * 7 + Math.floor(Math.random() * 6)).slice(0, 5)}`;
  const cert: Certificate = { number: num, holder, courseOrPath: title, kind, issuedAt: new Date().toISOString().slice(0, 10), status: "valid" };
  localStorage.setItem(CERT_KEY, JSON.stringify([...certs, cert]));
  return cert;
}
export function verifyCertificate(number: string): Certificate | null {
  return loadCertificates().find((c) => c.number === number.trim().toUpperCase()) ?? null;
}

/* ─────────── المهارات: الحالي مقابل المستهدف (0–5) ─────────── */
export interface SkillState { name: string; current: number; target: number; evidence: string; }
export function pathwaySkills(pathwayId: string, state: PortalState): SkillState[] {
  const p = pathwayById(pathwayId);
  const ids = pathwayCourses[pathwayId] ?? [];
  return (p?.coreSkills ?? []).slice(0, 5).map((name, i) => {
    const related = ids.filter((id) => courseById(id)?.skill === name || i === 0);
    const done = related.filter((id) => {
      const c = courseById(id);
      return c && isCourseComplete(c, state.courses[id] ?? emptyCourseProgress());
    }).length;
    const current = Math.min(4, 1 + done * 2); // يرتفع مع كل دورة مكتملة مرتبطة
    return { name, current, target: 5, evidence: done > 0 ? `أُثبت في ${done} ${done === 1 ? "دورة" : "دورات"}` : "لم يُثبت بعد — سيظهر الدليل مع تقدمك" };
  });
}

export function readUserName(): string {
  try {
    const raw = localStorage.getItem("wajeez_user");
    if (!raw) return "متعلم وجيز";
    const parsed = JSON.parse(raw) as { name?: string; exp?: number };
    if (typeof parsed.exp === "number" && Date.now() > parsed.exp) {
      localStorage.removeItem("wajeez_user"); // جلسة منتهية — تمسح بأمان
      return "متعلم وجيز";
    }
    return parsed.name ?? "متعلم وجيز";
  } catch { return "متعلم وجيز"; }
}

export { courseTrainer };

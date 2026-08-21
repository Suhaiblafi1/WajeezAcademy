/**
 * نموذج بيانات بوابة المدرب — Trainer Portal Store
 * -------------------------------------------------------
 * القسم 15 من الوثيقة (وظائف المدرب وحدوده) + US-09 + القسم 17 (المستحقات).
 * حدود صارمة مطبقة هنا: المدرب لا يرى بيانات دفع الطالب، لا ينشر تسجيلا قبل
 * موافقة، ولا يعدل درجة معتمدة إلا بسبب موثق في سجل المراجعة.
 * محاكاة محلية — عند النقل إلى Replit تُستبدل بنداءات API بصلاحيات server-side.
 */

import { courseById, pathwayCourses } from "./courses";
import { pathways } from "./pathways";

/* ─────────── الأنواع ─────────── */
export interface TrainerIdentity { id: string; name: string; role: string; family: string; }
export type CohortStatus = "open" | "full" | "running" | "postponed" | "done";
export interface CohortStudent {
  id: string; name: string; attendancePct: number; submitted: boolean;
  lastGrade?: number; atRisk: boolean;
}
export interface CohortSession {
  id: string; title: string; date: string; time: string;
  /* سلسلة التسجيل كما في الخادم: لا شيء → رُفع ملف → بانتظار موافقة النشر → منشور */
  recording: "none" | "uploaded" | "pending_review" | "published";
  recordingFile?: string; // اسم الملف المرفوع برابط الرفع الموقع
  /* حضور كل طالب على حدة — «تسجيل حضور متعلم في جلسة يعيد حساب تقدمه» */
  attendance?: Record<string, "present" | "absent">;
  attendanceMarked: boolean; notes?: string;
}
export interface Cohort {
  id: string; courseId: string; courseName: string; pathwayName: string;
  trainerName: string; capacity: number; status: CohortStatus; startDate: string;
  students: CohortStudent[]; sessions: CohortSession[];
}
export type SubmissionStatus = "pending" | "approved" | "revision" | "rejected" | "closed";
export interface Submission {
  id: string; studentName: string; cohortId: string; courseName: string;
  assignmentTitle: string; fileName: string; at: string;
  status: SubmissionStatus; grade?: number;
  rubric?: Record<string, number>; feedback?: string;
  rejectReason?: string; // الرفض يتطلب سببا مفهوما — كما يفرض الخادم
  history: { at: string; action: string; by: string }[];
}
export interface Earning {
  id: string; kind: "fixed" | "per_session" | "percent"; label: string;
  amount: number; status: "accrued" | "approved" | "paid"; source: string;
}
/* مهام تهيئة المدرب — من ملفه عند الخادم: تأهيله وإسناداته ومهام التهيئة */
export interface OnboardingTask { id: string; label: string; done: boolean; }

/* هويات المدربين — من نفس مجمع مدربي الكتالوج */
export const TRAINER_IDENTITIES: TrainerIdentity[] = [
  { id: "tr-reem", name: "أ. ريم القحطاني", role: "مدربة الجاهزية المهنية", family: "STU" },
  { id: "tr-faisal", name: "د. فيصل العتيبي", role: "مدرب تطوير الموظفين", family: "EMP" },
  { id: "tr-sultan", name: "م. سلطان الدوسري", role: "مدرب التطوير الحكومي والقيادة", family: "GOV" },
  { id: "tr-lina", name: "م. لينا الحربي", role: "مدربة ريادة الأعمال", family: "BIZ" },
];

/* روبريك تقييم الواجبات (مبسط عن روبريك مشروع التخرج) */
export const ASSIGNMENT_RUBRIC: { key: string; label: string; weight: number }[] = [
  { key: "context", label: "وضوح المشكلة والسياق", weight: 30 },
  { key: "method", label: "تطبيق منهجية الدورة", weight: 40 },
  { key: "quality", label: "جودة المخرج والتوثيق", weight: 30 },
];

/* ─────────── البذور ─────────── */
const today = (o: number) => { const d = new Date(); d.setDate(d.getDate() + o); return d.toISOString().slice(0, 10); };

const STUDENT_NAMES = [
  "عبدالعزيز الحربي", "منيرة القحطاني", "فيصل الدوسري", "ريم العتيبي",
  "تركي الشمري", "جواهر السبيعي", "بدر العنزي", "لمى الزهراني",
  "سلطان الغامدي", "أمل المطيري", "هشام بخاري", "دانة السديري",
];

function mkStudents(n: number, seed: number): CohortStudent[] {
  return Array.from({ length: n }, (_, i) => {
    const h = (seed * 7 + i * 13) % 100;
    return {
      id: `cs-${seed}-${i}`,
      name: STUDENT_NAMES[(seed + i) % STUDENT_NAMES.length],
      attendancePct: 60 + ((h * 3) % 40),
      submitted: h % 4 !== 0,
      lastGrade: h % 4 !== 0 ? 70 + ((h * 7) % 28) : undefined,
      atRisk: h % 9 === 0,
    };
  });
}

function mkSessions(cohortId: string, startDate: string, live: boolean): CohortSession[] {
  const base = new Date(startDate);
  const mk = (offset: number, title: string, done: boolean): CohortSession => {
    const d = new Date(base); d.setDate(d.getDate() + offset);
    return {
      id: `${cohortId}-S${offset}`, title, date: d.toISOString().slice(0, 10), time: "7:00–8:30 م",
      recording: done ? "pending_review" : "none",
      attendanceMarked: done,
      notes: done ? "جلسة نشطة — أسئلة ممتازة حول التطبيق العملي" : undefined,
    };
  };
  return live ? [mk(0, "الجلسة الافتتاحية", true), mk(7, "ورشة تطبيقية", true), mk(14, "جلسة أسئلة ومراجعة", false)] : [mk(0, "الجلسة الافتتاحية", true), mk(7, "ورشة تطبيقية", false)];
}

function seedCohorts(): Cohort[] {
  const pick = (family: string, idx: number) => {
    const pw = pathways.filter((p) => p.id.includes(`-${family}-`));
    /* الكتالوج كسول (ع-١): قبل تثبيته لا مسار — نعيد لا شيء بدل قراءة pathways[0] العارية */
    const pathway = pw[idx % Math.max(1, pw.length)] ?? pathways[0] ?? null;
    if (!pathway) return { c: null, pathway: null };
    const cid = (pathwayCourses[pathway.id] ?? [])[idx % 2];
    const c = cid ? courseById(cid) : null;
    return { c, pathway };
  };
  const cohorts: Cohort[] = [];
  TRAINER_IDENTITIES.forEach((t, ti) => {
    for (let k = 0; k < 2; k++) {
      const { c, pathway } = pick(t.family, ti + k);
      if (!c || !pathway) continue;
      const id = `COH-${t.family}-${ti}${k}`;
      const enrolled = 10 + ((ti + k) % 3) * 2;
      cohorts.push({
        id, courseId: c.id, courseName: c.name, pathwayName: pathway.name,
        trainerName: t.name, capacity: 14, status: k === 0 ? "running" : enrolled >= 14 ? "full" : "open",
        startDate: today(-14 + k * 21),
        students: mkStudents(enrolled, ti * 10 + k),
        sessions: mkSessions(id, today(-14 + k * 21), k === 0),
      });
    }
  });
  return cohorts;
}

function seedSubmissions(cohorts: Cohort[]): Submission[] {
  const titles = ["التطبيق العملي — تحليل حالة من واقعك", "التطبيق العملي — بناء النموذج الأولي", "مشروع الدورة المصغر"];
  const subs: Submission[] = [];
  cohorts.forEach((co, ci) => {
    co.students.filter((s) => s.submitted).slice(0, 4).forEach((st, si) => {
      const graded = (ci + si) % 3 === 0;
      subs.push({
        id: `SUB-${ci}-${si}`,
        studentName: st.name, cohortId: co.id, courseName: co.courseName,
        assignmentTitle: titles[si % titles.length],
        fileName: `assignment_${st.id}.pdf`, at: today(-(si + 1)),
        status: graded ? "approved" : "pending",
        grade: graded ? 74 + ((ci * 5 + si * 9) % 24) : undefined,
        rubric: graded ? { context: 24, method: 33, quality: 25 } : undefined,
        feedback: graded ? "عمل جيد — طبق المنهجية بوضوح أكبر في القسم الثاني." : undefined,
        history: graded
          ? [{ at: today(-(si + 1)), action: "تسليم الطالب", by: st.name }, { at: today(-si), action: "اعتماد بالدرجة", by: co.trainerName }]
          : [{ at: today(-(si + 1)), action: "تسليم الطالب", by: st.name }],
      });
    });
  });
  return subs;
}

function seedEarnings(): Record<string, Earning[]> {
  const out: Record<string, Earning[]> = {};
  TRAINER_IDENTITIES.forEach((t, i) => {
    out[t.name] = [
      { id: `E-${i}-1`, kind: "fixed", label: "عقد ثابت — شعبة الشهر الحالي", amount: 3200, status: "approved", source: "عقد-2026-08" },
      { id: `E-${i}-2`, kind: "per_session", label: "جلسات مباشرة منفذة (6 × 150$)", amount: 900, status: "accrued", source: "سجل الجلسات" },
      { id: `E-${i}-3`, kind: "per_session", label: "تقييم واجبات (18 × 12$)", amount: 216, status: "accrued", source: "سجل التقييم" },
      { id: `E-${i}-4`, kind: "fixed", label: "عقد ثابت — الشهر الماضي", amount: 3200, status: "paid", source: "تحويل-7781" },
    ];
  });
  return out;
}

/* ─────────── المتجر المحلي ─────────── */
const COHORTS_KEY = "wajeez_trainer_cohorts";
const SUBS_KEY = "wajeez_trainer_submissions";
const EARN_KEY = "wajeez_trainer_earnings";
const GRADE_AUDIT_KEY = "wajeez_grade_audit";

export function loadCohorts(trainerName: string): Cohort[] {
  try {
    const raw = localStorage.getItem(COHORTS_KEY);
    if (raw) return (JSON.parse(raw) as Cohort[]).filter((c) => c.trainerName === trainerName);
  } catch { /* ignore */ }
  const all = seedCohorts();
  localStorage.setItem(COHORTS_KEY, JSON.stringify(all));
  return all.filter((c) => c.trainerName === trainerName);
}
export function loadAllCohorts(): Cohort[] {
  try { return JSON.parse(localStorage.getItem(COHORTS_KEY) ?? "null") ?? seedCohorts(); } catch { return seedCohorts(); }
}

export function loadSubmissions(trainerName: string): Submission[] {
  const myCohortIds = new Set(loadCohorts(trainerName).map((c) => c.id));
  try {
    const raw = localStorage.getItem(SUBS_KEY);
    if (raw) return (JSON.parse(raw) as Submission[]).filter((s) => myCohortIds.has(s.cohortId));
  } catch { /* ignore */ }
  const all = seedSubmissions(loadAllCohorts());
  localStorage.setItem(SUBS_KEY, JSON.stringify(all));
  return all.filter((s) => myCohortIds.has(s.cohortId));
}

function saveSubmissions(_trainerName: string, mine: Submission[]) {
  const others = (() => {
    try {
      const raw = localStorage.getItem(SUBS_KEY);
      const all = raw ? (JSON.parse(raw) as Submission[]) : [];
      const myIds = new Set(mine.map((s) => s.id));
      return all.filter((s) => !myIds.has(s.id));
    } catch { return []; }
  })();
  localStorage.setItem(SUBS_KEY, JSON.stringify([...others, ...mine]));
}

/* تقييم تسليم — US-09: روبريك + ملاحظات + سجل تدقيق */
export function gradeSubmission(
  trainerName: string, id: string, rubric: Record<string, number>,
  feedback: string, decision: "approved" | "revision"
): Submission | null {
  const mine = loadSubmissions(trainerName);
  const idx = mine.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const grade = ASSIGNMENT_RUBRIC.reduce((sum, r) => sum + Math.min(rubric[r.key] ?? 0, r.weight), 0);
  mine[idx] = {
    ...mine[idx], status: decision, grade,
    rubric, feedback,
    history: [...mine[idx].history, { at: new Date().toISOString(), action: decision === "approved" ? `اعتماد بالدرجة ${grade}` : "طلب تعديل مع ملاحظات", by: trainerName }],
  };
  saveSubmissions(trainerName, mine);
  return mine[idx];
}

export function closeGrading(trainerName: string, id: string): void {
  const mine = loadSubmissions(trainerName).map((s) =>
    s.id === id && s.status === "approved"
      ? { ...s, status: "closed" as SubmissionStatus, history: [...s.history, { at: new Date().toISOString(), action: "إغلاق التقييم نهائيا", by: trainerName }] }
      : s
  );
  saveSubmissions(trainerName, mine);
}

/* تعديل درجة بعد اعتمادها — 15.2: يحتاج سببا وسجل مراجعة */
export interface GradeAuditEntry { at: string; trainer: string; submissionId: string; oldGrade: number; newGrade: number; reason: string; }
export function loadGradeAudit(): GradeAuditEntry[] {
  try { return JSON.parse(localStorage.getItem(GRADE_AUDIT_KEY) ?? "[]") as GradeAuditEntry[]; } catch { return []; }
}
export function requestGradeChange(trainerName: string, id: string, newGrade: number, reason: string): boolean {
  const mine = loadSubmissions(trainerName);
  const idx = mine.findIndex((s) => s.id === id);
  if (idx === -1 || mine[idx].grade === undefined || !reason.trim()) return false;
  const entry: GradeAuditEntry = { at: new Date().toISOString(), trainer: trainerName, submissionId: id, oldGrade: mine[idx].grade!, newGrade, reason: reason.trim() };
  localStorage.setItem(GRADE_AUDIT_KEY, JSON.stringify([entry, ...loadGradeAudit()]));
  mine[idx] = { ...mine[idx], grade: newGrade, history: [...mine[idx].history, { at: entry.at, action: `تعديل درجة ${entry.oldGrade} → ${newGrade} بسبب موثق`, by: trainerName }] };
  saveSubmissions(trainerName, mine);
  return true;
}

/* رفع تسجيل جلسة — ملف خاص برابط رفع موقع (يوافق learning-portal.routes) */
export function uploadSessionRecording(_trainerName: string, cohortId: string, sessionId: string, fileName: string): boolean {
  const all = loadAllCohorts();
  const co = all.find((c) => c.id === cohortId);
  const se = co?.sessions.find((s) => s.id === sessionId);
  if (!co || !se || se.recording !== "none") return false;
  se.recording = "uploaded";
  se.recordingFile = fileName;
  localStorage.setItem(COHORTS_KEY, JSON.stringify(all));
  return true;
}

/* نشر تسجيل جلسة — 15.2: لا يُنشر قبل رفعه ثم استكمال الموافقة والخصوصية */
export function requestRecordingPublish(_trainerName: string, cohortId: string, sessionId: string): "requested" | "already" {
  const all = loadAllCohorts();
  const co = all.find((c) => c.id === cohortId);
  const se = co?.sessions.find((s) => s.id === sessionId);
  if (!co || !se) return "already";
  if (se.recording === "uploaded") { se.recording = "pending_review"; }
  else return "already";
  localStorage.setItem(COHORTS_KEY, JSON.stringify(all));
  return "requested";
}

/* رصد حضور طالب في جلسة — يعيد حساب نسبة حضوره فورا كما يفعل الخادم */
export function setStudentAttendance(cohortId: string, sessionId: string, studentId: string, status: "present" | "absent"): void {
  const all = loadAllCohorts();
  const co = all.find((c) => c.id === cohortId);
  const se = co?.sessions.find((s) => s.id === sessionId);
  if (!co || !se) return;
  se.attendance = { ...(se.attendance ?? {}), [studentId]: status };
  /* إعادة حساب التقدم: نسبة الحضور = الجلسات المحضورة ÷ الجلسات المرصودة له */
  const student = co.students.find((s) => s.id === studentId);
  if (student) {
    let present = 0, marked = 0;
    for (const sess of co.sessions) {
      const rec = sess.attendance?.[studentId];
      if (rec) { marked++; if (rec === "present") present++; }
    }
    if (marked > 0) student.attendancePct = Math.round((present / marked) * 100);
  }
  localStorage.setItem(COHORTS_KEY, JSON.stringify(all));
}

/* إقفال رصد الجلسة بعد اكتمال كشفها */
export function finalizeAttendance(_trainerName: string, cohortId: string, sessionId: string): void {
  const all = loadAllCohorts();
  const co = all.find((c) => c.id === cohortId);
  const se = co?.sessions.find((s) => s.id === sessionId);
  if (se) se.attendanceMarked = true;
  localStorage.setItem(COHORTS_KEY, JSON.stringify(all));
}

/* رفض تسليم بسبب موثق — يقابله reject في مراجعة التسليمات عند الخادم */
export function rejectSubmission(trainerName: string, id: string, reason: string): boolean {
  if (!reason.trim()) return false;
  const mine = loadSubmissions(trainerName);
  const idx = mine.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  mine[idx] = {
    ...mine[idx], status: "rejected", rejectReason: reason.trim(),
    history: [...mine[idx].history, { at: new Date().toISOString(), action: "رفض التسليم بسبب موثق", by: trainerName }],
  };
  saveSubmissions(trainerName, mine);
  return true;
}

/* مهام تهيئة المدرب */
const ONBOARD_KEY = "wajeez_trainer_onboarding";
const ONBOARD_SEED: Omit<OnboardingTask, "done">[] = [
  { id: "contract", label: "توقيع العقد الإلكتروني" },
  { id: "profile", label: "إكمال الملف المهني والصورة المعتمدة" },
  { id: "orientation", label: "حضور الجلسة التعريفية للمدربين" },
  { id: "blueprint", label: "مراجعة المخطط الأساسي (Blueprint) لدورتك" },
  { id: "zoom", label: "تفعيل حساب Zoom وربطه بالمنصة" },
];
export function loadOnboardingTasks(_trainerName: string): OnboardingTask[] {
  void _trainerName; // التهيئة محلية مشتركة في الديمو — عند الربط تُقرأ من ملف المدرب نفسه
  try {
    const raw = localStorage.getItem(ONBOARD_KEY);
    if (raw) return JSON.parse(raw) as OnboardingTask[];
  } catch { /* ignore */ }
  const seeded = ONBOARD_SEED.map((t, i) => ({ ...t, done: i === 0 })); // العقد موقع في الديمو
  localStorage.setItem(ONBOARD_KEY, JSON.stringify(seeded));
  return seeded;
}
export function toggleOnboardingTask(_trainerName: string, taskId: string): void {
  const tasks = loadOnboardingTasks(_trainerName).map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
  localStorage.setItem(ONBOARD_KEY, JSON.stringify(tasks));
}

/* المستحقات — 15.1: تقديرية ومعتمدة ومدفوعة دون كشف ربحية كاملة */
export function loadEarnings(trainerName: string): Earning[] {
  try {
    const raw = localStorage.getItem(EARN_KEY);
    if (raw) return (JSON.parse(raw) as Record<string, Earning[]>)[trainerName] ?? [];
  } catch { /* ignore */ }
  const all = seedEarnings();
  localStorage.setItem(EARN_KEY, JSON.stringify(all));
  return all[trainerName] ?? [];
}

export const EARNING_STATUS_LABEL: Record<Earning["status"], string> = {
  accrued: "تقديرية — قيد التراكم", approved: "معتمدة — بانتظار الدفع", paid: "مدفوعة",
};
export const EARNING_KIND_LABEL: Record<Earning["kind"], string> = {
  fixed: "عقد ثابت", per_session: "لكل جلسة/تقييم", percent: "نسبة إيراد",
};

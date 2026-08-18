/**
 * نموذج بيانات بوابة المستشار — Advisor Portal Store
 * -------------------------------------------------------
 * القسم 14 من الوثيقة + الملحق ب (نموذج سجل مخاطرة الطالب).
 * محاكاة محلية: الطالب الحقيقي الوحيد هو مستخدم هذا الجهاز (من التشخيص والدفع)،
 * والباقي طلبة تجريبيون يغطون حالات الوثيقة الاختبارية (25.2):
 * جديد، متقدم، متعثر، موقوف، مسترد.
 * عند النقل إلى Replit تُستبدل المصادر بـ GET /api/advisor/students
 * والمخاطرة تحسب server-side بقواعد قابلة للشرح — ولا تستخدم لعقوبة آلية أبدا.
 */

import { pathwayById, pathways } from "./pathways";
import { pathwayCourses, courseById } from "./courses";
import { loadPortal, pathwayPercent, courseGate, readUserName } from "./student";
import { getEnrollment } from "@/services/access";

/* ─────────── الأنواع ─────────── */
export type RiskLevel = "green" | "yellow" | "red";
export type StudentStatus = "onboarding" | "active" | "at_risk" | "paused" | "refunded" | "completed";

export interface TimelineEvent {
  at: string; // YYYY-MM-DD
  kind: "message" | "call" | "payment" | "login" | "complete" | "absence" | "submission" | "grade" | "note";
  text: string;
}
export interface AdvisorStudent {
  id: string;
  name: string;
  role: string; // الدور الحالي
  goal: string;
  pathwayId: string;
  confidence: number; // درجة ثقة التوصية عند القبول
  status: StudentStatus;
  progressPct: number;
  lastActiveDays: number; // منذ كم يوم آخر نشاط
  signals: RiskSignal[];
  timeline: TimelineEvent[];
  isRealUser?: boolean;
}
export interface RiskSignal { key: string; label: string; points: number; active: boolean; }
export interface PathReviewRequest {
  id: string; studentName: string; reason: string; confidence: number;
  suggestedPathId: string; status: "pending" | "approved" | "custom";
  at: string;
}

/* ─────────── محرك المخاطرة — الملحق ب: 0–24 أخضر، 25–49 أصفر، 50+ أحمر ───────────
   قواعد قابلة للشرح وتاريخ آخر حساب معروض؛ لا عقوبة آلية — القرار للمستشار دائما. */
export const RISK_RULES: { key: string; label: string; points: number }[] = [
  { key: "no_login", label: "عدم دخول منذ 5 أيام أو أكثر", points: 20 },
  { key: "absence", label: "غياب عن جلسة مباشرة", points: 15 },
  { key: "late_assignment", label: "واجب متأخر عن موعده", points: 15 },
  { key: "failed_quiz", label: "رسوب في اختبار مقيم", points: 10 },
  { key: "payment_issue", label: "تعثر دفع أو مطالبة مالية", points: 25 },
  { key: "negative_feedback", label: "تقييم سلبي للدورة أو المدرب", points: 10 },
  { key: "recent_activity", label: "نشاط تعلم خلال 48 ساعة (يخفض)", points: -10 },
];

export function riskScore(signals: RiskSignal[]): number {
  const total = signals.filter((s) => s.active).reduce((sum, s) => sum + s.points, 0);
  return Math.max(0, Math.min(100, total));
}
export function riskLevel(score: number): RiskLevel {
  return score >= 50 ? "red" : score >= 25 ? "yellow" : "green";
}

function sig(key: string, active: boolean): RiskSignal {
  const rule = RISK_RULES.find((r) => r.key === key)!;
  return { key, label: rule.label, points: rule.points, active };
}

/* ─────────── الإجراء الأفضل التالي (Next Best Action) ─────────── */
export interface NBA { action: string; why: string; channel: "whatsapp" | "booking" | "none"; }
export function nextBestAction(s: AdvisorStudent): NBA {
  const act = (k: string) => s.signals.find((x) => x.key === k)?.active;
  if (s.status === "refunded") return { action: "لا إجراء — أُغلق الملف وفق سياسة الاسترداد", why: "الاسترداد مكتمل وموثق", channel: "none" };
  if (s.status === "paused") return { action: "راجع سبب الإيقاف وتاريخ المراجعة", why: "إيقاف معتمد يحتاج متابعة مجدولة لا رسائل عشوائية", channel: "booking" };
  if (act("payment_issue")) return { action: "تواصل لترتيب الدفع", why: "تعثر الدفع أثقل إشارة — يُحل بالحوار لا بالإشعارات", channel: "whatsapp" };
  if (act("no_login")) return { action: "رسالة تفقد ودية", why: "اختفى منذ أيام — التدخل المبكر يمنع التسرب", channel: "whatsapp" };
  if (act("absence")) return { action: "احجز جلسة تعويضية", why: "غاب عن جلسة مباشرة ويحتاج تعويض المحتوى", channel: "booking" };
  if (act("failed_quiz")) return { action: "اقترح جلسة تقوية", why: "رسب في اختبار — الفجوة محددة وقابلة للعلاج", channel: "booking" };
  if (act("late_assignment")) return { action: "ذكّره بموعد الواجب", why: "تأخر تسليم واحد لا يعني تعثرا — تذكير يكفي", channel: "whatsapp" };
  if (s.status === "completed") return { action: "اطلب تقييمه وقصته", why: "الخريجون السعداء هم سفراؤنا وقصصنا القادمة", channel: "whatsapp" };
  return { action: "لا إجراء — يسير بشكل صحي", why: "نشاط منتظم وتقدم طبيعي", channel: "none" };
}

/* ─────────── بيانات تجريبية ─────────── */
const today = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

function seedStudents(): AdvisorStudent[] {
  const pw = (i: number) => pathways[i % pathways.length].id;
  return [
    {
      id: "st-real", name: readUserName(), role: "متعلم هذا الجهاز", goal: "هدفه من التشخيص",
      pathwayId: getEnrollment()?.pathwayId ?? pw(0),
      confidence: 89, status: "active",
      progressPct: 0, lastActiveDays: 0,
      signals: [sig("recent_activity", true)],
      timeline: [{ at: today(0), kind: "payment", text: "دفع ناجح — فُتح وصوله تلقائيا" }, { at: today(0), kind: "login", text: "أول دخول لمنصة الطالب" }],
      isRealUser: true,
    },
    {
      id: "st-1", name: "عبدالعزيز الحربي", role: "موظف موارد بشرية — الرياض", goal: "الانتقال لشركاء الأعمال HRBP",
      pathwayId: pw(3), confidence: 91, status: "active", progressPct: 62, lastActiveDays: 1,
      signals: [sig("recent_activity", true)],
      timeline: [
        { at: today(-1), kind: "complete", text: "أكمل الدورة الثالثة بدرجة 92" },
        { at: today(-3), kind: "submission", text: "سلّم واجب «تصميم تجربة الموظف»" },
        { at: today(-6), kind: "login", text: "حضر ورشة التطبيق المباشرة" },
      ],
    },
    {
      id: "st-2", name: "منيرة القحطاني", role: "محاسبة — جدة", goal: "محللة بيانات مالية",
      pathwayId: pw(5), confidence: 84, status: "at_risk", progressPct: 28, lastActiveDays: 8,
      signals: [sig("no_login", true), sig("late_assignment", true)],
      timeline: [
        { at: today(-8), kind: "login", text: "آخر دخول للمنصة" },
        { at: today(-10), kind: "grade", text: "اجتازت اختبار الدورة الأولى بـ76" },
        { at: today(-12), kind: "message", text: "أجابت رسالة المستشار: «ضغط عمل مؤقت»" },
      ],
    },
    {
      id: "st-3", name: "فيصل الدوسري", role: "مشرف خدمة عملاء — الدمام", goal: "مدير تجربة عميل",
      pathwayId: pw(7), confidence: 78, status: "at_risk", progressPct: 41, lastActiveDays: 3,
      signals: [sig("absence", true), sig("failed_quiz", true)],
      timeline: [
        { at: today(-3), kind: "absence", text: "غاب عن ورشة «المحادثات الصعبة»" },
        { at: today(-5), kind: "grade", text: "رسب في اختبار الدورة الثانية (58)" },
        { at: today(-9), kind: "submission", text: "سلّم واجب خريطة رحلة العميل — اعتُمد" },
      ],
    },
    {
      id: "st-4", name: "ريم العتيبي", role: "طالبة ماجستير — الرياض", goal: "أول وظيفة في التسويق الرقمي",
      pathwayId: pw(2), confidence: 72, status: "paused", progressPct: 35, lastActiveDays: 15,
      signals: [sig("no_login", true)],
      timeline: [
        { at: today(-15), kind: "note", text: "إيقاف معتمد — فترة اختباراتها الجامعية، مراجعة بعد أسبوعين" },
        { at: today(-16), kind: "call", text: "مكالمة مستشار: اتفاق على الإيقاف المؤقت" },
      ],
    },
    {
      id: "st-5", name: "تركي الشمري", role: "رائد أعمال — الخبر", goal: "بناء فريق مبيعات أول",
      pathwayId: pw(9), confidence: 81, status: "at_risk", progressPct: 12, lastActiveDays: 6,
      signals: [sig("payment_issue", true), sig("no_login", true)],
      timeline: [
        { at: today(-6), kind: "payment", text: "فشلت محاولة تحصيل الدفعة الثانية" },
        { at: today(-13), kind: "login", text: "أكمل الدرس الافتتاحي" },
      ],
    },
    {
      id: "st-6", name: "جواهر السبيعي", role: "مصممة داخلية — جدة", goal: "محفظة أعمال في UX",
      pathwayId: pw(4), confidence: 95, status: "completed", progressPct: 100, lastActiveDays: 2,
      signals: [sig("recent_activity", true)],
      timeline: [
        { at: today(-2), kind: "complete", text: "اعتُمد مشروع تخرجها — صدرت شهادة المسار" },
        { at: today(-9), kind: "grade", text: "اجتازت اختبار الدورة الأخيرة بـ94" },
        { at: today(-30), kind: "payment", text: "دفعت المسار كاملا" },
      ],
    },
  ];
}

const KEY = "wajeez_advisor_students";

export function loadAdvisorStudents(): AdvisorStudent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const students = JSON.parse(raw) as AdvisorStudent[];
      // حدّث الطالب الحقيقي من بيانات الجهاز الفعلية
      const real = students.find((s) => s.isRealUser);
      if (real) {
        const enr = getEnrollment();
        if (enr) {
          real.pathwayId = enr.pathwayId;
          real.name = readUserName();
          real.progressPct = pathwayPercent(enr.pathwayId, loadPortal(enr.pathwayId));
        }
      }
      return students;
    }
  } catch { /* ignore */ }
  const seeded = seedStudents();
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

export function studentPathwayName(s: AdvisorStudent): string {
  return pathwayById(s.pathwayId)?.name ?? "مسار مخصص";
}

export function studentCourseCount(s: AdvisorStudent): { done: number; total: number } {
  const ids = pathwayCourses[s.pathwayId] ?? [];
  if (s.isRealUser) {
    const state = loadPortal(s.pathwayId);
    const done = ids.filter((id) => courseGate(s.pathwayId, id, state).status === "completed").length;
    return { done, total: ids.length };
  }
  return { done: Math.round((s.progressPct / 100) * ids.length), total: ids.length };
}

export function currentCourseName(s: AdvisorStudent): string {
  const ids = pathwayCourses[s.pathwayId] ?? [];
  const idx = Math.min(ids.length - 1, Math.floor((s.progressPct / 100) * ids.length));
  const c = ids[idx] ? courseById(ids[idx]) : null;
  return c?.name ?? "—";
}

/* ─────────── طلبات مراجعة المسار المخصص (القسم 6.2 الخطوة 6 + 14.2) ─────────── */
const REVIEW_KEY = "wajeez_path_reviews";

export function loadPathReviews(): PathReviewRequest[] {
  try {
    const raw = localStorage.getItem(REVIEW_KEY);
    if (raw) return JSON.parse(raw) as PathReviewRequest[];
  } catch { /* ignore */ }
  const seeded: PathReviewRequest[] = [
    { id: "rev-1", studentName: "زائر — تشخيص ثقته 43%", reason: "ثقة منخفضة وتعارض بين هدف معلن وإجابات الاستكشاف", confidence: 43, suggestedPathId: pathways[6].id, status: "pending", at: today(-1) },
    { id: "rev-2", studentName: "سارة المطيري", reason: "طلبت دمج دورتين من مسارين مختلفين في مسار واحد", confidence: 68, suggestedPathId: pathways[1].id, status: "pending", at: today(-2) },
  ];
  localStorage.setItem(REVIEW_KEY, JSON.stringify(seeded));
  return seeded;
}

export function resolvePathReview(id: string, status: "approved" | "custom") {
  const list = loadPathReviews().map((r) => (r.id === id ? { ...r, status } : r));
  localStorage.setItem(REVIEW_KEY, JSON.stringify(list));
}

/* ─────────── سجل إجراءات المستشار (Audit — كل تغيير موثق) ─────────── */
const AUDIT_KEY = "wajeez_advisor_audit";
export interface AuditEntry { at: string; advisor: string; action: string; studentId: string; }
export function loadAudit(): AuditEntry[] {
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) ?? "[]") as AuditEntry[]; } catch { return []; }
}
export function logAudit(advisor: string, action: string, studentId: string) {
  const entry: AuditEntry = { at: new Date().toISOString(), advisor, action, studentId };
  localStorage.setItem(AUDIT_KEY, JSON.stringify([entry, ...loadAudit()].slice(0, 50)));
}

/* ═══════════════ ملفات الحالات — محاكاة مسارات operations.routes.ts ═══════════════
   تطابق سلوك الخادم: ثماني حالات موثقة، مهام بمواعيد استحقاق، متابعات بنتائج،
   تواصل (أول تواصل ينقل الحالة تلقائيا)، ملاحظات داخلية، سيرة بسجل مشاهدة، وإسناد. */

export type CaseStatus =
  | "new" | "contacted" | "needs_review" | "follow_up"
  | "recommended" | "enrolled" | "not_interested" | "closed";

export const CASE_STATUS_META: Record<CaseStatus, { label: string; cls: string }> = {
  new:            { label: "جديدة",        cls: "border-white/20 text-white/70" },
  contacted:      { label: "تم التواصل",   cls: "border-[#38A7B4]/50 text-[#6EC7D1]" },
  needs_review:   { label: "تحتاج مراجعة", cls: "border-[#FABC05]/50 text-[#FABC05]" },
  follow_up:      { label: "قيد المتابعة", cls: "border-[#38A7B4]/50 text-[#6EC7D1]" },
  recommended:    { label: "أوصي بمسار",   cls: "border-[#FABC05]/50 text-[#FABC05]" },
  enrolled:       { label: "مسجّل",        cls: "border-[#38A7B4]/50 text-[#6EC7D1]" },
  not_interested: { label: "غير مهتم",     cls: "border-white/15 text-white/40" },
  closed:         { label: "مغلقة",        cls: "border-white/15 text-white/40" },
};
export const CASE_STATUSES = Object.keys(CASE_STATUS_META) as CaseStatus[];

export type ContactChannel = "whatsapp" | "email" | "phone" | "in_app";
export const CHANNEL_LABEL: Record<ContactChannel, string> = {
  whatsapp: "واتساب", email: "بريد", phone: "اتصال", in_app: "داخل المنصة",
};

export interface CaseTask { id: string; title: string; dueAt?: string; done: boolean; doneAt?: string; }
export interface CaseFollowUp {
  id: string; scheduledAt: string; channel?: ContactChannel; note?: string;
  doneAt?: string; outcome?: string;
}
export interface CaseContact { id: string; at: string; channel: ContactChannel; direction: "out" | "in"; summary: string; by: string; }
export interface CaseNote { id: string; at: string; body: string; by: string; }
export interface StatusChange { at: string; from: CaseStatus; to: CaseStatus; by: string; note?: string; }
export interface CvView { at: string; by: string; }

export interface AdvisorCase {
  id: string;
  studentId?: string;       // ربط بسجل AdvisorStudent إن وجد
  studentName: string;
  status: CaseStatus;
  nextAction?: string;
  nextFollowUpAt?: string;
  tasks: CaseTask[];
  followUps: CaseFollowUp[];
  contacts: CaseContact[];
  notes: CaseNote[];        // داخلية — لا تظهر للعميل
  history: StatusChange[];
  cv?: { fileName: string; sizeKb: number; uploadedAt: string; views: CvView[] };
  assignedTo?: string;      // اسم المستشار — الحالات بلا مستشار تُسند من لوحة الإدارة
}

const CASES_KEY = "wajeez_advisor_cases";
let caseSeq = 100;
const cid = () => `c-${Date.now().toString(36)}-${caseSeq++}`;

function isoDT(dayOffset: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
}

function seedCases(): AdvisorCase[] {
  return [
    {
      id: "case-real", studentId: "st-real", studentName: readUserName(), status: "enrolled",
      nextAction: "رسالة ترحيب بعد أول جلسة مباشرة", nextFollowUpAt: isoDT(4, 12),
      tasks: [{ id: "t-real-1", title: "التأكد من اكتمال ملفه الشخصي", dueAt: isoDT(2), done: false }],
      followUps: [], contacts: [], notes: [], history: [
        { at: isoDT(-1, 9), from: "new", to: "contacted", by: "أ. ريم القحطاني", note: "أول تواصل بعد الدفع" },
        { at: isoDT(0, 11), from: "contacted", to: "enrolled", by: "أ. ريم القحطاني" },
      ],
      assignedTo: "أ. ريم القحطاني",
    },
    {
      id: "case-1", studentId: "st-1", studentName: "عبدالعزيز الحربي", status: "enrolled",
      nextAction: "تهنئته على إتمام الدورة الثالثة", nextFollowUpAt: isoDT(3),
      tasks: [], followUps: [], contacts: [
        { id: "ct-1", at: isoDT(-6, 13), channel: "whatsapp", direction: "out", summary: "رحّب به وشرح خطة المسار", by: "أ. ريم القحطاني" },
      ],
      notes: [{ id: "n-1", at: isoDT(-6, 14), body: "متجاوب ومنظم — يفضل التواصل بعد السادسة مساء", by: "أ. ريم القحطاني" }],
      history: [{ at: isoDT(-20, 10), from: "recommended", to: "enrolled", by: "أ. ريم القحطاني" }],
      cv: { fileName: "abdulaziz-cv.pdf", sizeKb: 184, uploadedAt: isoDT(-18), views: [
        { at: isoDT(-6, 13), by: "أ. ريم القحطاني" },
      ] },
      assignedTo: "أ. ريم القحطاني",
    },
    {
      id: "case-2", studentId: "st-2", studentName: "منيرة القحطاني", status: "follow_up",
      nextAction: "جلسة صوتية لسماع ظرفها وإعادة جدولة واجبها", nextFollowUpAt: isoDT(1, 17),
      tasks: [
        { id: "t-2-1", title: "إعادة جدولة واجب «تحليل القوائم» بعد موافقة المدرب", dueAt: isoDT(1), done: false },
        { id: "t-2-2", title: "مراجعة نتيجة اختبار الدورة الأولى معها", dueAt: isoDT(-2), done: false },
      ],
      followUps: [
        { id: "f-2-1", scheduledAt: isoDT(1, 17), channel: "phone", note: "اتفقت على اتصال بعد الدوام" },
        { id: "f-2-0", scheduledAt: isoDT(-12, 12), channel: "whatsapp", doneAt: isoDT(-12, 12), outcome: "ردت: ضغط عمل مؤقت" },
      ],
      contacts: [
        { id: "ct-2", at: isoDT(-12, 12), channel: "whatsapp", direction: "in", summary: "أجابت رسالة التفقد: ضغط عمل مؤقت", by: "أ. ريم القحطاني" },
      ],
      notes: [{ id: "n-2", at: isoDT(-11, 9), body: "لا تضغط عليها هذا الأسبوع — حساسية من مطالبات الدفع السابقة لدى جهة أخرى", by: "أ. ريم القحطاني" }],
      history: [{ at: isoDT(-12, 12), from: "enrolled", to: "follow_up", by: "أ. ريم القحطاني", note: "إشارات مخاطرة نشطة" }],
      assignedTo: "أ. ريم القحطاني",
    },
    {
      id: "case-3", studentId: "st-3", studentName: "فيصل الدوسري", status: "needs_review",
      nextAction: "مراجعة خطة تعويض الغياب قبل جلسة الخميس", nextFollowUpAt: isoDT(2, 11),
      tasks: [{ id: "t-3-1", title: "التنسيق مع المدرب لجلسة تعويضية", dueAt: isoDT(0, 16), done: false }],
      followUps: [], contacts: [], notes: [], history: [
        { at: isoDT(-3, 18), from: "enrolled", to: "needs_review", by: "د. فيصل العتيبي", note: "غياب + رسوب متتاليان" },
      ],
      assignedTo: "د. فيصل العتيبي",
    },
    {
      id: "case-4", studentId: "st-4", studentName: "ريم العتيبي", status: "follow_up",
      nextAction: "التحقق من انتهاء اختباراتها الجامعية قبل إنهاء الإيقاف", nextFollowUpAt: isoDT(12),
      tasks: [], followUps: [
        { id: "f-4-1", scheduledAt: isoDT(12, 10), channel: "whatsapp", note: "موعد المراجعة المتفق عليه في مكالمة الإيقاف" },
      ],
      contacts: [
        { id: "ct-4", at: isoDT(-16, 15), channel: "phone", direction: "out", summary: "مكالمة: اتفاق على إيقاف مؤقت ومراجعة بعد أسبوعين", by: "د. فيصل العتيبي" },
      ],
      notes: [], history: [{ at: isoDT(-15, 9), from: "enrolled", to: "follow_up", by: "د. فيصل العتيبي", note: "إيقاف معتمد" }],
      assignedTo: "د. فيصل العتيبي",
    },
    {
      id: "case-5", studentId: "st-5", studentName: "تركي الشمري", status: "contacted",
      nextAction: "عرض تقسيط بديل قبل إيقاف الوصول", nextFollowUpAt: isoDT(0, 19),
      tasks: [
        { id: "t-5-1", title: "التأكد من رد المالية على طلب التقسيط", dueAt: isoDT(0, 14), done: false },
      ],
      followUps: [
        { id: "f-5-1", scheduledAt: isoDT(0, 19), channel: "whatsapp" },
      ],
      contacts: [
        { id: "ct-5", at: isoDT(-6, 20), channel: "whatsapp", direction: "out", summary: "أخبرته بتعثر الدفعة الثانية وطلبت وقتا مناسبا للحوار", by: "م. سلطان الدوسري" },
      ],
      notes: [{ id: "n-5", at: isoDT(-5, 10), body: "حساس تجاه المطالبات المباشرة — ابدأ بالحلول لا بالتنبيه", by: "م. سلطان الدوسري" }],
      history: [{ at: isoDT(-6, 20), from: "new", to: "contacted", by: "م. سلطان الدوسري", note: "أول تواصل — نُقلت تلقائيا" }],
      assignedTo: "م. سلطان الدوسري",
    },
    {
      id: "case-6", studentId: "st-6", studentName: "جواهر السبيعي", status: "closed",
      nextAction: "لا إجراء — أُغلقت بعد التخرج وطلب القصة", nextFollowUpAt: undefined,
      tasks: [{ id: "t-6-1", title: "إرسال استبيان الخريجين", done: true, doneAt: isoDT(-1, 10) }],
      followUps: [
        { id: "f-6-1", scheduledAt: isoDT(-2, 13), channel: "whatsapp", doneAt: isoDT(-2, 13), outcome: "وافقت على مشاركة قصتها" },
      ],
      contacts: [], notes: [], history: [
        { at: isoDT(-2, 14), from: "enrolled", to: "closed", by: "م. لينا الحربي", note: "تخرجت — صدرت الشهادة" },
      ],
      cv: { fileName: "jawaher-ux-portfolio.pdf", sizeKb: 2410, uploadedAt: isoDT(-30), views: [] },
      assignedTo: "م. لينا الحربي",
    },
    /* حالات بلا مستشار — تظهر للإسناد كما في GET /api/admin/advisor-cases/unassigned */
    {
      id: "case-u1", studentName: "نورة العنزي", status: "new",
      nextAction: undefined, nextFollowUpAt: undefined,
      tasks: [], followUps: [], contacts: [], notes: [], history: [],
      cv: { fileName: "noura-cv.pdf", sizeKb: 96, uploadedAt: isoDT(-1), views: [] },
    },
    {
      id: "case-u2", studentName: "ماجد القرني", status: "new",
      tasks: [], followUps: [], contacts: [], notes: [], history: [],
    },
  ];
}

export function loadCases(): AdvisorCase[] {
  try {
    const raw = localStorage.getItem(CASES_KEY);
    if (raw) return JSON.parse(raw) as AdvisorCase[];
  } catch { /* ignore */ }
  const seeded = seedCases();
  localStorage.setItem(CASES_KEY, JSON.stringify(seeded));
  return seeded;
}

function saveCases(cases: AdvisorCase[]) {
  localStorage.setItem(CASES_KEY, JSON.stringify(cases));
}

export function caseForStudent(studentId: string): AdvisorCase | undefined {
  return loadCases().find((c) => c.studentId === studentId);
}

export function unassignedCases(): AdvisorCase[] {
  return loadCases().filter((c) => !c.assignedTo && !["closed", "enrolled", "not_interested"].includes(c.status));
}

/** تغيير الحالة — ثماني حالات موثقة، كل انتقال محفوظ بمن ومتى ولماذا */
export function setCaseStatus(caseId: string, to: CaseStatus, by: string, note?: string): AdvisorCase[] {
  const cases = loadCases().map((c) => {
    if (c.id !== caseId || c.status === to) return c;
    return {
      ...c, status: to,
      history: [{ at: isoDT(0, new Date().getHours()), from: c.status, to, by, note }, ...c.history],
    };
  });
  saveCases(cases);
  return cases;
}

/** الإجراء التالي وموعد المتابعة القادم — POST /api/advisor/cases/:id/next-action */
export function setCaseNextAction(caseId: string, nextAction: string, nextFollowUpAt?: string): AdvisorCase[] {
  const cases = loadCases().map((c) => (c.id === caseId ? { ...c, nextAction, nextFollowUpAt } : c));
  saveCases(cases);
  return cases;
}

export function addCaseTask(caseId: string, title: string, dueAt?: string): AdvisorCase[] {
  const cases = loadCases().map((c) =>
    c.id === caseId ? { ...c, tasks: [...c.tasks, { id: cid(), title, dueAt, done: false }] } : c);
  saveCases(cases);
  return cases;
}

export function completeCaseTask(caseId: string, taskId: string): AdvisorCase[] {
  const cases = loadCases().map((c) =>
    c.id === caseId
      ? { ...c, tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, done: true, doneAt: isoDT(0, new Date().getHours()) } : t)) }
      : c);
  saveCases(cases);
  return cases;
}

/** جدولة متابعة — تنعكس على موعد متابعة الحالة */
export function addCaseFollowUp(caseId: string, scheduledAt: string, channel?: ContactChannel, note?: string): AdvisorCase[] {
  const cases = loadCases().map((c) =>
    c.id === caseId
      ? { ...c, followUps: [{ id: cid(), scheduledAt, channel, note }, ...c.followUps], nextFollowUpAt: scheduledAt }
      : c);
  saveCases(cases);
  return cases;
}

export function completeCaseFollowUp(caseId: string, followUpId: string, outcome: string, note?: string): AdvisorCase[] {
  const cases = loadCases().map((c) =>
    c.id === caseId
      ? { ...c, followUps: c.followUps.map((f) => (f.id === followUpId ? { ...f, doneAt: isoDT(0, new Date().getHours()), outcome, note: note ?? f.note } : f)) }
      : c);
  saveCases(cases);
  return cases;
}

/** تسجيل تواصل — أول تواصل ينقل الحالة من new إلى contacted تلقائيا كما في الخادم */
export function addCaseContact(caseId: string, channel: ContactChannel, direction: "out" | "in", summary: string, by: string): AdvisorCase[] {
  const cases = loadCases().map((c) => {
    if (c.id !== caseId) return c;
    const contact: CaseContact = { id: cid(), at: isoDT(0, new Date().getHours()), channel, direction, summary, by };
    const autoContacted = c.status === "new";
    return {
      ...c,
      contacts: [contact, ...c.contacts],
      status: autoContacted ? "contacted" : c.status,
      history: autoContacted
        ? [{ at: contact.at, from: "new" as CaseStatus, to: "contacted" as CaseStatus, by, note: "أول تواصل — نُقلت تلقائيا" }, ...c.history]
        : c.history,
    };
  });
  saveCases(cases);
  return cases;
}

/** ملاحظة داخلية — لا تظهر للعميل أبدا */
export function addCaseNote(caseId: string, body: string, by: string): AdvisorCase[] {
  const cases = loadCases().map((c) =>
    c.id === caseId ? { ...c, notes: [{ id: cid(), at: isoDT(0, new Date().getHours()), body, by }, ...c.notes] } : c);
  saveCases(cases);
  return cases;
}

/** فتح رابط قراءة السيرة — كل مشاهدة مسجلة كما في GET /api/cv/:id/read-url */
export function viewCaseCv(caseId: string, by: string): AdvisorCase[] {
  const cases = loadCases().map((c) =>
    c.id === caseId && c.cv
      ? { ...c, cv: { ...c.cv, views: [{ at: isoDT(0, new Date().getHours()), by }, ...c.cv.views] } }
      : c);
  saveCases(cases);
  return cases;
}

/** إسناد حالة — POST /api/admin/advisor-cases/:id/assign */
export function assignCase(caseId: string, advisorName: string): AdvisorCase[] {
  const cases = loadCases().map((c) => (c.id === caseId ? { ...c, assignedTo: advisorName } : c));
  saveCases(cases);
  return cases;
}

/* ── مساعدات العرض ── */
export function isOverdue(iso?: string): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

/* تنسيق موحد: القريب نسبي والبعيد تاريخ كامل — مصدره src/utils/format.ts */
export { fmtWhen } from "@/utils/format";
export { fmtWhen as fmtDT } from "@/utils/format";

/* ── «جديد منذ آخر زيارة» لكل حالة — يخزن محليا وقت آخر فتح لملف الحالة ── */
const SEEN_KEY = "wajeez_case_seen";

function readSeenMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, string>; } catch { return {}; }
}
/** وقت آخر زيارة قبل الحالية — null إن لم تُفتح الحالة من قبل */
export function caseSeenAt(caseId: string): string | null {
  return readSeenMap()[caseId] ?? null;
}
/** يُستدعى عند مغادرة ملف الحالة — ما بعد هذا الوقت يُوسم «جديد» في الزيارة القادمة */
export function markCaseSeen(caseId: string) {
  const map = readSeenMap();
  map[caseId] = isoDT(0, new Date().getHours());
  localStorage.setItem(SEEN_KEY, JSON.stringify(map));
}
export function isNewSince(at: string, seenAt: string | null): boolean {
  return seenAt !== null && at > seenAt;
}

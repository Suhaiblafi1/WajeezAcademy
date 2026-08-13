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

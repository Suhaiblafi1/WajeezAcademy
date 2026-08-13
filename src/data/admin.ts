/**
 * نموذج بيانات لوحة الإدارة والعمليات — Admin Portal Store
 * -------------------------------------------------------
 * القسم 16 (الإدارة والعمليات) + US-10 (فتح/إغلاق الشعب) + US-12 (ربحية المسار)
 * + 21.4 (تعريفات ثابتة للمؤشرات) + 10.4 (قواعد فتح وإغلاق الشعب).
 * محاكاة محلية — عند النقل إلى Replit تحسب المؤشرات server-side من سجل الأحداث.
 */

import { pathways } from "./pathways";
import { pathwayCourses, coursePriceOf, courseById } from "./courses";

/* ─────────── مؤشرات عليا (21.4: التعريفات ثابتة ومعلنة) ─────────── */
export interface ExecKpis {
  gross: number; discounts: number; refunds: number; net: number;
  enrolled: number; started: number; active: number; completed: number;
  atRisk: number; pendingReviews: number; openCohorts: number;
}
export function execKpis(): ExecKpis {
  return {
    gross: 86400, discounts: 14200, refunds: 3600, net: 68600,
    enrolled: 132, started: 121, active: 98, completed: 34,
    atRisk: 9, pendingReviews: 2, openCohorts: 11,
  };
}

/* ─────────── ربحية المسارات — US-12: gross/net/direct cost/margin بتعريفات ثابتة ─────────── */
export interface PathwayProfit {
  id: string; name: string;
  enrollments: number;
  gross: number;      // إجمالي الإيراد قبل أي خصم
  discounts: number;  // خصومات المسار الكامل مقابل الدورات المنفردة
  refunds: number;    // مستردات وchargebacks
  net: number;        // الصافي الفعلي
  directCost: number; // أجور مدربين ومحتوى مباشر
  margin: number;     // net - directCost
  marginPct: number;
}
export function pathwayProfitability(): PathwayProfit[] {
  return pathways.slice(0, 10).map((p, i) => {
    const ids = pathwayCourses[p.id] ?? [];
    const separate = ids.reduce((s, cid) => { const c = courseById(cid); return c ? s + coursePriceOf(c) : s; }, 0);
    const enrollments = 8 + ((i * 5) % 14);
    const gross = enrollments * separate;
    const discounts = enrollments * Math.max(0, separate - 600);
    const refunds = (i % 4) * 300;
    const net = gross - discounts - refunds;
    const directCost = Math.round(net * (0.28 + (i % 3) * 0.04));
    const margin = net - directCost;
    return {
      id: p.id, name: p.name, enrollments, gross, discounts, refunds, net,
      directCost, margin, marginPct: net > 0 ? Math.round((margin / net) * 100) : 0,
    };
  }).sort((a, b) => b.margin - a.margin);
}

/* ─────────── عمليات الشعب — US-10 + 10.4 ─────────── */
export type AdminCohortStatus = "draft" | "open" | "full" | "running" | "postponed" | "cancelled";
export interface CohortChecklist { trainer: boolean; schedule: boolean; capacity: boolean; content: boolean; contract: boolean; }
export interface AdminCohort {
  id: string; courseName: string; pathwayName: string; trainer: string;
  capacity: number; enrolled: number; startDate: string;
  status: AdminCohortStatus; checklist: CohortChecklist; minSeats: number;
}
const CK = "wajeez_admin_cohorts";
const d = (o: number) => { const x = new Date(); x.setDate(x.getDate() + o); return x.toISOString().slice(0, 10); };

function seedAdminCohorts(): AdminCohort[] {
  const trainers = ["أ. ريم القحطاني", "د. فيصل العتيبي", "م. سلطان الدوسري", "م. لينا الحربي", "أ. هند العمري", "م. خالد العنزي"];
  return pathways.slice(0, 8).map((p, i) => {
    const cid = (pathwayCourses[p.id] ?? [])[0];
    const c = cid ? courseById(cid) : null;
    const enrolled = 4 + ((i * 7) % 11);
    const fullCheck: CohortChecklist = { trainer: true, schedule: true, capacity: true, content: true, contract: true };
    return {
      id: `AC-${i}`, courseName: c?.name ?? "دورة تأسيسية", pathwayName: p.name,
      trainer: trainers[i % trainers.length], capacity: 14, enrolled,
      startDate: d(3 + i * 4), minSeats: 6,
      status: i === 0 ? "draft" : enrolled >= 14 ? "full" : i % 5 === 4 ? "postponed" : "open",
      checklist: i === 0 ? { ...fullCheck, content: false, contract: false } : fullCheck,
    } as AdminCohort;
  });
}

export function loadAdminCohorts(): AdminCohort[] {
  try {
    const raw = localStorage.getItem(CK);
    if (raw) return JSON.parse(raw) as AdminCohort[];
  } catch { /* ignore */ }
  const seeded = seedAdminCohorts();
  localStorage.setItem(CK, JSON.stringify(seeded));
  return seeded;
}
function saveAdminCohorts(list: AdminCohort[]) { localStorage.setItem(CK, JSON.stringify(list)); }

/* هل تستوفي الشعبة شروط الفتح؟ — لا تفتح دون مدرب وجدول وسعة ومحتوى وعقد مالي */
export function cohortReadyToOpen(c: AdminCohort): { ready: boolean; missing: string[] } {
  const labels: Record<keyof CohortChecklist, string> = {
    trainer: "مدرب معتمد ومسند", schedule: "جدول جلسات منشور", capacity: "سعة مقاعد محددة",
    content: "محتوى الدورة معتمد", contract: "العقد المالي للمدرب موقع",
  };
  const missing = (Object.keys(labels) as (keyof CohortChecklist)[]).filter((k) => !c.checklist[k]).map((k) => labels[k]);
  return { ready: missing.length === 0, missing };
}

export function openCohort(id: string): { ok: boolean; reason?: string } {
  const list = loadAdminCohorts();
  const c = list.find((x) => x.id === id);
  if (!c) return { ok: false, reason: "الشعبة غير موجودة" };
  const check = cohortReadyToOpen(c);
  if (!check.ready) return { ok: false, reason: `لا يمكن الفتح — ينقص: ${check.missing.join("، ")}` };
  c.status = "open";
  saveAdminCohorts(list);
  return { ok: true };
}

/* تغلق تلقائيا عند بلوغ السعة — تُستدعى عند كل تسجيل جديد */
export function autoCloseAtCapacity(id: string): boolean {
  const list = loadAdminCohorts();
  const c = list.find((x) => x.id === id);
  if (c && c.enrolled >= c.capacity && c.status === "open") {
    c.status = "full";
    saveAdminCohorts(list);
    return true;
  }
  return false;
}

/* دمج أو تأجيل أو تشغيل استثنائي للشعب دون الحد الأدنى */
export function resolveUnderMinimum(id: string, action: "merge" | "postpone" | "exceptional_run"): void {
  const list = loadAdminCohorts();
  const c = list.find((x) => x.id === id);
  if (!c) return;
  if (action === "merge") c.status = "cancelled";
  else if (action === "postpone") c.status = "postponed";
  else c.status = "open";
  saveAdminCohorts(list);
}

/* ─────────── الحالات الاستثنائية — 16.3 ─────────── */
export type ExceptionKind = "refund" | "appeal" | "pause" | "dispute";
export interface ExceptionCase {
  id: string; kind: ExceptionKind; studentName: string; pathwayName: string;
  detail: string; amount?: number; at: string; status: "pending" | "approved" | "rejected";
}
const EK = "wajeez_admin_exceptions";

function seedExceptions(): ExceptionCase[] {
  return [
    { id: "EX-1", kind: "refund", studentName: "تركي الشمري", pathwayName: "تأسيس مشروع من الفكرة إلى أول بيع", detail: "طلب استرداد خلال فترة السماح — لم يبدأ أي درس", amount: 600, at: d(-1), status: "pending" },
    { id: "EX-2", kind: "appeal", studentName: "فيصل الدوسري", pathwayName: "قيادة الفرق للمدراء الجدد", detail: "اعتراض على نتيجة مشروع التخرج — يطلب مقيما ثانيا", at: d(-2), status: "pending" },
    { id: "EX-3", kind: "pause", studentName: "ريم العتيبي", pathwayName: "الطالب الجامعي إلى أول فرصة", detail: "طلب إيقاف معتمد لظرف صحي — مستند مرفق", at: d(-3), status: "pending" },
    { id: "EX-4", kind: "dispute", studentName: "شركة لوجستية (B2B)", pathwayName: "دفعة قيادات مخصصة", detail: "خلاف على عدد مقاعد الفاتورة الثانية — يحتاج مراجعة العقد", amount: 4200, at: d(-4), status: "pending" },
  ];
}
export function loadExceptions(): ExceptionCase[] {
  try {
    const raw = localStorage.getItem(EK);
    if (raw) return JSON.parse(raw) as ExceptionCase[];
  } catch { /* ignore */ }
  const seeded = seedExceptions();
  localStorage.setItem(EK, JSON.stringify(seeded));
  return seeded;
}
export function resolveException(id: string, status: "approved" | "rejected"): void {
  const list = loadExceptions().map((e) => (e.id === id ? { ...e, status } : e));
  localStorage.setItem(EK, JSON.stringify(list));
}
export const EXCEPTION_KIND_LABEL: Record<ExceptionKind, string> = {
  refund: "طلب استرداد", appeal: "اعتراض على تقييم", pause: "طلب إيقاف معتمد", dispute: "خلاف مالي/عقدي",
};

/* ─────────── سير مراجعة المحتوى الأكاديمي — 16.2 ─────────── */
export type ContentStage = "draft" | "academic_review" | "qa" | "published" | "retired";
export interface ContentItem {
  id: string; title: string; version: string; owner: string;
  stage: ContentStage; skillsCount: number; updatedAt: string;
}
const CONTENT_KEY = "wajeez_admin_content";

function seedContent(): ContentItem[] {
  const stages: ContentStage[] = ["published", "qa", "academic_review", "draft", "published", "retired"];
  return pathways.slice(0, 6).map((p, i) => {
    const cid = (pathwayCourses[p.id] ?? [])[0];
    const c = cid ? courseById(cid) : null;
    return {
      id: `CT-${i}`, title: c?.name ?? p.name, version: `v${1 + (i % 3)}.${i % 2}`,
      owner: ["أ. ريم القحطاني", "د. فيصل العتيبي", "م. سلطان الدوسري"][i % 3],
      stage: stages[i], skillsCount: 3 + (i % 4), updatedAt: d(-(i * 6 + 2)),
    };
  });
}
export function loadContent(): ContentItem[] {
  try {
    const raw = localStorage.getItem(CONTENT_KEY);
    if (raw) return JSON.parse(raw) as ContentItem[];
  } catch { /* ignore */ }
  const seeded = seedContent();
  localStorage.setItem(CONTENT_KEY, JSON.stringify(seeded));
  return seeded;
}
export function advanceContent(id: string): void {
  const order: ContentStage[] = ["draft", "academic_review", "qa", "published", "retired"];
  const list = loadContent().map((c) => {
    if (c.id !== id) return c;
    const idx = order.indexOf(c.stage);
    return { ...c, stage: order[Math.min(order.length - 1, idx + 1)] };
  });
  localStorage.setItem(CONTENT_KEY, JSON.stringify(list));
}
export const CONTENT_STAGE_LABEL: Record<ContentStage, string> = {
  draft: "مسودة", academic_review: "مراجعة أكاديمية", qa: "ضمان الجودة", published: "منشور", retired: "مؤرشف",
};

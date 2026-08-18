/* بيانات تجريبية لأقسام الإدارة الخمسة (مستخدمون، تقارير، دعم، مالية، إشعارات) —
   تعكس قدرات الخادم المبنية فعلا (server/http/routes) وتُعرض موسومة كنموذج.
   التخزين محلي (localStorage) حتى يُربط كل قسم بمساراته الحقيقية. */

const KEY = "wajeez_admin_extras_v1";

/* ═══ المستخدمون والأدوار ═══ */

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "مدير النظام",
  academic_manager: "مدير أكاديمي",
  diagnostic_manager: "مدير التشخيص",
  operations_manager: "مدير العمليات",
  advisor: "مستشار",
  trainer: "مدرب",
  finance: "مالية",
  support: "دعم",
  learner: "متعلم",
};

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  status: "active" | "suspended";
  joinedAt: string;
}

/* ═══ التقارير ═══ */

export interface ReportDef {
  id: string;
  title: string;
  method: string; // طريقة حساب المؤشر — كما يعرضها فهرس التقارير في الخادم
  columns: string[];
  rows: string[][];
}

/* ═══ الدعم ═══ */

export type TicketStatus = "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "مفتوحة",
  in_progress: "قيد المعالجة",
  waiting_customer: "بانتظار العميل",
  resolved: "محلولة",
  closed: "مغلقة",
};
export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "منخفضة",
  normal: "عادية",
  high: "عالية",
  urgent: "عاجلة",
};

/* خريطة التحولات المشروعة — مطابقة لما يفرضه الخادم */
export const TICKET_FLOW: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "closed"],
  in_progress: ["waiting_customer", "resolved"],
  waiting_customer: ["in_progress", "resolved"],
  resolved: ["closed", "in_progress"],
  closed: [],
};

export interface TicketMessage {
  from: "customer" | "agent";
  internal: boolean; // الرسائل الداخلية مخفية عن العميل — كما في الخادم
  text: string;
  at: string;
}

export interface Ticket {
  id: string;
  subject: string;
  customer: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: string | null;
  openedAt: string;
  messages: TicketMessage[];
}

/* ═══ المالية والتجارة ═══ */

export interface EnrollmentRequest {
  id: string;
  student: string;
  cohort: string;
  amount: number;
  at: string;
  status: "pending" | "approved" | "rejected";
}

export interface Invoice {
  id: string;
  student: string;
  item: string;
  amount: number;
  paid: number;
  status: "open" | "paid" | "refunded";
}

export interface RefundRequest {
  id: string;
  student: string;
  amount: number;
  reason: string;
  status: "pending" | "executed" | "rejected";
}

export interface Coupon {
  code: string;
  percent: number;
  active: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: "شهري" | "سنوي";
  active: boolean;
}

/* ═══ الإشعارات ═══ */

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: "بريد" | "داخلي";
  body: string; // بمتغيرات {{key}} — كما في الخادم
  updatedAt: string;
}

export interface NotificationLogEntry {
  id: string;
  template: string;
  to: string;
  status: "sent" | "failed" | "queued";
  attempts: number; // حد إعادة المحاولة ثلاث — كما في الخادم
  at: string;
}

/* ═══ المخزن ═══ */

interface AdminExtrasState {
  users: AdminUser[];
  tickets: Ticket[];
  enrollmentRequests: EnrollmentRequest[];
  invoices: Invoice[];
  refunds: RefundRequest[];
  coupons: Coupon[];
  plans: SubscriptionPlan[];
  templates: NotificationTemplate[];
  notificationLog: NotificationLogEntry[];
}

const SEED: AdminExtrasState = {
  users: [
    { id: "u1", name: "مدير النظام — حساب ديمو", email: "superadmin.demo@wajeez.local", roles: ["super_admin"], status: "active", joinedAt: "2026-08-15" },
    { id: "u2", name: "مدير أكاديمي — حساب ديمو", email: "admin.demo@wajeez.local", roles: ["academic_manager"], status: "active", joinedAt: "2026-08-15" },
    { id: "u3", name: "أستاذ رامي — مدرب ديمو", email: "trainer.demo@wajeez.local", roles: ["trainer"], status: "active", joinedAt: "2026-08-15" },
    { id: "u4", name: "أستاذ سامر — مستشار ديمو", email: "consultant.demo@wajeez.local", roles: ["advisor"], status: "active", joinedAt: "2026-08-15" },
    { id: "u5", name: "ليان الحوراني — حساب ديمو", email: "student.demo@wajeez.local", roles: ["learner"], status: "active", joinedAt: "2026-08-15" },
    { id: "u6", name: "مستخدم تجريبي", email: "test.user@wajeez.local", roles: ["learner"], status: "suspended", joinedAt: "2026-08-18" },
  ],
  tickets: [
    {
      id: "T-1042", subject: "لا يظهر تسجيل الجلسة الثالثة", customer: "ليان الحوراني — حساب ديمو",
      status: "open", priority: "high", assignee: null, openedAt: "2026-08-18 09:12",
      messages: [{ from: "customer", internal: false, text: "أكملت الجلسة الثالثة لكن التسجيل لا يظهر في مكتبتي.", at: "2026-08-18 09:12" }],
    },
    {
      id: "T-1041", subject: "خطأ في قيمة الفاتورة بعد الكوبون", customer: "مستخدم تجريبي",
      status: "in_progress", priority: "urgent", assignee: "وكيل الدعم — ديمو", openedAt: "2026-08-17 16:40",
      messages: [
        { from: "customer", internal: false, text: "طبقت كوبون خصم 20% والفاتورة لم تتغير.", at: "2026-08-17 16:40" },
        { from: "agent", internal: true, text: "ملاحظة داخلية: نراجع سجل الكوبونات قبل الرد.", at: "2026-08-17 17:05" },
      ],
    },
    {
      id: "T-1037", subject: "طلب تغيير موعد الشعبة المسائية", customer: "ليان الحوراني — حساب ديمو",
      status: "resolved", priority: "normal", assignee: "وكيل الدعم — ديمو", openedAt: "2026-08-15 11:02",
      messages: [
        { from: "customer", internal: false, text: "هل يمكن نقل تسجيلي للشعبة الصباحية؟", at: "2026-08-15 11:02" },
        { from: "agent", internal: false, text: "تم نقلك للشعبة الصباحية — ستصلك رسالة تأكيد.", at: "2026-08-15 13:44" },
      ],
    },
  ],
  enrollmentRequests: [
    { id: "ER-301", student: "ليان الحوراني — حساب ديمو", cohort: "تحليل الأعمال — الشعبة المسائية", amount: 1450, at: "2026-08-18", status: "pending" },
    { id: "ER-300", student: "مستخدم تجريبي", cohort: "أساسيات البيانات — الشعبة الصباحية", amount: 980, at: "2026-08-17", status: "pending" },
  ],
  invoices: [
    { id: "INV-880", student: "ليان الحوراني — حساب ديمو", item: "مسار تحليل الأعمال", amount: 1450, paid: 1450, status: "paid" },
    { id: "INV-881", student: "مستخدم تجريبي", item: "أساسيات البيانات", amount: 980, paid: 0, status: "open" },
    { id: "INV-879", student: "متعلم ديمو سابق", item: "مسار التسويق الرقمي", amount: 1200, paid: 1200, status: "refunded" },
  ],
  refunds: [
    { id: "RF-12", student: "متعلم ديمو سابق", amount: 1200, reason: "ظرف طارئ موثق — خلال نافذة الاسترداد", status: "pending" },
  ],
  coupons: [
    { code: "WELCOME20", percent: 20, active: true },
    { code: "RAMADAN15", percent: 15, active: false },
  ],
  plans: [
    { id: "P1", name: "اشتراك المتعلم الشهري", price: 149, interval: "شهري", active: true },
    { id: "P2", name: "اشتراك المتعلم السنوي", price: 1490, interval: "سنوي", active: true },
  ],
  templates: [
    { id: "NT-1", name: "تأكيد التسجيل في شعبة", channel: "بريد", body: "مرحبا {{name}}، تأكد تسجيلك في {{cohort}} — أول جلسة {{first_session}}.", updatedAt: "2026-08-16" },
    { id: "NT-2", name: "تذكير بتسليم الواجب", channel: "داخلي", body: "لديك واجب مستحق في {{course}} بعد {{days}} أيام.", updatedAt: "2026-08-16" },
    { id: "NT-3", name: "صدور الشهادة", channel: "بريد", body: "مبارك {{name}}! شهادتك في {{pathway}} صدرت برقم تحقق {{verify_code}}.", updatedAt: "2026-08-17" },
  ],
  notificationLog: [
    { id: "L-91", template: "تأكيد التسجيل في شعبة", to: "student.demo@wajeez.local", status: "sent", attempts: 1, at: "2026-08-18 08:30" },
    { id: "L-92", template: "تذكير بتسليم الواجب", to: "student.demo@wajeez.local", status: "failed", attempts: 2, at: "2026-08-18 09:05" },
    { id: "L-93", template: "صدور الشهادة", to: "test.user@wajeez.local", status: "queued", attempts: 0, at: "2026-08-18 09:20" },
  ],
};

export const REPORTS: ReportDef[] = [
  {
    id: "cohort-completion",
    title: "إكمال الشعب",
    method: "عدد المكملين ÷ المسجلين الفعليين لكل شعبة منتهية — المنسحب قبل أول جلسة لا يدخل في المقام.",
    columns: ["الشعبة", "مسجلون", "مكملون", "نسبة الإكمال"],
    rows: [
      ["تحليل الأعمال — مسائية", "24", "19", "79%"],
      ["أساسيات البيانات — صباحية", "30", "26", "87%"],
      ["التسويق الرقمي — مسائية", "18", "12", "67%"],
    ],
  },
  {
    id: "revenue",
    title: "الإيرادات والتحصيل",
    method: "مجموع الدفعات الناجحة ناقص الاستردادات المنفذة — الدفعة اليدوية تُحتسب بعد التوثيق فقط.",
    columns: ["الشهر", "فواتير", "محصّل", "مسترد", "صافي"],
    rows: [
      ["2026-06", "31", "38,200$", "1,200$", "37,000$"],
      ["2026-07", "42", "51,750$", "0$", "51,750$"],
      ["2026-08", "27", "33,400$", "800$", "32,600$"],
    ],
  },
  {
    id: "trainer-performance",
    title: "أداء المدربين",
    method: "متوسط درجات الروبرك المعتمدة وسرعة المراجعة — التسليمات المُعاد طلبها تُخصم من مؤشر الجودة.",
    columns: ["المدرب", "شعب نشطة", "متوسط الروبرك", "متوسط زمن المراجعة"],
    rows: [
      ["أستاذ رامي — مدرب ديمو", "2", "4.6 / 5", "26 ساعة"],
      ["مدرب ديمو ثان", "1", "4.2 / 5", "41 ساعة"],
    ],
  },
  {
    id: "diagnostic-funnel",
    title: "قمع التشخيص إلى التسجيل",
    method: "من بدأ التشخيص ← أكمله ← فتح مسارا ← قدّم طلب تسجيل ← دفع — كل مرحلة بجلسة فريدة.",
    columns: ["المرحلة", "العدد", "النسبة من السابقة"],
    rows: [
      ["بدأ التشخيص", "1,240", "—"],
      ["أكمل التشخيص", "860", "69%"],
      ["فتح مسارا", "640", "74%"],
      ["قدّم طلب تسجيل", "210", "33%"],
      ["دفع", "96", "46%"],
    ],
  },
];

function load(): AdminExtrasState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AdminExtrasState;
  } catch { /* تالف — يعاد البذر */ }
  localStorage.setItem(KEY, JSON.stringify(SEED));
  return structuredClone(SEED);
}

function save(state: AdminExtrasState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

/* ── قراءات ── */
export const loadUsers = () => load().users;
export const loadTickets = () => load().tickets;
export const loadEnrollmentRequests = () => load().enrollmentRequests;
export const loadInvoices = () => load().invoices;
export const loadRefunds = () => load().refunds;
export const loadCoupons = () => load().coupons;
export const loadPlans = () => load().plans;
export const loadTemplates = () => load().templates;
export const loadNotificationLog = () => load().notificationLog;

/* ── كتابات ── */
export function updateUser(id: string, patch: Partial<AdminUser>): void {
  const s = load();
  s.users = s.users.map((u) => (u.id === id ? { ...u, ...patch } : u));
  save(s);
}

export function updateTicket(id: string, patch: Partial<Ticket>): void {
  const s = load();
  s.tickets = s.tickets.map((t) => (t.id === id ? { ...t, ...patch } : t));
  save(s);
}

export function addTicketMessage(id: string, msg: TicketMessage): void {
  const s = load();
  const t = s.tickets.find((x) => x.id === id);
  if (t) t.messages.push(msg);
  save(s);
}

export function updateEnrollmentRequest(id: string, status: EnrollmentRequest["status"]): void {
  const s = load();
  s.enrollmentRequests = s.enrollmentRequests.map((r) => (r.id === id ? { ...r, status } : r));
  save(s);
}

export function updateRefund(id: string, status: RefundRequest["status"]): void {
  const s = load();
  s.refunds = s.refunds.map((r) => (r.id === id ? { ...r, status } : r));
  if (status === "executed") {
    const rf = s.refunds.find((r) => r.id === id);
    const inv = s.invoices.find((i) => i.status === "paid" && i.amount === rf?.amount);
    if (inv) inv.status = "refunded"; // تنفيذ الاسترداد يحدّث الدفعة والطلب — كما في الخادم
  }
  save(s);
}

export function addCoupon(coupon: Coupon): void {
  const s = load();
  s.coupons.unshift(coupon);
  save(s);
}

export function addPlan(plan: SubscriptionPlan): void {
  const s = load();
  s.plans.unshift(plan);
  save(s);
}

export function upsertTemplate(tpl: NotificationTemplate): void {
  const s = load();
  const i = s.templates.findIndex((t) => t.id === tpl.id);
  if (i >= 0) s.templates[i] = tpl; else s.templates.unshift(tpl);
  save(s);
}

export function retryNotification(id: string): boolean {
  const s = load();
  const entry = s.notificationLog.find((e) => e.id === id);
  if (!entry || entry.status !== "failed" || entry.attempts >= 3) return false; // حد ثلاث محاولات — كما في الخادم
  entry.attempts += 1;
  entry.status = "sent";
  save(s);
  return true;
}

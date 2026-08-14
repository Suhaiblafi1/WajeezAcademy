/**
 * طلبات انضمام المدربين — Trainer Applications Store
 * -------------------------------------------------------
 * الآن: تُحفظ محليا (localStorage) ويعرضها الأدمن في بوابته.
 * عند النقل إلى Replit: يُرسل النموذج إلى نقطة الاستقبال الرسمية
 * (TRAINER_FORM_ENDPOINT) وتُدار الحالات من قاعدة البيانات —
 * الأنواع والحالات لن تتغير.
 */

/* نقطة الاستقبال الرسمية لطلبات المدربين — تُفعَّل عند الربط الحقيقي */
export const TRAINER_FORM_ENDPOINT = "https://wajeez-academy.web.app";

export type ApplicationStatus = "new" | "interview" | "accepted" | "rejected";

export interface TrainerApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  domain: string;      // المجال الرئيسي
  years: string;       // سنوات الخبرة
  role: string;        // الدور الحالي
  links: string;       // لينكدإن / أعمال
  topics: string;      // المواضيع التي يحب تدريبها
  why: string;         // لماذا يريد الانضمام
  status: ApplicationStatus;
  createdAt: number;
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "جديد",
  interview: "مقابلة مجدولة",
  accepted: "مقبول — انضم",
  rejected: "مرفوض بلطف",
};

/* ترتيب سير العملية: جديد ← مقابلة ← قرار */
export const STATUS_FLOW: ApplicationStatus[] = ["new", "interview", "accepted", "rejected"];

const KEY = "wajeez_trainer_applications";

export function loadApplications(): TrainerApplication[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TrainerApplication[]) : [];
  } catch {
    return [];
  }
}

export function saveApplication(
  data: Omit<TrainerApplication, "id" | "status" | "createdAt">
): TrainerApplication {
  const app: TrainerApplication = {
    ...data,
    id: `tr-${Date.now().toString(36)}`,
    status: "new",
    createdAt: Date.now(),
  };
  const all = [app, ...loadApplications()];
  localStorage.setItem(KEY, JSON.stringify(all));
  return app;
}

export function updateApplicationStatus(id: string, status: ApplicationStatus): void {
  const all = loadApplications().map((a) => (a.id === id ? { ...a, status } : a));
  localStorage.setItem(KEY, JSON.stringify(all));
}

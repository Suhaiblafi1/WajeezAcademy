/**
 * طلبات انضمام المدربين — Trainer Applications Store
 * -------------------------------------------------------
 * الآن (نسخة تجريبية): تُحفظ محليا (localStorage) على جهاز المستخدم فقط
 * ويعرضها نموذج بوابة الإدارة التجريبي. لا يصل أي طلب إلى الإدارة آليا —
 * القناة الحقيقية اليوم هي واتساب الفريق.
 *
 * عند بناء المنصة: أول مسار إنتاجي كامل سيكون استقبال «الطلب الأولي»
 * (TrainerApplicationInitial) في قاعدة البيانات، ثم فتح «الاستكمال المهني»
 * (TrainerProfessionalProfile) بعد قرار الإدارة — العقود في trainer-contracts.ts
 * هي الواجهة الثابتة التي لن تتغير.
 *
 * لا يوجد أي endpoint إنتاجي الآن — ولا يُستخدم رابط الموقع التجريبي القديم
 * (wajeez-academy.web.app) كأنه واجهة استقبال.
 */

import type { TrainingSpecialization } from "./trainer-contracts";

export type ApplicationStatus = "new" | "interview" | "accepted" | "rejected";

/* نموذج التخزين المحلي — مطابق للمرحلة الأولى من العقود */
export interface TrainerApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: TrainingSpecialization | string; // التخصص التدريبي الحقيقي
  domain_years: string;      // سنوات خبرة المجال
  training_experience: string; // خبرة التدريب — منفصلة عن خبرة المجال
  role: string;              // الدور الحالي
  links: string;             // لينكدإن / أعمال
  topics: string;            // المواضيع التي يحب تدريبها
  why: string;               // لماذا يريد الانضمام
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

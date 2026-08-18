/**
 * سيرتي الذاتية — محاكاة مسارات cv في operations.routes.ts
 * ------------------------------------------------------------
 * تطابق سلوك الخادم:
 *  - POST /api/learner/cv: رفع بموافقة صريحة إلزامية + تحقق نوع وحجم + رابط رفع موقع.
 *  - GET  /api/learner/cv: سيري الفعالة فقط.
 *  - POST /api/cv/:id/delete: حذف وفق السياسة — سبب موثق (5+ أحرف) وحذف منطقي لا فيزيائي.
 * المستشار المسند يرى السيرة برابط قراءة موقع وتُسجل كل مشاهدة (يظهر في بوابة المستشار).
 */

export interface CvFile {
  id: string;
  originalName: string;
  mime: string;
  sizeKb: number;
  uploadedAt: string;
  status: "active" | "deleted";
  deletedAt?: string;
  deleteReason?: string;
}

const KEY = "wajeez_learner_cvs";
const MAX_SIZE_KB = 10 * 1024; // 10MB — حد السيرة
const ALLOWED: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
};

export const CV_ACCEPT = Object.keys(ALLOWED).join(",");
export const CV_MAX_LABEL = "10MB";

export function mimeOk(mime: string): boolean {
  return mime in ALLOWED;
}

function isoNow(): string {
  return new Date().toISOString().slice(0, 16);
}

function loadAll(): CvFile[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as CvFile[];
  } catch { /* ignore */ }
  const seeded: CvFile[] = [
    {
      id: "cv-seed-1",
      originalName: "سيرتي-الذاتية-2026.pdf",
      mime: "application/pdf",
      sizeKb: 212,
      uploadedAt: isoNow(),
      status: "active",
    },
  ];
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

function saveAll(cvs: CvFile[]) {
  localStorage.setItem(KEY, JSON.stringify(cvs));
}

/** سيري الفعالة فقط — كما في GET /api/learner/cv */
export function listMyCvs(): CvFile[] {
  return loadAll().filter((c) => c.status === "active");
}

/** رفع سيرة — الموافقة الصريحة إلزامية، وتحقق النوع والحجم قبل القبول */
export function uploadCv(input: { originalName: string; mime: string; sizeKb: number; consent: boolean }): { ok: true; cv: CvFile } | { ok: false; error: string } {
  if (!input.consent) return { ok: false, error: "الموافقة الصريحة إلزامية — لن تُرفع السيرة دونها" };
  if (!input.originalName.trim()) return { ok: false, error: "اسم الملف فارغ" };
  if (!mimeOk(input.mime)) return { ok: false, error: "صيغة غير مدعومة — PDF أو Word فقط" };
  if (input.sizeKb <= 0 || input.sizeKb > MAX_SIZE_KB) return { ok: false, error: `الحجم يتجاوز ${CV_MAX_LABEL}` };
  const cv: CvFile = {
    id: `cv-${Date.now().toString(36)}`,
    originalName: input.originalName.trim(),
    mime: input.mime,
    sizeKb: input.sizeKb,
    uploadedAt: isoNow(),
    status: "active",
  };
  saveAll([cv, ...loadAll()]);
  return { ok: true, cv };
}

/** حذف وفق السياسة — سبب موثق وحذف منطقي، لا إزالة فيزيائية */
export function deleteCv(id: string, reason: string): { ok: true } | { ok: false; error: string } {
  if (reason.trim().length < 5) return { ok: false, error: "اكتب سببا مفهوما (5 أحرف على الأقل) — يُوثق في السجل" };
  const all = loadAll().map((c) =>
    c.id === id ? { ...c, status: "deleted" as const, deletedAt: isoNow(), deleteReason: reason.trim() } : c);
  saveAll(all);
  return { ok: true };
}

export function cvKindLabel(mime: string): string {
  return ALLOWED[mime] ?? "ملف";
}

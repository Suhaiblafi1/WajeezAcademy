/* قدراتُ المنصّة كما يقولها الخادم — تُقرأ مرّةً واحدةً في عمر الصفحة.

   لماذا من الخادم لا من ثابتٍ في الواجهة: قدرةُ الرفع تعتمد على وجود مخزنٍ
   للملفّات، وهو شرطُ بيئةٍ لا شرطُ بناء. فلو كتبناها في الواجهة لاحتجنا نشرَ
   واجهةٍ جديدةٍ يومَ يجهز المخزن — والصحيحُ أن يُشعله متغيّرٌ في الخادم
   فتتبعه الواجهةُ بلا نشر. */

import { apiGet } from "./api";

export interface PlatformConfig {
  /** هل يستطيع الخادمُ تخزينَ بايتات الملفّات المرفوعة؟ */
  fileUploads: boolean;
  /** بيئةُ عرضٍ بحساباتِ ديمو — تُقال تلميحاتُها للمستخدم، ولا تُقال في الإنتاج */
  demoMode: boolean;
}

/* الافتراضُ عند تعذُّر السؤال: «لا» — فلا نعرض زرّا قد لا يعمل. */
const FALLBACK: PlatformConfig = { fileUploads: false, demoMode: false };

let cached: Promise<PlatformConfig> | null = null;
let snapshot: PlatformConfig | null = null;

export function loadPlatformConfig(): Promise<PlatformConfig> {
  cached ??= apiGet<PlatformConfig>("/api/config")
    .catch(() => FALLBACK)
    .then((c) => { snapshot = c; return c });
  return cached;
}

/** آخرُ جوابٍ وصل، أو `null` قبل وصوله — لمن يحتاجه في لحظةٍ لا تنتظر */
export function platformConfigSnapshot(): PlatformConfig | null {
  return snapshot;
}

/** للاختبارات وحدَها — تُنسي النسخةَ المحفوظة */
export function resetPlatformConfigCache(): void {
  cached = null;
  snapshot = null;
}

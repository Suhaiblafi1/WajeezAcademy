/* تهيئة عامة لاختبارات الخادم — نسخة PostgreSQL واحدة للتشغيل كله.

   لماذا: vitest يشغّل كل ملف اختبار في عملية عاملة مستقلة، حتى مع
   --no-file-parallelism. وكانت كل عملية تحاول تشغيل PostgreSQL المدمج بنفسها
   على المنفذ والمجلد نفسيهما: الأولى تنجح، والبقية إما تتصل بنسخة الأولى وهي
   في طور الإغلاق — فتسقط بـ«the database system is shutting down» قبل أن يجري
   اختبار واحد — أو تنتظر نسخةً لن تعمل لأن المنفذ مأخوذ.

   الحل ليس مهلة أطول: مالك دورة الحياة يجب أن يكون واحدا. globalSetup يعمل مرة
   في العملية الأم قبل أي عامل وبعد آخرهم، فيشغّلها هنا ويطفئها هنا، وتبقى
   العوامل متصلةً فقط. */

import { ensureEmbeddedPostgres, stopEmbeddedPostgres } from '../../db/embedded'

export async function setup(): Promise<void> {
  await ensureEmbeddedPostgres()
}

export async function teardown(): Promise<void> {
  await stopEmbeddedPostgres()
}

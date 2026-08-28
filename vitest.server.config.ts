/* إعداد اختبارات الخادم — يفترق عن إعداد الواجهة في شيء واحد: مالك دورة حياة
   قاعدة الاختبار.

   الأساس (vite.config.ts) يخدم اختبارات الواجهة أيضا، وتلك لا قاعدة لها؛ فوضعُ
   globalSetup هناك يشغّل PostgreSQL لـ٥٤٣ اختبار واجهة لا تحتاجه. وهنا يعمل
   مرة واحدة في العملية الأم قبل أول عامل وبعد آخرهم — انظر التعليل الكامل في
   server/tests/helpers/global-setup.ts. */

import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vite.config'

export default mergeConfig(
  base,
  defineConfig({
    test: {
      globalSetup: ['./server/tests/helpers/global-setup.ts'],
      /* التوازي بين الملفات ممنوع: كل ملف يعيد بناء قاعدة الاختبار من الصفر */
      fileParallelism: false,
    },
  }),
)

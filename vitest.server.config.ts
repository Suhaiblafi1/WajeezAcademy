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
      /* رفعُ الملفّات مطفأٌ افتراضيّا في المنصّة (storage.service.ts) لأنّ
         بايتاتَ ما عدا وثائقِ طلب الانضمام لا مكانَ لها بعد. واختباراتُ العقد
         هنا تفحص التوقيعَ والصلاحيّةَ لا التخزين، فتعمل والمفتاحُ مشتعل؛
         وحالةُ الإطفاء لها اختبارُها الخاصّ في uploads-gate.test.ts. */
      env: { FILE_UPLOADS: 'on' },
      /* التوازي بين الملفات ممنوع: كل ملف يعيد بناء قاعدة الاختبار من الصفر */
      fileParallelism: false,
    },
  }),
)

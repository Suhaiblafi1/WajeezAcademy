import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import './styles/light.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

/* تسجيلُ عاملِ الخدمة — انقطاعُ الاتصال يفتح الموقعَ من المحفوظ لا شاشةَ خطأ.

   السببُ والتعليلُ كاملا في `public/sw.js`. وموضعُ التسجيل هنا لا في
   `index.html`: سياسةُ المحتوى تسمّي سكربتات الصفحة ببصماتها
   (`scripts/audit-csp.ts`)، فسطرٌ يُضاف هناك يُبطل البصمةَ ويُحجب سكربتَي
   المظهر وشبكةِ الأمان معا. وهنا في الحزمة لا بصمةَ تُمَسّ.

   وبعد `load` لا قبله: التسجيلُ ينافس أوّل رسمٍ إن سبقه.
   وفي الإنتاج وحده: `npm run dev` يخدّم من الذاكرة، وعاملُ خدمةٍ فوقه يربك
   التطوير بلا فائدة. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((err: unknown) => {
      /* الموقعُ يعمل كما كان — لكنّ السببَ يُعلَن.

         كان هذا المسارُ يبتلع الخطأ صامتا، فسُئل صاحبُ المنصّة: هل ظهر
         العاملُ في سفاري؟ فقال «لا شيء» — ولم يكن في يدنا ما يقول **لماذا**.
         وأسبابُ الرفض في سفاري ثلاثةٌ لا تُفرَّق إلّا بنصّها: تصفّحٌ خفيّ،
         أو «حظرُ كلّ ملفات تعريف الارتباط» (يمنع تسجيلَ العامل أصلا)، أو
         سياسةُ محتوى ترفض `worker-src`.

         فسطرٌ واحدٌ في وحدة التحكّم يحوّل «لا شيء» إلى جواب. */
      console.warn('[wajeez] تعذّر تسجيل عامل الخدمة:', err)
    })
  })
}

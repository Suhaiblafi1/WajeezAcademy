/* أسماءُ الدورات لا رموزُها في شاشات المدرّب (ح-١).

   شكوى ١٣ سبتمبر ٢٠٢٦: «أسماءُ الدورات بدل رموزها». وكانت بطاقةُ التأهيل
   تحمل الاثنين — الاسمَ عنوانا و`C-AUT-101` تحته — فيقرأ المدرّبُ رمزا لا
   يعنيه شيئا في شاشةٍ كلُّها له.

   ومُشيت الشاشاتُ بالمتصفّح قبل كتابة هذا الحارس، فتبيّن أنّ ثلاثةً من
   المواضع الأربعة التي ذكرها صاحبُ المنصّة نظيفةٌ أصلا (نموذجُ الانضمام،
   وملفُّ المدرّب في الإدارة، وإعداداتُ حسابه) — وأنّ الرمزَ يظهر في
   «مؤهّلاتي» وحدَها. فالإصلاحُ سطرٌ، والحارسُ هو ما يمنع عودتَه.

   **والفحصُ على موضع الظهور لا على ورود الكلمة:** `key={q.courseId}` مفتاحُ
   تصييرٍ لا يراه أحد، و`value={sel.courseId}` قيمةُ حقلٍ لا نصُّه. فتُنزع
   الإسناداتُ أوّلا ثمّ يُفحَص ما بقي — وهو وحدَه ما يقع تحت عين القارئ.

   وأمّا «المعرّف» في محرّر المحور فمستثنًى بقصد: معرّفُ المحور معروضٌ
   باسمه صراحةً لمؤلّفه ليذكره حين يسأل عن محورٍ بعينه — وهو ليس رمزَ دورةٍ
   حلَّ محلَّ اسمها. */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/** الملفُّ بلا تعليقاته وبلا إسنادات JSX — فما بقي نصٌّ يُقرأ */
function renderedText(p: string): string {
  return read(p)
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    /* `key={…}` و`value={…}` و`aria-label={…}` وأمثالُها إسنادٌ لا نصّ */
    .replace(/\b[a-zA-Z-]+=\{[^{}]*\}/g, '')
}

/* ═══ وقائمةٌ مكتوبةٌ بيدها تحرس ما فيها وحدَه ═══

   كانت أربعَ شاشاتٍ مسمّاةً — والبوّابةُ خضراءُ على ما سواها. فشاشةُ
   «دوراتي المقترحة» وُلدت بعدها وهي تطبع «دخلت الكتالوجَ **برمز**
   C-BIZ-101» للمدرّب، ولم يحمرّ شيء: لم تكن في القائمة.

   فصار المسحُ على **كلّ شاشات المدرّب** — من أضاف شاشةً ورث الحارسَ معها،
   ولا يحتاج أن يتذكّر تسجيلَها. */
function trainerScreens(): string[] {
  const dir = join(process.cwd(), 'src/pages/trainer')
  return readdirSync(dir)
    .filter((n) => n.endsWith('.tsx'))
    .map((n) => `src/pages/trainer/${n}`)
}
const TRAINER_SCREENS = trainerScreens()

describe('رمزُ الدورة لا يُعرض للمدرّب', () => {
  it('المسحُ يجد شاشاتِ المدرّب — وإلّا كان يخضرّ على فراغ', () => {
    expect(TRAINER_SCREENS.length, 'لم تُقرأ شاشةٌ واحدة').toBeGreaterThan(8)
  })

  for (const f of TRAINER_SCREENS) {
    it(`⚠️ ${f.split('/').pop()} لا تُصيّر \`courseId\` نصّا`, () => {
      /* ═══ والرمزُ يُكتب بإملاءَين ═══

         كان الفحصُ على `.courseId}` وحدَها. و«دوراتي المقترحة» تطبعه
         `{p.course.id}` — **الشيءُ نفسُه بمسارِ خاصّيّةٍ آخر** — فمرّت
         وهي تعرض «دخلت الكتالوجَ برمز C-BIZ-101» للمدرّب.

         فوُسّع على الإملاءَين: `courseId` و`course.id` (ومعها `course?.id`). */
      const hit = renderedText(f).split('\n')
        .find((l) => /\.courseId\s*\}/.test(l) || /\.course\??\.id\s*[}`]/.test(l))
      expect(hit ?? null, `رمزُ الدورة يُقرأ في سطر: ${hit?.trim().slice(0, 90)}`).toBeNull()
    })
  }

  it('⚠️ وحين لا اسمَ في الكتالوج لا يُطبع الرمزُ بديلا عنه', () => {
    /* `{q.title || q.courseId}` كان يضع الرمزَ في موضع الاسم بعينه —
       وهو العطبُ نفسُه من بابٍ آخر، لا احتياطٌ منه. */
    const q = renderedText('src/pages/trainer/Qualifications.tsx')
    expect(q, 'الرمزُ يحلّ محلَّ الاسم حين يغيب').not.toMatch(/\|\|\s*q\.courseId/)
    expect(read('src/pages/trainer/Qualifications.tsx'), 'لا قولَ لغياب الاسم').toContain('دورةٌ بلا اسمٍ في الكتالوج')
  })

  it('وما بقي يفيد المدرّبَ: أيُّ نسخةٍ أُهِّل لها ومتى', () => {
    /* الحذفُ لا يجرّد البطاقةَ ممّا يحتاجه — وإلّا صار الإصلاحُ خسارة */
    const q = read('src/pages/trainer/Qualifications.tsx')
    expect(q).toMatch(/النسخة \{q\.currentVersion\}/)
    expect(q).toMatch(/fmtDate\(q\.qualifiedAt\)/)
  })
})

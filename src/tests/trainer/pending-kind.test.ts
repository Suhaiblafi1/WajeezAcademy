/* «طلبُ تأهيل» أم «دورةٌ يعدّها» — الشاشة (١٣ أكتوبر ٢٠٢٦).

   سأل صاحبُ المنصّة عن ٥٥ بطاقةً تحت «طلبات التأهيل المعلّقة» في «التأهيل
   والإسناد»، أكثرُها «من طلب الانضمام» وعليها «أهّله وأسنده». فاختار «افصلهما»:

   ① القاعدة: الفارقُ بنيةٌ (`requestedCohortId`) لا ملحوظة.
   ② الطابورُ يرسم الطلبات وحدَها، وعددُه عددُها.
   ③ والدوراتُ قيد الإعداد قائمةٌ وحدَها: حالُها، ورابطُ خطّتها، وزرٌّ يقول ما
      يقع به قبل أن يقع — ولا «ارفض» عليها.
   ④ وملفُّ المدرّب لا يعدّها «طلبات تأهيل».
   والخادمُ في `server/tests/trainer/pending-kind.test.ts`. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pendingKind, preparingCoursesAr } from '@/application/trainer/pending-kind'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const screen = code('src/pages/admin/TrainerRunOps.tsx')

/** ما بين علامتين في الشاشة — فيُفحص كلُّ قسمٍ وحدَه لا الملفُّ كلُّه */
const between = (from: string, to: string) => {
  const a = screen.indexOf(from)
  const b = screen.indexOf(to, a + from.length)
  expect(a, `لا «${from}» في الشاشة`).toBeGreaterThan(-1)
  expect(b, `لا «${to}» بعد «${from}»`).toBeGreaterThan(a)
  return screen.slice(a, b)
}

describe('① القاعدة', () => {
  it('⚠️ بشعبةٍ مطلوبةٍ طلب، وبلا شعبةٍ دورةٌ يعدّها', () => {
    expect(pendingKind({ requestedCohortId: 'c-1' })).toBe('request')
    expect(pendingKind({ requestedCohortId: null })).toBe('preparing')
  })

  it('وسطرُ الملفّ بعددٍ يُقرأ', () => {
    expect(preparingCoursesAr(1)).toBe('وله 1 دورة قيد الإعداد — تعتمد حين تعتمد خطّتها.')
    expect(preparingCoursesAr(3)).toMatch(/^وله 3 دورات قيد الإعداد/)
  })
})

describe('② الطابورُ للطلبات وحدَها', () => {
  it('⚠️ يُقسَم ما جاء من الخادم بنوعه', () => {
    expect(screen).toMatch(/const asks = useMemo\(\(\) => requests\.filter\(\(r\) => r\.kind !== "preparing"\), \[requests\]\);/)
    expect(screen).toMatch(/const preparing = useMemo\(\(\) => requests\.filter\(\(r\) => r\.kind === "preparing"\), \[requests\]\);/)
  })

  it('⚠️ والطابورُ يرسم الطلبات ويعدّها — لا ما جاء كلَّه', () => {
    const queue = between('طلبات التأهيل المعلّقة', '<section>')
    expect(queue).toContain('{asks.length}')
    expect(queue).toContain('asks.map((r) =>')
    expect(queue, 'الطابورُ يرسم الدوراتِ قيد الإعداد طلباتٍ').not.toContain('requests.map(')
  })
})

describe('③ والدوراتُ قيد الإعداد وحدَها', () => {
  const list = between('دورات قيد الإعداد', '<section>')

  it('⚠️ لكلٍّ حالُها ورابطُ خطّتها', () => {
    expect(list).toMatch(/PREP_AR\[r\.prep\?\.state \?\? "to_decide"\]/)
    expect(list).toMatch(/<Link to=\{`\/admin\/plans\/\$\{r\.prep\.cohortId\}`\}/)
  })

  it('⚠️ والزرُّ يفتح ما يقول ما يقع — ولا ينادي القرارَ مباشرة', () => {
    expect(list).toContain('onClick={() => setSkipPlan(r)}')
    expect(list, 'القرارُ يُنادى من القائمة بلا تأكيد').not.toContain('/decide')
    const dialog = screen.slice(screen.indexOf('{skipPlan && ('))
    expect(dialog).toMatch(/apiPost\(`\/api\/admin\/qualification-requests\/\$\{r\.id\}\/decide`, \{ approve: true, note: "اعتمدت دون انتظار الخطة" \}\)/)
    expect(dialog).toContain('دون أن تقرأ خطتها')
  })

  it('⚠️ ولا «ارفض» عليها — ولا «أهّله وأسنده»', () => {
    expect(list).not.toContain('ارفض')
    expect(list).not.toContain('أهّله وأسنده')
    expect(list).not.toContain('approve: false')
  })
})

describe('④ وملفُّ المدرّب لا يعدّها طلبات', () => {
  it('الشاشتان تقولان عددَها بسطرها', () => {
    for (const p of ['src/pages/admin/TrainerOps.tsx', 'src/pages/admin/TrainerApplications.tsx']) {
      expect(code(p), p).toMatch(/preparingCoursesAr\((app\.)?summary!?\.preparingCourses!\)/)
    }
  })
})

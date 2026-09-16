/* الإسنادُ يبدأ من المدرّب — بابٌ ثانٍ لا بديل (ج-١).

   ═══ الشكوى ═══

   «أجد صعوبةً بالبحث عن الدورات». والإسنادُ كان يبدأ من الشعبة وحدَها: من
   في ذهنه **مدرّبٌ** يريد أن يشغله لزمه أن يخمّن في أيّ شعبةٍ يصلح ويفتحها
   واحدةً واحدةً.

   ═══ وما يُحرَس ═══

   ① الشاشةُ تبدأ بالمدرّب، والخطوةُ الثانيةُ **لا تُعرض قبل اختياره**.
   ② وتُصفّى الشعبُ بمؤهّلاته — وهذا كلُّ معناها؛ فلو سردت كلَّ شعبةٍ لعادت
      الشكوى بشكلٍ آخر.
   ③ **وتقول لماذا القائمةُ قصيرة** — وهو ما يمنع السؤالَ «أين البقيّة؟».
   ④ والتأهيلُ في مكانه (قرارُ صاحب المنصّة ١٤ سبتمبر): من لا مؤهّلَ له
      يُؤهَّل من الشاشة نفسِها، فالغرضُ ألّا يغادر من يُسنِد ليبحث.
   ⑤ ولا مسارَ جديدٌ في الخادم: الحمولةُ قائمةٌ في مسارَين، وهذه تصل بينهما.
   ⑥ وبابُ الشعبة يبقى — هذه ثانيةٌ لا بديلة.

   والفحصُ **بنيويٌّ لا نصّيّ**: على الشرط الذي يحجب الخطوةَ الثانية، وعلى
   المجموعة التي تُصفّي بها، وعلى المسارات التي تُنادى. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const SCREEN = 'src/pages/admin/AssignByTrainer.tsx'

describe('ج-١ · الإسنادُ يبدأ من المدرّب', () => {
  const src = code(SCREEN)

  it('يبدأ بقائمة المدرّبين — بحثا لا قائمةً منسدلة', () => {
    /* قائمةٌ منسدلةٌ بكلّ المدرّبين تُعيد الشكوى: صعوبةُ العثور على السطر.
       و«طوابيرُ الفريق» يشترط `ListToolbar` على كلّ قائمةٍ تنمو. */
    expect(src, 'لا شريطَ بحثٍ وترقيم').toContain('<ListToolbar')
    expect(src, 'البحثُ لا يمرّ بالمطابقة العربيّة').toContain('matchesQuery')
    /* ويُبحَث بالدورة كما بالاسم: من يعرف الدورةَ ولا يعرف من يصلح لها */
    expect(src).toMatch(/matchesQuery\(q, \[t\.name, t\.email, \.\.\.t\.qualifications/)
  })

  it('والخطوةُ الثانيةُ لا تُعرض قبل اختيار المدرّب', () => {
    /* لو عُرضت معا لصارت شاشةً واحدةً مزدحمة، والترقيمُ زينة */
    expect(src, 'الخطوةُ الثانيةُ معروضةٌ دائما').toMatch(/\{picked && \(/)
    expect(src).toContain('① اختر المدرّب')
    expect(src).toContain('② ما يصلح له')
  })

  it('وتُصفّى الشعبُ بمؤهّلاته — وهو كلُّ معنى الشاشة', () => {
    /* الفحصُ على **التصفية** لا على ورودِ كلمة: شاشةٌ تسرد كلَّ الشعب
       تحت عنوانٍ يقول «ما يصلح له» أسوأُ من لا شاشة. */
    expect(src).toMatch(/new Set\(qualified\.map\(\(x\) => x\.courseId\)\)/)
    expect(src).toMatch(/codes\.has\(c\.courseId\)/)
    /* والمنتهيةُ لا يُسنَد إليها أحد */
    expect(src).toMatch(/OPEN_COHORT\.includes\(c\.status\)/)
  })

  it('وتقول لماذا القائمةُ قصيرة — فالقصرُ جوابٌ لا لغز', () => {
    const raw = readFileSync(join(root, SCREEN), 'utf8')
    expect(raw, 'لا يُقال للمُسنِد لماذا لا يرى بقيّةَ الشعب').toContain(
      'تظهر هنا الشعبُ المفتوحةُ على الدورات التي أُهِّل لها هذا المدرّبُ وحدَها',
    )
    /* والحالةُ الفارغةُ تقول ما تفعله لا تُترك بياضا */
    expect(raw).toContain('لا تأهيلَ قائما لهذا المدرّب')
  })

  it('والتأهيلُ في مكانه — لا مغادرةَ للبحث', () => {
    expect(src, 'لا بابَ تأهيلٍ في الشاشة').toMatch(/\/qualifications`/)
    /* ولا يُعرض إلّا ما له شعبةٌ مفتوحة: تأهيلٌ لا يُسنَد بعده شيءٌ عملٌ بلا أثر */
    expect(src).toMatch(/qualifiable/)
    expect(src).toMatch(/known\.has\(c\.courseId\)/)
  })

  it('والإسنادُ يُنادي المسارَ القائم — لا مسارَ جديدا لعرضٍ يقدر عليه ما هو قائم', () => {
    expect(src).toMatch(/\/api\/admin\/trainers\/\$\{picked\.profileId\}\/assignments/)
    expect(src).toContain('/api/admin/trainers/ops')
    expect(src).toContain('/api/admin/cohorts')
  })

  it('وبابُ الشعبة يبقى — وهذه ثانيةٌ لا بديلة', () => {
    const raw = readFileSync(join(root, SCREEN), 'utf8')
    expect(raw, 'لا إحالةَ إلى بابِ الشعبة').toContain('/admin/cohorts')
    /* والشاشةُ القديمةُ ما زالت تُسنِد */
    expect(code('src/pages/admin/CohortOps.tsx'), 'سقط إسنادُ الشعبة من صفحتها').toContain('مدرّب الشعبة')
  })

  it('وبابُها في القائمة محروسٌ بصلاحيّة الإسناد', () => {
    const layout = code('src/pages/admin/nav-map.ts')
    expect(layout).toMatch(/to: "\/admin\/assign-by-trainer"[^}]*need: "trainer\.assign"/)
    expect(code('src/App.tsx'), 'لا مسارَ للشاشة').toContain('/admin/assign-by-trainer')
  })
})

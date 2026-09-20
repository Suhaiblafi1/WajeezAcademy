/* صفُّ طابور الطلبات — أربعُ حقائقَ وقائمةُ أفعال.

   ═══ ما نُقض هنا (٢٠ سبتمبر ٢٠٢٦) ═══

   شكا صاحبُ المنصّة: «المعلومات كثيرة — أحتاج فقط الاسم والرقم والحالة،
   وأيضا نتيجة المقابلة التي صدرت من التقييم… زد عدد المتقدّمين في الصفحة
   الواحدة، وضع أيقونةَ أكشن ينسدل فيها: اعتمد، اطلب منه تحديد موعد
   للمقابلة، ذكّره أن يكمل التقديم إذا كان مسوّدة».

   وكان الصفُّ أربعةَ أسطر: تخصّصاتٌ وسنواتُ خبرةٍ ومسمّى، ثمّ عدُّ الوثائق
   والتقييمات والمقابلات، ثمّ عمرُ الانتظار — **وما يُقرَّر عليه ليس فيها**.

   ═══ وما يُحرس ═══

   ① **ما ذهب لا يعود** — أسطرُ العدّ والتخصّصات تُفتَّش في صفّ الطابور
      وحدَه: هي في الملفّ كما كانت، وعودتُها إلى الصفّ عودةُ الشكوى.
   ② **ونتيجةُ اللقاء تُقرأ من المعجم** — لا `passed` حرفا لاتينيّا في صفّ،
      ولا جدولَ أسماءٍ ثانٍ يُكتب في الشاشة.
   ③ **وقائمةُ الأفعال تتبع الحالة** — شرطُها من `DECISIONS` و`canRemind`
      أنفسِهما، فلا يُعرض فعلٌ يردّه الخادمُ بـ٤٠٩.
   ④ **والصفحةُ تسع خمسين** — والرقمُ يُقرأ من الشيفرة لا من ذاكرة قارئ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { INTERVIEW_OUTCOMES, outcomeLabelAr } from '@/application/trainer/interview-outcome'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const SCREEN = 'src/pages/admin/TrainerApplications.tsx'
/* بلا التعليقات: ذِكرُ ما حُذف في شرحٍ يقول ما كان ليس عودةً له */
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

/** صفُّ الطابور وحدَه — من `view.rows.map` إلى قائمة أفعاله */
const queueRow = (): string => {
  const src = code(SCREEN)
  const from = src.indexOf('view.rows.map')
  const to = src.indexOf('<RowActions')
  expect(from, 'صفُّ الطابور مفقود').toBeGreaterThan(-1)
  expect(to, 'قائمةُ أفعال الصفّ مفقودة — وهي حدُّه').toBeGreaterThan(from)
  return src.slice(from, to)
}

describe('① الصفُّ أربعُ حقائقَ لا أربعةُ أسطر', () => {
  it('يحمل الاسمَ والرقمَ والحالةَ ونتيجةَ اللقاء', () => {
    const row = queueRow()
    expect(row, 'الاسمُ غاب عن الصفّ').toContain('a.fullName')
    expect(row, 'الرقمُ المرجعيُّ غاب عن الصفّ').toContain('a.reference')
    expect(row, 'الحالةُ غابت عن الصفّ').toContain('STATUS_LABELS[a.status]')
    expect(row, 'نتيجةُ اللقاء غابت — وهي ما يُقرَّر عليه').toContain('a.interviewOutcome')
  })

  it('ولا يعود إليه ما شُكي منه: تخصّصاتٌ وخبرةٌ وعدُّ وثائقَ وتقييمات', () => {
    const row = queueRow()
    for (const [what, needle] of [
      ['التخصّصات', 'a.specialties'],
      ['سنواتُ المجال', 'a.domainYears'],
      ['المسمّى الوظيفيّ', 'a.jobTitle'],
      ['عدُّ الوثائق', 'a.documentsCount'],
      ['عدُّ التقييمات', 'a.reviewsCount'],
      ['عدُّ المقابلات', 'a.interviewsCount'],
      ['حالُ توثيق البريد', 'a.emailVerified'],
      ['إتمامُ القسم الثاني', 'a.phase2Done'],
      /* وشارةُ العمر آخرُ ما خرج: «احذفها نهائيّا من الصفّ» */
      ['شارةُ عمر الانتظار', 'queueAge('],
      ['ساعةُ شارة العمر', '<Clock'],
    ] as const) {
      expect(row, `${what}: عاد إلى الصفّ — وهو ما شُكي منه`).not.toContain(needle)
    }
  })

  it('وما ذهب من الصفّ باقٍ في الملفّ — لا يُحذف من المنصّة', () => {
    /* الحذفُ من الصفّ ترتيبٌ، ولو ذهبت من الشاشة كلِّها لصار نقصا */
    const screen = code(SCREEN)
    for (const needle of ['documents', 'specialties']) {
      expect(screen, `${needle}: ذهب من الملفّ أيضا`).toContain(needle)
    }
  })
})

describe('② نتيجةُ اللقاء من معجمها', () => {
  it('الشاشةُ تترجمها بالدالّة لا بجدولٍ تكتبه', () => {
    const screen = code(SCREEN)
    expect(screen, 'عُرضت النتيجةُ بلا ترجمة — فيقرأ الموظّفُ `passed`')
      .toContain('outcomeLabelAr(a.interviewOutcome)')
    /* ولا تُكتب الأسماءُ العربيّةُ هنا ثانيةً بجانب المعجم */
    for (const o of INTERVIEW_OUTCOMES) {
      expect(screen, `«${o.labelAr}» مكتوبٌ بيدِ الشاشة لا مقروءٌ من المعجم`)
        .not.toContain(`"${o.labelAr}"`)
    }
  })

  it('ولكلّ نتيجةٍ يقبلها الخادمُ نبرةٌ في الصفّ — ولا لونَ لمجهول', () => {
    const screen = code(SCREEN)
    const tones = /const OUTCOME_TONE: Record<string, string> = \{([\s\S]*?)\n\};/.exec(screen)?.[1] ?? ''
    expect(tones, 'جدولُ نبرات النتيجة مفقود').toBeTruthy()
    for (const o of INTERVIEW_OUTCOMES) {
      expect(tones, `النتيجةُ «${o.key}» بلا نبرةٍ في الصفّ`).toContain(`${o.key}:`)
    }
    /* والعنوانُ يُقرأ من المعجم فعلا — لا حرفا لاتينيّا */
    expect(outcomeLabelAr('passed')).toBe('ناجح')
    expect(outcomeLabelAr('failed')).toBe('غير مناسب')
  })
})

describe('③ قائمةُ الأفعال تتبع حالةَ الطلب', () => {
  const screen = code(SCREEN)

  it('شرطُها من `DECISIONS` و`canRemind` أنفسِهما لا من قائمةٍ ثانية', () => {
    expect(screen, 'شرطُ الأفعال مكتوبٌ بيدٍ — فيظهر فعلٌ يردّه الخادم')
      .toContain('DECISIONS.some((d) => d.action === action && d.from.includes(status))')
    expect(screen, 'التذكيرُ لا يقرأ مِحَكَّ الخادم').toMatch(/if \(canRemind\(a\)\)/)
  })

  it('وفيها الأفعالُ الأربعةُ التي طُلبت — كلٌّ بشرطه', () => {
    for (const [what, needle] of [
      ['الاعتماد', 'allows("approve", a.status)'],
      ['طلبُ تحديد الموعد', '/booking-reminder'],
      ['تذكيرُ المسوّدة', '/draft-reminder'],
      ['الرفض', 'allows("reject", a.status)'],
      ['التراجعُ عن الرفض', 'allows("undo_reject", a.status)'],
    ] as const) {
      expect(screen, `${what}: غاب عن قائمة أفعال الصفّ`).toContain(needle)
    }
    /* وتذكيرُ المسوّدة للمسوّدة وحدَها — والخادمُ يشترطها */
    expect(screen, 'تذكيرُ المسوّدة يُعرض لغير المسوّدة').toMatch(/a\.status === "draft"/)
  })

  it('والقائمةُ تُغلق بالمستمع والمفتاح — لا بستارةٍ تحبسها الترويسة', () => {
    const menu = /function RowActions\([\s\S]*?\n\}/.exec(screen)?.[0] ?? ''
    expect(menu, 'مكوّنُ القائمة مفقود').toBeTruthy()
    expect(menu, 'لا تُغلق بنقرةٍ خارجها').toContain("document.addEventListener(\"mousedown\"")
    expect(menu, 'لا تُغلق بـEscape').toContain('e.key === "Escape"')
    /* ويُعلَن دورُها لقارئ الشاشة — زرٌّ بلا اسمٍ ولا دورٍ لا يُنقر بلوحة */
    expect(menu, 'الزرُّ بلا اسمٍ مقروء').toContain('aria-label={`إجراءات ${label}`}')
    expect(menu, 'القائمةُ بلا دورٍ معلَن').toContain('role="menu"')
    expect(menu, 'عناصرُها بلا دورٍ معلَن').toContain('role="menuitem"')
  })
})

/* ═══ ④ والصفحةُ تسع خمسين — وصارت تُختار (٢٠ سبتمبر ٢٠٢٦) ═══

   كان الحجمُ رقما مكتوبا في نداء `paginate`، فكان يُقرأ منه. ثمّ قال
   صاحبُ المنصّة: «اجعلنا نختار عدد الخانات التي تظهر في الصفحة الواحدة»،
   فصار حالةً يبدّلها قارئُ الطابور.

   **والحارسُ لم يُحذف بل نُقل إلى حيث انتقل الرقم**: ما يحرسه هو أن يبدأ
   الطابورُ بخمسين لا بعشرين كما كان — والخيارُ بعد ذلك لصاحبه. ولو حُذف
   لَأمكن أن يعود الافتراضُ عشرين ولا يقول ذلك أحد. */
describe('④ والصفحةُ تبدأ بخمسين', () => {
  it('لا عشرين كما كانت — والافتراضُ حيث صار الرقمُ يسكن', () => {
    const size = /const \[size, setSize\] = useState\((\d+)\)/.exec(code(SCREEN))?.[1]
    expect(size, 'حجمُ الصفحة الافتراضيُّ لا يُقرأ من الشيفرة').toBeTruthy()
    expect(Number(size), 'عادت الصفحةُ إلى ما كانت').toBeGreaterThanOrEqual(50)
  })

  it('ويُمرَّر إلى `paginate` — فالخيارُ يعمل لا يُعرض فحسب', () => {
    expect(code(SCREEN), 'الترقيمُ لا يقرأ الحجمَ المختار')
      .toMatch(/paginate\(\s*sortApplications\(([\s\S]*?)page, size\);/)
  })

  it('والمُبدِّلُ في الشريط — وإلّا فالحالةُ بلا يدٍ تغيّرها', () => {
    expect(code(SCREEN), 'الشريطُ بلا مُبدِّلِ حجم')
      .toMatch(/size=\{size\}\s+onSize=\{setSize\}/)
  })
})

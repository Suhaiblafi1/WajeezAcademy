/* عدّادُ طابور التصحيح — الإشارةُ الأولى في قائمة المدرّب.
 *
 * ── لماذا رقمٌ في القائمة لا إشعارٌ وحدَه ──
 *
 * الإشعارُ يُقرأ مرّةً ثمّ يُنسى، ويُرسَل مرّةً واحدةً عند امتلاء الطابور
 * كي لا تصير شعبةٌ من ثلاثين ثلاثين إشعارا عن عملٍ واحد. فالرقمُ هو ما
 * يبقى: يُرى بلا فتحِ شيء، ويصير صفرا وحدَه حين يفرغ الطابور.
 *
 * وهذا الحارسُ يفحص البنيةَ لا الشكل: من أين يأتي الرقم، وهل يُقرأ لمن
 * لا يرى، وهل يختفي عند الصفر.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const layout = readFileSync(join(root, 'src/pages/trainer/TrainerLayout.tsx'), 'utf8')
/* الشيفرةُ بلا تعليقاتها — لما يُفحص بنيةً لا نصّا (أعرافُ `CLAUDE.md`) */
const code = layout.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const route = readFileSync(join(root, 'server/http/routes/trainer-portal.routes.ts'), 'utf8')
const queue = readFileSync(join(root, 'src/pages/trainer/GradingQueue.tsx'), 'utf8')

describe('عدّادُ ما ينتظر تصحيحَه', () => {
  it('الرقمُ من الخادم لا من الواجهة — فلا يُخمَّن ولا يُحسب مرّتين', () => {
    expect(layout).toMatch(/apiGet<PortalMe>\("\/api\/trainer\/me"\)/)
    /* وصار النداءُ يخدم اثنين — العدّادَ وشريطَ العرض المشروط — فتوسّع
       نوعُه. والمحروسُ واحدٌ لم يتغيّر: الرقمُ من ذلك المسار لا يُحسب هنا. */
    expect(layout).toMatch(/pendingGrading\?: number/)
    expect(layout).toMatch(/me\?\.pendingGrading \?\? 0/)
    expect(route).toMatch(/pendingGrading/)
  })

  it('والخادمُ يعدّ المعلّقَ في شعبِ هذا المدرّب وحدَه', () => {
    /* عدٌّ بلا قيدِ المدرّب يُظهر له عملَ غيره؛ وبلا قيدِ الحالة يعدّ ما صُحّح */
    expect(route).toMatch(/status: \{ in: \['submitted', 'under_review'\] \}/)
    expect(route).toMatch(/trainers: \{ some: \{ profileId: profile\.id \} \}/)
  })

  it('ويظهر على «طابور التقييم» وحدَه', () => {
    expect(layout).toMatch(/label: "طابور التقييم"[^}]*count: pending/)
  })

  it('ويُقرأ لمن لا يرى — رقمٌ عائمٌ لا يقول ماذا يعدّ', () => {
    expect(layout).toMatch(/sr-only">ينتظر تصحيحَك: /)
  })

  it('ويختفي عند الصفر — «٠ ينتظر» ضجيجٌ لا خبر', () => {
    /* صارت الشارةُ مكوّنا واحدا (`CountBadge`) يُرسم في أربعة مواضع: الحبّة،
       وشبحِها الذي يُقاس به عرضُها، وبندِ «المزيد»، وزرِّه. فالشرطُ فيه مرّةً —
       ورقمٌ يُرسم خامَ في موضعٍ خامس يتجاوزه، فلا يُرسم رقمٌ خامٌ أصلا. */
    const badge = code.slice(code.indexOf('function CountBadge'), code.indexOf('function MoreTabs'))
    expect(badge, 'لا مكوّنَ للشارة').not.toBe('')
    expect(badge, 'الشارةُ تُرسم والعددُ صفر').toMatch(/^function CountBadge\(\{ count \}[^{]*\{[^}]*\}\) \{\s*if \(!count\) return null;/)
    /* ابنُ وسمٍ لا قيمةُ خاصّيّة: `count={t.count}` تمريرٌ إلى الشارة، و`{t.count}`
       بلا `=` قبلها رسمٌ خام. وأوّلُ صياغةٍ لهذا الفحص طابقت التمريرَ نفسَه */
    expect(code.match(/(?<!=)\{t\.count\}/g) ?? [], 'عددٌ يُرسم خاما خارجَ الشارة — فيظهر «٠» ويفقد اسمَه').toHaveLength(0)
  })

  it('⚠️ ويبقى مرئيّا حين يخرج تبويبُه إلى «المزيد» — على الزرّ نفسِه لا خلف نقرة', () => {
    /* الشريطُ يعرض ما وسعه (٢٧ سبتمبر ٢٠٢٦)، و«طابورُ التقييم» رابعُ القائمة
       فيخرج إلى «المزيد» على الهاتف — ثلاثةٌ تسع ٣٩٠. والرقمُ وُضع في الشريط
       ليُرى بلا فتحِ شيء، فلو بقي في بند القائمة وحدَه لدُفن خلف نقرةٍ على
       أكثر الشاشات استعمالا. */
    const more = code.slice(code.indexOf('function MoreTabs'), code.indexOf('function TabsBar'))
    expect(more, 'لا مكوّنَ لـ«المزيد»').not.toBe('')
    expect(more, 'الزرُّ لا يجمع عدّادَ ما خلفه').toMatch(/const waiting = items\.reduce\(/)
    const button = more.slice(more.indexOf('<NavPillButton'), more.indexOf('</NavPillButton>'))
    expect(button, 'عدّادُ المخفيّ لا يُرسم على الزرّ').toContain('<CountBadge count={waiting} />')
    /* وبندُه في القائمة يحمله أيضا — فمن فتحها عرف أين ينتظره العمل */
    const menu = more.slice(more.indexOf('role="menu"'))
    expect(menu, 'بندُ القائمة بلا عدّاد').toContain('<CountBadge count={t.count} />')
  })

  it('وسقوطُ العدّاد لا يُسقط البوّابة', () => {
    /* بوّابةٌ لا تُفتح لأنّ رقما لم يصل عطبٌ أكبرُ من غياب الرقم */
    expect(layout).toMatch(/\.catch\(\(\) => \{/)
  })
})

/* ── والرقمُ يُعاد جلبُه بعد الفعل ──

   رصدت جولةُ البند ③ أنّ المدرّبَ يقبل آخرَ تسليمٍ فيصير المتنُ «الطابورُ
   نظيف» والشارةُ فوقه في القائمة ما تزال «ينتظر تصحيحَك: ١» — في الصفحة
   نفسِها، ولا تنطفئ إلّا بإعادة تحميلٍ كاملة. فالعددُ صحيحٌ ولا يُعاد جلبُه.

   والسببُ بنيويّ: الشارةُ في الإطار والطابورُ في ابنه، ولا يعرف الأوّلُ ما
   يفعله الثاني. فيُبلَّغ بإشارةٍ اسمُها مصدَّرٌ من موضعٍ واحد — وحدثٌ يُطلق
   باسمٍ ويُسمع بآخرَ لا يشكو، يصمت. */
describe('والشارةُ تنطفئ بفعلِ المدرّب لا بإعادة التحميل', () => {
  it('الطابورُ يُطلق الإشارةَ بعد كلّ فعلٍ ينجح', () => {
    expect(queue, 'لا إشارةَ تُطلق — فالشارةُ تبقى على رقمٍ بائت').toContain('signalGradingChanged()')
    /* بعد النجاح لا قبله: إطلاقٌ في `try` قبل `await fn()` يكذب حين يسقط الفعل */
    const act = queue.slice(queue.indexOf('const act ='), queue.indexOf('} catch (err)', queue.indexOf('const act =')))
    expect(act.indexOf('await fn()')).toBeLessThan(act.indexOf('signalGradingChanged()'))
  })

  it('والإطارُ يسمعها — ولو أطلقها أحدٌ ولا سامعَ لبقيت الشارةُ كما هي', () => {
    expect(layout).toMatch(/addEventListener\(GRADING_CHANGED, refreshMe\)/)
    expect(layout, 'المستمعُ لا يُنزَع عند التفكيك — تراكمُ المستمعين تسريبٌ صامت')
      .toMatch(/removeEventListener\(GRADING_CHANGED, refreshMe\)/)
  })

  it('والاسمُ مصدَّرٌ من موضعٍ واحدٍ لا مكتوبٌ حرفا في الطرفَين', () => {
    for (const [name, src] of [['الإطار', layout], ['الطابور', queue]] as const) {
      expect(src, `${name} لا يستورد الإشارةَ من مصدرها`).toContain('@/services/grading-signal')
      expect(
        src.includes('"wajeez:grading-changed"') || src.includes("'wajeez:grading-changed'"),
        `${name} يكتب اسمَ الحدث بيده — فحرفٌ يتغيّر في أحدهما يقطع الوصلَ بلا خطأ`,
      ).toBe(false)
    }
  })
})

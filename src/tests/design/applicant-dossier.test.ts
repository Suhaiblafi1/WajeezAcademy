/* ملفُّ المتقدّم: الشاشةُ تُقرأ بالقفز، والمطبوعُ يخرج كاملا.

   ═══ العطبُ الذي كُتبت له ═══

   بلاغُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦) بصورة حوار الطباعة: «صفحة المدرّب داخل
   الأدمن غير مرتّبة وغير سهلة التعامل… واجعل التقرير المطبوع أكثر احترافيّة…
   يجب أن يشمل كافّة التفاصيل».

   وفي الصورة نفسِها الدليل: ستُّ صفحاتٍ تحمل عناوينَ «المقابلات» و«الدرس
   التجريبيّ» و«المراجع المهنيّة» و«العقد والتوقيع» — **بلا سطرٍ تحت أيٍّ
   منها**. والسببُ أنّ `FoldSection` كانت `{open && <div>…}`: المطويُّ غيرُ
   موجودٍ في الصفحة أصلا لا مخفيٌّ فيها، والطابعةُ لا تطبع ما ليس موجودا.
   فخرج تقريرٌ **يبدو مكتملا وهو ناقصُ أربعةِ أقسام** — وهذا أسوأُ من نقصٍ
   ظاهر، إذ يُبنى عليه قرارٌ في إنسان.

   والحرّاسُ هنا على **البنية**: أنّ الجسمَ يُرسَم دائما، وأنّ كلَّ مدخلٍ في
   الفهرس يقابل مرساةً قائمة، وأنّ الورقةَ لها مقاسٌ ومراتبُ حبر. ولا يُطابَق
   نصٌّ في تعليق — فالتعليقاتُ تُنزع قبل الفحص، وقد مرّ في هذه المنصّة حارسٌ
   أخضرُ لأنّه طابق شرحا عربيّا لا شيفرة. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
/** الشيفرةُ بلا تعليقاتها — فلا يُطابَق شرحٌ يذكر ما يحرسه */
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const ops = code('src/pages/admin/TrainerOps.tsx')
const screen = code('src/pages/admin/TrainerApplications.tsx')
const css = readFileSync(join(root, 'src/index.css'), 'utf8')

/** جسمُ `FoldSection` وحدَه — لا الملفُّ كلُّه، فلا يُطابَق قسمٌ آخر */
const foldSection = /function FoldSection\([\s\S]*?\n\}\n/.exec(ops)?.[0] ?? ''

describe('القسمُ المطويُّ يُخفى ولا يُنزَع — وإلّا خرج المطبوعُ ناقصا', () => {
  it('الجسمُ مرسومٌ في كلّ حال، لا مشروطا بأنّ القسم مفتوح', () => {
    expect(foldSection, 'لم يُعثر على `FoldSection`').not.toBe('')
    /* `{open && <div>…}` هو العطبُ بعينه: لا عنصرَ في الصفحة فلا شيءَ يُطبع */
    expect(foldSection, 'المطويُّ يُنزَع من الصفحة فلا تجده الطابعة').not.toMatch(/\{\s*open\s*&&\s*</)
  })

  it('⚠️ والمطويُّ يُعرَض في الطباعة — وهو الفحصُ الذي كُتب له الإصلاح', () => {
    expect(foldSection, 'لا قاعدةَ تُظهر المطويَّ عند الطباعة').toContain('print:block')
    /* ويبقى مخفيّا على الشاشة، وإلّا فقد الطيُّ معناه */
    expect(foldSection, 'المطويُّ ظاهرٌ على الشاشة — فلا طيَّ أصلا').toContain('hidden')
  })

  it('ويُفتح من تلقائه لمن جاءه من الفهرس — لا يُقفَز إلى عنوانٍ فارغ', () => {
    expect(foldSection, 'لا يستمع إلى الجزء فيبقى مطويّا لمن قصده').toContain('hashchange')
  })
})

describe('فهرسُ الأقسام: كلُّ مدخلٍ يقابل مرساةً قائمة', () => {
  /* مدخلٌ في فهرسٍ لا مرساةَ له لا يُخطئ ولا يتحرّك: يُنقر فلا يقع شيء.
     ولا يُكتشف إلّا بالنقر على كلّ مدخلٍ بعد كلّ تعديل. */
  const ids = [...(/const DOSSIER_SECTIONS[\s\S]*?\n\];/.exec(screen)?.[0] ?? '')
    .matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1])
  const anchors = new Set(
    [...`${screen}${ops}`.matchAll(/id="([^"]+)"/g)].map((m) => m[1]),
  )

  it('الفهرسُ ليس فارغا ولا يُقرأ من فراغ', () => {
    expect(ids.length, 'لم تُقرأ أقسامُ الفهرس').toBeGreaterThanOrEqual(6)
  })

  it('⚠️ ولا مدخلَ بلا مرساة — والنقرةُ التي لا تحرّك شيئا لا تُخطئ فلا تُكتشف', () => {
    const dangling = ids.filter((id) => !anchors.has(id))
    expect(dangling, `مداخلُ فهرسٍ بلا مراسٍ: ${dangling.join(' · ')}`).toEqual([])
  })

  it('والفهرسُ أداةُ تنقّلٍ فلا يُطبع', () => {
    const nav = /<nav aria-label="أقسام الملفّ"[\s\S]*?>/.exec(screen)?.[0] ?? ''
    expect(nav, 'لا عنصرَ تنقّلٍ للفهرس').not.toBe('')
    expect(nav, 'الفهرسُ يُطبع مع الملفّ').toContain('print:hidden')
  })
})

describe('ورقةُ الطباعة: مقاسٌ ومراتبُ حبرٍ لا كتلةٌ رماديّة', () => {
  const printBlock = /@media print \{[\s\S]*\n\}/.exec(css)?.[0] ?? ''

  it('للورقة مقاسٌ وهوامش — لا هوامشُ المتصفّح الافتراضيّة', () => {
    expect(printBlock, 'لا `@page` فالهوامشُ ما قرّره المتصفّح').toMatch(/@page\s*\{[^}]*size:\s*A4/)
  })

  it('⚠️ والتسطيحُ لا يُترك آخرَ كلمة — وإلّا خرج كلُّ شيءٍ بلونٍ واحد', () => {
    /* تسطيحُ الواجهة الداكنة لازم، لكنّه وحدَه يجعل العنوانَ كالنصّ والتسميةَ
       كالقيمة. فتُعاد المراتبُ بعده: تسميةٌ أهدأُ، وعنوانُ قسمٍ له خطّ. */
    const flattenAt = printBlock.indexOf('#111111')
    const mutedAt = printBlock.indexOf('.text-muted-foreground')
    expect(flattenAt, 'لا تسطيحَ أصلا').toBeGreaterThan(-1)
    expect(mutedAt, 'لا تُعاد مرتبةُ التسمية بعد التسطيح').toBeGreaterThan(flattenAt)
    expect(printBlock, 'عنوانُ القسم بلا فاصلٍ يميّزه').toMatch(/h4[\s\S]{0,200}border-bottom/)
  })

  it('وعنوانٌ لا يُترك وحيدا في ذيل صفحة', () => {
    expect(printBlock).toMatch(/break-after:\s*avoid/)
  })

  it('ولا يُمنع القطعُ داخلَ قسمٍ كامل — بعضُها صفحةٌ بعد أن صار المطويُّ يُطبع', () => {
    /* `section, article { break-inside: avoid }` كان يُخرج صفحاتٍ نصفَ بيضاء */
    expect(printBlock, 'ما زال القطعُ ممنوعا في القسم كلِّه').not.toMatch(/section,\s*\n?\s*article \{\s*\n?\s*break-inside/)
  })
})

describe('ترويسةُ المطبوع وذيلُه', () => {
  it('⚠️ المطبوعُ يقول ما هو ولمن ومتى — لا يبدأ بأوّل بطاقةٍ في الصفحة', () => {
    /* ويُغلَق على إزاحته لا على أوّل `</div>` — فأوّلُها إغلاقُ صفٍّ داخليّ،
       وقد مرّ في هذه الجلسة حارسٌ طابق دالّةً أخرى بحرفٍ عامٍّ كسول. */
    const cover = /<div className="hidden print:block">[\s\S]*?\n {8}<\/div>/.exec(screen)?.[0] ?? ''
    expect(cover, 'لا ترويسةَ للمطبوع').not.toBe('')
    expect(cover, 'لا رقمَ طلبٍ في الترويسة').toContain('رقمُ الطلب')
    expect(cover, 'لا تاريخَ طباعة').toContain('طُبع في')
    expect(cover, 'لا حالةَ للطلب').toContain('الحالة')
  })

  it('وبصمةُ البناء لا تُطبع — أداةُ تشخيصٍ لا سطرٌ في مستندِ لجنة', () => {
    const stamp = code('src/components/BuildStampLine.tsx')
    expect(stamp, 'بصمةُ البناء تُطبع في ذيل الملفّ').toMatch(/<p className="[^"]*print:hidden/)
  })
})

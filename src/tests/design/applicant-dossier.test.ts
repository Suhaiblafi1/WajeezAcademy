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

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RUBRIC_AXES } from '@/application/trainer/rubric'
import { DOMAIN_YEARS, TRAINING_YEARS, yearsLabel } from '@/application/trainer/application-options'

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
  /* ═══ والمراسي تُمسح من الشجرة لا من ملفَّين ═══

     كانت تُقرأ من `TrainerApplications` و`TrainerOps` وحدَهما. فلمّا خرجت
     «أسئلةُ المقابلة» إلى ملفٍّ ثالثٍ صار مدخلُها بلا مرساةٍ في نظر الحارس
     وهو سليم — قائمةٌ مكتوبةٌ باليد تُخطئ في الاتّجاهَين. */
  const adminTsx = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const full = join(dir, e)
      return statSync(full).isDirectory() ? adminTsx(full) : full.endsWith('.tsx') ? [full] : []
    })
  const anchors = new Set(
    adminTsx(join(root, 'src/pages/admin'))
      .flatMap((f) => [...code(f.slice(root.length + 1)).matchAll(/id="([^"]+)"/g)].map((m) => m[1])),
  )

  it('الفهرسُ ليس فارغا ولا يُقرأ من فراغ', () => {
    expect(ids.length, 'لم تُقرأ أقسامُ الفهرس').toBeGreaterThanOrEqual(6)
  })

  it('⚠️ ولا مدخلَ بلا مرساة — والنقرةُ التي لا تحرّك شيئا لا تُخطئ فلا تُكتشف', () => {
    const dangling = ids.filter((id) => !anchors.has(id))
    expect(dangling, `مداخلُ فهرسٍ بلا مراسٍ: ${dangling.join(' · ')}`).toEqual([])
  })

  it('والفهرسُ قائمٌ — أداةُ تنقّلٍ في شاشةٍ طويلة', () => {
    const nav = /<nav aria-label="أقسام الملفّ"[\s\S]*?>/.exec(screen)?.[0] ?? ''
    expect(nav, 'لا عنصرَ تنقّلٍ للفهرس').not.toBe('')
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

  it('⚠️ وحقولُ الإدخال لا تُطبع — ومربّعٌ خاوٍ على الورق يُقرأ بيانا ناقصا', () => {
    /* خرج التقريرُ أوّلَ مرّةٍ وفيه صفوفُ مربّعاتِ درجاتٍ فارغةٍ وقوائمُ
       منسدلةٌ ومساحاتُ ملاحظاتٍ بيضاء — «فاشل جدا» بعبارة صاحب المنصّة. */
    expect(printBlock, 'حقولُ الإدخال تُطبع').toMatch(/input,\s*\n\s*select,\s*\n\s*textarea,\s*\n\s*button:not\(\[aria-expanded\]\) \{\s*\n\s*display: none/)
    /* ⚠ ويُستثنى زرُّ الكشف: سطورُ الوثائق أزرارٌ تحمل `aria-expanded`، فحجبُ
       الأزرار كلِّها أخرج «الوثائق» عنوانا بلا سطرٍ تحته — والسيرةُ الذاتيّةُ
       أوّلُ ما يُنظر فيه. */
    expect(printBlock, 'زرُّ الكشفِ يُحجب مع الأفعال، فتضيع الوثائق').toContain('button:not([aria-expanded])')
    /* ويُستثنى زرُّ رأسِ القسم: هو عنوانُه لا أداةً فيه — و`!important` لازمٌ
       ليغلب القاعدةَ أعلاه، وبدونه اختفت عناوينُ الأقسام المطويّة كلُّها. */
    expect(printBlock, 'رأسُ القسم المطويّ يختفي مع الحقول').toMatch(/article > button \{[\s\S]{0,80}display: block !important/)
  })

  it('⚠️ ولا عنوانَ بلا شيءٍ تحته: قسمُ الحقول لا يُطبع، والفارغُ كذلك', () => {
    /* ثلاثةُ أقسامٍ لا تعرض المسجَّلَ في متنها بل في قائمةٍ منسدلة — «الدرس
       التجريبيّ» و«المراجع» و«العقد». فلمّا أُخفيت الحقولُ وحدَها بقيت
       عناوينُها الثلاثةُ معلّقةً على الورق: العطبُ نفسُه الذي أُصلح في الأقسام
       المطويّة، عائدا من بابٍ آخر. */
    expect(ops, 'لا سبيلَ لاستثناء قسمٍ من الطباعة').toContain('omitFromPrint')
    for (const [id, why] of [
      ['sec-demo', 'الدرس التجريبيّ'],
      ['sec-references', 'المراجع المهنيّة'],
      ['sec-contract', 'العقد والتوقيع'],
    ] as const) {
      const tag = new RegExp(`<FoldSection[^>]*${id}[^>]*>`).exec(ops)?.[0] ?? ''
      expect(tag, `«${why}» حقولٌ خالصةٌ وتُطبع — فعنوانُها يخرج فارغا`).toContain('omitFromPrint')
    }
    /* والمقابلاتُ تعرض المسجَّلَ فعلا، فتُطبع حين يكون فيها شيء وحدَه */
    const interviews = /<FoldSection[^>]*sec-interviews[^>]*>/.exec(ops)?.[0] ?? ''
    expect(interviews, 'المقابلاتُ الفارغةُ تُطبع عنوانا بلا سطر').toMatch(/omitFromPrint=\{app\.interviews\.length === 0\}/)
  })

  it('وعنوانٌ لا يُترك وحيدا في ذيل صفحة', () => {
    expect(printBlock).toMatch(/break-after:\s*avoid/)
  })

  it('ولا يُمنع القطعُ داخلَ قسمٍ كامل — بعضُها صفحةٌ بعد أن صار المطويُّ يُطبع', () => {
    /* `section, article { break-inside: avoid }` كان يُخرج صفحاتٍ نصفَ بيضاء */
    expect(printBlock, 'ما زال القطعُ ممنوعا في القسم كلِّه').not.toMatch(/section,\s*\n?\s*article \{\s*\n?\s*break-inside/)
  })
})

describe('والمطبوعُ ذهب — لكلّ قارئٍ رابطُه', () => {
  /* ═══ ما كان هنا ولماذا ذهب ═══

     كان يُحرَس أنّ للمطبوع ترويسةً تقول ما هو ولمن ومتى، وأنّ الفهرسَ لا
     يُطبع. وكلاهما صوابٌ **لمطبوعٍ موجود**. والمرحلةُ الثالثة (١٤ سبتمبر
     ٢٠٢٦) أنهت المطبوعَ نفسَه: صار لكلّ قارئٍ رابطُه باسمه يقرأ فيه ويكتب.

     فالحارسُ ينقلب: لا يُحرَس أنّ المطبوعَ حسنٌ، بل أنّ الشاشةَ **لم تُبقِ
     سقالتَه**. وسقالةٌ باقيةٌ بلا مطبعةٍ ليست حيادا: شيفرةٌ تُصان ويُظنّ
     أنّها تعمل، ومن رآها بعد سنةٍ أعاد بناءَ الزرّ عليها. */
  it('⚠️ لا زرَّ طباعةٍ ولا ترويسةَ مطبوعٍ ولا صنفَ طباعةٍ في شاشة الملفّ', () => {
    expect(screen, 'عاد زرُّ الطباعة').not.toMatch(/window\.print\(\)/)
    expect(screen, 'ترويسةُ مطبوعٍ بلا مطبعة').not.toMatch(/hidden print:block/)
    expect(screen, 'سقالةُ طباعةٍ باقيةٌ في شاشةٍ لا تُطبع').not.toMatch(/\bprint:[a-z]/)
  })

  it('وبديلُه قائمٌ في الشاشة نفسِها — لوحُ روابط القُرّاء', () => {
    expect(screen, 'أُزيل المطبوعُ ولا بديلَ في مكانه').toContain('<ReviewerLinks')
  })

  it('وبصمةُ البناء لا تُطبع — أداةُ تشخيصٍ لا سطرٌ في مستندِ لجنة', () => {
    const stamp = code('src/components/BuildStampLine.tsx')
    expect(stamp, 'بصمةُ البناء تُطبع في ذيل الملفّ').toMatch(/<p className="[^"]*print:hidden/)
  })
})

describe('ورقةُ المقابلة: تُسأل بمحاور التقييم — والتقييمُ يُكتب في الرابط', () => {
  const sheet = code('src/pages/admin/InterviewSheet.tsx')
  /* انتقلت الأسئلةُ إلى وحدتها لمّا صار لها قارئان: شاشةُ الأدمن
     والصفحةُ المشتركة. والحارسُ يتبعها ولا يبقى على ملفٍّ لم تعد فيه. */
  const asks = code('src/pages/admin/InterviewQuestions.tsx')
  const rubric = code('src/application/trainer/rubric.ts')
  const server = readFileSync(join(root, 'server/services/trainer-review.service.ts'), 'utf8')

  /* مفاتيحُ الخادم — وهو الحَكَم: يتحقّق منها عند الحفظ ويرفض ما نقص */
  const serverKeys = (/export const RUBRIC_CRITERIA = \[([\s\S]*?)\] as const/.exec(server)?.[1] ?? '')
    .match(/'([a-z_]+)'/g)?.map((q) => q.slice(1, -1)) ?? []

  it('⚠️ محاورُ الورقة هي محاورُ الخادم — مفتاحا مفتاحا وترتيبا', () => {
    /* ═══ ولماذا هذا أخطرُ من فرقٍ تجميليّ ═══

       النموذجُ يُطبع ليُملأ باليد في المقابلة ثمّ تُنقل درجاتُه إلى الشاشة.
       فلو زاد الخادمُ محورا ولم تزده الورقة، جلس المديرُ بثمانيةٍ ثمّ وجد في
       الشاشة تسعةً لا يملك للتاسع جوابا — ولا شيءَ يقول له إنّ ورقتَه قديمة. */
    expect(serverKeys.length, 'لم تُقرأ محاورُ الخادم').toBe(9)
    expect(RUBRIC_AXES.map((x) => x.key)).toEqual(serverKeys)
  })

  it('ولا نسخةَ ثانيةً للمحاور في الشاشات — مصدرٌ واحدٌ لا ثلاثة', () => {
    for (const p of ['src/pages/admin/TrainerApplications.tsx', 'src/pages/admin/TrainerOps.tsx']) {
      expect(code(p), `${p}: يعرّف المحاورَ بنفسه بدل قراءتها من مصدرها`)
        .not.toMatch(/const RUBRIC_AXES\s*[:=]/)
    }
  })

  it('وكلُّ محورٍ له سؤالٌ أو سببٌ مكتوبٌ لغيابه — لا محورَ يُترك صامتا', () => {
    for (const axis of RUBRIC_AXES) {
      const covered = axis.questions.length > 0 || Boolean(axis.laterAr)
      expect(covered, `محور «${axis.label}» بلا أسئلةٍ وبلا سببٍ لغيابها`).toBe(true)
    }
    /* وأكثرُها يُسأل فعلا: ورقةٌ فيها محورٌ واحدٌ مسؤولٌ عنه ليست ورقةَ مقابلة */
    expect(RUBRIC_AXES.filter((x) => x.questions.length > 0).length).toBeGreaterThanOrEqual(7)
  })

  it('⚠️ ونموذجُ التعبئة اليدويّة ذهب — طريقان إلى ملفٍّ واحدٍ يعني نقلا يُخطئ', () => {
    /* ═══ ولماذا حارسٌ على الغياب ═══

       كان النموذجُ يُرسَم بخاناتٍ وسطورٍ منقّطةٍ (`Scale` و`Ruled`) ليُملأ
       بالقلم **ثمّ يُنقل إلى الشاشة**. وتلك العلّةُ زالت: صار لكلّ قارئٍ
       رابطُه يفتحه في الغرفة ويكتب فيه، فيصل الملفَّ في حينه منسوبا إليه.

       ونقلٌ يدويٌّ بعد ذلك ليس توفيرا بل **فرصةَ خطأٍ ثانية**: ما كُتب
       بالقلم يُقرأ بعد ساعةٍ فيُدخَل غيرُه، ولا أحدَ يعرف أيُّهما الصواب. */
    expect(sheet, 'عادت خاناتُ الدرجات التي تُدوَّر باليد').not.toMatch(/\bScale\b/)
    expect(sheet, 'عادت السطورُ المنقّطةُ التي تُكتب بالقلم').not.toMatch(/\bRuled\b/)
    expect(sheet, 'عاد نموذجٌ مخصَّصٌ للطباعة').not.toMatch(/hidden print:block/)
  })

  it('وتبقى الأسئلة — هي التي توحّد المقابلات، ولا بديلَ لها في الرابط', () => {
    expect(sheet, 'ذهبت الأسئلةُ مع النموذج').toContain('InterviewQuestions')
  })

  it('⚠️ ولا صيغةَ ماركداون في نصٍّ يُرسَم كما هو — النجمتان تُطبعان نجمتَين', () => {
    /* وقع هذا مرّتَين في يومٍ واحد: مرّةً في صفّ صحّة النظام، ومرّةً في سؤال
       «التوفر» — فخرجت «تستطيع **فعلا**» بنجمتَيها على الورق. والواجهةُ هنا
       لا تفسّر ماركداون في شيء. */
    for (const axis of RUBRIC_AXES) {
      for (const q of axis.questions) {
        expect(q, `سؤالُ «${axis.label}» فيه صيغةُ ماركداون تُطبع كما هي`).not.toMatch(/\*\*|`|^- /)
      }
      if (axis.laterAr) expect(axis.laterAr, `تفسيرُ «${axis.label}» فيه صيغةُ ماركداون`).not.toMatch(/\*\*|`/)
    }
  })

  it('وأسئلةٌ تخصُّ هذا الطلبَ وحدَه تُشتقّ منه — لا قائمةٌ عامّةٌ للجميع', () => {
    expect(rubric, 'لا محاورَ ذاتُ أسئلة').toContain('questions')
    expect(asks, 'لا سؤالَ مشتقٌّ من الطلب نفسِه').toContain('personalAsks')
    /* والادّعاءُ غيرُ الموثَّق أوّلُ ما يُسأل عنه */
    expect(asks, 'اعتمادٌ بلا جهةٍ لا يُسأل عنه').toContain('hasAccreditation')
    /* ويقرؤها الاثنان من مصدرٍ واحد — نسختان تتفقان اليومَ لا تتفقان غدا */
    expect(sheet, 'ورقةُ المقابلة لا تعرض الأسئلة').toContain('InterviewQuestions')
    expect(code('src/pages/SharedDossier.tsx'), 'الصفحةُ المشتركةُ بلا أسئلة').toContain('InterviewQuestions')
  })

  /* ═══ كُشف بالنظر في الصفحة لا بالشيفرة ═══

     `yearsLabel` تردّ المفتاحَ كما هو عند العجز، وقيمُ `TRAINING_YEARS`
     لم تكن في معجمها. فظهر `formal_teaching` نصّا لاتينيّا في صفّ «خبرة
     التدريب» — ولا يُحمّر ذلك شيئا: الصفحةُ تعمل والقيمةُ تُعرض.

     والفحصُ على القوائم نفسِها لا على مفتاحٍ بعينه: قيمةٌ تُضاف غدا إلى
     أيٍّ منهما بلا ترجمةٍ يجب أن تُسقط هذا الحارسَ وحدَها. */
  it('⚠️ وكلُّ قيمةِ خبرةٍ تُترجَم — ولا يظهر مفتاحُ قاعدةٍ لمن يقرأ الملفّ', () => {
    for (const list of [TRAINING_YEARS, DOMAIN_YEARS]) {
      for (const { value } of list) {
        expect(yearsLabel(value), `القيمة «${value}» تُعرض مفتاحا لاتينيّا كما هي`).not.toBe(value)
      }
    }
  })

  /* ═══ المرحلةُ الثانية: الروبركُ يُملأ في الرابط لا في الشاشة ═══

     قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦). وبقاءُ النموذج هنا يعني موضعَين
     لشيءٍ واحد — ومن ملأ ههنا وملأ زميلُه هناك لم يُعرف أيُّهما التقييم.

     والفحصُ على **البنية**: أزرارُ درجاتٍ تكتب في حالةٍ، ومسارُ حفظٍ إلى
     `/reviews`. ولا يكفي غيابُ كلمة. */
  it('⚠️ ولا نموذجَ روبركٍ في شاشة الإدارة — يُملأ في الرابط المشترك', () => {
    expect(screen, 'ما زالت الشاشةُ ترسل تقييما إلى الخادم').not.toMatch(/\/reviews['`"]/)
    expect(screen, 'ما زالت الشاشةُ تكتب درجاتٍ في حالة').not.toMatch(/setScores\s*\(/)
    /* وتبقى المقارنةُ — وهي ما لا يُغني عنه الرابط */
    expect(screen, 'ذهبت المقارنةُ مع النموذج').toMatch(/a\.reviews\.map/)
  })

  /* ═══ وبابُ الحذف يُرى في كلّ حالة ═══

     كان محجوبا إلّا على أربعِ حالاتٍ منتهية، وطلباتُ التجربة تسكن كلَّ
     الحالات — فكان البابُ موجودا ولا يُرى حيث يُحتاج. والفحصُ أنّ ظهورَه
     لا يُشترط بحالةٍ، وأنّ قائمةَ المنتهيات تُقرأ من مصدرها لا تُنسَخ. */
  it('⚠️ وبابُ الحذف لا يُشترط بحالة، وقائمةُ المنتهيات تُقرأ من مصدرها', () => {
    expect(screen, 'قائمةُ الحالات منسوخةٌ بالحرف في الشاشة — تنحرف عن الخادم يوما')
      .not.toMatch(/\["draft",\s*"email_verification_pending"/)
    expect(screen, 'لا تقرأ الشاشةُ قائمةَ المنتهيات من مصدرها').toContain('PURGEABLE_STATUSES')
    /* والبابُ مشروطٌ بالصلاحيّة وبألّا يكون صار مدرّبا — لا بحالته */
    expect(screen, 'بابُ الحذف غيرُ مشروطٍ بالصلاحيّة').toMatch(/canPurge\s*&&/)
  })

  it('وسجلُّ الحالة عاد إلى المطبوع بطلب صاحب المنصّة', () => {
    const panel = /\{\/\* سجل الحالات[\s\S]{0,400}?<Panel as="article"[^>]*>/.exec(screen)?.[0]
      ?? /<Panel as="article"[^>]*>\s*<h4 id="sec-history"/.exec(screen)?.[0] ?? ''
    expect(panel, 'لم يُعثر على بطاقة سجلّ الحالة').not.toBe('')
    expect(panel, 'سجلُّ الحالة ما زال محجوبا عن الطباعة').not.toContain('print:hidden')
  })
})

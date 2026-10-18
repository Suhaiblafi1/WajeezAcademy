/* أربعةُ تغييراتٍ في ملفّ المتقدّم (١٤ سبتمبر ٢٠٢٦) — بنيةٌ لا نصّ.

   ═══ ١) الكتالوجُ يُطلب، وإلّا طُبعت المعرّفاتُ خاما ═══

   `courses` في `@/data/courses` تُبنى **لحظةَ استيراد الوحدة** من كتالوجٍ
   يبدأ فارغا ويُحمَّل كسولا (البند ع-١). ومن يملؤه `usePublishedContent()`،
   ولم تكن تناديه لا شاشةُ الطلبات ولا صفحةُ الرابط. فقرأ صاحبُ المنصّة
   «C-BIZ-101» مكانَ اسم الدورة — وهو أهمُّ ما في الطلب.

   ═══ ٢) الأدمنُ يكتب اسمَ الاقتراح بنفسه ═══
   ═══ ٣) والاتفاقُ الماليُّ في نموذج القارئ ═══
   ═══ ٤) وقسمانِ ذهبا من شاشة المدرّب ═══
   ═══ ٥) ثمّ ما يتخطّى العقد (١٨ أكتوبر ٢٠٢٦) ═══ */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const dossier = code('src/pages/admin/ApplicationDossier.tsx')
const apps = code('src/pages/admin/TrainerApplications.tsx')
const editor = code('src/pages/admin/ProposalsEditor.tsx')
const shared = code('src/pages/SharedDossier.tsx')
const ops = code('src/pages/admin/TrainerOps.tsx')
const routes = code('server/http/routes/admin-trainer.routes.ts')

describe('أسماء الدورات تقرأ أسماء', () => {
  it('⚠️ الملفّ يطلب الكتالوج بنفسه — فلا يطبع المعرّف خاما في شاشة ولا في رابط', () => {
    expect(dossier, 'لا يقرأ أسماء الدورات أصلا').toMatch(/courseById\(/)
    expect(dossier, 'يقرأ الأسماء ولا يطلب الكتالوج — فتعود فارغة ويطبع المعرّف')
      .toMatch(/usePublishedContent\(\)/)
  })

  it('والموضع في الملفّ لا في الشاشتين — فمن أضاف شاشة ثالثة لا يحتاج أن يتذكّر', () => {
    /* لو كان النداءُ في `TrainerApplications` وحدَها لبقيت صفحةُ الرابط مكسورة */
    expect(dossier).toMatch(/usePublishedContent/)
  })
})

describe('الأدمن يكتب اسم الاقتراح', () => {
  it('المحرّر معروض في الملفّ، وينادي المسار القائم', () => {
    expect(apps).toMatch(/<ProposalsEditor/)
    expect(editor).toContain('/teachable-proposals')
    expect(routes).toContain("app.put('/api/admin/trainer-applications/:id/teachable-proposals'")
  })

  /* ═══ وحارسٌ كان هنا ذهب مع ما يحرسه ═══

     حرس زرَّ «اربِطها» ألّا يُفتح لصفٍّ لم يُحفظ — وكان ذلك صوابا ما دام
     الزرُّ قائما. وقد زال الزرُّ مع الطريق الثاني لاقتراح الدورات (قرارُ
     صاحب المنصّة): التصنيفُ موضعُه طابورُ «دوراتٌ مقترحة» لا هذه الشاشة.

     فلم يُترَك الحارسُ يحرس فراغا — إذ حارسٌ على شيءٍ زال يخضرّ أبدا ويوهم
     أنّ شيئا يُحرَس. */

  it('والفقرة التي كتبها هو تبقى معروضة — لا تمحى ولا تقسّم تخمينا', () => {
    expect(editor).toMatch(/\{teachableOther\}/)
  })

  it('وحدّ العشرين يقرأ من مصدره لا يكتب رقما', () => {
    expect(editor, 'رقم مكتوب بدل `MAX_PROPOSALS`').toMatch(/MAX_PROPOSALS/)
  })
})

describe('الاتفاق الماليّ', () => {
  it('حقلان في نموذج القارئ يرسلان مع التقييم', () => {
    expect(shared).toMatch(/feeExpectationAr:/)
    expect(shared).toMatch(/feeProposalAr:/)
  })

  it('⚠️ ونصّ لا رقم — الوحدة والعملة تختلفان، والمدى ليس رقما', () => {
    /* `type="number"` هنا يجبر القارئَ على اختراع دقّةٍ لا يملكها */
    const block = /الاتفاق الماليّ[\s\S]*?<\/fieldset>/.exec(shared)?.[0] ?? ''
    expect(block, 'لا كتلة للاتفاق الماليّ').not.toBe('')
    expect(block, 'خانة رقميّة لما يقال مدى').not.toMatch(/type="number"/)
  })

  it('ويقرآن في شاشة القرار — فمن قرأ الحكم رأى ما دار في المال', () => {
    expect(apps).toMatch(/r\.feeExpectationAr/)
    expect(apps).toMatch(/r\.feeProposalAr/)
  })
})

describe('ما ذهب من شاشة المدرّب', () => {
  it('تقييم الدرس التجريبيّ والمراجع المهنيّة — ولا بقايا نماذج لهما', () => {
    expect(ops, 'عاد قسم الديمو').not.toMatch(/id="sec-demo"/)
    expect(ops, 'عاد قسم المراجع').not.toMatch(/id="sec-references"/)
    expect(ops, 'بقي نموذج الروبرك بلا قسم يستعمله').not.toMatch(/function RubricInput/)
  })

  it('والمقابلات باقية — لم يحذف ما لم يطلب حذفه', () => {
    expect(ops).toMatch(/id="sec-interviews"/)
  })
})

/* ═══ ثمّ «العقد والتوقيع» و«ابدأ التهيئة» (١٨ أكتوبر ٢٠٢٦) ═══

   بابان يتخطّيان العقد: «أنشئ وأرسل» و«سجّل التوقيع» يُدخلان الطلبَ التهيئةَ بعقدٍ بلا نصٍّ ولا
   اعتماد، و«ابدأ التهيئة» يُدخلها بلا عقدٍ أصلا. واختار صاحبُ المنصّة حذفَهما — والعقدُ الحقُّ
   خطوةٌ في «التجهيز» تبقى. */
describe('ما يتخطّى العقد ذهب — والعقد في «التجهيز» باق', () => {
  const prep = code('src/pages/admin/PreparationSteps.tsx')

  it('⚠️ لا «العقد والتوقيع» في ملفّ المدرّب — ولا في فهرسه', () => {
    expect(ops).not.toMatch(/id="sec-contract"/)
    expect(ops, 'بقي «أنشئ وأرسل»').not.toMatch(/\/trainer-applications\/\$\{app\.id\}\/contracts`/)
    expect(ops, 'بقي «سجّل التوقيع»').not.toMatch(/\/trainer-contracts\/\$\{[a-zA-Z]+\}\/sign`/)
    expect(apps).not.toMatch(/id: "sec-contract"/)
  })

  it('⚠️ ولا «ابدأ التهيئة» بين القرارات', async () => {
    const { DECISIONS, RECOMMENDED_ACTIONS } = await import('@/application/trainer/decisions')
    expect(DECISIONS.map((d) => d.action)).not.toContain('start_onboarding')
    expect(RECOMMENDED_ACTIONS).not.toContain('start_onboarding')
  })

  it('⚠️ والعقد في «التجهيز»: يركّب نصه ويرسل ويعتمد توقيعه', () => {
    expect(prep).toMatch(/function ContractStep\(/)
    expect(prep).toContain('/contract-prefill`')
    expect(apps).toMatch(/<PreparationSteps\b/)
  })
})

describe('موضع الحذف', () => {
  it('⚠️ مطويّ ولا يجاور أزرار القرار — زرّ لا ينقر ينقر يوما بالخطأ', () => {
    expect(apps, 'لا طيّ للحذف').toMatch(/purgeOpen/)
    /* وشريطُ القرار اللاصقُ لا يحمل زرَّ حذف */
    /* ويُعرف بلصوقه أيًّا كان عرضُه: صار يلصق من `lg` وحدَها (٣٠ سبتمبر ٢٠٢٦)،
       ثمّ صار صفَّ الأزرار وحدَه بنغمةٍ صلبةٍ قبل أصنافه (١ أكتوبر ٢٠٢٦) */
    const bar = /<Card\b[^>]*?className="(?:[^"]*\s)?(?:[\w-]+:)?sticky\s[^"]*"[\s\S]*?<\/Card>/.exec(apps)?.[0] ?? ''
    expect(bar, 'لا شريط قرار').not.toBe('')
    expect(bar, 'زرّ الحذف عاد إلى شريط القرار').not.toMatch(/setPurging/)
  })
})

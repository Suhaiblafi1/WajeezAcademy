/* أربعةُ تغييراتٍ في ملفّ المتقدّم (١٤ سبتمبر ٢٠٢٦) — بنيةٌ لا نصّ.

   ═══ ١) الكتالوجُ يُطلب، وإلّا طُبعت المعرّفاتُ خاما ═══

   `courses` في `@/data/courses` تُبنى **لحظةَ استيراد الوحدة** من كتالوجٍ
   يبدأ فارغا ويُحمَّل كسولا (البند ع-١). ومن يملؤه `usePublishedContent()`،
   ولم تكن تناديه لا شاشةُ الطلبات ولا صفحةُ الرابط. فقرأ صاحبُ المنصّة
   «C-BIZ-101» مكانَ اسم الدورة — وهو أهمُّ ما في الطلب.

   ═══ ٢) الأدمنُ يكتب اسمَ الاقتراح بنفسه ═══
   ═══ ٣) والاتفاقُ الماليُّ في نموذج القارئ ═══
   ═══ ٤) وقسمانِ ذهبا من شاشة المدرّب ═══ */
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

describe('أسماءُ الدورات تُقرأ أسماءً', () => {
  it('⚠️ الملفُّ يطلب الكتالوجَ بنفسه — فلا يُطبع المعرّفُ خاما في شاشةٍ ولا في رابط', () => {
    expect(dossier, 'لا يقرأ أسماءَ الدورات أصلا').toMatch(/courseById\(/)
    expect(dossier, 'يقرأ الأسماءَ ولا يطلب الكتالوجَ — فتعود فارغةً ويُطبع المعرّف')
      .toMatch(/usePublishedContent\(\)/)
  })

  it('والموضعُ في الملفّ لا في الشاشتَين — فمن أضاف شاشةً ثالثةً لا يحتاج أن يتذكّر', () => {
    /* لو كان النداءُ في `TrainerApplications` وحدَها لبقيت صفحةُ الرابط مكسورة */
    expect(dossier).toMatch(/usePublishedContent/)
  })
})

describe('الأدمنُ يكتب اسمَ الاقتراح', () => {
  it('المحرّرُ معروضٌ في الملفّ، وينادي المسارَ القائم', () => {
    expect(apps).toMatch(/<ProposalsEditor/)
    expect(editor).toContain('/teachable-proposals')
    expect(routes).toContain("app.put('/api/admin/trainer-applications/:id/teachable-proposals'")
  })

  it('⚠️ ولا يُفتح «اربِطها» لصفٍّ لم يُحفظ — الخادمُ يقرأ الاقتراحَ بترتيبه من القاعدة', () => {
    /* صفٌّ في الشاشة وحدَها يُربط بغيره أو بفراغ: الترتيبُ يُرسَل رقما،
       والخادمُ يعدّ به صفوفَ القاعدة لا صفوفَ المتصفّح. */
    expect(editor, 'لا يفرّق بين المحفوظ وما لم يُحفظ').toMatch(/const persisted =/)
    expect(editor, 'الزرُّ مفتوحٌ لصفٍّ لم يُحفظ').toMatch(/disabled=\{!persisted\}/)
  })

  it('والفقرةُ التي كتبها هو تبقى معروضةً — لا تُمحى ولا تُقسَّم تخمينا', () => {
    expect(editor).toMatch(/\{teachableOther\}/)
  })

  it('وحدُّ العشرين يُقرأ من مصدره لا يُكتب رقما', () => {
    expect(editor, 'رقمٌ مكتوبٌ بدل `MAX_PROPOSALS`').toMatch(/MAX_PROPOSALS/)
  })
})

describe('الاتفاقُ الماليّ', () => {
  it('حقلانِ في نموذج القارئ يُرسَلان مع التقييم', () => {
    expect(shared).toMatch(/feeExpectationAr:/)
    expect(shared).toMatch(/feeProposalAr:/)
  })

  it('⚠️ ونصٌّ لا رقم — الوحدةُ والعملةُ تختلفان، والمدى ليس رقما', () => {
    /* `type="number"` هنا يجبر القارئَ على اختراع دقّةٍ لا يملكها */
    const block = /الاتفاقُ الماليّ[\s\S]*?<\/fieldset>/.exec(shared)?.[0] ?? ''
    expect(block, 'لا كتلةَ للاتفاق الماليّ').not.toBe('')
    expect(block, 'خانةٌ رقميّةٌ لما يُقال مدى').not.toMatch(/type="number"/)
  })

  it('ويُقرآن في شاشة القرار — فمن قرأ الحكمَ رأى ما دار في المال', () => {
    expect(apps).toMatch(/r\.feeExpectationAr/)
    expect(apps).toMatch(/r\.feeProposalAr/)
  })
})

describe('ما ذهب من شاشة المدرّب', () => {
  it('تقييمُ الدرس التجريبيّ والمراجعُ المهنيّة — ولا بقايا نماذجَ لهما', () => {
    expect(ops, 'عاد قسمُ الديمو').not.toMatch(/id="sec-demo"/)
    expect(ops, 'عاد قسمُ المراجع').not.toMatch(/id="sec-references"/)
    expect(ops, 'بقي نموذجُ الروبرك بلا قسمٍ يستعمله').not.toMatch(/function RubricInput/)
  })

  it('والعقدُ والمقابلاتُ باقيان — لم يُحذف ما لم يُطلب حذفُه', () => {
    expect(ops).toMatch(/id="sec-contract"/)
    expect(ops).toMatch(/id="sec-interviews"/)
  })
})

describe('موضعُ الحذف', () => {
  it('⚠️ مطويٌّ ولا يُجاور أزرارَ القرار — زرٌّ لا يُنقر يُنقر يوما بالخطأ', () => {
    expect(apps, 'لا طيَّ للحذف').toMatch(/purgeOpen/)
    /* وشريطُ القرار اللاصقُ لا يحمل زرَّ حذف */
    const bar = /<Card className="sticky top-0[\s\S]*?<\/Card>/.exec(apps)?.[0] ?? ''
    expect(bar, 'لا شريطَ قرار').not.toBe('')
    expect(bar, 'زرُّ الحذف عاد إلى شريط القرار').not.toMatch(/setPurging/)
  })
})

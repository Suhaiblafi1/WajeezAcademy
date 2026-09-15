/* ═══ خطوةُ المهامّ: لائحةٌ يليها فعل، لا نموذجٌ تتقدّمه لائحة ═══

   قال صاحبُ المنصّة (١٥ سبتمبر ٢٠٢٦): «في مرحلة المهامّ والواجبات — هنا
   التصميمُ مبعثر. يجب أن تكون لائحةُ المهامّ التي قدّمها مع حقّ التعديل
   والحذف، وإضافةُ مهمّةٍ جديدةٍ تفتح انسدالا يقوم بتعديل المطلوب فيها
   ويؤكّد».

   وكانت ثمانيةُ حقولٍ مفتوحةً تحت اللائحة **أبدا**: عنوانٌ وتعليماتٌ
   ومرفقاتٌ ونوعٌ ودرجةٌ وموعد. فمن فتح الخطوةَ ليراجع مهامَّه وجد نفسَه في
   نموذجِ إنشاء، ولا يُرى من لائحته إلّا صدرُها.

   والفحصُ على البنية: رايةٌ تحكم الظهور، وزرٌّ يفتحها، و«عدّل» يفتح
   الانسدالَ نفسَه لا شاشةً ثانية. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const WS = code('src/pages/trainer/CohortWorkspace.tsx')
/** جسدُ خطوة المهامّ وحدَها — لا الشاشةُ كلُّها */
const stage = WS.slice(WS.indexOf('stage === "assignments"'), WS.indexOf('{pendingModule && ('))

describe('المهامُّ: لائحةٌ ثمّ انسدال', () => {
  it('⚠️ النموذجُ مطويٌّ بدءا — وكان مفتوحا أبدا', () => {
    expect(WS, 'لا رايةَ تحكم الانسدال').toMatch(/const \[taskFormOpen, setTaskFormOpen\] = useState\(false\)/)
    expect(stage, 'النموذجُ لا يخضع للراية').toMatch(/\{!taskFormOpen \? \(/)
  })

  it('وزرٌّ يفتحه — وإلّا فرايةٌ مطويّةٌ لا بابَ إليها', () => {
    expect(stage).toMatch(/onClick=\{\(\) => setTaskFormOpen\(true\)\}/)
    expect(stage).toContain('+ مهمّةٌ جديدة')
  })

  it('و«عدّل» يفتح الانسدالَ نفسَه — لا شاشةً ثانيةً ولا حقولٌ تُكرَّر', () => {
    const edit = WS.slice(WS.indexOf('const editAssessment ='))
    expect(edit.slice(0, edit.indexOf('\n  }')), 'التعديلُ يفتح نموذجا مطويّا فلا يُرى').toContain('setTaskFormOpen(true)')
  })

  it('والإغلاقُ يطوي ويُفرغ — وإلّا بقي ما كُتب لمهمّةٍ في نموذج التالية', () => {
    const cancel = /const cancelEdit = \(\) => \{([^}]*)\}/.exec(WS)
    expect(cancel, 'لا مُلغِيَ أصلا').toBeTruthy()
    const body = cancel![1]
    expect(body, 'الانسدالُ يبقى مفتوحا بعد الإلغاء').toContain('setTaskFormOpen(false)')
    expect(body, 'ما كُتب يبقى في الحقول').toContain('setTaskForm(blankTask)')
    expect(body, 'مرفقاتُ السابقة تبقى').toContain('setTaskAttachments([])')
  })

  it('واللائحةُ باقيةٌ بحقَّي التعديل والحذف — وهي أصلُ الخطوة', () => {
    expect(stage).toMatch(/onClick=\{\(\) => editAssessment\(a\)\}/)
    expect(stage).toMatch(/onClick=\{\(\) => setPendingDelete\(a\)\}/)
    /* وما سُلّم فيه لا يُحذف — الشرطُ قائمٌ بعد إعادة الترتيب */
    expect(stage, 'صار يُحذف ما سلّم فيه متعلّمون').toMatch(/disabled=\{busy \|\| a\.submissions > 0\}/)
  })

  it('والتأكيدُ في الانسدال — «يقوم بتعديل المطلوب فيها ويؤكّد»', () => {
    expect(stage).toMatch(/onClick=\{saveAssessment\}/)
    expect(stage).toContain('أكِّدِ المهمّة')
  })
})

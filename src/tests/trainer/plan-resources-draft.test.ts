/* ═══ المصادرُ تُغلَق: مسوّدةٌ لا صفّ، ومصدرٌ واحدٌ، وعطبان صامتان (م٣) ═══

   أربعةُ أحكامٍ من قرار صاحب المنصّة (١٧ سبتمبر ٢٠٢٦):

     ١ · نقرةُ «أضف» تفتح **مسوّدةً** لا صفًّا حقيقيّا — فلا يقفل صفٌّ فارغٌ
         زرَّ الحفظ على اللوحة كلِّها. ولها × وزرُّ إلغاءٍ وEsc: ثلاثةُ مخارج.
     ٢ · مصدرٌ واحدٌ يُختار **قبل ظهور أيّ حقل**: يُحذف حقلُ الرابط الثاني،
         ولخانة «كتبٌ وملفّات» زرّان. فالحالةُ الخاطئةُ لا يمكن التعبيرُ
         عنها بدل أن تُشرَح بجملة.
     ٣ · عطبٌ صامت: ملفٌّ يُرفع في خانة الكتب يبقى نوعُه «كتاب» مدى الحياة،
         فيراه المتعلّمُ كتابا وهو مستند.
     ٤ · وعطبٌ صامتٌ ثانٍ: «أزِل» يُسقط الصفَّ ولا يحذف الملفَّ من التخزين.

   ── والثالثُ يُشفى في الإسقاط لا في الشاشة وحدَها ──

   صفوفٌ حُفظت بالنوع الخاطئ قبل الإصلاح باقيةٌ في القاعدة. فإصلاحُ الكتابة
   يمنع الجديدَ ولا يشفي القديم — والاشتقاقُ في الإسقاط يشفيهما معا.

   ── ثمّ صارت المصادرُ قائمةً مضغوطةً بخانة رفعٍ واحدة (١١ أكتوبر ٢٠٢٦) ──

   «احذفوا اختيارَ "ارفع ملفّا / أضف رابطا" قبل الرفع: خانةٌ واحدةٌ تقبل الإفلاتَ أو
   لصقَ رابط، وتعرف النوعَ وحدَها» (ملفُّ صاحب المنصّة). فذهبت المسوّدة: الصفُّ لا
   يُكتب إلّا كاملا — بعد أن يُرفع ملفُّه أو يُلصق رابطُه، باسمٍ أوّلَ يعدّله. والحكمُ
   الأوّلُ والثاني باقيان بغير صورتهما: لا صفَّ فارغا يقفل الحفظ، ولا ملفٌّ ورابطٌ
   في صفٍّ واحد. والثالثُ والرابعُ كما هما. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { displayKind, projectPlanForLearner } from '@/application/trainer/plan-overlay'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*(\/\/|--).*$/gm, '')

const WS = code('src/pages/trainer/CohortWorkspace.tsx')
/** كتلةُ المصادر وحدَها — الملفُّ فيه ستُّ خطواتٍ لكلٍّ حقولُها.

    وانتقلت الكتلةُ إلى درجة «المهامّ والمصادر» (٢٧ سبتمبر ٢٠٢٦)، وأصنافُها
    تُقرأ من `resourceCats` — الثلاثةُ لشعبةٍ اعتُمدت قبل المواعيد، واثنان
    بعدها (المسجَّلُ صار في «اللقاءات»). والمقتطَعُ من أصنافها إلى لوحة
    التسليمات تحتها. */
const LIST = code('src/pages/trainer/PlanResources.tsx')
const RL = code('src/application/trainer/resource-list.ts')
/** كتلةُ المصادر في الدرجة — من القائمة إلى لوحة التسليمات تحتها */
const RES = (() => {
  const from = WS.indexOf('<PlanResources')
  const to = WS.indexOf('<CohortSubmissions', from)
  expect(from, 'لا كتلة مصادر').toBeGreaterThan(-1)
  expect(to, 'الكتلة بلا نهاية').toBeGreaterThan(from)
  return WS.slice(from, to)
})()

describe('③ ملفّ في خانة الكتب لا يبقى «كتابا»', () => {
  it('⚠️ الاشتقاق: صنف صريح ومعه ملفّ ← «ملفّ» لا «كتاب»', () => {
    expect(displayKind({ category: 'reading', kind: 'book', bodyFileKey: 'k/1.pdf' })).toBe('file')
    expect(displayKind({ category: 'reading', kind: 'book', bodyFileKey: null })).toBe('book')
    expect(displayKind({ category: 'recorded', kind: 'book' })).toBe('video')
    expect(displayKind({ category: 'public', kind: 'book' })).toBe('link')
  })

  it('⚠️ وما لا صنف صريح له يصدّق نوعه — لا يحوّل `audiobook` إلى `book`', () => {
    /* صفوفُ ما قبل عمود `category` اختار أصحابُها نوعَها من الستّة،
       واشتقاقُها يُضيّع تمييزا قصدوه. */
    expect(displayKind({ kind: 'audiobook' })).toBe('audiobook')
    expect(displayKind({ category: null, kind: 'audiobook', bodyFileKey: 'k/1.pdf' })).toBe('audiobook')
    expect(displayKind({ category: 'ليس صنفا', kind: 'audiobook' })).toBe('audiobook')
  })

  it('⚠️ والإسقاط إلى المتعلّم يشفي ما حفظ خطأ — بلا ترحيل', () => {
    const out = projectPlanForLearner({
      status: 'approved',
      content: {
        modules: [],
        resources: [
          { title: 'كرّاسة', category: 'reading', kind: 'book', bodyFileKey: 'plan/1.pdf', bodyFileName: 'a.pdf' },
          { title: 'كتاب على الشبكة', category: 'reading', kind: 'book', url: 'https://x.test/b' },
          { title: 'قديم بلا صنف', kind: 'audiobook', url: 'https://x.test/c' },
        ],
      },
    })
    expect(out, 'لم يسقط شيء').not.toBeNull()
    expect(out!.resources.map((r) => r.kind), 'النوع المعروض لم يشتقّ').toEqual(['file', 'book', 'audiobook'])
  })

  it('⚠️ والشاشة تعيد اشتقاقه مع كلّ تعديل — لا مرّة عند الإنشاء', () => {
    expect(RES, 'التعديل لا يعيد اشتقاق النوع')
      .toContain('kind: kindForCategory(resourceCategory(merged), Boolean((merged.bodyFileKey ?? "").trim()))')
  })
})

describe('① لا يدخل الخطّة صفّ ناقص — فلا يقفل الحفظ على اللوحة', () => {
  it('⚠️ الصفّ يكتب بعد أن يرفع ملفّه أو يلصق رابطه — كاملا', () => {
    expect(RES, 'ما زال صفّ فارغ يدفع إلى الخطّة').not.toMatch(/resources: \[\.\.\.(?:content|c)\.resources, \{ title: "", url: ""/)
    expect(LIST, 'صفّ فارغ يضاف').not.toMatch(/onAdd\(\{ title: ""/)
    const one = LIST.slice(LIST.indexOf('const uploadOne'), LIST.indexOf('const uploadAll'))
    expect(one.indexOf('if (!put.ok)'), 'يضاف الصفّ قبل أن يكتمل رفعه').toBeLessThan(one.indexOf('onAdd(rowFromFile('))
    expect(LIST, 'يضاف رابط ليس رابطا').toMatch(/if \(!isResourceUrl\(link\)\) return;\s*onAdd\(rowFromUrl\(link\)\);/)
  })

  it('⚠️ والصفّ الجديد باسم أوّل لا يقصر عن حدّ الخطّة — فلا يمنع الحفظ', () => {
    expect(RL).toContain('const padTitle = (t: string) => (t.length >= PLAN_TITLE_MIN ?')
    expect(RL).toMatch(/title: titleFromFileName\(file\.name\)/)
    expect(RL).toMatch(/title: titleFromUrl\(url\)/)
  })

  it('ولا مسوّدة بقيت — ولا ما يغلقها', () => {
    expect(WS).not.toMatch(/const \[draft, setDraft\] = useState</)
    expect(WS).not.toContain('cancelDraft')
  })
})

describe('② مصدر واحد في الصفّ — والخانة تعرف نوعه وحدها', () => {
  it('⚠️ لا «ارفع ملفّا / أضف رابطا» يختار قبل الرفع', () => {
    expect(LIST).not.toContain('أضف رابط كتاب')
    expect(LIST).not.toContain('draft.source')
    expect(LIST).toContain('أفلت الملفّات هنا، أو الصق رابطا')
  })

  it('⚠️ والصفّ بملفّ لا يعرض فيه حقل رابط — فلا يجتمعان', () => {
    expect(LIST).toMatch(/\{!\(r\.bodyFileKey \?\? ""\)\.trim\(\) && \(\s*<input dir="ltr" value=\{r\.url/)
  })
})

describe('④ الحذف يحذف الملفّ — بعد الحفظ لا قبله', () => {
  it('⚠️ الإزالة تقيّد المفتاح ليحذف', () => {
    const at = RES.indexOf('onRemove={(i) => {')
    expect(at, 'لا زرّ إزالة').toBeGreaterThan(-1)
    expect(RES.slice(at, at + 400), 'الإزالة تترك الملفّ في التخزين مدى الحياة').toContain('setOrphans((o) => [...o, key])')
    /* وزرٌّ واحدٌ بأيقونة — كانا «احذفه» و«أزل» بمعنيين متقاربين في الصفّ نفسِه */
    expect(LIST).toMatch(/icon=\{Trash2\}[\s\S]{0,300}onClick=\{\(\) => \{ if \(open === i\) setOpen\(null\); onRemove\(i\); \}\}/)
  })

  it('⚠️ والحذف بعد نجاح الحفظ — لا لحظة الإزالة', () => {
    /* الصفُّ ما زال في الخطّة المحفوظة حتّى يُحفظ ما بعده. فحذفُ الملفّ
       لحظةَ الإزالة يترك خطّةً محفوظةً تشير إلى ملفٍّ مُحيَ — وهو أسوأُ
       من ملفٍّ يتيم. */
    /* والحفظُ صار واحدا لكلّ الخطوات (`persist`، ٢٧ سبتمبر ٢٠٢٦) — والترتيبُ
       المحروسُ هو هو: الحذفُ بعد نجاح الحفظ. */
    const at = WS.indexOf('const persist =')
    expect(at, 'لا دالّة حفظ').toBeGreaterThan(0)
    const body = WS.slice(at, WS.indexOf('const gapsFor', at))
    const put = body.indexOf('apiPut(')
    const drop = body.indexOf('dropFile(')
    expect(put, 'لا حفظ').toBeGreaterThan(-1)
    expect(drop, 'الحفظ لا يفرغ اليتامى').toBeGreaterThan(-1)
    expect(drop, 'الحذف قبل الحفظ — فخطّة محفوظة تشير إلى ملفّ محي').toBeGreaterThan(put)
  })

  it('وسقوط الحذف يبتلع — لا يعطّل الحفظ لأجل ملفّ لم يحذف', () => {
    const at = WS.indexOf('const dropFile')
    expect(at, 'لا دالّة حذف').toBeGreaterThan(0)
    expect(WS.slice(at, at + 320)).toContain('catch {')
  })
})

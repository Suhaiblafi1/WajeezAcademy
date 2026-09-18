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
   يمنع الجديدَ ولا يشفي القديم — والاشتقاقُ في الإسقاط يشفيهما معا. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { displayKind, projectPlanForLearner } from '@/application/trainer/plan-overlay'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*(\/\/|--).*$/gm, '')

const WS = code('src/pages/trainer/CohortWorkspace.tsx')
/** كتلةُ المصادر وحدَها — الملفُّ فيه خمسُ خطواتٍ لكلٍّ حقولُها */
const RES = WS.slice(WS.indexOf('RESOURCE_CATEGORIES.map((cat)'), WS.indexOf('احفظ المصادر'))

describe('③ ملفٌّ في خانة الكتب لا يبقى «كتابا»', () => {
  it('⚠️ الاشتقاق: صنفٌ صريحٌ ومعه ملفٌّ ← «ملفّ» لا «كتاب»', () => {
    expect(displayKind({ category: 'reading', kind: 'book', bodyFileKey: 'k/1.pdf' })).toBe('file')
    expect(displayKind({ category: 'reading', kind: 'book', bodyFileKey: null })).toBe('book')
    expect(displayKind({ category: 'recorded', kind: 'book' })).toBe('video')
    expect(displayKind({ category: 'public', kind: 'book' })).toBe('link')
  })

  it('⚠️ وما لا صنفَ صريحَ له يُصدَّق نوعُه — لا يُحوَّل `audiobook` إلى `book`', () => {
    /* صفوفُ ما قبل عمود `category` اختار أصحابُها نوعَها من الستّة،
       واشتقاقُها يُضيّع تمييزا قصدوه. */
    expect(displayKind({ kind: 'audiobook' })).toBe('audiobook')
    expect(displayKind({ category: null, kind: 'audiobook', bodyFileKey: 'k/1.pdf' })).toBe('audiobook')
    expect(displayKind({ category: 'ليس صنفا', kind: 'audiobook' })).toBe('audiobook')
  })

  it('⚠️ والإسقاطُ إلى المتعلّم يشفي ما حُفظ خطأً — بلا ترحيل', () => {
    const out = projectPlanForLearner({
      status: 'approved',
      content: {
        modules: [],
        resources: [
          { title: 'كرّاسة', category: 'reading', kind: 'book', bodyFileKey: 'plan/1.pdf', bodyFileName: 'a.pdf' },
          { title: 'كتابٌ على الشبكة', category: 'reading', kind: 'book', url: 'https://x.test/b' },
          { title: 'قديمٌ بلا صنف', kind: 'audiobook', url: 'https://x.test/c' },
        ],
      },
    })
    expect(out, 'لم يُسقَط شيء').not.toBeNull()
    expect(out!.resources.map((r) => r.kind), 'النوعُ المعروضُ لم يُشتقّ').toEqual(['file', 'book', 'audiobook'])
  })

  it('⚠️ والشاشةُ تُعيد اشتقاقَه مع كلّ تعديل — لا مرّةً عند الإنشاء', () => {
    expect(RES, 'التعديلُ لا يُعيد اشتقاقَ النوع')
      .toContain('kind: kindForCategory(resourceCategory(merged), Boolean((merged.bodyFileKey ?? "").trim()))')
  })
})

describe('① «أضف» تفتح مسوّدةً لا صفًّا حقيقيّا', () => {
  it('⚠️ لا يُدفَع صفٌّ فارغٌ إلى الخطّة — فلا يُقفَل الحفظُ على اللوحة', () => {
    /* كانت `resources: [...content.resources, { title: "", url: "", … }]`،
       وشرطُ زرِّ الحفظ يقرؤه ناقصا فيُقفِل الحفظَ على المصادر كلِّها. */
    expect(RES, 'ما زال «أضف» يدفع صفًّا فارغا').not.toMatch(/resources: \[\.\.\.content\.resources, \{ title: "", url: ""/)
    expect(RES, 'لا مسوّدةَ تُفتح').toContain('setDraft({')
    expect(WS, 'لا حالةَ للمسوّدة').toMatch(/const \[draft, setDraft\] = useState</)
  })

  it('⚠️ وثلاثةُ مخارج: × وزرُّ إلغاءٍ وEsc', () => {
    expect(RES, 'لا زرَّ إغلاقٍ (×)').toContain('aria-label="أغلِق المسوّدة"')
    expect(RES, 'لا زرَّ إلغاء').toMatch(/onClick=\{cancelDraft\}>ألغِ</)
    expect(WS, 'لا يُغلقها Escape').toMatch(/if \(e\.key === "Escape"\) cancelDraft\(\)/)
  })

  it('⚠️ وإلغاؤها يحذف ملفَّها فورا — لم تدخل الخطّةَ قطّ', () => {
    const at = WS.indexOf('const cancelDraft')
    expect(at, 'لا دالّةَ إلغاء').toBeGreaterThan(0)
    expect(WS.slice(at, at + 500), 'الإلغاءُ يترك ملفّا يتيما').toContain('apiDelete(`/api/trainer/cohorts/${id}/files/')
  })

  it('ولا تُفتح مسوّدتان معا — زرُّ الإضافة يُقفَل ما دامت واحدةٌ مفتوحة', () => {
    expect(RES).toMatch(/disabled=\{locked \|\| draft !== null\}/)
  })
})

describe('② مصدرٌ واحدٌ يُختار قبل ظهور أيّ حقل', () => {
  it('⚠️ حقلُ الرابط الثاني تحت الرفع زال', () => {
    /* كان في خانة الكتب حقلُ رفعٍ وحقلُ رابطٍ تحته، فيملؤهما مدرّبٌ معا
       ولا شيءَ يقول أيُّهما يصل المتعلّم. */
    expect(RES, 'عاد حقلُ الرابط الثاني').not.toContain('أو رابطٌ إليه — https://…')
    expect(RES, 'حقلُ الرابط ما زال يُعرض مع الرفع في صفٍّ واحد')
      .toMatch(/cat === "reading" && hasFile \? \(/)
  })

  it('⚠️ وللكتب زرّان يُختار أحدُهما قبل أيّ حقل', () => {
    const at = RES.indexOf('draft.source === null')
    expect(at, 'لا اختيارَ مصدرٍ قبل الحقول').toBeGreaterThan(-1)
    const choose = RES.slice(at, RES.indexOf('draft.row.title', at))
    expect(choose, 'لا زرَّ رفع').toContain('ارفع ملفّا')
    expect(choose, 'لا زرَّ رابط').toContain('أضِف رابطَ كتاب')
    expect(choose, 'الحقولُ تظهر قبل الاختيار').not.toContain('ModuleBodyUpload')
  })

  it('والخانتان الأخريان رابطٌ وحدَه — فلا يُسأل عمّا لا خيارَ فيه', () => {
    expect(RES).toMatch(/source: cat === "reading" \? null : "url"/)
  })
})

describe('④ «أزِل» تحذف الملفَّ — بعد الحفظ لا قبله', () => {
  it('⚠️ الإزالةُ تُقيّد المفتاحَ ليُحذف', () => {
    const at = RES.indexOf('>أزل<')
    expect(at, 'لا زرَّ إزالة').toBeGreaterThan(-1)
    const btn = RES.slice(Math.max(0, at - 500), at)
    expect(btn, 'الإزالةُ تترك الملفَّ في التخزين مدى الحياة').toContain('setOrphans((o) => [...o, key])')
  })

  it('⚠️ والحذفُ بعد نجاح الحفظ — لا لحظةَ الإزالة', () => {
    /* الصفُّ ما زال في الخطّة المحفوظة حتّى يُحفظ ما بعده. فحذفُ الملفّ
       لحظةَ الإزالة يترك خطّةً محفوظةً تشير إلى ملفٍّ مُحيَ — وهو أسوأُ
       من ملفٍّ يتيم. */
    const at = WS.indexOf('const savePlan =')
    expect(at, 'لا دالّةَ حفظ').toBeGreaterThan(0)
    const body = WS.slice(at, at + 700)
    const put = body.indexOf('apiPut(')
    const drop = body.indexOf('dropFile(')
    expect(put, 'لا حفظ').toBeGreaterThan(-1)
    expect(drop, 'الحفظُ لا يُفرغ اليتامى').toBeGreaterThan(-1)
    expect(drop, 'الحذفُ قبل الحفظ — فخطّةٌ محفوظةٌ تشير إلى ملفٍّ مُحيَ').toBeGreaterThan(put)
  })

  it('وسقوطُ الحذف يُبتلع — لا يُعطَّل الحفظُ لأجل ملفٍّ لم يُحذف', () => {
    const at = WS.indexOf('const dropFile')
    expect(at, 'لا دالّةَ حذف').toBeGreaterThan(0)
    expect(WS.slice(at, at + 320)).toContain('catch {')
  })
})

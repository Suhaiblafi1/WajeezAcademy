/* طابورُ طلبات التغيير في «الكتالوج» (٢٦ أكتوبر ٢٠٢٦، المرحلة الثامنة — ب).

   ① كلُّ طلبٍ يُقرأ بكلمات: ما يطلبه وعلى أيّ شيء، وما يقع إن اعتُمد (`change-request-view.ts`). كان «دورة ·
      C-MKT-104» وعددَ قراراته.
   ② وبجانبه «اعتمد» و«ارفض» لمن يملك القرار — لا «طلب تعديل» بملاحظةٍ ثابتةٍ لا يُعدَّل الطلبُ بعدها.
   ③ وصندوقُ JSON ذهب: اسمُ كلّ دورةٍ حقلٌ في قائمتها، يكتبه بابُ الاسم نفسُه.
   ④ ونصوصُ ذلك بلا تشكيل.

   وما يقع في القاعدة — لا يُنزَل منشور، والاسمُ يُنشر — في `server/tests/catalog/change-request-queue.test.ts`. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { changeRequestView } from '@/application/catalog/change-request-view'
import ChangeRequestItem, { type QueuedChangeRequest } from '@/components/admin/ChangeRequestItem'
import { markedTexts } from '../helpers/marked-text'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/* الشيفرةُ بلا تعليقاتها — فلا يُطابَق نصٌّ في شرح */
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
const PAGE = code('src/pages/admin/CatalogAdmin.tsx')

describe('① كل طلب يقرأ بكلمات', () => {
  it('⚠️ اسم دورة: اسمها الآن والجديد، واعتماده يكتبه في الموقع', () => {
    const v = changeRequestView({
      entityType: 'course', entityId: 'C-MKT-104', entityLabelAr: 'التسويق الرقمي', entityStatus: 'published',
      payload: { kind: 'course_rename', titleAr: 'التسويق بالمحتوى', fromTitleAr: 'التسويق الرقمي' },
    })
    expect(v).toMatchObject({ kindAr: 'اسم دورة', subjectAr: 'التسويق الرقمي', renameTo: 'التسويق بالمحتوى', blockedAr: null })
    expect(v.lines).toEqual(['الاسم الجديد: «التسويق بالمحتوى»'])
    expect(v.approveAr).toBe('يتغير اسمها في الموقع الآن.')
  })

  it('والطلب العام { titleAr } يرفع المسودة معه — ولا يعد باسم لدورة لا صف لها', () => {
    const draft = changeRequestView({ entityType: 'course', entityId: 'C-X', entityLabelAr: 'دورة', entityStatus: 'draft', payload: { titleAr: 'اسم' } })
    expect(draft.approveAr).toBe('يتغير اسمها في الموقع الآن. تجهز المسودة للنشر وتظهر مع النشر التالي.')
    const live = changeRequestView({ entityType: 'course', entityId: 'C-X', entityLabelAr: 'دورة', entityStatus: 'published', payload: { titleAr: 'اسم' } })
    expect(live.approveAr, 'وعد المنشورة بأن تجهز للنشر').toBe('يتغير اسمها في الموقع الآن.')
    const none = changeRequestView({ entityType: 'course', entityId: 'C-NONE', entityStatus: null, payload: { titleAr: 'اسم' } })
    expect(none).toMatchObject({ renameTo: null, approveAr: 'لا دورة بهذا الرمز. الاعتماد قرار فقط.' })
  })

  it('والمثال «الاسم الجديد» لا يعتمد — والسبب مكتوب', () => {
    const v = changeRequestView({ entityType: 'course', entityId: 'C-X', entityStatus: 'published', payload: { titleAr: 'الاسم الجديد' } })
    expect(v.blockedAr).toBe('«الاسم الجديد» مثال وليس اسما. ارفضه.')
  })

  it('⚠️ مهارة تطلب: اسمها ورمزها وسببها — واعتمادها لا ينشئها', () => {
    const v = changeRequestView({
      entityType: 'skill', entityId: 'k-slug', entityLabelAr: null, entityStatus: null,
      payload: { kind: 'skill_request', slug: 'k-slug', nameAr: 'مهارة التفاوض', reasonAr: 'تحتاجها دورة المبيعات' },
    })
    expect(v).toMatchObject({ kindAr: 'مهارة جديدة', subjectAr: 'مهارة التفاوض', renameTo: null })
    expect(v.lines).toEqual(['رمزها: k-slug', 'السبب: تحتاجها دورة المبيعات'])
    expect(v.approveAr).toBe('لا ينشئها. تنشأ بعده من «مهارة جديدة» في هذه الصفحة.')
  })

  it('⚠️ مسار جديد: اسمه وما فيه — واعتماده يجهزه للنشر', () => {
    const v = changeRequestView({
      entityType: 'pathway', entityId: 'PW-X', entityLabelAr: 'مسار القيادة', entityStatus: 'draft',
      payload: { action: 'create', courseIds: ['a', 'b', 'c'], goals: ['g'], personas: ['p', 'q'] },
    })
    expect(v).toMatchObject({ kindAr: 'مسار جديد', subjectAr: 'مسار القيادة' })
    expect(v.lines).toEqual(['دوراته: 3 · أهدافه: 1 · شخصياته: 2'])
    expect(v.approveAr).toBe('تجهز المسودة للنشر وتظهر مع النشر التالي.')
  })

  it('واقتراح المدرب القديم يقرأ — ولا يقرأ اسمه اسما لهذه الدورة', () => {
    const v = changeRequestView({
      entityType: 'course', entityId: 'C-PROPOSED-1', entityStatus: null,
      payload: { kind: 'trainer_new_course', titleAr: 'تحليل الأثر', fromApplication: { fullName: 'سارة', reference: 'TR-1' }, trainerWordsAr: 'بقلمها' },
    })
    expect(v).toMatchObject({ kindAr: 'دورة مقترحة', subjectAr: 'تحليل الأثر', renameTo: null })
    expect(v.lines).toEqual(['اقترحها سارة (TR-1)', 'بقلمه: بقلمها'])
    expect(v.approveAr).toBe('قرار فقط. لا ينشئ دورة.')
  })

  it('وطلب الصندوق القديم يقول إن الاعتماد لا يطبق حقوله', () => {
    const v = changeRequestView({
      entityType: 'course', entityId: 'C-X', entityLabelAr: 'دورة', entityStatus: 'published',
      payload: { objectives: ['x'], skillIds: [] },
    })
    expect(v).toMatchObject({ kindAr: 'طلب قديم', lines: ['حقوله: objectives، skillIds'] })
    expect(v.approveAr).toBe('لا يطبق شيئا من حقوله.')
  })
})

const RENAME: QueuedChangeRequest = {
  entityType: 'course', entityId: 'C-MKT-104', entityLabelAr: 'التسويق الرقمي', entityStatus: 'published',
  status: 'in_review', createdAt: '2026-10-26T10:00:00Z', payload: { kind: 'course_rename', titleAr: 'التسويق بالمحتوى' },
}
const html = (cr: QueuedChangeRequest, canDecide: boolean) =>
  renderToStaticMarkup(createElement(ChangeRequestItem, { cr, status: null, canDecide, busy: false, onDecide: () => {} }))
const buttons = (h: string) => [...h.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)]
  .map((m) => ({ tag: m[0].slice(0, m[0].indexOf('>') + 1), label: m[1]!.replace(/<[^>]+>/g, '').trim() }))

describe('② اعتمد أو ارفض — لمن يملك القرار', () => {
  it('⚠️ ينتظر قرارا: «اعتمد» و«ارفض» وما يقع بكل منهما — والاسم لا المعرف', () => {
    const h = html(RENAME, true)
    expect(buttons(h).map((b) => b.label)).toEqual(['اعتمد', 'ارفض'])
    expect(h).toContain('اعتمد:</b> يتغير اسمها في الموقع الآن.')
    expect(h).toContain('ارفض:</b> لا يتغير شيء.')
    expect(h).toContain('اسم دورة · التسويق الرقمي')
    expect(h, 'عرض المعرف بدل الاسم').not.toContain('C-MKT-104')
  })

  it('ومن لا يملك القرار يقرأ ولا يرى الزرين', () => {
    const h = html(RENAME, false)
    expect(buttons(h)).toEqual([])
    expect(h).toContain('يتغير اسمها في الموقع الآن.')
  })

  it('وما قرر لا زر له', () => {
    expect(buttons(html({ ...RENAME, status: 'applied' }, true))).toEqual([])
  })

  it('والمثال: «اعتمد» معطل والسبب مكتوب، و«ارفض» متاح', () => {
    const h = html({ ...RENAME, payload: { titleAr: 'الاسم الجديد' } }, true)
    const [approve, reject] = buttons(h)
    expect(approve!.tag, '«اعتمد» متاح على المثال').toMatch(/disabled=""/)
    expect(reject!.tag).not.toMatch(/disabled=""/)
    expect(h).toContain('مثال وليس اسما. ارفضه.')
  })

  it('⚠️ والصفحة تعطي الزرين لحبة مسار القرار وتمرر القرار كما هو — لا ملاحظة ثابتة', () => {
    expect(PAGE).toContain('const canDecide = me?.permissions.includes("catalog.pathway.review") ?? false;')
    const items = PAGE.match(/<ChangeRequestItem [^\n]*\/>$/gm) ?? []
    expect(items.length, 'الطابور لا يعرض البند المشترك').toBe(2)
    for (const item of items) expect(item).toContain('canDecide={canDecide}')
    expect(PAGE).toMatch(/apiPost<[^>]*>\(`\/api\/admin\/catalog\/change-requests\/\$\{cr\.id\}\/decision`, \{ decision \}\)/)
    expect(PAGE).not.toContain('request_changes')
    expect(PAGE).not.toContain('راجع التفاصيل')
  })

  it('وما ينتظر قرارا أولا، وما قرر مطوي تحته', () => {
    const waiting = PAGE.indexOf('{waitingCrs.map((cr) => (')
    const folded = PAGE.indexOf('<details', waiting)
    expect(waiting).toBeGreaterThan(-1)
    expect(folded, 'ما قرر ليس مطويا تحت ما ينتظر').toBeGreaterThan(waiting)
    expect(PAGE.indexOf('{decidedCrs.map((cr) => (', folded)).toBeGreaterThan(folded)
    expect(PAGE).toContain('const waitingCrs = crs.filter((cr) => cr.status === "in_review");')
  })

  it('وبند «ما ينتظرك» يصل الطابور مفتوحا', () => {
    expect(PAGE).toContain('const openRequests = params.get("requests") === "1";')
    expect(PAGE).toMatch(/if \(!openRequests \|\| overview === null \|\| requestsShown\.current\) return;\s*requestsShown\.current = true;\s*revealRow\("change-requests"\);/)
  })
})

describe('③ لا صندوق JSON — واسم كل دورة حقل', () => {
  it('⚠️ لا خانة JSON ولا مثالها في الشاشة', () => {
    expect(PAGE).not.toMatch(/JSON\.parse\(/)
    expect(PAGE).not.toMatch(/<textarea/)
    expect(PAGE).not.toContain('change-request-example')
    /* والطلبُ الوحيدُ الذي تكتبه الشاشةُ بعدُ طلبُ المهارة */
    const posts = PAGE.match(/apiPost\("\/api\/admin\/catalog\/change-requests", \{[\s\S]*?\}\);/g) ?? []
    expect(posts).toHaveLength(1)
    expect(posts[0]).toContain('kind: "skill_request"')
  })

  it('⚠️ «اسمها» لكل دورة لمن يعدل الدورات — بباب الاسم نفسه', () => {
    expect(PAGE).toMatch(/\{canEditCourse && \(\s*<Button\s+tone="ghost" size="sm"\s+aria-expanded=\{nameFor === c\.id\}/)
    expect(PAGE).toMatch(/apiPost<RenameResult>\(`\/api\/admin\/catalog\/courses\/\$\{c\.id\}\/rename`, \{ titleAr: next \}\),\s*renameDoneAr,/)
    expect(PAGE).toMatch(/disabled=\{!next \|\| next === c\.title\}/)
  })
})

describe('④ بلا تشكيل', () => {
  for (const f of [
    'src/application/catalog/change-request-view.ts',
    'src/components/admin/ChangeRequestItem.tsx',
    'src/pages/admin/CatalogAdmin.tsx',
  ]) {
    it(f, () => expect(markedTexts(f, read(f))).toEqual([]))
  }
})

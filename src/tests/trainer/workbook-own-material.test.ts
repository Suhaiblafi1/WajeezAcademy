/* ═══ مادّتُه الجاهزة بابٌ ثانٍ — والكرّاسةُ ملكُه (٧ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «ومن عنده PDF جاهز — أنُبقي له أن يرفعه بلا القالب؟». وكان
   الإقرارُ صندوقا واحدا، فمن عنده مادّةٌ جاهزةٌ إمّا أعاد صفَّها وإمّا أقرّ بما لم
   يكن. فاختار من أربعِ طرقٍ «Allow it, reviewer decides». وقال معه: «اوضح للمدرب
   بانه اذا استخدم التمبلت لا يعني نقل الحقوق لنا».

   وما يُحرس هنا:
     ① القاعدة: ما قاله يُقرأ بـ`workbookMaterialOf` ويُكتب بـ`MATERIAL_PATCH`، فلا
        يجتمعان — ومادّتُه الجاهزةُ تُتمّ الخطوةَ كالقالب، والسكوتُ لا يُتمّها.
     ② المخطّطُ يحملها في الكرّاستين، والشاشةُ تكتبها بالقاعدة لا بيدها.
     ③ المعتمِدُ يراها بلونٍ يُرى، ويُسمّى له ما رُفع بها في رأس المراجعة، ويُقال
        له الانتقالُ بين الاثنين فيما تغيّر.
     ④ والحقّ: النصُّ نفسُه بجانب القالب وفي صفحة المدرّب داخلَه وفي الدليل — ولا
        يقول أقلَّ ممّا في الاتفاقيّة ولا أكثر: إن تغيّر البندُ 10 سقط هذا ليُراجَع.

   والفحصُ على البنية: التعليقاتُ تُنزع قبل المطابقة. */
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import JSZip from 'jszip'
import {
  MATERIAL_PATCH, WORKBOOK_MATERIALS, WORKBOOK_RIGHTS_AR, ownMaterialLabels, workbookMaterialOf, workbooksProblems,
} from '@/application/trainer/cohort-workbooks'
import { curriculumView } from '@/application/trainer/curriculum-view'
import { planDiff } from '@/application/trainer/plan-diff'
import CurriculumReview from '@/components/CurriculumReview'
import { blankFill, workbookDocx } from '../../../server/services/workbook-docx'
import { GUIDE_SECTIONS } from '@/data/trainer-guide/content'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const IDS = ['m1', 'm2', 'm3']
const SLOTS = [
  { startsOn: '2026-12-01', endsOn: '2026-12-07', moduleIds: ['m1'] },
  { startsOn: '2026-12-08', endsOn: '2026-12-14', moduleIds: ['m2'] },
  { startsOn: '2026-12-15', endsOn: '2026-12-21', moduleIds: ['m3'] },
]
const url = (x: string) => ({ url: `https://x.test/${x}.pdf` })

describe('① القاعدة: القالبُ أو مادّتُه الجاهزة — وأيُّهما تتمّ به الخطوة', () => {
  it('⚠️ يُقرأ ما قاله — والقالبُ أوّلا إن اجتمعا في خطّةٍ قديمة', () => {
    expect(WORKBOOK_MATERIALS).toEqual(['template', 'own'])
    expect(workbookMaterialOf({ onTemplate: true })).toBe('template')
    expect(workbookMaterialOf({ ownMaterial: true })).toBe('own')
    expect(workbookMaterialOf({ onTemplate: false, ownMaterial: false })).toBeNull()
    expect(workbookMaterialOf(null)).toBeNull()
    expect(workbookMaterialOf({ onTemplate: true, ownMaterial: true })).toBe('template')
  })

  it('⚠️ وكلُّ اختيارٍ يُطفئ الآخر — فلا يبقى قالبٌ تحت مادّةٍ جاهزة', () => {
    let w = { ...url('a'), ...MATERIAL_PATCH.template }
    w = { ...w, ...MATERIAL_PATCH.own }
    expect(workbookMaterialOf(w), 'بقي القالبُ بعد أن اختار مادّتَه').toBe('own')
    w = { ...w, ...MATERIAL_PATCH.template }
    expect(workbookMaterialOf(w)).toBe('template')
  })

  it('⚠️ ومادّتُه الجاهزةُ تُتمّ الخطوةَ للجديد — في الطريقتين — والسكوتُ لا يُتمّها', () => {
    const req = { templateRequired: true }
    expect(workbooksProblems({ workbook: { ...url('wb'), ...MATERIAL_PATCH.own } }, IDS, req), 'رُدّت كرّاسةُ الدورة بمادّته').toEqual([])
    const groups = IDS.map((id) => ({ moduleIds: [id], ...url(id), ...MATERIAL_PATCH.own }))
    expect(workbooksProblems({ workbookMode: 'modules', workbooks: groups }, IDS, req), 'رُدّت كرّاساتُ المحاور بمادّته').toEqual([])
    const silent = workbooksProblems({ workbook: url('wb') }, IDS, req)
    expect(silent[0], 'تمّت الخطوةُ ولم يقل أيّهما').toContain('مادّتُك الجاهزة')
    expect(silent[0]).toContain('قالب وجيز')
  })
})

describe('② المخطّطُ يحملها، والشاشةُ تكتبها بالقاعدة', () => {
  it('⚠️ في مخطّط الحفظ: في كرّاسة الدورة وكرّاسات المحاور — وإلّا ضاعت صامتة', () => {
    const ROUTES = code('server/http/routes/learning-portal.routes.ts')
    const schema = ROUTES.slice(ROUTES.indexOf('const planContent'), ROUTES.indexOf("app.get('/api/trainer/cohorts/:id/workspace'"))
    expect(schema.match(/ownMaterial: z\.boolean\(\)\.nullish\(\)/g), 'مادّتُه تُسقَط من إحداهما').toHaveLength(2)
  })

  it('⚠️ والاختيارُ تحت كلّ كرّاسة يقرأ بالقاعدة ويكتب بها — والخياران بفرقهما', () => {
    const WS = code('src/pages/trainer/CohortWorkspace.tsx')
    expect(WS).toContain('<MaterialChoice id="tpl-course" value={workbookMaterialOf(wb)}')
    expect(WS).toContain('onChange={(m) => setWorkbook(MATERIAL_PATCH[m])}')
    expect(WS).toContain('value={workbookMaterialOf(g)}')
    expect(WS).toContain('onChange={(m) => patchGroup(i, MATERIAL_PATCH[m])}')
    const options = WS.slice(WS.indexOf('const MATERIAL_OPTIONS'), WS.indexOf('function MaterialChoice('))
    expect(options).toMatch(/value: "template", label: "كتبتُها على قالب وجيز"/)
    expect(options).toMatch(/value: "own", label: "مادّتي الجاهزة", hint: "[^"]*يراه المعتمِدُ[^"]*"/)
    const choice = WS.slice(WS.indexOf('function MaterialChoice('), WS.indexOf('function StageIntro('))
    expect(choice, 'صار اختيارا بلا زرّين').toMatch(/type="radio" name=\{id\}/)
    expect(choice).toContain('MATERIAL_OPTIONS.map(')
  })
})

describe('③ المعتمِدُ يرى ويقرّر', () => {
  const base = { kind: 'trainer', modules: IDS.map((moduleId, i) => ({ moduleId, titleAr: `محور ${i + 1}` })), resources: [], slots: SLOTS }
  const byModule = { ...base, workbookMode: 'modules', workbooks: [
    { moduleIds: ['m1'], ...url('m1'), ...MATERIAL_PATCH.template },
    { moduleIds: ['m2', 'm3'], ...url('m23'), ...MATERIAL_PATCH.own },
  ] }

  it('⚠️ في المنهج: مادّتُه الجاهزةُ تُقال بلونٍ يُرى', () => {
    const view = curriculumView({ title: 'ش', period: null, content: byModule, sessions: [], assessments: [], fileKey: null, fileName: null } as never)
    expect(view.moduleWorkbooks.map((w) => w.material)).toEqual(['template', 'own'])
    const html = renderToStaticMarkup(createElement(CurriculumReview, { view }))
    expect(html).toMatch(/class="font-bold text-gold-ink">· مادّةُ المدرّب الجاهزة — ليست على القالب</)
    expect(html).toContain('· على قالب وجيز')
  })

  it('⚠️ وفي رأس المراجعة يُسمّى ما رُفع بها — من الطريقة التي تصل المتعلّم وحدَها', () => {
    expect(ownMaterialLabels(byModule, IDS)).toEqual(['كرّاسةُ المحورين 2 و3'])
    expect(ownMaterialLabels({ ...byModule, workbook: { ...url('wb'), ...MATERIAL_PATCH.own } }, IDS),
      'سُمّيت كرّاسةُ الدورة وهي محفوظةٌ لا تصل').toEqual(['كرّاسةُ المحورين 2 و3'])
    expect(ownMaterialLabels({ workbook: { ...url('wb'), ...MATERIAL_PATCH.own } }, IDS)).toEqual(['كرّاسةُ الدورة'])
    expect(ownMaterialLabels({ workbook: { ownMaterial: true } }, IDS), 'سُمّيت كرّاسةٌ لم تُرفع').toEqual([])
    const REVIEW = code('src/components/admin/TrainerPlanReview.tsx')
    expect(REVIEW).toContain('const own = ownMaterialLabels(trainerPlan.content, (trainerPlan.content?.modules ?? []).map((m) => m.moduleId));')
    expect(REVIEW).toMatch(/\{own\.length > 0 && \([\s\S]{0,120}بمادّته الجاهزة لا على القالب: <b>\{own\.join\("، و"\)\}<\/b>/)
  })

  it('⚠️ وفيما تغيّر: الانتقالُ بين القالب ومادّته يُقال بطرفيه', () => {
    const fmt = { date: (d: string) => d }
    const was = { ...byModule, workbooks: byModule.workbooks.map((g) => ({ ...g, ...MATERIAL_PATCH.template })) }
    const lines = planDiff(was, byModule, fmt).find((s) => s.section === 'workbooks')?.lines ?? []
    expect(lines).toEqual(['كرّاسةُ المحورين 2 و3: على قالب وجيز ← مادّتُه الجاهزة'])
    const course = { ...base, workbook: url('wb') }
    const said = planDiff(course, { ...course, workbook: { ...url('wb'), ...MATERIAL_PATCH.own } }, fmt)
      .find((s) => s.section === 'workbooks')?.lines ?? []
    expect(said).toEqual(['كرّاسةُ الدورة: قال إنّها مادّتُه الجاهزة لا على القالب'])
  })
})

describe('④ الكرّاسةُ ملكُه — بنصٍّ واحدٍ في مواضعه الثلاثة، ولا يخالف الاتفاقيّة', () => {
  it('⚠️ يقول ما في البند 10 بلا نقص: الملكيّةُ له، وترخيصُ 10-3 كما هو، والقالبُ لوجيز', () => {
    const t = WORKBOOK_RIGHTS_AR.body
    expect(t).toContain('لا ينقل ملكيّتَه إلى وجيز')
    expect(t).toContain('ولك أن تستعمله كما تشاء')
    expect(t, 'قيل إنّ لا حقَّ لوجيز — وفي الاتفاقيّة ترخيص').toContain('ترخيصٌ غيرُ حصريٍّ ودائمٌ لوجيز باستعمال ما تعدّه للشعبة وتعديلِه داخل المنصّة')
    expect(t).toContain('(10-3)')
    expect(t).toContain('وشكلُه وشعارُه لوجيز')
  })

  it('⚠️ والاتفاقيّةُ ما زالت تقول ذلك — فإن تغيّر البندُ 10 سقط هذا ليُراجَع النصّ', () => {
    const BODY = readFileSync(join(process.cwd(), 'src/application/trainer/contract-body.ts'), 'utf8')
    expect(BODY).toContain('10-1 يبقى للأكاديمية ما تملكه قبل هذه الاتفاقية وما تنتجه بنفسها: كتالوجها، ومخططات دوراتها، وعلامتها التجارية، ومنصتها، والمواد التي تزود بها المدرب.')
    expect(BODY).toContain('ولا ينتقل شيء منه إلى الأكاديمية بموجب هذه الاتفاقية.')
    expect(BODY).toContain('يمنح للأكاديمية بشأنه ترخيصا غير حصري ودائما وغير قابل للنقض، يخولها استخدامه وتعديله داخل المنصة لأغراضها التعليمية. ويبقى المدرب مالكا له وله استخدامه كما يشاء.')
  })

  it('⚠️ بجانب القالب في الخطوة الثالثة', () => {
    const WS = code('src/pages/trainer/CohortWorkspace.tsx')
    const block = WS.slice(WS.indexOf('stage === "workbooks" &&'), WS.indexOf('stage === "sessions" &&'))
    const card = block.slice(block.indexOf('ابدأ من قالب وجيز'), block.indexOf('كيف تعطي المتعلّمين كرّاستك؟'))
    expect(card, 'غاب النصُّ عن بطاقة القالب').toContain('<b className="text-foreground">{WORKBOOK_RIGHTS_AR.title}.</b> {WORKBOOK_RIGHTS_AR.body}')
  })

  it('⚠️ وفي صفحة المدرّب داخلَ القالب — الفارغِ والمملوء', async () => {
    for (const kind of ['course', 'module'] as const) {
      const zip = await JSZip.loadAsync(await workbookDocx(blankFill(kind)))
      const xml = await zip.file('word/document.xml')!.async('string')
      const text = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')
      expect(text, `غاب عن قالب ${kind}`).toContain(`${WORKBOOK_RIGHTS_AR.title}.`)
      expect(text).toContain(WORKBOOK_RIGHTS_AR.body)
    }
  })

  it('⚠️ وفي الدليل — مع بابِ مادّته الجاهزة بفرقه', () => {
    const blocks = GUIDE_SECTIONS.flatMap((s) => s.blocks)
    const callouts = blocks.filter((b): b is Extract<typeof b, { kind: 'callout' }> => b.kind === 'callout')
    const rights = callouts.find((c) => c.title === WORKBOOK_RIGHTS_AR.title)
    expect(rights, 'غاب عن الدليل').toBeTruthy()
    expect(rights!.text).toBe(WORKBOOK_RIGHTS_AR.body)
    expect(rights!.tone).toBe('contract')
    const own = callouts.find((c) => c.title === 'وعندك مادّةٌ جاهزة؟')
    expect(String(own?.text)).toContain('«مادّتي الجاهزة»')
    expect(String(own?.text), 'لم يُقل الفرق').toContain('يراها المعتمِدُ ليست على القالب')
  })
})

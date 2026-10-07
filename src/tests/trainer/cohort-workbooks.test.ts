/* ═══ الكرّاسة: للدورة أو لكلّ محور، وقالبُ وجيز (٦ أكتوبر ٢٠٢٦) ═══

   طلب صاحبُ المنصّة خيارين للكرّاسة وقالبَ Word بمعاييرنا، ثمّ أجاب عن ستّة
   أسئلةٍ وأربعةٍ بعدها: له أن يجمع محاورَ متجاورة · تُفتح كلٌّ بموعد أسبق محاورها
   · موضعُ المحور في كرّاسة الدورة اختياريّ · الرفعُ PDF والقالبُ Word · القالبُ
   إلزاميٌّ للجدد ومستحسَنٌ لمن رفع قبله — **لكلّ مدرّب** · وفي الجمع يبقى ملفُّ
   الأسبق · والقديمُ يبقى · **والروابطُ تبقى** · والتبديلُ يحفظ الطريقةَ الأخرى.

   وما يُحرس هنا:
     ① القاعدةُ المحضة: المجموعاتُ والجمعُ والفصلُ وموعدُ الفتح والتسمية.
     ② ما ينقص الخطوة — والإلزامُ بحال الخطّة وعلمِ المدرّب.
     ③ المخطّطُ يحملها، والخادمُ يحكم بها ويقرأ العلمَ في مواضعه الثلاثة.
     ④ الشاشةُ تنادي القاعدةَ ولا تعيد كتابتها، والقالبان في موضعهما.
     ⑤ المتعلّمُ لا يصله رابطٌ قبل أوانه، والحارسُ يفتح المفتاحَ متى فُتحت.
     ⑥ المعتمِدُ يرى الطريقةَ والإقرارَ وما تغيّر.

   والفحصُ على البنية لا على ورودِ حرفٍ في تعليق: التعليقاتُ تُنزع قبل المطابقة. */
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  WORKBOOK_MODES, WORKBOOK_TEMPLATES, groupLabelAr, mergeWithNext, splitGroup, templateRequired,
  workbookGroups, workbookModeOf, workbookOpensOn, workbooksProblems, type ModuleWorkbook,
} from '@/application/trainer/cohort-workbooks'
import { projectPlanForLearner } from '@/application/trainer/plan-overlay'
import { learnerGate } from '@/application/learning/cohort-gate'
import { curriculumView } from '@/application/trainer/curriculum-view'
import { planDiff } from '@/application/trainer/plan-diff'
import CurriculumReview from '@/components/CurriculumReview'

const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const IDS = ['m1', 'm2', 'm3', 'm4']
const SLOTS = [
  { startsOn: '2026-12-01', endsOn: '2026-12-07', moduleIds: ['m1'] },
  { startsOn: '2026-12-08', endsOn: '2026-12-14', moduleIds: ['m2'] },
  { startsOn: '2026-12-15', endsOn: '2026-12-21', moduleIds: ['m3'] },
  { startsOn: '2026-12-22', endsOn: '2026-12-29', moduleIds: ['m4'] },
]
const pdf = (k: string) => ({ bodyFileKey: k, bodyFileName: `${k}.pdf`, bodyFileMime: 'application/pdf' })

describe('① القاعدةُ المحضة', () => {
  it('⚠️ وغيابُ الطريقة «للدورة» — فالخططُ القائمةُ كما هي', () => {
    expect(WORKBOOK_MODES).toEqual(['course', 'modules'])
    expect(workbookModeOf({})).toBe('course')
    expect(workbookModeOf({ workbookMode: 'nonsense' })).toBe('course')
    expect(workbookModeOf({ workbookMode: 'modules' })).toBe('modules')
  })

  it('⚠️ كلُّ محورٍ في مجموعةٍ واحدةٍ متجاورة — بالمحاور كما هي الآن', () => {
    /* محورٌ حُذف يسقط، ومحورٌ جديدٌ يأخذ كرّاستَه فارغة */
    const saved: ModuleWorkbook[] = [{ moduleIds: ['m1', 'gone'], ...pdf('a') }, { moduleIds: ['m2', 'm3'], ...pdf('b') }]
    expect(workbookGroups(saved, IDS).map((g) => g.moduleIds)).toEqual([['m1'], ['m2', 'm3'], ['m4']])
    expect(workbookGroups(saved, IDS)[1].bodyFileKey).toBe('b')
    /* وترتيبٌ جديدٌ فرّق مجموعةً: تبقى بأوّل ما تجاور منها وملفُّها معه، والمنفصلُ فارغ */
    const reordered = workbookGroups([{ moduleIds: ['m1', 'm2'], ...pdf('a') }], ['m1', 'm3', 'm2', 'm4'])
    expect(reordered.map((g) => g.moduleIds)).toEqual([['m1'], ['m3'], ['m2'], ['m4']])
    expect(reordered[0].bodyFileKey).toBe('a')
    expect(reordered[2].bodyFileKey, 'انفصل ملفٌّ مع محورٍ ليس أوّلَها').toBeUndefined()
  })

  /* «Keep the earlier file» — اختيارُ صاحب المنصّة (٦ أكتوبر ٢٠٢٦) */
  it('⚠️ الجمعُ يُبقي ملفَّ الأسبق — وإن خلا الأسبقُ أخذ ملفَّ التالي', () => {
    const groups: ModuleWorkbook[] = [{ moduleIds: ['m1'], ...pdf('a') }, { moduleIds: ['m2'], ...pdf('b') }, { moduleIds: ['m3'] }]
    const merged = mergeWithNext(groups, 0)
    expect(merged.map((g) => g.moduleIds)).toEqual([['m1', 'm2'], ['m3']])
    expect(merged[0].bodyFileKey, 'بقي ملفُّ اللاحق').toBe('a')
    const fromLater = mergeWithNext([{ moduleIds: ['m1'] }, { moduleIds: ['m2'], ...pdf('b') }], 0)
    expect(fromLater[0].bodyFileKey).toBe('b')
  })

  it('والفصلُ كرّاسةٌ لكلّ محور — وملفُّها مع أوّلها', () => {
    const split = splitGroup([{ moduleIds: ['m1', 'm2', 'm3'], ...pdf('a'), onTemplate: true }], 0)
    expect(split.map((g) => g.moduleIds)).toEqual([['m1'], ['m2'], ['m3']])
    expect(split[0]).toMatchObject({ bodyFileKey: 'a', onTemplate: true })
    expect(split[1].bodyFileKey).toBeUndefined()
  })

  it('⚠️ تُفتح أوّلَ يومٍ في موعد أسبق محاورها', () => {
    expect(workbookOpensOn({ moduleIds: ['m3', 'm2'] }, SLOTS)).toBe('2026-12-08')
    expect(workbookOpensOn({ moduleIds: ['m4'] }, SLOTS)).toBe('2026-12-22')
    expect(workbookOpensOn({ moduleIds: ['m4'] }, [])).toBeNull()
  })

  it('والاسمُ مجرورٌ بعد «كرّاسةُ» — ومدًى للمتجاورة', () => {
    expect(groupLabelAr({ moduleIds: ['m2'] }, IDS)).toBe('المحور 2')
    expect(groupLabelAr({ moduleIds: ['m2', 'm3'] }, IDS)).toBe('المحورين 2 و3')
    expect(groupLabelAr({ moduleIds: ['m1', 'm2', 'm3'] }, IDS)).toBe('المحاور 1–3')
  })
})

describe('② ما ينقص الخطوة — والإلزامُ بحال الخطّة وعلمِ المدرّب', () => {
  it('⚠️ القالبُ إلزاميٌّ للجديد ما دامت الخطّةُ في يده — ومستحسَنٌ لمن رفع قبله', () => {
    expect(templateRequired('draft', false)).toBe(true)
    expect(templateRequired('changes_requested', false)).toBe(true)
    expect(templateRequired('draft', true), 'أُلزم من رفع قبل القالب').toBe(false)
    for (const st of ['submitted', 'approved', 'published']) expect(templateRequired(st, false), st).toBe(false)
  })

  it('⚠️ كرّاسةُ الدورة: ملفٌّ أو رابط — وموضعُ المحور لا يُطلب', () => {
    expect(workbooksProblems({}, IDS, { templateRequired: false })).toHaveLength(1)
    expect(workbooksProblems({ workbook: { url: 'https://x.test/wb' } }, IDS, { templateRequired: false })).toEqual([])
    expect(workbooksProblems({ workbook: pdf('k') }, IDS, { templateRequired: false })).toEqual([])
  })

  it('⚠️ والإقرارُ يُطلب حين يُلزَم — ولا يُطلب على كرّاسةٍ لم تُوضع', () => {
    const wb = { workbook: { url: 'https://x.test/wb' } }
    expect(workbooksProblems(wb, IDS, { templateRequired: true })[0]).toContain('قالب وجيز')
    expect(workbooksProblems({ workbook: { ...wb.workbook, onTemplate: true } }, IDS, { templateRequired: true })).toEqual([])
    expect(workbooksProblems({}, IDS, { templateRequired: true }).join(), 'طُلب إقرارٌ على كرّاسةٍ غائبة').not.toContain('قالب')
  })

  it('⚠️ ولكلّ محور: يُسمّى ما خلا من كرّاسته — وكرّاسةُ الدورة المحفوظةُ لا تُعدّ', () => {
    const c = { workbookMode: 'modules', workbook: { url: 'https://x.test/wb', onTemplate: true },
      workbooks: [{ moduleIds: ['m1', 'm2'], url: 'https://x.test/a', onTemplate: true }, { moduleIds: ['m3'], ...pdf('b') }] }
    const out = workbooksProblems(c, IDS, { templateRequired: true })
    expect(out[0], 'لم يُسمَّ المحورُ الخالي').toContain('المحور 4')
    expect(out[1], 'لم يُطلب إقرارُ الكرّاسة المرفوعة').toContain('المحور 3')
    expect(workbooksProblems(c, IDS, { templateRequired: false })).toHaveLength(1)
  })
})

describe('③ المخطّطُ يحملها، والخادمُ يحكم بها', () => {
  const ROUTES = code('server/http/routes/learning-portal.routes.ts')
  const schema = ROUTES.slice(ROUTES.indexOf('const planContent'), ROUTES.indexOf("app.get('/api/trainer/cohorts/:id/workspace'"))
  const SVC = code('server/services/cohort-plan.service.ts')

  it('⚠️ في مخطّط حفظ الخطّة: الطريقةُ والمجموعاتُ والإقرار — وإلّا ضاعت صامتة', () => {
    expect(schema, 'الطريقةُ تُسقَط').toMatch(/workbookMode: z\.enum\(WORKBOOK_MODES\)\.nullish\(\)/)
    expect(schema, 'كرّاساتُ المحاور تُسقَط').toMatch(/workbooks: z\.array\(z\.object\(\{\s*moduleIds: z\.array\(z\.string\(\)\.max\(64\)\)\.min\(1\)/)
    expect(schema.match(/onTemplate: z\.boolean\(\)\.nullish\(\)/g), 'الإقرارُ يُسقَط من إحداهما').toHaveLength(2)
  })

  it('⚠️ وقائمةُ الخادم تحكم بالقاعدة نفسِها، وبعلم المدرّب', () => {
    expect(SVC).toMatch(/workbooksProblems\(input\.content, moduleIds, \{\s*templateRequired: templateRequired\(input\.planStatus, input\.workbookBeforeTemplate === true\),/)
    /* في مواضعها الثلاثة: الورشة، وبطاقاتُ «شعبي»، وحاجزُ الإرسال */
    expect(SVC.match(/workbookBeforeTemplate: profile\.workbookBeforeTemplate,\s*\}\)/g), 'موضعٌ يحكم بلا علم المدرّب').toHaveLength(3)
  })

  it('⚠️ والعلمُ يُكتب في هجرة يوم القرار — ولا يكتبه الخادمُ بعدها', () => {
    const SQL = readFileSync(join(process.cwd(), 'prisma/migrations/20261006180000_workbook_before_template/migration.sql'), 'utf8')
    expect(SQL).toMatch(/ALTER TABLE "TrainerProfile" ADD COLUMN IF NOT EXISTS "workbookBeforeTemplate" BOOLEAN NOT NULL DEFAULT false/)
    expect(SQL).toMatch(/UPDATE "TrainerProfile"/)
    /* والكتابةُ في Prisma تمرّ بـ`data` — والقراءةُ بـ`select` تبقى مباحة */
    const files = (readdirSync(join(process.cwd(), 'server'), { recursive: true }) as string[])
      .filter((f) => f.endsWith('.ts') && !f.split(/[\\/]/).includes('tests'))
    const writers = files.filter((f) => /data:\s*\{[^}]*workbookBeforeTemplate/.test(code(join('server', f))))
    expect(writers, 'صار الخادمُ يكتب العلم').toEqual([])
  })
})

describe('④ الشاشةُ تنادي القاعدة، والقالبان في موضعهما', () => {
  const WS = code('src/pages/trainer/CohortWorkspace.tsx')
  const block = WS.slice(WS.indexOf('stage === "workbooks" &&'), WS.indexOf('stage === "sessions" &&'))

  it('⚠️ ما ينقص الخطوةَ بقاعدة الخادم وعلمِه', () => {
    const gaps = WS.slice(WS.indexOf('const gapsFor'), WS.indexOf('if (k === "sessions")', WS.indexOf('const gapsFor')))
    expect(gaps).toMatch(/workbooksProblems\(saved, ids, \{\s*templateRequired: templateRequired\(w\.plan\?\.status \?\? "draft", Boolean\(w\.workbookBeforeTemplate\)\),/)
  })

  it('⚠️ والطريقتان تُختاران، والجمعُ والفصلُ بالقاعدة — لا بإعادة كتابتها', () => {
    expect(block).toMatch(/onClick=\{\(\) => setContent\(\{ \.\.\.content, workbookMode: m\.mode \}\)\}/)
    expect(block, 'الجمعُ يُعاد كتابتُه').toContain('setGroups(mergeWithNext(wbGroups, i))')
    expect(block, 'الفصلُ يُعاد كتابتُه').toContain('setGroups(splitGroup(wbGroups, i))')
    expect(block, 'موعدُ الفتح يُحسب في الشاشة').toContain('workbookOpensOn(g, slots)')
    /* وصار الإقرارُ اختيارا: القالبُ أو مادّتُه الجاهزة (٧ أكتوبر ٢٠٢٦) — `workbook-own-material.test.ts` */
    expect(block.match(/<MaterialChoice /g), 'كرّاسةٌ بلا إقرار').toHaveLength(2)
  })

  it('⚠️ والقالبان يُنزَّلان من الخطوة — وهما في `public/templates` ملفّا Word', () => {
    expect(block).toMatch(/href=\{tpl\.href\} download=\{tpl\.download\}/)
    for (const t of Object.values(WORKBOOK_TEMPLATES)) {
      const bytes = readFileSync(join(process.cwd(), 'public', t.href))
      expect(bytes.subarray(0, 2).toString(), `${t.href} ليس ملفّ Word`).toBe('PK')
      expect(t.download).toMatch(/\.docx$/)
    }
  })
})

describe('⑤ المتعلّمُ: كرّاسةُ المحور بموعد أسبق محاورها', () => {
  const content = {
    kind: 'trainer', startsOn: '2026-12-01', endsOn: '2026-12-29', slots: SLOTS,
    modules: IDS.map((moduleId, i) => ({ moduleId, titleAr: `محور ${i + 1}` })), resources: [],
    workbook: { url: 'https://x.test/course-wb' },
    workbookMode: 'modules',
    workbooks: [{ moduleIds: ['m1'], ...pdf('k1') }, { moduleIds: ['m2', 'm3'], ...pdf('k23') }, { moduleIds: ['m4'] }],
  }
  const at = (iso: string) => {
    const now = new Date(iso)
    const gate = learnerGate({ content, cohort: {}, sessions: [], now })
    return { gate, out: projectPlanForLearner({ status: 'approved', content }, now, gate)! }
  }

  it('⚠️ قبل موعدها: يُقال متى، ولا يصل رابطٌ ولا مفتاح', () => {
    const { gate, out } = at('2026-12-03T10:00:00Z')
    const [first, pair] = out.moduleWorkbooks!
    expect(first.file?.bodyFileKey).toBe('k1')
    expect(pair.locked).toBe(true)
    expect(pair.file, 'وصل ملفُّ المحورين قبل موعدهما').toBeNull()
    expect(pair.opensAt).toBe(gate.timeline!.theoryOpensAt('m2')!.toISOString())
    expect(JSON.stringify(out), 'تسرّب المفتاحُ في الإسقاط').not.toContain('k23')
  })

  it('⚠️ وتُفتح أوّلَ يومٍ في موعد أسبقها — والخاليةُ لا تُذكر', () => {
    const { out } = at('2026-12-09T10:00:00Z')
    expect(out.moduleWorkbooks!.map((w) => w.file?.bodyFileKey)).toEqual(['k1', 'k23'])
  })

  it('⚠️ وما في الطريقة الأخرى محفوظٌ لا يصل — كرّاسةُ الدورة ولا كرّاساتُ المواعيد', () => {
    const { out } = at('2026-12-20T10:00:00Z')
    expect(out.workbook, 'وصلت كرّاسةُ الدورة وقد اختار لكلّ محور').toBeNull()
    expect(projectPlanForLearner({ status: 'approved', content: { ...content, workbookMode: 'course' } })!.moduleWorkbooks).toEqual([])
  })

  it('⚠️ وحارسُ الملفّات يفتح مفتاحَها متى فُتحت — من الإسقاط نفسِه', () => {
    expect(code('server/services/cohort-file.service.ts')).toMatch(/\.\.\.\(view\.moduleWorkbooks \?\? \[\]\)\.map\(\(w\) => w\.file\?\.bodyFileKey\)/)
  })
})

describe('⑥ المعتمِدُ يرى الطريقةَ والإقرارَ وما تغيّر', () => {
  const base = { kind: 'trainer', modules: IDS.map((moduleId, i) => ({ moduleId, titleAr: `محور ${i + 1}` })), resources: [], slots: SLOTS }
  const byModule = { ...base, workbookMode: 'modules', workbooks: [
    { moduleIds: ['m1', 'm2'], ...pdf('k12'), onTemplate: true }, { moduleIds: ['m3'], url: 'https://x.test/m3' }, { moduleIds: ['m4'] },
  ] }

  it('⚠️ في المنهج: كلُّ كرّاسةٍ بإقرارها، والخاليةُ تُقال', () => {
    const view = curriculumView({ title: 'ش', period: null, content: byModule, sessions: [], assessments: [], fileKey: null, fileName: null } as never)
    const html = renderToStaticMarkup(createElement(CurriculumReview, { view }))
    expect(html).toContain('لكلّ محورٍ كرّاستُه')
    expect(html).toContain('كرّاسةُ المحورين 1 و2')
    expect(html).toContain('على قالب وجيز')
    expect(html, 'لا يُقال إنّ الإقرارَ غائب').toContain('لم يقل أعلى القالب هي')
    expect(html).toContain('لم تُوضع بعد')
  })

  it('⚠️ وفي رأس المراجعة: أإلزاميٌّ القالبُ لهذا المدرّب أم مستحسَن', () => {
    const REVIEW = code('src/components/admin/TrainerPlanReview.tsx')
    expect(REVIEW).toMatch(/trainerPlan\.workbookBeforeTemplate\s*\?[\s\S]{0,80}مستحسَنٌ لهذا المدرّب[\s\S]{0,160}القالبُ أو مادّتُه الجاهزة/)
    expect(code('server/services/cohort-plan.service.ts')).toMatch(/workbookBeforeTemplate: trainer\?\.workbookBeforeTemplate \?\? false/)
  })

  it('⚠️ وفيما تغيّر: الطريقةُ، والكرّاسةُ المضافة، والإقرار — ولا «حُذفت» لمحفوظٍ لم يُمسّ', () => {
    const fmt = { date: (d: string) => d }
    const before = { ...base, workbook: { url: 'https://x.test/wb' } }
    const lines = planDiff(before, byModule, fmt).find((s) => s.section === 'workbooks')?.lines ?? []
    expect(lines).toContain('طريقةُ الكرّاسة: واحدةٌ للدورة ← لكلّ محورٍ كرّاستُه')
    expect(lines).toContain('أُضيفت كرّاسةُ المحورين 1 و2')
    expect(lines).toContain('كرّاسةُ المحورين 1 و2: أقرّ بأنّها على قالب وجيز')
    expect(lines.join(), 'قيل «حُذفت كرّاسةُ الدورة» وهي محفوظة').not.toContain('حُذفت كرّاسةُ الدورة')
    expect(planDiff(byModule, byModule, fmt)).toEqual([])
  })

  it('⚠️ والعودةُ إلى «للدورة» تقول إنّ كرّاستَها صارت تصل — وإن كانت محفوظةً من قبل', () => {
    const fmt = { date: (d: string) => d }
    const kept = { url: 'https://x.test/wb' }
    const lines = planDiff({ ...byModule, workbook: kept }, { ...byModule, workbookMode: 'course', workbook: kept }, fmt)
      .find((s) => s.section === 'workbooks')?.lines ?? []
    expect(lines).toContain('طريقةُ الكرّاسة: لكلّ محورٍ كرّاستُه ← واحدةٌ للدورة')
    expect(lines, 'لم يُقل إنّ كرّاسةَ الدورة صارت تصل المتعلّمين').toContain('أُضيفت كرّاسةُ الدورة')
  })
})

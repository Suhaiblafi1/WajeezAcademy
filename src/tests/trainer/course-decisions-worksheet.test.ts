/* ورقةُ القرارات — الطابورُ المفتوحُ بصيغة ملفّ القرارات (٢ أكتوبر ٢٠٢٦).

   ما يُحرَس هنا ثلاثة، كلٌّ على البنية لا على ورود نصّ:
   ① الورقةُ ملفُّ قراراتٍ بصيغته — ومن ملأها رفعها كما هي، فوقع كلُّ قرارٍ على
      الاقتراح الذي كُتب له، ولم تُرسَم خطوةُ «تصحيح» لم يطلبها أحد.
   ② ولا تُطبَّق قبل أن تُملأ.
   ③ والمبتوتُ لا يخرج، وما يُقرأ لا يدخل خاناتِ القرار.

   والشاشةُ تُخرجها وتقبل الملفَّ ملصوقا — وكلاهما إلى المعاينة لا إلى التطبيق. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildDecisionsWorksheet, type WorksheetRow, type WorksheetTrainer,
} from '../../application/trainer/course-decisions-worksheet'
import {
  DECISIONS_KIND, DECISIONS_VERSION, STEP_PERMISSION, parseDecisionsFile, planDecisions,
  type DecisionsWorld, type ProposalState, type TrainerState,
} from '../../application/trainer/course-decisions'
import { OPEN_PROPOSAL_STATUSES } from '../../application/trainer/accepted-courses'

const NOW = new Date('2026-10-02T09:00:00Z')

const amal: WorksheetTrainer = {
  reference: 'WJ-TR-2026-00041', fullName: 'أمل الورقة', applicationStatus: 'active', suspended: false, qualified: ['C-COM-102'],
}
const basem: WorksheetTrainer = {
  reference: 'WJ-TR-2026-00007', fullName: 'باسم الورقة', applicationStatus: 'onboarding', suspended: false, qualified: [],
}

const row = (over: Partial<WorksheetRow> & Pick<WorksheetRow, 'proposalId' | 'trainer'>): WorksheetRow => ({
  status: 'submitted', titleAr: 'عنوان', summaryAr: null, createdAt: '2026-10-01T08:00:00.000Z',
  questionAr: null, answerAr: null, detailsAr: [], suggested: [], ...over,
})

/* أمل: اقتراحان مفتوحان (أحدُهما سُئلت عنه وأجابت) وثالثٌ مربوطٌ من قبل، وباسم:
   اقتراحٌ مفتوحٌ أقدمُ من الجميع وآخرُ مردود. والترتيبُ هنا مقلوبٌ عمدا. */
const ROWS: WorksheetRow[] = [
  row({
    proposalId: 'p-amal-2', trainer: amal, createdAt: '2026-10-01T12:00:00.000Z', status: 'info_requested',
    titleAr: 'إدارة الفعاليات', questionAr: 'لمن هي؟', answerAr: 'لمنسّقي الفعاليات المبتدئين',
  }),
  row({ proposalId: 'p-amal-linked', trainer: amal, status: 'linked', titleAr: 'مربوطةٌ من قبل' }),
  row({
    proposalId: 'p-amal-1', trainer: amal, createdAt: '2026-10-01T10:00:00.000Z',
    titleAr: 'دوره الخطابه', summaryAr: 'الإلقاء أمام الجمهور',
    detailsAr: [{ labelAr: 'الساعات', valueAr: '8 ساعة' }],
    suggested: [{ courseId: 'C-COM-101', titleAr: 'الخطابة', sharedAr: ['الخطابة'] }],
  }),
  row({ proposalId: 'p-basem-rejected', trainer: basem, status: 'rejected', titleAr: 'مردودة' }),
  row({ proposalId: 'p-basem-1', trainer: basem, createdAt: '2026-09-30T08:00:00.000Z', status: 'draft', titleAr: 'فكرةٌ تُرفض' }),
]

const sheet = () => buildDecisionsWorksheet(ROWS, NOW)

/** العالمُ كما يقرؤه المنفِّذ — من الصفوف نفسِها التي خرجت منها الورقة */
function worldOf(rows: readonly WorksheetRow[]): DecisionsWorld {
  const byRef = new Map<string, { t: WorksheetTrainer; proposals: ProposalState[] }>()
  for (const r of rows) {
    const at = byRef.get(r.trainer.reference) ?? { t: r.trainer, proposals: [] }
    at.proposals.push({
      id: r.proposalId, titleAr: r.titleAr, summaryAr: r.summaryAr, status: r.status, courseId: null, questionAr: r.questionAr,
    })
    byRef.set(r.trainer.reference, at)
  }
  const trainers = new Map<string, TrainerState>([...byRef].map(([ref, { t, proposals }]) => [ref, {
    reference: ref, fullName: t.fullName, applicationId: `app-${ref}`, status: t.applicationStatus,
    profile: {
      id: `prof-${ref}`, userId: null, suspended: t.suspended, proposals,
      qualifications: t.qualified.map((courseId) => ({ courseId, status: 'qualified' })),
    },
  }]))
  return {
    trainers,
    courses: new Map([['C-COM-101', 'published'], ['C-COM-102', 'published']]),
    actorUserId: 'u-admin',
    permissions: new Set(Object.values(STEP_PERMISSION)),
    permissionLabelAr: (k) => `«${k}»`,
    qualifiableStatuses: ['conditionally_approved', 'contract_pending', 'onboarding', 'active'],
    withdrawProblem: () => null,
  }
}

describe('① الورقةُ ملفُّ قراراتٍ بصيغته', () => {
  it('النوعُ والإصدارُ نفسُهما — والمدرّبون بترتيب أقدمِ ما ينتظر منهم', () => {
    const s = sheet()
    expect(s.kind).toBe(DECISIONS_KIND)
    expect(s.version).toBe(DECISIONS_VERSION)
    expect(s.trainers.map((t) => t.reference)).toEqual([basem.reference, amal.reference])
    expect(s.trainers.map((t) => t.fullName)).toEqual([basem.fullName, amal.fullName])
    expect(s.trainers[1].proposals.map((p) => p.proposalId), 'اقتراحاتُ المدرّب بترتيب وصولها').toEqual(['p-amal-1', 'p-amal-2'])
    expect(s.context).toMatchObject({ openProposals: 3, trainers: 2, exportedAt: NOW.toISOString() })
  })

  it('⚠️ ومن ملأها رفعها كما هي — فوقع كلُّ قرارٍ على اقتراحه، ولا «تصحيحَ» لم يُطلب', () => {
    const filled = structuredClone(sheet()) as unknown as {
      trainers: { proposals: Record<string, unknown>[]; qualify: string[] }[]
    }
    const [b, a] = filled.trainers
    Object.assign(b.proposals[0], { verdict: 'reject', noteAr: 'ليست في مجال الأكاديمية' })
    Object.assign(a.proposals[0], { verdict: 'link', courseId: 'C-COM-101' })
    Object.assign(a.proposals[1], { verdict: 'ask', questionAr: 'كم ساعةً تقترح لها؟' })
    a.qualify.push('C-COM-101')

    const parsed = parseDecisionsFile(filled)
    expect(parsed, parsed.ok ? '' : parsed.errorsAr.join(' | ')).toMatchObject({ ok: true })
    if (!parsed.ok) return
    const plan = planDecisions(parsed.file, worldOf(ROWS))

    expect(plan.steps.filter((s) => s.state !== 'todo').map((s) => `${s.n} ${s.reasonAr}`)).toEqual([])
    expect(
      plan.steps.map((s) => [s.kind, s.proposalId ?? s.courseId]),
      'خطوةٌ لم يطلبها أحد — «context» دخل خاناتِ القرار؟',
    ).toEqual([
      ['reject', 'p-basem-1'],
      ['qualify', 'C-COM-101'],
      ['link', 'p-amal-1'],
      ['ask', 'p-amal-2'],
    ])
  })

  it('وما يُفتح في الورقة يُقرَّر فيه — لا حالَ مفتوحةً يراها المنفِّذُ مبتوتة', () => {
    /* قائمتان في طبقتَين: ما تُخرجه الورقة، وما يقبل المنفِّذُ القرارَ فيه. فإن
       افترقتا خرج في الورقة بندٌ يُردّ عند الرفع «قُرّر فيه غيرُ ما في الملفّ» */
    for (const status of OPEN_PROPOSAL_STATUSES) {
      const rows = [row({ proposalId: 'p-x', trainer: basem, status, titleAr: 'بندٌ مفتوح' })]
      const s = structuredClone(buildDecisionsWorksheet(rows, NOW)) as unknown as { trainers: { proposals: Record<string, unknown>[] }[] }
      expect(s.trainers[0]?.proposals, `«${status}» لم يخرج في الورقة`).toHaveLength(1)
      Object.assign(s.trainers[0].proposals[0], { verdict: 'link', courseId: 'C-COM-101' })
      const parsed = parseDecisionsFile(s)
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) continue
      const step = planDecisions(parsed.file, worldOf(rows)).steps.find((x) => x.kind === 'link')
      expect(step?.state, `«${status}» يخرج في الورقة ويراه المنفِّذُ مبتوتا: ${step?.reasonAr}`).toBe('todo')
    }
  })
})

describe('② ولا تُطبَّق قبل أن تُملأ', () => {
  it('⚠️ الورقةُ كما خرجت يردّها المنفِّذ — كلُّ بندٍ فيها لا يطلب شيئا بعد', () => {
    const r = parseDecisionsFile(structuredClone(sheet()))
    expect(r.ok).toBe(false)
    if (r.ok) return
    /* بندٌ لكلّ اقتراحٍ مفتوح — فيُعرف أنّها الورقةُ قبل القرار لا ملفٌّ معطوب */
    expect(r.errorsAr.filter((e) => e.includes('بندٌ لا يطلب شيئا'))).toHaveLength(3)
  })
})

describe('③ المبتوتُ لا يخرج، وما يُقرأ لا يدخل خاناتِ القرار', () => {
  it('⚠️ المربوطُ والمردودُ ليسا في الورقة — ومن لم يبقَ له مفتوحٌ لا يخرج', () => {
    const ids = sheet().trainers.flatMap((t) => t.proposals.map((p) => p.proposalId))
    expect(ids).not.toContain('p-amal-linked')
    expect(ids).not.toContain('p-basem-rejected')
    const onlyDecided = buildDecisionsWorksheet(ROWS.filter((r) => r.status === 'linked' || r.status === 'rejected'), NOW)
    expect(onlyDecided.trainers).toEqual([])
    expect(onlyDecided.context.openProposals).toBe(0)
  })

  it('⚠️ خاناتُ القرار فارغة — والنصُّ وأجوبتُه وأقربُ الرموز تحت «context» وحدَه', () => {
    const p = sheet().trainers[1].proposals[0] as Record<string, unknown>
    for (const key of ['verdict', 'courseId', 'questionAr', 'noteAr']) expect(p[key], key).toBeNull()
    expect('titleAr' in p, 'العنوانُ في خانة التصحيح — يُقرأ تصحيحا عند الرفع').toBe(false)
    expect('summaryAr' in p).toBe(false)
    expect(p.context).toMatchObject({
      titleAr: 'دوره الخطابه', summaryAr: 'الإلقاء أمام الجمهور', details: [{ labelAr: 'الساعات', valueAr: '8 ساعة' }],
      suggested: [{ courseId: 'C-COM-101', titleAr: 'الخطابة', sharedAr: ['الخطابة'] }],
    })
    const asked = sheet().trainers[1].proposals[1] as { context: Record<string, unknown> }
    expect(asked.context).toMatchObject({ askedAr: 'لمن هي؟', answerAr: 'لمنسّقي الفعاليات المبتدئين' })
  })

  it('وحالُ المدرّب للقراءة — وما أُهِّل له لا يُكتب في «qualify» سلفا', () => {
    const a = sheet().trainers[1]
    expect(a.qualify).toEqual([])
    expect(a.status).toBeNull()
    expect(a.context).toEqual({ applicationStatus: 'active', suspended: false, qualified: ['C-COM-102'] })
  })
})

describe('④ والشاشةُ تُخرجها وتقبل الملفَّ ملصوقا — إلى المعاينة لا إلى التطبيق', () => {
  const ui = readFileSync(join(process.cwd(), 'src/components/admin/CourseDecisionsUpload.tsx'), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

  it('⚠️ تُحمَّل الورقةُ من نقطتها حين يُفتح الباب — فالنسخُ يقع في النقرة نفسِها', () => {
    expect(ui).toContain('"/api/admin/course-proposals/worksheet"')
    expect(ui, 'لا تُحمَّل حين يُفتح الباب').toMatch(/useEffect\(\(\) => \{ if \(open\) loadSheet\(\); \}/)
    const copy = /const copySheet = \(\) => \{[\s\S]*?\n {2}\};/.exec(ui)?.[0] ?? ''
    expect(copy, 'لا نسخَ إلى الحافظة').toContain('navigator.clipboard.writeText(sheet.text)')
    expect(copy, 'النسخُ ينتظر الشبكةَ قبل الحافظة — يسقط في Safari').not.toMatch(/await|apiGet|fetch\(/)
  })

  it('⚠️ والملصوقُ يمرّ من باب الملفّ نفسِه إلى المعاينة — لا يُطبَّق ملصوقٌ لم يُرَ', () => {
    const take = /const take = async \(text: string, name: string\) => \{[\s\S]*?\n {2}\};/.exec(ui)?.[0] ?? ''
    expect(take, 'لا بابَ واحدٌ للملفّ والملصوق').toContain('await show(parsed)')
    expect(take).not.toContain('course-decisions/apply')
    expect(ui, 'الملفُّ لا يمرّ من الباب نفسِه').toMatch(/const read = async \(file: File\) => take\(await file\.text\(\), file\.name\)/)
    expect(ui, 'زرُّ اللصق لا يمرّ من الباب').toMatch(/onClick=\{\(\) => void take\(pasted, /)
  })
})

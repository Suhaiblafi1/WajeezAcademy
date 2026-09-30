/* قائمةُ التجهيز على خطّ المحاور — ما يحجب الإرسالَ منذ صار للمحاور مواعيد.

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦) وقراراتُه العشرة بكلمة «go». والقاعدةُ
   المحضةُ في `src/application/trainer/axis-timeline.ts` (وحرّاسُها في
   `axis-timeline.test.ts`)، وهنا أنّها **تحجب فعلا** في القائمة التي يحتجّ
   بها الإرسالُ نفسُه — لا في الشاشة وحدَها. */

import { describe, expect, it } from 'vitest'
import { buildChecklist } from '../../../server/services/cohort-plan.service'
import { blockingBeforeSubmit, readyToSubmit } from '@/application/trainer/plan-gate'
import { MIN_MODULE_BODY } from '@/application/trainer/plan-overlay'
import { defaultSlots } from '@/application/trainer/axis-timeline'

const body = 'ن'.repeat(MIN_MODULE_BODY)
const PERIOD = { startsOn: '2027-02-07', endsOn: '2027-03-13' }
const IDS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8']
const mods = IDS.map((moduleId, i) => ({ moduleId, titleAr: `محور ${i + 1}`, bodyAr: body }))
/* خمسةُ أسابيع: ١+٢ · ٣ · ٤+٥ · ٦ · ٧+٨ */
const SLOTS = defaultSlots(IDS, PERIOD)
/* وكرّاسةٌ واحدةٌ للدورة، وموضعُ كلّ محورٍ فيها (٣٠ سبتمبر ٢٠٢٦) */
const WORKBOOK = { url: 'https://x.test/wb', parts: IDS.map((moduleId, i) => ({ moduleId, whereAr: `ص ${i * 4 + 1}` })) }
/** لقاءٌ في اليوم الثاني من الموعد، مربوطٌ بمحاوره */
const meetings = SLOTS.map((s) => ({
  title: `لقاء ${s.moduleIds.join('+')}`,
  startsAt: new Date(`${s.startsOn}T15:00:00.000Z`),
  endsAt: new Date(`${s.startsOn}T17:00:00.000Z`),
  recordings: [] as unknown[],
  moduleIds: s.moduleIds,
}))

/** شعبةٌ تامّةٌ على خطّ المحاور — وكلُّ حارسٍ ينقض منها شيئا واحدا */
const complete = (over: Partial<Parameters<typeof buildChecklist>[0]> = {}, content: Record<string, unknown> = {}) => buildChecklist({
  cohort: { title: 'الدفعة الأولى' },
  period: PERIOD,
  content: { kind: 'trainer', modules: mods, resources: [{ title: 'مرجع', url: 'https://x.test/a', moduleId: 'M3' }], slots: SLOTS, workbook: WORKBOOK, ...content } as never,
  sessions: meetings,
  assessmentsCount: 2,
  assessmentModuleIds: ['M1', 'M6'],
  planStatus: 'draft',
  ...over,
})
const row = (list: ReturnType<typeof buildChecklist>, key: string) => list.find((c) => c.key === key)!

describe('التامّةُ على خطّ المحاور تُرسَل', () => {
  it('كلُّ الصفوف تامّة، والإرسالُ مفتوح', () => {
    const list = complete()
    expect(blockingBeforeSubmit(list)).toEqual([])
    expect(readyToSubmit(list)).toBe(true)
  })

  it('⚠️ وصفُّ «التسجيلات» الاختياريُّ سقط — المسجَّلُ صار جلسةً في «اللقاءات»', () => {
    expect(complete().map((c) => c.key)).not.toContain('recordings')
    expect(complete().map((c) => c.key)).toEqual(['identity', 'modules', 'workbooks', 'sessions', 'assignments', 'resources', 'project', 'approval'])
  })
})

describe('المحاورُ ومواعيدُها', () => {
  it('⚠️ مسودّةٌ بلا مواعيدَ لا تُرسَل — وإن اكتملت متونُها', () => {
    const list = complete({}, { slots: [] })
    expect(row(list, 'modules').done).toBe(false)
    expect(row(list, 'modules').labelAr).toContain('وزّع المحاورَ على مواعيدها')
    expect(blockingBeforeSubmit(list).map((c) => c.key)).toContain('modules')
  })

  it('⚠️ وأقلُّ من أربعة مواعيدَ يحجب', () => {
    const three = [
      { ...SLOTS[0], moduleIds: ['M1', 'M2', 'M3'] },
      { ...SLOTS[2], moduleIds: ['M4', 'M5', 'M6'] },
      { ...SLOTS[4], moduleIds: ['M7', 'M8'] },
    ]
    expect(row(complete({}, { slots: three }), 'modules').done).toBe(false)
  })

  it('⚠️ والموعدُ خارجَ المدّة يحجب', () => {
    const out = SLOTS.map((s, i) => (i === 4 ? { ...s, endsOn: '2027-03-20' } : s))
    expect(row(complete({}, { slots: out }), 'modules').done).toBe(false)
  })
})

/* كانت لكلّ موعدٍ كرّاسة. وقرارُ صاحب المنصّة (٣٠ سبتمبر ٢٠٢٦): «اجعل الكرّاسةَ
   واحدةً فقط… كاملةً لكلّ المحاور… سهلةً على الطالب يتبعها محورا محورا». */
describe('الكرّاسة — واحدةٌ للدورة، وموضعُ كلّ محورٍ فيها', () => {
  it('⚠️ بلا كرّاسةٍ يحجب', () => {
    const list = complete({}, { workbook: { parts: WORKBOOK.parts } })
    expect(row(list, 'workbooks').done).toBe(false)
    expect(blockingBeforeSubmit(list).map((c) => c.key)).toEqual(['workbooks'])
  })

  it('⚠️ ومحورٌ لا يُعرف موضعُه فيها يحجب — فلا يتبعها المتعلّمُ محورا محورا', () => {
    const parts = WORKBOOK.parts.map((p) => (p.moduleId === 'M5' ? { ...p, whereAr: '  ' } : p))
    const list = complete({}, { workbook: { ...WORKBOOK, parts } })
    expect(row(list, 'workbooks').done).toBe(false)
    expect(blockingBeforeSubmit(list).map((c) => c.key)).toEqual(['workbooks'])
  })

  it('والملفُّ المرفوعُ يكفي كالرابط', () => {
    const file = { bodyFileKey: 'k-1', bodyFileName: 'wb.pdf', parts: WORKBOOK.parts }
    expect(row(complete({}, { workbook: file }), 'workbooks').done).toBe(true)
  })

  it('⚠️ وكرّاسةٌ لكلّ موعدٍ لم تعد تكفي مسودّةً — وتكفي ما أُرسل قبل القرار', () => {
    const perSlot = { workbook: null, slots: SLOTS.map((s) => ({ ...s, workbook: { url: 'https://x.test/old' } })) }
    expect(row(complete({}, perSlot), 'workbooks').done).toBe(false)
    expect(row(complete({ planStatus: 'approved' }, perSlot), 'workbooks').done).toBe(true)
  })
})

/* قرارُ صاحب المنصّة (٣٠ سبتمبر ٢٠٢٦): «ثلاثُ تابات: للمهامّ العمليّة، وللمصادر،
   ولمشروع التخرّج… لكي لا ينسى أيّا منها لأنّها كلُّها إجباريّة». */
describe('المهامُّ العمليّةُ ومشروعُ التخرّج — كلٌّ إلزاميّ', () => {
  it('⚠️ بلا مشروعِ تخرّجٍ يحجب — وإن كثرت المهامّ', () => {
    const list = complete({ assessmentTypes: ['assignment', 'quiz'] })
    expect(row(list, 'project').done).toBe(false)
    expect(blockingBeforeSubmit(list).map((c) => c.key)).toEqual(['project'])
  })

  it('⚠️ ومشروعُ التخرّج وحدَه لا يكفي — المهامُّ العمليّةُ صفٌّ غيرُه', () => {
    const list = complete({ assessmentTypes: ['project', 'project'] })
    expect(row(list, 'assignments').done).toBe(false)
    expect(row(list, 'project').done).toBe(true)
  })

  it('وبهما معا يُرسَل', () => {
    const list = complete({ assessmentTypes: ['assignment', 'project'] })
    expect(blockingBeforeSubmit(list)).toEqual([])
  })

  it('وما اعتُمد قبل القرار بلا مشروعٍ يمضي كما اعتُمد', () => {
    expect(row(complete({ assessmentTypes: ['assignment', 'quiz'], planStatus: 'approved' }), 'project').done).toBe(true)
  })
})

describe('اللقاءاتُ بمحاورها', () => {
  it('⚠️ محورٌ بلا لقاءٍ مباشرٍ يحجب — ويُكتب المغطّى في السطر', () => {
    const list = complete({ sessions: meetings.slice(1) })
    expect(row(list, 'sessions').done).toBe(false)
    expect(row(list, 'sessions').labelAr).toContain('6/8')
  })

  it('⚠️ وما انعقد قبل اليوم لا يحجب — لا بالربط ولا بالمدّة', () => {
    /* لقاءٌ حضره متعلّمون قبل أن تُحدَّد المدّةُ الجديدة: لا يُحذف ولا يُنقل */
    const held = { title: 'انعقد', startsAt: new Date('2026-09-01T17:00:00.000Z'), endsAt: new Date('2026-09-01T19:00:00.000Z'), recordings: [] as unknown[], moduleIds: [] as string[] }
    const NOW = new Date('2027-01-10T12:00:00.000Z')
    const list = complete({ sessions: [...meetings, held], now: NOW })
    expect(row(list, 'sessions').done, 'حُوسب ما انعقد').toBe(true)
    expect(row(list, 'sessions').labelAr, 'عُدَّ المنعقدُ خارجَ المدّة').not.toContain('خارجَ مدّة الشعبة')
    /* والقادمُ خارجَ المدّة يحجب كما كان */
    const later = { ...held, moduleIds: ['M1'], startsAt: new Date('2027-03-20T17:00:00.000Z'), endsAt: new Date('2027-03-20T19:00:00.000Z') }
    expect(row(complete({ sessions: [...meetings, later], now: NOW }), 'sessions').done).toBe(false)
  })

  it('⚠️ والجلسةُ المسجّلةُ خارجَ موعد محورها تحجب — وداخلَه لا', () => {
    const outside = [{ title: 'مسجّل', url: 'https://x.test/v', category: 'recorded', moduleId: 'M3', opensAt: '2027-02-08T06:00:00.000Z' }]
    expect(row(complete({}, { resources: [...outside, { title: 'مرجع', url: 'https://x.test/a' }] }), 'sessions').done).toBe(false)
    const inside = [{ ...outside[0], opensAt: '2027-02-15T06:00:00.000Z' }]
    expect(row(complete({}, { resources: [...inside, { title: 'مرجع', url: 'https://x.test/a' }] }), 'sessions').done).toBe(true)
  })
})

describe('المهامُّ والمصادرُ بمحاورها', () => {
  it('⚠️ مهمّةٌ بلا محورٍ تحجب — ويُسمّى العددُ في السطر', () => {
    const list = complete({ assessmentModuleIds: ['M1', null] })
    expect(row(list, 'assignments').done).toBe(false)
    expect(row(list, 'assignments').labelAr).toContain('مهمّةٌ غيرُ مربوطةٍ بمحور')
  })

  it('⚠️ ومهمّةٌ بمحورٍ حُذف من الخطّة كالتي بلا محور', () => {
    expect(row(complete({ assessmentModuleIds: ['M1', 'M99'] }), 'assignments').done).toBe(false)
  })

  it('⚠️ ومصدرٌ مربوطٌ بمحورٍ حُذف يحجب — والذي بلا محورٍ للشعبة كلِّها جائز', () => {
    const orphan = complete({}, { resources: [{ title: 'مرجع', url: 'https://x.test/a', moduleId: 'M99' }] })
    expect(row(orphan, 'resources').done).toBe(false)
    expect(row(orphan, 'resources').labelAr).toContain('بمحورٍ حُذف')
    expect(row(complete({}, { resources: [{ title: 'مرجع', url: 'https://x.test/a' }] }), 'resources').done).toBe(true)
  })
})

/* ═══ وما أُرسل أو اعتُمد قبل المواعيد يمضي كما بدأ ═══

   «الشعبُ الجاريةُ تنتهي بطريقتها» — ولا يُكتب «لم يتمّ» على شعبةٍ لأنّ
   حقلا وُلد بعدها. والمسودّةُ لا تُعفى: متى عُدّلت لزمتها المواعيد. */
describe('ما سبق المواعيدَ لا يُحاسَب بها', () => {
  const legacy = (planStatus: 'approved' | 'published' | 'submitted') => complete(
    { planStatus, sessions: meetings.map((m) => ({ ...m, moduleIds: [] })), assessmentModuleIds: [null, null] },
    { slots: [] },
  )

  it('⚠️ المعتمَدُ والمنشورُ والمرسَلُ بلا مواعيدَ تامٌّ في محاوره وكرّاساته ومهامّه', () => {
    for (const s of ['approved', 'published', 'submitted'] as const) {
      const list = legacy(s)
      expect(row(list, 'modules').done, `${s}: المحاور`).toBe(true)
      expect(row(list, 'workbooks').done, `${s}: الكرّاسات`).toBe(true)
      expect(row(list, 'assignments').done, `${s}: المهامّ`).toBe(true)
      /* ويُحكم في لقاءاته بالعدد كما اعتُمد — خمسةُ لقاءاتٍ لثمانية محاور لا تكفي */
      expect(row(list, 'sessions').done, `${s}: اللقاءات بالعدد`).toBe(false)
    }
  })

  it('⚠️ والمسودّةُ بلا مواعيدَ لا تُعفى', () => {
    const list = complete({ assessmentModuleIds: [null, null] }, { slots: [] })
    expect(row(list, 'modules').done).toBe(false)
    /* والكرّاسةُ الواحدةُ لا تتعلّق بالمواعيد (٣٠ سبتمبر ٢٠٢٦) — فتمّت بنفسها،
       والمسودّةُ محجوبةٌ بالمحاور والمهامّ */
    expect(row(list, 'workbooks').done).toBe(true)
    expect(row(list, 'assignments').done).toBe(false)
  })
})

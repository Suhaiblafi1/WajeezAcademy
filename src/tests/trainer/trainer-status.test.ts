/* حالُ المدرّب وما ينتظره في «المدربون» (٢٠ أكتوبر ٢٠٢٦) — `trainer-status.ts`.

   ① لكلّ خطوةٍ صاحبُها: ما على الإدارة «منك»، وما على المدرّب «منه».
   ② وحالٌ واحدةٌ بترتيبٍ ثابت: موقوف، ثمّ اسمُه لا يظهر، ثمّ ينتظرك، ثمّ ينتظره، ثمّ لا شيء ينتظر.
   ⑤ ومرحلةٌ مستقلّةٌ على سلّم دوراته (٢٤ أكتوبر ٢٠٢٦): لا دورة مؤهل لها · مؤهل ولم يوافق · وافق وفتح شعبة · جاهز.
   ③ والعقدُ لا يُقرأ لمن طلبُه نشط — والدعوةُ لمن لا حسابَ له عليه هو.
   ④ والغائبُ بطلبٍ غيرِ نشطٍ لا يُطلب اعتمادُ ظهوره — الزرُّ يرفضه — بل يقال طورُ طلبه.
   ⑥ وما ينتظر في طابور التأهيل يُعدّ بدالّةٍ واحدةٍ لبطاقته وملفّه (`queueOf`)، وسلّمُه في خطّ ملفّه (`ladderOf`). */

import { describe, expect, it } from 'vitest'
import {
  approvedToAccept, firstActOf, ladderOf, queueOf, quietLineAr, stateChipAr, stepsLineAr, TRAINER_STAGES, TRAINER_STATES,
  trainerStageOf, trainerStateOf, trainerSteps, type QueueRequest, type StatusInput,
} from '@/application/trainer/trainer-status'

const base: StatusInput = {
  suspended: false, hasAccount: true, applicationStatus: 'active',
  publiclyVisible: true, isVerified: true, hasLiveCourse: true,
  photoUrl: '/p.jpg', pendingPhotoUrl: null, pendingText: null,
  pitchDraft: null, bioDraft: null, pitchLatest: null, bioLatest: null,
  cohorts: [{ status: 'open', plan: 'approved', postponedTo: null }],
  contract: { status: 'countersigned' },
  queue: { requests: 0, toAccept: 0 },
}
const t = (over: Partial<StatusInput>): StatusInput => ({ ...base, ...over })
const ars = (x: StatusInput, turn: 'you' | 'trainer') => trainerSteps(x).filter((s) => s.turn === turn).map((s) => s.ar)

describe('حال المدرب وما ينتظره', () => {
  it('⚠️ ① خطة أرسلها تنتظرك، وخطة لم يكتبها تنتظره', () => {
    const x = t({ cohorts: [
      { status: 'draft', plan: 'submitted', postponedTo: null },
      { status: 'draft', plan: null, postponedTo: null },
      { status: 'draft', plan: 'draft', postponedTo: null },
      { status: 'draft', plan: 'changes_requested', postponedTo: null },
    ] })
    expect(ars(x, 'you')).toEqual(['اعتماد خطة شعبة'])
    expect(ars(x, 'trainer')).toEqual(['كتابة خطط شعبتين', 'تعديل خطة شعبة رددتها'])
    expect(trainerStateOf(x)).toBe('you')
  })

  it('والمؤجلة والمنتهية والملغاة لا تنتظر أحدا', () => {
    const x = t({ cohorts: [
      { status: 'draft', plan: 'changes_requested', postponedTo: '2027-02-01' },
      { status: 'completed', plan: null, postponedTo: null },
      { status: 'cancelled', plan: 'submitted', postponedTo: null },
    ] })
    expect(trainerSteps(x)).toEqual([])
    expect(trainerStateOf(x)).toBe('quiet')
  })

  it('⚠️ ② الحال بترتيبها: موقوف قبل كل شيء، ثم اسمه لا يظهر، ثم ينتظرك، ثم ينتظره', () => {
    const busy = { pendingPhotoUrl: '/new.jpg', cohorts: [{ status: 'draft', plan: null, postponedTo: null }] }
    expect(trainerStateOf(t({ ...busy, suspended: true }))).toBe('suspended')
    expect(trainerSteps(t({ ...busy, suspended: true }))).toEqual([])
    expect(trainerStateOf(t({ ...busy, publiclyVisible: false }))).toBe('hidden')
    expect(trainerStateOf(t(busy))).toBe('you')
    expect(trainerStateOf(t({ cohorts: busy.cohorts }))).toBe('trainer')
    expect(trainerStateOf(t({}))).toBe('quiet')
    expect(trainerStateOf(t({ cohorts: [] }))).toBe('quiet')
  })

  it('⚠️ ③ العقد يقرأ لمن طلبه غير نشط وحده، ولكل حال صاحبها', () => {
    const pending = (status: string | null, app = 'contract_pending') =>
      t({ applicationStatus: app, contract: status ? { status } : null, hasLiveCourse: false, publiclyVisible: false })
    expect(ars(pending('sent'), 'trainer')).toContain('توقيع عقده')
    expect(ars(pending('signed'), 'you')).toContain('اعتماد توقيعه على العقد')
    expect(ars(pending('draft'), 'you')).toContain('إرسال عقده')
    expect(ars(pending('amendment_requested'), 'you')).toContain('الرد على طلب تعديل عقده')
    expect(ars(pending(null, 'conditionally_approved'), 'you')).toContain('تجهيز عقده وإرساله')
    expect(trainerSteps(pending('signature_approved'))).toEqual([])
    /* والنشطُ عقدُه وراءه — ولو كان آخرُه منتهيا */
    expect(trainerSteps(t({ contract: { status: 'expired' } }))).toEqual([])
  })

  it('ومن دعي ولم ينشئ حسابه فعليه، ومن لا حساب له قبل ذلك فعليك', () => {
    expect(ars(t({ hasAccount: false, applicationStatus: 'onboarding', contract: { status: 'signature_approved' } }), 'trainer'))
      .toContain('إنشاء حسابه من الدعوة')
    expect(ars(t({ hasAccount: false, applicationStatus: 'under_review', contract: null }), 'you')[0]).toBe('اعتماده مدربا — لا حساب له بعد')
  })

  it('⚠️ ومن له عقد قائم فخطوة العقد تكفي — اعتماد توقيعه يربط حسابه (٢٠ أكتوبر ٢٠٢٦)', () => {
    const noAccount = (status: string) => t({
      hasAccount: false, applicationStatus: 'conditionally_approved', contract: { status },
      hasLiveCourse: false, publiclyVisible: false, cohorts: [],
    })
    /* «لينا»: عقدها عندها — فلا شيء عليك */
    expect(ars(noAccount('sent'), 'you')).toEqual([])
    expect(ars(noAccount('sent'), 'trainer')).toEqual(['توقيع عقده'])
    expect(trainerStateOf(noAccount('sent'))).toBe('trainer')
    /* و«فداء»: عقدها انتهى — خطوة واحدة لا اثنتان */
    expect(ars(noAccount('expired'), 'you')).toEqual(['إرسال عقد جديد له'])
    /* ولا يقال «قبوله من طلبات المدربين» لأحد بعد اليوم */
    for (const status of ['sent', 'expired', 'declined', 'signed']) {
      expect(ars(noAccount(status), 'you').some((a) => a.includes('طلبات المدربين'))).toBe(false)
    }
  })

  it('⚠️ ④ الغائب بطلب نشط: اعتماد ظهوره عليك — وبطلب غير نشط يقال طور طلبه', () => {
    const hiddenActive = t({ publiclyVisible: false })
    expect(ars(hiddenActive, 'you')[0]).toMatch(/^اعتماد ظهوره/)
    expect(quietLineAr('hidden', 'active', 'ready')).toBeNull()

    const hiddenOnboarding = t({ publiclyVisible: false, applicationStatus: 'onboarding', contract: { status: 'signature_approved' } })
    expect(ars(hiddenOnboarding, 'you').some((a) => a.startsWith('اعتماد ظهوره'))).toBe(false)
    expect(trainerStateOf(hiddenOnboarding)).toBe('hidden')
    expect(quietLineAr('hidden', 'onboarding', 'eligible')).toBe('يظهر حين ينشط طلبه — طلبه الآن: تهيئة')
  })

  it('والطابور: طلبات التأهيل عليك، والدورات التي لم يقبلها عليه', () => {
    const x = t({ queue: { requests: 1, toAccept: 3 } })
    expect(ars(x, 'you')).toContain('البت في طلب تأهيل')
    expect(ars(x, 'trainer')).toContain('الموافقة على 3 دورات مؤهل لها')
  })

  it('⚠️ والمعتمدة بلا شعبة تنتظره هو لا «بلا شعبة» — ومن انتهت شعبته فيها لا يعرض عليه قبولها', () => {
    const qualifications = [
      { courseId: 'a', status: 'qualified' },
      { courseId: 'b', status: 'qualified' },
      { courseId: 'c', status: 'qualified' },
      { courseId: 'd', status: 'pending' },
      { courseId: 'e', status: 'rejected' },
    ]
    const cohorts = [
      { courseId: 'b', status: 'completed' },
      { courseId: 'c', status: 'cancelled' },
    ]
    /* a بلا شعبة، وc شعبتها ملغاة فكأن لا شعبة. وb انتهت شعبتها، والمعلقة والمرفوضة ليستا معتمدتين */
    expect(approvedToAccept({ qualifications, cohorts })).toBe(2)

    const x = t({ cohorts: [], queue: { requests: 0, toAccept: approvedToAccept({ qualifications: [qualifications[0]], cohorts: [] }) } })
    expect(ars(x, 'trainer')).toContain('الموافقة على دورة مؤهل لها')
    expect(trainerStateOf(x)).toBe('trainer')
    expect(approvedToAccept({ qualifications: [qualifications[1]], cohorts: [cohorts[0]] })).toBe(0)
  })

  it('والاقتراحات: المسودة عليك لمن تصله، والمرسل الذي لم يجب عليه', () => {
    expect(ars(t({ pitchDraft: ['سطر'], bioDraft: 'نبذة' }), 'you')).toContain('إرسال اقتراحي «لماذا نفتخر به» والنبذة')
    /* ومن لا يصله الإرسال لا تعد مسودته عليك */
    expect(ars(t({ pitchDraft: ['سطر'], applicationStatus: 'onboarding', hasLiveCourse: false, publiclyVisible: false, contract: { status: 'signature_approved' } }), 'you'))
      .not.toContain('إرسال اقتراح «لماذا نفتخر به»')
    expect(ars(t({ pitchLatest: { status: 'pending' } }), 'trainer')).toContain('الرد على اقتراحنا')
  })

  it('وسطر الصاحب يجمع خطواته بفاصل، ولا سطر لمن لا خطوة له', () => {
    const steps = trainerSteps(t({ pendingText: { at: 'x' }, pendingPhotoUrl: '/n.jpg', photoUrl: null }))
    expect(stepsLineAr(steps, 'you')).toBe('المطلوب منك: مراجعة نبذته وصورته الجديدتين')
    expect(stepsLineAr(steps, 'trainer')).toBeNull()
    expect(stepsLineAr(trainerSteps(t({ photoUrl: null })), 'trainer')).toBe('المطلوب منه: رفع صورته')
  })

  /* ⑤ (٢١ أكتوبر ٢٠٢٦) «يجب أن يأخذني الزرُّ للإجراء الذي ينتظرني» — وكان زرُّ البطاقة «اعتمده مدربا» لكلّ من لم
     ينشط، والمطلوبُ منك تجهيزُ عقده. و«ينتظرك» يحمل المطلوب. */
  it('⚠️ ⑤ زر البطاقة باب أولى خطواتك، و«ينتظرك» يقول ما ينتظر', () => {
    /* أحمد: قبل قبولا مشروطا، ولا عقد ولا حساب، وعرضت عليه دورات ولا صورة له */
    const x = t({
      applicationStatus: 'conditionally_approved', hasAccount: false, contract: null, photoUrl: null,
      hasLiveCourse: false, publiclyVisible: false, cohorts: [], queue: { requests: 0, toAccept: 10 },
    })
    const steps = trainerSteps(x)
    expect(trainerStateOf(x, steps)).toBe('you')
    expect(firstActOf(steps)?.act).toBe('contract_new')
    expect(stateChipAr('you', steps)).toBe('ينتظرك: تجهيز عقده وإرساله')
    /* والسطرُ لا يكرّر ما في الوسم */
    expect(stepsLineAr(steps, 'you', 1)).toBeNull()

    /* ومن لا عقد له يعتمد مدربا — فزرّه الاعتماد، والوسم بلا شرح ما بعد الشرطة */
    const y = t({ applicationStatus: 'under_review', hasAccount: false, contract: null, hasLiveCourse: false, publiclyVisible: false })
    const ys = trainerSteps(y)
    expect(firstActOf(ys)?.act).toBe('approve')
    expect(stateChipAr('you', ys)).toBe('ينتظرك: اعتماده مدربا')

    /* وخطوتان منك: الأولى في الوسم، والثانية «وأيضا منك» */
    const z = trainerSteps(t({ pendingPhotoUrl: '/n.jpg', cohorts: [{ status: 'draft', plan: 'submitted', postponedTo: null }] }))
    expect(stateChipAr('you', z)).toBe('ينتظرك: اعتماد خطة شعبة')
    expect(firstActOf(z)?.act).toBe('plans')
    expect(stepsLineAr(z, 'you', 1)).toBe('وأيضا منك: مراجعة صورته الجديدة')

    /* وسائرُ الحالات وسمُها اسمُها */
    expect(stateChipAr('trainer', trainerSteps(t({ photoUrl: null })))).toBe('ينتظر المدرب')
  })

  /* ⑤ «هناك العديد بلا شعبة ولا يظهروا في الفلتر!!!» (صاحب المنصّة، ٢٤ أكتوبر ٢٠٢٦): كان «بلا شعبة» حالا يأخذ
     من لا ينتظر شيئا وحدَه، فمن بلا شعبةٍ وينقصه رفعُ صورةٍ أو موافقةٌ على دورةٍ كان في «ينتظر المدرب». */
  it('⚠️ ⑤ من بلا شعبة يرى في مرحلته ولو كان ينتظر شيئا — والمرحلة لا تتبع الحال', () => {
    const quals = [{ status: 'pending' }]
    const noCohort = t({ cohorts: [], photoUrl: null, queue: { requests: 0, toAccept: 1 } })
    expect(trainerStateOf(noCohort)).toBe('trainer')
    expect(trainerStageOf({ qualifications: quals, cohorts: noCohort.cohorts })).toBe('eligible')
    /* والحالُ لا تحمل مرحلةً بعد: لا «جاهز» ولا «بلا شعبة» فيها، فلا يقع مدرّبٌ في غير مكانه */
    expect(TRAINER_STATES.map((x) => x.id)).toEqual(['hidden', 'you', 'trainer', 'quiet', 'suspended'])
    expect(TRAINER_STAGES.map((x) => x.ar)).toEqual(['لا دورة مؤهل لها', 'مؤهل ولم يوافق', 'وافق وفتح شعبة', 'جاهز'])
  })

  it('⚠️ ⑤ السلم: مؤهل لها ما لم يعتذر أو يرفض · وافق = له شعبة قائمة · جاهز = اعتمدت خطتها', () => {
    const stage = (qualifications: { status: string; requested?: boolean }[], cohorts: StatusInput['cohorts']) =>
      trainerStageOf({ qualifications, cohorts })
    /* المؤهل لها: اخترناها له — أجّلها أو لم يبدأ أو لم يوافق. والاعتذار والرفض وطلب التأهيل المعلق ليست تأهيلا */
    expect(stage([{ status: 'pending' }], [])).toBe('eligible')
    expect(stage([{ status: 'qualified' }], [])).toBe('eligible')
    expect(stage([{ status: 'retired' }, { status: 'rejected' }, { status: 'pending', requested: true }], [])).toBe('none')
    /* وافق وفتح شعبة: شعبة قائمة خطتها لم تعتمد — والمؤجلة منها، فالتأجيل لا يسحب موافقته */
    expect(stage([], [{ status: 'draft', plan: null, postponedTo: null }])).toBe('opened')
    expect(stage([], [{ status: 'draft', plan: 'submitted', postponedTo: null }])).toBe('opened')
    expect(stage([], [{ status: 'draft', plan: 'changes_requested', postponedTo: '2027-02-01' }])).toBe('opened')
    /* جاهز: اعتمدت خطة شعبة قائمة له — ولو كانت له غيرها لم تعتمد */
    expect(stage([], [
      { status: 'open', plan: 'approved', postponedTo: null },
      { status: 'draft', plan: 'draft', postponedTo: null },
    ])).toBe('ready')
    expect(stage([], [{ status: 'active', plan: 'published', postponedTo: null }])).toBe('ready')
    /* والمنتهية والملغاة وراءه: لا تجعله جاهزا ولا موافقا لفصل قادم */
    expect(stage([{ status: 'qualified' }], [
      { status: 'completed', plan: 'approved', postponedTo: null },
      { status: 'cancelled', plan: 'draft', postponedTo: null },
    ])).toBe('eligible')
  })

  it('وسطر «لا شيء ينتظر» يقول مرحلته', () => {
    expect(quietLineAr('quiet', 'active', 'ready')).toBe('لا شيء ينتظر — اعتمدت خطة شعبته')
    expect(quietLineAr('quiet', 'active', 'eligible')).toBe('لا شيء ينتظر — لا شعبة قادمة له. يسند من صفحة الشعبة')
    expect(quietLineAr('you', 'active', 'eligible')).toBeNull()
  })

  it('واسمه الجديد يقال في خطوة المراجعة، وبابها ملفه', () => {
    const s = trainerSteps(t({ pendingText: { name: 'أحمد الصيفي', at: 'x' } }))
    expect(s.filter((x) => x.turn === 'you').map((x) => x.ar)).toEqual(['مراجعة اسمه الجديد ونبذته'])
    expect(firstActOf(s)?.act).toBe('profile')
    expect(ars(t({ pendingText: { name: null, at: 'x' } }), 'you')).toEqual(['مراجعة نبذته الجديدة'])
  })
})

describe('⑥ طابور التأهيل وسلّمه', () => {
  const P = 'p-1'
  const req = (kind: QueueRequest['kind'], profile = P, state?: string): QueueRequest =>
    ({ kind, profile: { id: profile }, prep: state ? { state } : null })

  it('⚠️ طلباته وحده — والدورة التي يعدها ليست طلبا', () => {
    const q = queueOf({ profileId: P, qualifications: [], cohorts: [] },
      [req('request'), req('request'), req('request', 'p-2'), req('preparing', P, 'preparing')])
    expect(q.requests).toBe(2)
  })

  it('⚠️ وما عرض عليه ولم يوافق: إعداد لم يبدأ — ومعتمدة بلا شعبة', () => {
    const q = queueOf(
      { profileId: P, qualifications: [{ courseId: 'c1', status: 'qualified' }], cohorts: [] },
      [req('preparing', P, 'to_decide'), req('preparing', P), req('preparing', P, 'submitted'), req('preparing', 'p-2', 'to_decide')],
    )
    expect(q.toAccept, 'إعدادان لم يوافق عليهما ودورة معتمدة بلا شعبة').toBe(3)
  })

  it('⚠️ سلّمه: ما بلغه مضى، والذي هو فيه الآن، وما بعده لم يبلغه', () => {
    expect(ladderOf('opened', false).steps.map((x) => `${x.ar}:${x.state}`))
      .toEqual(['مؤهل لها:done', 'وافق وفتح شعبة:now', 'جاهز:ahead'])
    /* و«مؤهل ولم يوافق» ما دام فيها — فإذا جاوزها وافق، فلا يقال «لم يوافق» بعلامة «تم» */
    expect(ladderOf('eligible', false).steps[0]).toMatchObject({ ar: 'مؤهل ولم يوافق', state: 'now' })
    expect(ladderOf('ready', false).steps.map((x) => x.state)).toEqual(['done', 'done', 'now'])
    expect(ladderOf('eligible', false).aside).toBeNull()
  })

  it('⚠️ و«لا دورة مؤهل لها» و«متوقف» جانبه لا عليه', () => {
    const none = ladderOf('none', false)
    expect(none.steps.every((x) => x.state === 'ahead')).toBe(true)
    expect(none.aside).toBe('لا دورة مؤهل لها')
    expect(ladderOf('ready', true).aside).toBe('متوقف')
  })
})

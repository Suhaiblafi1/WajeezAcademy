/* حالُ المدرّب وما ينتظره في «المدربون» (٢٠ أكتوبر ٢٠٢٦) — `trainer-status.ts`.

   ① لكلّ خطوةٍ صاحبُها: ما على الإدارة «منك»، وما على المدرّب «منه».
   ② وحالٌ واحدةٌ بترتيبٍ ثابت: موقوف، ثمّ اسمُه لا يظهر، ثمّ ينتظرك، ثمّ ينتظره، ثمّ جاهز، ثمّ بلا شعبة.
   ③ والعقدُ لا يُقرأ لمن طلبُه نشط — والدعوةُ لمن لا حسابَ له عليه هو.
   ④ والغائبُ بطلبٍ غيرِ نشطٍ لا يُطلب اعتمادُ ظهوره — الزرُّ يرفضه — بل يقال طورُ طلبه. */

import { describe, expect, it } from 'vitest'
import { approvedToAccept, quietLineAr, stepsLineAr, trainerStateOf, trainerSteps, type StatusInput } from '@/application/trainer/trainer-status'

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
    expect(trainerStateOf(x)).toBe('ready')
  })

  it('⚠️ ② الحال بترتيبها: موقوف قبل كل شيء، ثم اسمه لا يظهر، ثم ينتظرك، ثم ينتظره', () => {
    const busy = { pendingPhotoUrl: '/new.jpg', cohorts: [{ status: 'draft', plan: null, postponedTo: null }] }
    expect(trainerStateOf(t({ ...busy, suspended: true }))).toBe('suspended')
    expect(trainerSteps(t({ ...busy, suspended: true }))).toEqual([])
    expect(trainerStateOf(t({ ...busy, publiclyVisible: false }))).toBe('hidden')
    expect(trainerStateOf(t(busy))).toBe('you')
    expect(trainerStateOf(t({ cohorts: busy.cohorts }))).toBe('trainer')
    expect(trainerStateOf(t({}))).toBe('ready')
    expect(trainerStateOf(t({ cohorts: [] }))).toBe('idle')
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
    expect(quietLineAr('hidden', 'active')).toBeNull()

    const hiddenOnboarding = t({ publiclyVisible: false, applicationStatus: 'onboarding', contract: { status: 'signature_approved' } })
    expect(ars(hiddenOnboarding, 'you').some((a) => a.startsWith('اعتماد ظهوره'))).toBe(false)
    expect(trainerStateOf(hiddenOnboarding)).toBe('hidden')
    expect(quietLineAr('hidden', 'onboarding')).toBe('يظهر حين ينشط طلبه — طلبه الآن: تهيئة')
  })

  it('والطابور: طلبات التأهيل عليك، والدورات التي لم يقبلها عليه', () => {
    const x = t({ queue: { requests: 1, toAccept: 3 } })
    expect(ars(x, 'you')).toContain('البت في طلب تأهيل')
    expect(ars(x, 'trainer')).toContain('قبول 3 دورات عرضت عليه')
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
    expect(ars(x, 'trainer')).toContain('قبول دورة عرضت عليه')
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
})

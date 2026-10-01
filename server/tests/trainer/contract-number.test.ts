/* ═══ رقمُ العقد — `WJ-CT-<سنة>-<خمسة أرقام>` (١ أكتوبر ٢٠٢٦) ═══

   قولُ صاحب المنصّة بعد أن حُذف رقمُ الإصدار من الشاشات: «make a number for
   contract instead of version that we deleted!.. so he knows the reference
   number of the contract he/she signed». ويُقاس هنا ما يقع فعلا:

   ① التركيبُ يصرف رقما بالصيغة، ويُطبَع أوّلَ ترويسة المتن — والمطبوعُ هو المحفوظ.
   ② ولا يأخذ عقدان رقما واحدا ولو رُكّبا في اللحظة نفسِها.
   ③ وكلُّ صفٍّ يُنشأ من أيّ بابٍ له رقم — القاعدةُ تملؤه إن لم يُمرَّر.
   ④ والبديلُ رقمٌ جديد، والمحدَّثُ رقمُه، والمعاينةُ لا تصرف رقما.
   ⑤ ويصل صاحبَه: في رسالة العرض، وفي رسالة «سُجّل توقيعُك»، وفي «عقدي». */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

const outbox = vi.hoisted(() => [] as { to: string; subject: string; text: string }[])
vi.mock('../../services/notification.service', async (orig) => {
  const real = await orig<typeof import('../../services/notification.service')>()
  return {
    ...real,
    sendDirectEmail: async (_p: unknown, input: { to: string; subject: string; text: string }) => {
      outbox.push({ to: input.to, subject: input.subject, text: input.text })
      return { status: 'sent' as const }
    },
  }
})

import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { EarningsService } from '../../services/earnings.service'
import { CONTRACT_NUMBER_PENDING_AR, contractAcks } from '../../../src/application/trainer/contract-body'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const COURSE = 'C-CONTRACT-NO-101'
const DAY = 86_400_000
const NUMBER_RE = /^WJ-CT-\d{4}-\d{5,}$/
const tokenOf = (url: string) => decodeURIComponent(url.split('/c/')[1])

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  adminId = (await auth.register('contract-no-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')).userId
  await auth.setRoles(adminId, ['academic_manager'])
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({
    data: { courseId: COURSE, version: 1, titleAr: 'أساسيّاتُ المحاسبة', totalHours: 10 },
  })
}, 240_000)

beforeEach(() => { outbox.length = 0 })

let seq = 0
const INPUT = {
  title: 'اتفاقية تقديم خدمات تدريبية',
  requiredDocuments: [{ kind: 'national_id', labelAr: 'الهويّة', required: true }],
}

/** مرشّحٌ له حسابٌ وملفٌّ وقاعدةُ أتعاب — جاهزٌ لأن يُركَّب له عقد */
async function candidate() {
  /* ═══ والعدّادُ يُقرأ مرّةً قبل أوّل انتظار ═══
     الحالةُ ② تنادي هذه مرّتين معا. وكان `seq` يُقرأ ثانيةً في `reference`
     بعد `await` — وقد زاده النداءُ الآخر — فيأخذ الطلبان رقما واحدا في
     الجزء نفسِه من الثانية، ويسقط الفحصُ على قيد التفرّد لا على ما يحرسه. */
  const n = ++seq
  const email = `contract-no-${n}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', 'مدرّبٌ مرقَّم')
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-NO-${Date.now()}-${n}`, fullName: 'مدرّبٌ مرقَّم', email,
      status: 'conditionally_approved', motivation: 'اختبار',
      privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: user.userId, isVerified: true },
  })
  await prisma.trainerCourseQualification.create({
    data: { profileId: profile.id, courseId: COURSE, status: 'qualified' },
  })
  await new EarningsService(prisma).setRule(adminId, { profileId: profile.id, type: 'per_seat', rate: 25, minSeats: 0 })
  return { application, profile, userId: user.userId, email }
}

const compose = (applicationId: string) => review.composeContract(applicationId, adminId, {
  ...INPUT, orientationAt: new Date(Date.now() + 3 * DAY).toISOString(),
})

describe('① التركيبُ يصرف رقما — ويُطبَع أوّلَ الترويسة', () => {
  it('⚠️ بالصيغة، والمطبوعُ في المتن هو المحفوظُ في الصفّ', async () => {
    const { application } = await candidate()
    const c = await compose(application.id)
    expect(c.number, 'رقمٌ على غير الصيغة').toMatch(NUMBER_RE)
    expect(c.number.slice(6, 10), 'السنةُ في الرقم غيرُ سنة الإصدار')
      .toBe(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Amman' }).format(new Date()))
    expect(c.bodyAr, 'الرقمُ لا يُطبَع في المتن — فلا يعرف من وقّع رقمَ ما وقّعه')
      .toContain(`رقم العقد: ${c.number}`)
    /* أوّلُ الترويسة: بعد العنوان وقبل «المرجع» — فلا يُخلط برقم الطلب */
    const head = (c.bodyAr ?? '').split('\n').slice(0, 6).join('\n')
    expect(head.indexOf('رقم العقد:'), 'الرقمُ ليس في الترويسة').toBeGreaterThan(-1)
    expect(head.indexOf('رقم العقد:'), 'الرقمُ بعد «المرجع» — فيُقرأ رقمُ الطلب أوّلا')
      .toBeLessThan(head.indexOf('المرجع:'))
    expect(c.bodyHash, 'البصمةُ لا تشمل الرقم — فيُبدَّل تحت الموقِّع').toBe(sha256(c.bodyAr ?? ''))
  })
})

describe('② ولا يأخذ عقدان رقما واحدا', () => {
  it('⚠️ ولو رُكّبا في اللحظة نفسِها', async () => {
    const [a, b] = await Promise.all([candidate(), candidate()])
    const [x, y] = await Promise.all([compose(a.application.id), compose(b.application.id)])
    expect(x.number, 'عقدان برقمٍ واحد').not.toBe(y.number)
  })
})

describe('③ وكلُّ صفٍّ له رقم — من أيّ بابٍ أُنشئ', () => {
  it('⚠️ صفٌّ يُنشأ بلا رقمٍ تملؤه القاعدة', async () => {
    const { profile } = await candidate()
    const row = await prisma.trainerContract.create({
      data: { profileId: profile.id, title: 'من البابِ القديم', status: 'draft' },
    })
    expect(row.number, 'صفٌّ بلا رقم — فيُقال للمدرّب عقدٌ لا رقمَ له').toMatch(NUMBER_RE)
  })
})

describe('④ البديلُ رقمٌ جديد، والمحدَّثُ رقمُه، والمعاينةُ لا تصرف رقما', () => {
  it('⚠️ تصحيحُ الاسم يُنشئ عقدا برقمٍ غيرِ رقم ما حلّ محلَّه', async () => {
    const { application } = await candidate()
    const old = await compose(application.id)
    await review.sendContract(old.id, adminId)
    const r = await review.reissueWithCorrectedName(old.id, adminId, { legalNameAr: 'مدرّبٌ باسمه الصحيح' })
    const next = await prisma.trainerContract.findUniqueOrThrow({ where: { id: r.contractId } })
    expect(next.number, 'البديلُ برقم ما حلّ محلَّه — فلا يُعرف أيُّهما بين يديه').not.toBe(old.number)
    expect(next.bodyAr).toContain(`رقم العقد: ${next.number}`)
  })

  it('⚠️ وتحديثُ النصّ يُبقي رقمَه', async () => {
    const { application } = await candidate()
    const c = await compose(application.id)
    await review.sendContract(c.id, adminId)
    /* عرضٌ رُكّب قبل الرقم — بلا سطره وعلى إصدارٍ سابق — فيُعاد تصييرُه */
    const before = (c.bodyAr ?? '').replace(`رقم العقد: ${c.number}\n`, '')
    expect(before, 'لم يُنزَع السطرُ — فالسقالةُ لا تحاكي عرضا قديما').not.toContain('رقم العقد:')
    await prisma.trainerContract.update({
      where: { id: c.id }, data: { bodyVersion: 'v1-2026-01-01', bodyAr: before, bodyHash: sha256(before) },
    })
    await review.refreshOpenContracts(adminId, { notify: false })
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(after.bodyUpdatedAt, 'لم يُحدَّث — فالقياسُ لا يقول شيئا').not.toBeNull()
    expect(after.number).toBe(c.number)
    expect(after.bodyAr, 'التحديثُ أسقط رقمَه من المتن').toContain(`رقم العقد: ${c.number}`)
  })

  it('والمعاينةُ تقول موضعَه ولا تصرف رقما', async () => {
    /* مرشّحان: لا يُركَّب لواحدٍ عقدان وأحدُهما مفتوح (`contract_open`) */
    const [a, b] = [await candidate(), await candidate()]
    const before = await compose(a.application.id)
    const shown = await review.previewContract(b.application.id, INPUT)
    expect(shown).toContain(`رقم العقد: ${CONTRACT_NUMBER_PENDING_AR}`)
    const after = await compose(b.application.id)
    const n = (s: string) => Number(s.split('-').pop())
    /* والمعاينةُ بينهما لم تأخذ رقما: التالي يلي السابقَ — إلّا أن يسبقه تركيبٌ في
       ملفٍّ آخر، والملفّاتُ لا تجري متوازية */
    expect(n(after.number) - n(before.number), 'المعاينةُ صرفت رقما').toBe(1)
  })
})

describe('⑤ ويصل صاحبَه', () => {
  it('⚠️ في رسالة العرض، وفي «سُجّل توقيعُك»، وفي «عقدي»', async () => {
    const { application, userId } = await candidate()
    const c = await compose(application.id)
    const sent = await review.sendContract(c.id, adminId)
    expect(outbox.at(-1)?.text, 'رسالةُ العرض بلا رقمه').toContain(c.number)

    await prisma.trainerContractDocument.create({
      data: {
        contractId: c.id, kind: 'national_id', storageKey: `k-${c.id}`,
        originalName: 'id.pdf', mime: 'application/pdf', sizeBytes: 1024,
      },
    })
    outbox.length = 0
    await review.signContractByToken(tokenOf(sent.signingUrl), {
      legalName: 'مدرّبٌ مرقَّم بالاسم', addressAr: 'عمّان — بناية ١٢', phone: '+962790000000',
      bodyHash: sha256(c.bodyAr ?? ''), acks: contractAcks(c.gatesActivation).map((a) => a.key),
    })
    const signedMail = outbox.find((m) => m.subject.startsWith('سُجّل توقيعُك'))
    expect(signedMail, 'لم تخرج رسالةُ التوقيع').toBeTruthy()
    expect(signedMail!.text, 'رسالةُ «سُجّل توقيعُك» بلا رقم ما وقّعه').toContain(c.number)

    const mine = await review.myContract(userId)
    expect(mine.number, '«عقدي» لا يقول رقمَه').toBe(c.number)
  })
})

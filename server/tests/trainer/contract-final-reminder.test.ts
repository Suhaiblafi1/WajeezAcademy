/* ═══ التذكيرُ الأخيرُ بالتوقيع — مرّةً واحدة، والعرضُ صالحٌ ثلاثةَ أيّام (١ أكتوبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: زرٌّ للعرض المرسَل غير الموقَّع «يذكّر المدرّبَ آخرَ مرّةٍ
   بتوقيع الاتفاقيّة، والعقدُ صالحٌ ثلاثةَ أيّام». ويُقاس هنا ما يقع فعلا:

   ① الرابطُ الجديدُ صالحٌ ثلاثةَ أيّام، والقديمُ يبطل لحظتَها.
   ② والرسالةُ التي خرجت تقول إنّه الأخير، وإلى متى — بالرابط الجديد.
   ③ ومرّةً واحدة: الثاني يُردّ، ولا يُذكَّر إلّا عرضٌ مرسَلٌ لم يُوقَّع.
   ④ وبعد الأجل يسقط: الصفحةُ تقول «انتهى»، والتوقيعُ يُردّ.
   ⑤ وطلبُ الرابط بالبريد (`/contract-link`) لا يمدّ الأجلَ ولا يقصّره: في
      الأجل رابطٌ بالأجل نفسِه، وبعده لا رابطَ بل رسالةٌ تقول إنّ المهلةَ انقضت.

   والبريدُ يُلتقَط عند `sendDirectEmail` كأخيه `contract-resign`: ما يُقاس هو
   ما خرج من الخدمة، لا ما كان ينبغي أن يخرج. */

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
import { contractAcks } from '../../../src/application/trainer/contract-body'
import { CONTRACT_SIGNING_LINK_DAYS, FINAL_REMINDER_DAYS } from '../../../src/application/trainer/notice-periods'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const COURSE = 'C-FINAL-REMIND-101'
const DAY = 86_400_000
const tokenOf = (url: string) => decodeURIComponent(url.split('/c/')[1])

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  adminId = (await auth.register('final-remind-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')).userId
  await auth.setRoles(adminId, ['academic_manager'])
  await prisma.course.create({ data: { id: COURSE, status: 'published', currentVersion: 1 } })
  await prisma.courseVersion.create({
    data: { courseId: COURSE, version: 1, titleAr: 'أساسيّاتُ المحاسبة', totalHours: 10 },
  })
}, 240_000)

beforeEach(() => { outbox.length = 0 })

let seq = 0

/** عرضٌ مرسَلٌ حقيقيٌّ ورمزُه — بانتظار توقيعه */
async function sentContract() {
  seq += 1
  const email = `final-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', 'مدرّبٌ ينتظر')
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-FINAL-${Date.now()}-${seq}`, fullName: 'مدرّبٌ ينتظر', email,
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
  await new EarningsService(prisma).setRule(adminId, {
    profileId: profile.id, type: 'per_seat', rate: 25, minSeats: 0,
  })
  const c = await review.composeContract(application.id, adminId, {
    title: 'اتفاقية تقديم خدمات تدريبية',
    requiredDocuments: [{ kind: 'national_id', labelAr: 'الهويّة', required: true }],
    orientationAt: new Date(Date.now() + 3 * DAY).toISOString(),
  })
  const sent = await review.sendContract(c.id, adminId)
  outbox.length = 0
  return { c, token: tokenOf(sent.signingUrl), email }
}

describe('① رابطٌ جديدٌ صالحٌ ثلاثةَ أيّام، والقديمُ يبطل', () => {
  it('⚠️ الأجلُ ثلاثةُ أيّام من الإرسال — لا يوما نافذة التوقيع', async () => {
    const { c } = await sentContract()
    const before = Date.now()
    const out = await review.sendFinalReminder(c.id, adminId)
    const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(FINAL_REMINDER_DAYS, 'تغيّر الأجلُ عمّا قرّره صاحبُ المنصّة').toBe(3)
    const ms = row.tokenExpiresAt!.getTime() - before
    expect(ms, 'الأجلُ أقصرُ من ثلاثة أيّام').toBeGreaterThan(3 * DAY - 60_000)
    expect(ms, 'الأجلُ أطولُ من ثلاثة أيّام').toBeLessThan(3 * DAY + 60_000)
    expect(row.finalReminderAt, 'لم يُكتب وقتُ التذكير — فيُعرَض الزرُّ ثانية').not.toBeNull()
    expect(out.expiresAt.getTime()).toBe(row.tokenExpiresAt!.getTime())
  })

  it('⚠️ والرابطُ القديمُ يبطل، والجديدُ يفتح العرض', async () => {
    const { c, token: old } = await sentContract()
    const out = await review.sendFinalReminder(c.id, adminId)
    /* والقديمُ لا يُوقَّع منه — ويقول «أرسلنا أحدث» بدل «غيرُ صالح» (`contract-link-states`) */
    expect((await review.contractByToken(old)).state, 'بقي الرابطُ القديمُ يفتح العرض').toBe('replaced')
    await expect(review.signContractByToken(old, {
      legalName: 'مدرّبٌ ينتظر توقيعا', addressAr: 'عمّان', phone: '+962790000000',
      bodyHash: sha256(c.bodyAr ?? ''), acks: contractAcks(c.gatesActivation).map((a) => a.key),
    }), 'وُقّع من الرابط القديم').rejects.toMatchObject({ code: 'invalid_token' })
    expect((await review.contractByToken(tokenOf(out.signingUrl))).state, 'الرابطُ الجديدُ لا يفتح العرض')
      .toBe('open')
  })
})

describe('② الرسالةُ تقول إنّه الأخير — وإلى متى', () => {
  it('⚠️ خرجت إلى صاحبه بالرابط الجديد، وفيها «آخرُ تذكير» والأجلُ بتوقيت عمّان', async () => {
    const { c, email } = await sentContract()
    const out = await review.sendFinalReminder(c.id, adminId)
    expect(outbox, 'لم تخرج رسالة — أو خرجت أكثرُ من واحدة').toHaveLength(1)
    const [mail] = outbox
    expect(mail.to).toBe(email)
    expect(mail.subject, 'العنوانُ لا يقول إنّه تذكيرٌ أخير').toMatch(/^تذكيرٌ أخير: /)
    expect(mail.text, 'لا يقول إنّه آخرُ تذكير').toContain('وهذا آخرُ تذكيرٍ نرسله بها')
    expect(mail.text, 'لا يقول إلى متى').toContain('بتوقيت عمّان')
    /* وما بعد الأجل يُقال بلطفٍ لا بسقوطٍ ونصّ عقد (٢ أكتوبر ٢٠٢٦) */
    expect(mail.text, 'لا يقول إنّا نعود إليه بعد الأجل').toContain('نعود إليك في الفصول القادمة باتفاقٍ جديد')
    for (const w of ['عرضك', 'عرضُك', 'سقط', 'كما ينصّ عقدُك']) {
      expect(`${mail.subject}\n${mail.text}`, `في التذكير الأخير «${w}»`).not.toContain(w)
    }
    expect(mail.text, 'خرج بغير الرابط الجديد').toContain(out.signingUrl)
  })
})

describe('③ مرّةً واحدة — ولعرضٍ مرسَلٍ لم يُوقَّع', () => {
  it('⚠️ الثاني يُردّ ولا تخرج رسالةٌ ثانية', async () => {
    const { c } = await sentContract()
    await review.sendFinalReminder(c.id, adminId)
    outbox.length = 0
    await expect(review.sendFinalReminder(c.id, adminId), '«أخيرٌ» أُرسل مرّتين')
      .rejects.toMatchObject({ code: 'already_reminded' })
    expect(outbox, 'خرجت رسالةٌ ثانية').toHaveLength(0)
  })

  /* والنقرتان معا: الشرطُ في الكتابة لا في القراءة — فواحدةٌ تمرّ والأخرى تُردّ */
  it('⚠️ ونقرتان في اللحظة نفسِها لا تُخرجان رسالتين', async () => {
    const { c } = await sentContract()
    const both = await Promise.allSettled([
      review.sendFinalReminder(c.id, adminId), review.sendFinalReminder(c.id, adminId),
    ])
    expect(both.filter((r) => r.status === 'fulfilled'), 'مرّ التذكيرُ مرّتين').toHaveLength(1)
    expect(outbox, 'خرجت رسالتان').toHaveLength(1)
  })

  it('⚠️ ولا يُذكَّر من وقّع', async () => {
    const { c, token } = await sentContract()
    await prisma.trainerContractDocument.create({
      data: {
        contractId: c.id, kind: 'national_id', storageKey: `k-${c.id}`,
        originalName: 'id.pdf', mime: 'application/pdf', sizeBytes: 1024,
      },
    })
    await review.signContractByToken(token, {
      legalName: 'مدرّبٌ ينتظر توقيعا', addressAr: 'عمّان — بناية ١٢', phone: '+962790000000',
      bodyHash: sha256(c.bodyAr ?? ''), acks: contractAcks(c.gatesActivation).map((a) => a.key),
    })
    outbox.length = 0
    await expect(review.sendFinalReminder(c.id, adminId)).rejects.toMatchObject({ code: 'bad_state' })
    expect(outbox).toHaveLength(0)
  })

  it('ويُكتب أثرُه بمن أرسل وإلى متى', async () => {
    const { c } = await sentContract()
    const out = await review.sendFinalReminder(c.id, adminId)
    const ev = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.contract.final_reminder_sent', entityId: c.id },
    })
    expect(ev, 'لا أثرَ للتذكير').not.toBeNull()
    expect(ev!.actorId).toBe(adminId)
    expect(JSON.stringify(ev!.meta)).toContain(out.expiresAt.toISOString())
  })
})

describe('④ وبعد الأجل يسقط', () => {
  it('⚠️ الصفحةُ تقول «انتهى»، والتوقيعُ يُردّ', async () => {
    const { c } = await sentContract()
    const out = await review.sendFinalReminder(c.id, adminId)
    await prisma.trainerContract.update({
      where: { id: c.id }, data: { tokenExpiresAt: new Date(Date.now() - 60_000) },
    })
    const t = tokenOf(out.signingUrl)
    expect((await review.contractByToken(t)).state, 'بقي العرضُ مفتوحا بعد أجله').toBe('expired')
    await expect(review.signContractByToken(t, {
      legalName: 'مدرّبٌ ينتظر توقيعا', addressAr: 'عمّان', phone: '+962790000000',
      bodyHash: sha256(c.bodyAr ?? ''), acks: contractAcks(c.gatesActivation).map((a) => a.key),
    }), 'وُقّع عرضٌ سقط').rejects.toMatchObject({ code: 'expired_token' })
  })
})

describe('⑤ وطلبُ الرابط بالبريد لا يمدّ الأجلَ ولا يقصّره', () => {
  /** رابطُ التوقيع من نصّ رسالةٍ خرجت — أو `null` إن لم يكن فيها */
  const linkIn = (text: string) => {
    const m = text.match(/\/c\/([A-Za-z0-9_%-]+)/)
    return m ? decodeURIComponent(m[1]) : null
  }

  it('⚠️ بعد الأجل: لا رمزَ جديد — ورسالةٌ تقول إنّ المهلةَ انقضت، بلا رابط', async () => {
    const { c, email } = await sentContract()
    await review.sendFinalReminder(c.id, adminId)
    const lapsedAt = new Date(Date.now() - 60_000)
    await prisma.trainerContract.update({ where: { id: c.id }, data: { tokenExpiresAt: lapsedAt } })
    const before = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    outbox.length = 0

    const res = await review.requestContractLink(email)
    expect(res.ok, 'جوابٌ يفرّق — فيكشف حالَ العرض لمن يملك البريد').toBe(true)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(after.tokenHash, 'سُكّ رمزٌ لعرضٍ سقط بعد التذكير الأخير — فالأجلُ كلمةٌ لا تُنفَّذ')
      .toBe(before.tokenHash)
    expect(after.tokenExpiresAt!.getTime(), 'مُدّ أجلُ عرضٍ سقط').toBe(lapsedAt.getTime())

    expect(outbox, 'لم تُقَل له حالُه — أو خرجت رسالتان').toHaveLength(1)
    const [mail] = outbox
    expect(mail.to).toBe(email)
    expect(mail.subject, 'العنوانُ لا يقول إنّ المدّةَ انتهت').toMatch(/^انتهت مدّةُ توقيع/)
    expect(mail.text, 'لا يقول إنّا نعود إليه').toContain('نعود إليك في الفصول القادمة باتفاقٍ جديد')
    for (const w of ['عرضك', 'عرضُك', 'سقط', 'كما ينصّ عقدُك']) {
      expect(`${mail.subject}\n${mail.text}`, `في رسالة انتهاء المدّة «${w}»`).not.toContain(w)
    }
    expect(mail.text, 'لا يقول متى انقضت').toContain('بتوقيت عمّان')
    expect(linkIn(mail.text), 'خرج رابطُ توقيعٍ لعرضٍ سقط').toBeNull()

    const ev = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.contract.link_requested', entityId: c.id },
    })
    expect(ev, 'طلبٌ بلا أثر').not.toBeNull()
    expect((ev!.meta as Record<string, unknown>).lapsed, 'الأثرُ لا يقول إنّه رُدّ لانقضاء المهلة').toBe(true)
  })

  it('⚠️ وفي الأجل: رابطٌ جديدٌ بالأجل نفسِه — والقديمُ يبطل', async () => {
    const { c, email } = await sentContract()
    const out = await review.sendFinalReminder(c.id, adminId)
    outbox.length = 0

    await review.requestContractLink(email)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(after.tokenExpiresAt!.getTime(), 'تغيّر الأجلُ الموعودُ في التذكير الأخير بطلب رابط')
      .toBe(out.expiresAt.getTime())
    expect((await review.contractByToken(tokenOf(out.signingUrl))).state, 'بقي رابطُ التذكير يفتح العرضَ مع الجديد')
      .toBe('replaced')

    expect(outbox, 'لم يخرج الرابطُ الجديد').toHaveLength(1)
    const fresh = linkIn(outbox[0].text)
    expect(fresh, 'الرسالةُ بلا رابط').not.toBeNull()
    expect((await review.contractByToken(fresh!)).state, 'الرابطُ الجديدُ لا يفتح العرض').toBe('open')
  })

  /* والقيدُ للتذكير الأخير وحدَه: من لم يُذكَّر بعدُ فطلبُه يفتح له نافذةً كما كان */
  it('ومن لم يُذكَّر بعدُ فطلبُه يفتح له يومَي النافذة كما كان', async () => {
    const { c, email } = await sentContract()
    await prisma.trainerContract.update({
      where: { id: c.id }, data: { tokenExpiresAt: new Date(Date.now() - 60_000) },
    })
    const at = Date.now()
    await review.requestContractLink(email)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: c.id } })
    expect(after.tokenExpiresAt!.getTime() - at, 'قُيّد طلبُ من لم يُذكَّر تذكيرَه الأخير')
      .toBeGreaterThan(CONTRACT_SIGNING_LINK_DAYS * DAY - 60_000)
    expect(outbox, 'لم يخرج رابطُه').toHaveLength(1)
    expect(linkIn(outbox[0].text), 'خرجت رسالتُه بلا رابط').not.toBeNull()
  })
})

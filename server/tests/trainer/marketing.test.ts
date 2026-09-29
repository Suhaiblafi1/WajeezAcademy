/* «التسويق» — فيديوهاتُ المدرّب وصورُه، وملصقٌ لا يُستعمل علنا إلّا بموافقته.

   ═══ ما يُحرَس ═══

   ① **الموافقةُ فعلُه وحدَه** — لا تُكتب `approved` إلّا من بابه، ولا يقرّر
      مدرّبٌ في ملصقِ غيره.
   ② **والمسوّدةُ لا تصله** — ما لم تُرسله الإدارةُ لا يُعرض عليه.
   ③ **والنسخةُ الجديدةُ تُزيح ما قبلها ولا تمسّ الموافَقَ عليه** — فلا
      يُسحب من تحت يده ما أذن فيه.
   ④ **وطلبُ التعديل بسبب** — ولا قرارَ مرّتين.
   ⑤ **ولا يُسوَّق إلّا لما له** — دورةٌ أُهِّل لها أو مسارٌ بناه.
   ⑥ **والصورةُ ملفٌّ يعرف المخزنُ مالكَه ويشترط أن يكون صورة**، أو رابطٌ
      حين يكون الرفعُ مطفأً.

   والفحصُ على ما في القاعدة وما تردّه الدوالّ، لا على نصٍّ في ملفّ. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeReadyForApproval } from '../helpers/trainer-ready'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerMarketingService } from '../../services/trainer-marketing.service'
import { kindRequiresImage, resolveStorageOwner } from '../../services/storage.service'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let svc: TrainerMarketingService
let adminId = ''
const COURSE = 'C-ZMKT-901'
const OTHER_COURSE = 'C-ZMKT-902'
let savedUploads: string | undefined

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  svc = new TrainerMarketingService(prisma)
  savedUploads = process.env.FILE_UPLOADS
  const admin = await auth.register('mkt-admin@test.local', 'Admin#12345', 'المدير')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  const pw = await prisma.pathway.create({ data: { id: 'PW-ZMKT-1', status: 'published' } })
  for (const id of [COURSE, OTHER_COURSE]) {
    await prisma.course.create({ data: { id, status: 'published', currentVersion: 1, homePathwayId: pw.id } })
    await prisma.courseVersion.create({ data: { courseId: id, version: 1, titleAr: `دورةُ ${id}`, totalHours: 10 } })
  }
}, 240_000)

afterAll(() => {
  if (savedUploads === undefined) delete process.env.FILE_UPLOADS
  else process.env.FILE_UPLOADS = savedUploads
})

let seq = 0
/** مدرّبٌ نشطٌ مؤهَّلٌ لـ`COURSE` وحدَها */
async function mkTrainer() {
  seq += 1
  const email = `mkt-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Pass#12345', `مدرّبٌ ${seq}`)
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-MKT-${Date.now()}-${seq}`, fullName: `مدرّبٌ ${seq}`, email,
      status: 'contract_pending', motivation: 'اختبار', privacyConsentAt: new Date(), userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `اتفاقيّةٌ ${seq}`, status: 'signed', bodyVersion: 'v-test',
      bodyAr: 'نصٌّ للاختبار', signerEmail: email, signerLegalName: `مدرّبٌ ${seq}`,
      signedAt: new Date(), gatesActivation: true,
    },
  })
  await makeReadyForApproval(prisma, app.id, adminId)
  await review.decide(app.id, adminId, 'approve')
  await prisma.trainerCourseQualification.upsert({
    where: { profileId_courseId: { profileId: profile.id, courseId: COURSE } },
    create: { profileId: profile.id, courseId: COURSE, status: 'qualified' },
    update: { status: 'qualified' },
  })
  await prisma.trainerCourseQualification.deleteMany({ where: { profileId: profile.id, courseId: OTHER_COURSE } })
  return { profileId: profile.id, userId: user.userId }
}

async function codeOf(work: Promise<unknown>): Promise<string> {
  try { await work; return 'لم يُردّ' } catch (e) { return (e as { code?: string }).code ?? 'بلا رمز' }
}

describe('الفيديو — رابطٌ لما له وحدَه', () => {
  it('⚠️ تعريفٌ به ودورةٌ أُهِّل لها تُحفظ — ودورةٌ ليست له تُردّ', async () => {
    const t = await mkTrainer()
    await svc.setVideo(t.userId, { targetKind: 'bio', url: 'https://youtu.be/abc123' })
    await svc.setVideo(t.userId, { targetKind: 'course', targetId: COURSE, url: 'https://vimeo.com/42' })
    expect(await codeOf(svc.setVideo(t.userId, { targetKind: 'course', targetId: OTHER_COURSE, url: 'https://vimeo.com/43' })),
      'قُبل فيديو لدورةٍ لم يُؤهَّل لها').toBe('unknown_target')
    const mine = await svc.mine(t.userId)
    expect(mine.bioVideo?.url).toContain('youtu.be/abc123')
    expect(mine.targets.find((x) => x.id === COURSE)?.video?.url).toContain('vimeo.com/42')
  })

  it('والرابطُ بلا https يُردّ، والفارغُ يمحو — وفيديو التعريف واحدٌ لا اثنان', async () => {
    const t = await mkTrainer()
    expect(await codeOf(svc.setVideo(t.userId, { targetKind: 'bio', url: 'http://x.com/v' }))).toBe('bad_url')
    expect(await codeOf(svc.setVideo(t.userId, { targetKind: 'bio', url: 'javascript:alert(1)' }))).toBe('bad_url')
    await svc.setVideo(t.userId, { targetKind: 'bio', url: 'https://a.com/1' })
    await svc.setVideo(t.userId, { targetKind: 'bio', url: 'https://a.com/2' })
    expect(await prisma.trainerMarketingVideo.count({ where: { profileId: t.profileId, targetKind: 'bio' } })).toBe(1)
    await svc.setVideo(t.userId, { targetKind: 'bio', url: null })
    expect((await svc.mine(t.userId)).bioVideo).toBeNull()
  })
})

describe('الصور — ملفٌّ يعرف المخزنُ مالكَه، أو رابط', () => {
  it('⚠️ الرفعُ المطفأُ يُردّ بالبديل — والرابطُ يُقبل', async () => {
    const t = await mkTrainer()
    delete process.env.FILE_UPLOADS
    expect(await codeOf(svc.addPhoto(t.userId, { mime: 'image/jpeg' }))).toBe('uploads_unavailable')
    await svc.addPhoto(t.userId, { url: 'https://drive.google.com/x' })
    expect((await svc.mine(t.userId)).photos.length).toBe(1)
  })

  it('⚠️ والملفُّ يُسجَّل قبل رابطه — فيعرفه المخزنُ صورةً بسقفها', async () => {
    const t = await mkTrainer()
    process.env.FILE_UPLOADS = 'on'
    const r = await svc.addPhoto(t.userId, { mime: 'image/png' })
    expect(r.uploadUrl).toBeTruthy()
    const row = await prisma.trainerMarketingPhoto.findUniqueOrThrow({ where: { id: r.id } })
    const owner = await resolveStorageOwner(prisma, row.storageKey!)
    expect(owner?.kind, 'رابطُ رفعٍ لمفتاحٍ لا مالكَ له — يُردّ بـ٤٠٤').toBe('marketing_photo')
    expect(kindRequiresImage(owner!.kind), 'تُقبل بايتاتٌ ليست صورة').toBe(true)
    expect(await codeOf(svc.addPhoto(t.userId, { mime: 'text/html' }))).toBe('bad_mime')
    delete process.env.FILE_UPLOADS
  })
})

describe('الملصق — لا يُستعمل علنا إلّا بموافقته', () => {
  async function sendPoster(profileId: string, n = 1) {
    const p = await svc.createPoster(adminId, profileId, {
      targetKind: 'course', targetId: COURSE, url: `https://design.example.com/p${n}.png`,
    })
    return p.id
  }

  it('⚠️ المسوّدةُ لا تصله، والمُرسَلُ يصله منتظرا قرارَه', async () => {
    const t = await mkTrainer()
    const id = await sendPoster(t.profileId)
    const draftView = (await svc.mine(t.userId)).targets.find((x) => x.id === COURSE)!
    expect(draftView.posters.length, 'رأى المدرّبُ مسوّدةً لم تُرسَل').toBe(0)
    await svc.submitPoster(adminId, id)
    const sent = (await svc.mine(t.userId)).targets.find((x) => x.id === COURSE)!
    expect(sent.posters[0]?.status).toBe('pending')
  })

  it('⚠️ الموافقةُ من بابه وحدَه — ولا يقرّر مدرّبٌ في ملصقِ غيره', async () => {
    const a = await mkTrainer()
    const b = await mkTrainer()
    const id = await sendPoster(a.profileId)
    await svc.submitPoster(adminId, id)
    expect(await codeOf(svc.decidePoster(b.userId, id, 'approve')), 'وافق مدرّبٌ على ملصقِ غيره').toBe('not_found')
    await svc.decidePoster(a.userId, id, 'approve')
    expect((await prisma.trainerPoster.findUniqueOrThrow({ where: { id } })).status).toBe('approved')
    expect(await codeOf(svc.decidePoster(a.userId, id, 'changes', 'تعديلٌ بعد الموافقة')), 'قرارٌ ثانٍ على ملصقٍ بُتّ فيه').toBe('bad_state')
  })

  it('⚠️ وطلبُ التعديل بسببٍ يُكتب — ويصل من صمّمه', async () => {
    const t = await mkTrainer()
    const id = await sendPoster(t.profileId)
    await svc.submitPoster(adminId, id)
    expect(await codeOf(svc.decidePoster(t.userId, id, 'changes', ''))).toBe('note_required')
    await svc.decidePoster(t.userId, id, 'changes', 'استعملوا صورتي الثانية')
    const row = await prisma.trainerPoster.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('changes_requested')
    expect(row.trainerNoteAr).toContain('الثانية')
    const bell = await prisma.notification.count({ where: { userId: adminId, templateKey: 'trainer.poster.decided' } })
    expect(bell, 'لم يصل المصمّمَ طلبُ التعديل').toBeGreaterThan(0)
  })

  it('⚠️ والنسخةُ الجديدةُ تُزيح ما لم يُوافَق عليه — ولا تمسّ الموافَقَ عليه', async () => {
    const t = await mkTrainer()
    const v1 = await sendPoster(t.profileId, 1)
    await svc.submitPoster(adminId, v1)
    await svc.decidePoster(t.userId, v1, 'approve')
    const v2 = await sendPoster(t.profileId, 2)
    await svc.submitPoster(adminId, v2)
    const v3 = await sendPoster(t.profileId, 3)
    await svc.submitPoster(adminId, v3)
    const rows = await prisma.trainerPoster.findMany({ where: { profileId: t.profileId }, orderBy: { version: 'asc' } })
    expect(rows.map((r) => [r.version, r.status])).toEqual([[1, 'approved'], [2, 'superseded'], [3, 'pending']])
  })

  it('ولا يُصمَّم ملصقٌ لدورةٍ ليست له', async () => {
    const t = await mkTrainer()
    expect(await codeOf(svc.createPoster(adminId, t.profileId, {
      targetKind: 'course', targetId: OTHER_COURSE, url: 'https://design.example.com/x.png',
    }))).toBe('unknown_target')
  })
})

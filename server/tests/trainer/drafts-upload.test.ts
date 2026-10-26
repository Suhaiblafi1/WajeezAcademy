/* مسوّداتُ ما نقترحه على بطاقة المدرّب — تُرفع من الشاشة لا تُكتب في الشيفرة (٢٦ أكتوبر ٢٠٢٦).

   كانت مسوّداتُ «لماذا نفتخر به» والنبذةِ ثابتةً في `trainer-suggestion-drafts.ts`، فكلُّ جولةٍ نشرُ شيفرة. فصارت ملفّا
   يُرفع من «ارفع المسوّدات» (`trainer-drafts.service.ts`). ويُحرس هنا على قاعدةٍ حقيقيّة:

   ١) لمن يرسلها وحدَه (`trainer.publish`)؛
   ٢) والملفُّ كلُّه أو لا شيء — بقواعد البطاقة نفسِها، ويُسمّى المدرّبُ وسببُه؛ وملفٌّ بصيغةٍ أخرى يُقال باسمه؛
   ٣) والمرفوعُ يُقرأ في بطاقته بلا تشكيل، ويُرسَل بـ«أرسل الكلّ» كما رُفع؛
   ٤) والملفُّ نفسُه ثانيةً لا يكتب شيئا، والأحدثُ لكلّ مدرّبٍ ونوعٍ مكانَ ما قبله؛
   ٥) وملفُّ المدرّبين لا يُدخل من له مسوّدة، ويقول كيف تعود المسوّدات؛
   ٦) ولكلّ مدرّبٍ أثرُ ما رُفع له. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
/* يُقارَن بلا تشكيلٍ إعرابيّ — العلّةُ في `helpers/plain-expect.ts` */
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { giveLiveCourse } from '../helpers/live-course'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerDraftingBundleService } from '../../services/trainer-drafting-bundle.service'
import { DRAFTS_FORMAT } from '../../../src/application/trainer/text-drafts'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
const STAMP = Date.now()
const PASS = 'Pass#12345'
const ACTOR = '00000000-0000-0000-0000-000000000009'
const cookies: Record<string, string> = {}
let liveId = ''
let otherId = ''

const login = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
const call = (method: 'GET' | 'POST', url: string, who: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie: cookies[who] }, ...(payload !== undefined ? { payload: payload as never } : {}) })
const upload = (body: unknown, who = 'admin') => call('POST', '/api/admin/trainers/suggestions/drafts', who, body)
const card = async (profileId: string) => (await call('GET', `/api/admin/trainers/${profileId}/ops`, 'admin')).json() as {
  pitchDraft: string[] | null; bioDraft: string | null
}

const PITCH = ['خمس عشرة سنة يُعلّم الناسَ إدارةَ المال', 'دورته عندنا: من الدخل إلى ميزانية تصمد']
const BIO = 'مستشار مالي يدرّب الأسر والشباب على بناء ميزانية تصمد أمام المفاجآت، وعلى الادخار المنتظم.'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  for (const [tag, role] of [['admin', 'academic_manager'], ['support', 'support']] as const) {
    const email = `drafts-${tag}-${STAMP}@test.local`
    const u = await auth.register(email, PASS, tag)
    await auth.setRoles(u.userId, [role])
    cookies[tag] = await login(email)
  }
  const review = new TrainerReviewService(prisma)
  liveId = (await review.createTrainerDirectly(ACTOR, { fullName: 'مدرب منشور', email: `drafts-live-${STAMP}@test.local` })).profileId
  await giveLiveCourse(prisma, liveId)
  otherId = (await review.createTrainerDirectly(ACTOR, { fullName: 'مدرب ثان', email: `drafts-other-${STAMP}@test.local` })).profileId
  for (const id of [liveId, otherId]) {
    await prisma.trainerCourseQualification.create({ data: { profileId: id, courseId: 'C-BIZ-101', status: 'qualified' } })
  }
}, 240_000)

describe('١ — لمن يرسلها وحدَه', () => {
  it('⚠️ من لا يملك الإرسال يُردّ — ولا يُكتب شيء', async () => {
    expect((await upload({ format: DRAFTS_FORMAT, pitch: { [liveId]: PITCH } }, 'support')).statusCode).toBe(403)
    expect(await prisma.trainerTextDraft.count()).toBe(0)
  })
})

describe('٢ — الملفُّ كلُّه أو لا شيء', () => {
  it('⚠️ مدرّبٌ واحدٌ يخالف يردّ الملفّ كلَّه باسمه وسببه', async () => {
    const r = await upload({ format: DRAFTS_FORMAT, pitch: { [liveId]: PITCH, [otherId]: ['أ', 'ب', 'ج', 'د'] } })
    expect(r.statusCode).toBe(422)
    expect(r.json().error.message_ar).toMatch(/مدرب ثان — «لماذا نفتخر به»: 3 أسطر على الأكثر/)
    expect(r.json().error.message_ar).not.toMatch(/مدرب منشور/)
    expect(await prisma.trainerTextDraft.count(), 'حُفظ نصفُ ملفّ').toBe(0)
  })

  it('⚠️ والمعرّفُ الذي لا مدرّبَ له يُسمّى — ولا يُسقط الخادم', async () => {
    const r = await upload({ format: DRAFTS_FORMAT, bio: { 'ليس-معرّفا': BIO, '00000000-0000-4000-8000-000000000000': BIO } })
    expect(r.statusCode).toBe(422)
    expect(r.json().error.message_ar).toMatch(/ليس-معرّفا: لا مدرب بهذا المعرّف/)
    expect(r.json().error.message_ar).toMatch(/00000000-0000-4000-8000-000000000000: لا مدرب بهذا المعرّف/)
  })

  it('⚠️ وملفٌّ بصيغةٍ أخرى يُقال باسمه — ملفُّ تعديلات خطّةٍ رُفع هنا خطأً', async () => {
    const r = await upload({ format: 'wajeez.plan-edits/1', items: [] })
    expect(r.statusCode).toBe(422)
    expect(r.json().error.message_ar).toMatch(/هذا ليس ملف مسوّدات \(صيغته wajeez\.plan-edits\/1\)/)
  })
})

describe('٣ — المرفوعُ يُقرأ في بطاقته ويُرسَل كما رُفع', () => {
  it('⚠️ يُحفظ بلا تشكيل، ويُقرأ مسوّدةً في بطاقته', async () => {
    const r = await upload({ format: DRAFTS_FORMAT, pitch: { [liveId]: PITCH }, bio: { [liveId]: BIO } })
    expect(r.statusCode, r.body).toBe(201)
    expect(r.json()).toEqual({ pitch: 1, bio: 1, repeated: 0 })
    const row = await prisma.trainerTextDraft.findUniqueOrThrow({ where: { profileId_kind: { profileId: liveId, kind: 'pitch' } } })
    vexpect(row.lines[0], 'بقي التشكيل').toBe('خمس عشرة سنة يعلّم الناس إدارة المال')
    const c = await card(liveId)
    vexpect(c.pitchDraft).toEqual(['خمس عشرة سنة يعلّم الناس إدارة المال', 'دورته عندنا: من الدخل إلى ميزانية تصمد'])
    expect(c.bioDraft).toBe(BIO)
  })

  it('⚠️ و«أرسل الكلّ» يرسل ما رُفع — لمن يصله الإرسال', async () => {
    const due = (await call('GET', '/api/admin/trainers/suggestions/send-drafts', 'admin')).json() as { trainers: { profileId: string; kinds: string[] }[] }
    expect(due.trainers.find((t) => t.profileId === liveId)?.kinds.sort()).toEqual(['bio', 'pitch'])
    const sent = await call('POST', '/api/admin/trainers/suggestions/send-drafts', 'admin', { profileIds: [liveId] })
    expect(sent.statusCode, sent.body).toBe(200)
    const s = await prisma.trainerTextSuggestion.findFirstOrThrow({ where: { profileId: liveId, kind: 'pitch' } })
    vexpect(s.lines).toEqual(['خمس عشرة سنة يعلّم الناس إدارة المال', 'دورته عندنا: من الدخل إلى ميزانية تصمد'])
  })
})

describe('٤ — الملفُّ نفسُه ثانيةً لا يكتب شيئا، والأحدثُ مكانَ ما قبله', () => {
  it('⚠️ الملفُّ نفسُه: «مرفوع من قبل» ولا أثرَ جديد', async () => {
    const before = await prisma.auditEvent.count({ where: { action: 'trainer.drafts.upload' } })
    const r = await upload({ format: DRAFTS_FORMAT, pitch: { [liveId]: PITCH }, bio: { [liveId]: BIO } })
    expect(r.json()).toEqual({ pitch: 0, bio: 0, repeated: 2 })
    expect(await prisma.auditEvent.count({ where: { action: 'trainer.drafts.upload' } })).toBe(before)
  })

  it('⚠️ والأحدثُ لمدرّبٍ ونوعٍ يحلّ محلّ ما قبله — صفٌّ واحد', async () => {
    const r = await upload({ format: DRAFTS_FORMAT, pitch: { [otherId]: ['سطر أول'] } })
    expect(r.json()).toEqual({ pitch: 1, bio: 0, repeated: 0 })
    const again = await upload({ format: DRAFTS_FORMAT, pitch: { [otherId]: ['سطر أحدث'] } })
    expect(again.json()).toEqual({ pitch: 1, bio: 0, repeated: 0 })
    const rows = await prisma.trainerTextDraft.findMany({ where: { profileId: otherId } })
    expect(rows.map((x) => x.lines)).toEqual([['سطر أحدث']])
    expect((await card(otherId)).pitchDraft).toEqual(['سطر أحدث'])
  })
})

describe('٥ — وملفُّ المدرّبين', () => {
  it('⚠️ لا يُدخل من رُفعت له مسوّدة — ويقول كيف تعود المسوّدات', async () => {
    const bundles = new TrainerDraftingBundleService(prisma)
    const fresh = (await new TrainerReviewService(prisma).createTrainerDirectly(ACTOR, { fullName: 'مدرب بلا مسودة', email: `drafts-fresh-${STAMP}@test.local` })).profileId
    await prisma.trainerCourseQualification.create({ data: { profileId: fresh, courseId: 'C-BIZ-101', status: 'qualified' } })
    const built = await bundles.build(ACTOR)
    const ids = built.trainers.map((t) => t.profileId)
    expect(ids).toContain(fresh)
    expect(ids, 'دخل من رُفعت له مسوّدة').not.toContain(otherId)
    const JSZip = (await import('jszip')).default
    const md = await (await JSZip.loadAsync(built.zip)).file('المدربون.md')!.async('string')
    expect(md).toContain('## كيف ترجع المسودات')
    expect(md).toContain(`"format": "${DRAFTS_FORMAT}"`)
  })
})

describe('٦ — والأثر', () => {
  it('لكلّ مدرّبٍ أثرُ ما رُفع له باسم من رفعه', async () => {
    const rows = await prisma.auditEvent.findMany({ where: { action: 'trainer.drafts.upload', entityId: liveId }, select: { meta: true, actorId: true } })
    expect(rows).toHaveLength(1)
    vexpect((rows[0]!.meta as { kinds: string[] }).kinds.sort()).toEqual(['bio', 'pitch'])
    expect(rows[0]!.actorId).not.toBeNull()
  })
})

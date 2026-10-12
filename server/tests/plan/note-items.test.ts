/* ملاحظاتُ الردّ بنودٌ في «المراجعة» يوافق عليها المدرّب (١١ أكتوبر ٢٠٢٦).

   كانت صندوقا «ملاحظةُ الإدارة — على خطوات: …» فوق كلّ خطوةٍ ونقاطا حمراءَ على دوائرها. فسأل صاحبُ
   المنصّة: «لماذا هذا القسم؟» وقرّر: «دعها في قسم التعديلات بشكلٍ واضح… على شكل نقاط ليوافق عليها
   أيضا». وهنا على قاعدةٍ حقيقيّة:

   ١) **الردُّ يولّد بندا لكلّ خطوةٍ عليها ملاحظة** — معتمَدا للمدرّب (`pending`)، و«مطلوب» إن كان فيها.
   ٢) **الموافقةُ لا تكتب في الخطّة شيئا**، و«لا أوافق» تحفظ كلمتَه ويراها المعتمِد.
   ٣) **ولا تولد مرّتين** — والخطّةُ التي رُدّت قبل هذا تُستدرَك بنودُها عند أوّل قراءة.
   ٤) **ولا يقرّر فيها غيرُ مدرّب الشعبة**، ولا تُعدّ «تعديلاتٍ جاهزة» في الجرس. */

import { beforeAll, describe, expect as vexpect, it } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
/* يُقارَن بلا تشكيلٍ إعرابيّ — العلّةُ في `helpers/plain-expect.ts` */
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { PlanEditService } from '../../services/plan-edit.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
const STAMP = Date.now()
const PASS = 'Pass#12345'
const cookies: Record<string, string> = {}
let profileId = ''
let adminUserId = ''

const login = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`
const call = (method: 'GET' | 'POST', url: string, who: string, payload?: unknown) =>
  app.inject({ method, url, headers: { cookie: cookies[who] }, ...(payload !== undefined ? { payload: payload as never } : {}) })

const content = {
  kind: 'trainer',
  modules: [{ moduleId: 'M1', titleAr: 'الجمهور', outcomeAr: 'يحلّل جمهوره', artifactAr: 'خريطة' }],
  resources: [],
  startsOn: '2026-12-06', endsOn: '2027-01-30',
}

type Item = { id: string; kind: string; step: string; status: string; required: boolean; noteAr: string | null; view: { titleAr: string; rows: { labelAr: string; tagAr?: string; afterAr: string | null }[] } }
const notesOf = async (cohortId: string, who = 'a') =>
  ((await call('GET', `/api/trainer/cohorts/${cohortId}/plan-edits`, who)).json() as Item[]).filter((x) => x.kind === 'note')

async function register(tag: string) {
  const email = `ni-${tag}-${STAMP}@test.local`
  const u = await auth.register(email, PASS, `مدرّب ${tag}`)
  await auth.setRoles(u.userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `WJ-TR-NI-${tag}-${STAMP}`, email, fullName: `مدرّب ${tag}`,
      phoneCountryCode: '+962', phone: `78${tag === 'a' ? 5 : 6}${STAMP % 1000000}`, country: 'الأردن', status: 'active',
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: application.id, userId: u.userId } })
  cookies[tag] = await login(email)
  return profile.id
}

async function plan(status: 'submitted' | 'changes_requested', extra: Record<string, unknown> = {}) {
  const course = await prisma.course.findFirstOrThrow({ select: { id: true } })
  const cohort = await prisma.cohort.create({
    data: {
      courseId: course.id, title: `شعبةُ الملاحظات ${status} ${Math.random()}`, status: 'draft', capacity: 20,
      scheduleWindowStart: new Date('2026-12-05T21:00:00.000Z'), scheduleWindowEnd: new Date('2027-01-30T20:59:59.999Z'),
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
  const p = await prisma.cohortDeliveryPlan.create({
    data: { cohortId: cohort.id, trainerId: profileId, status, submittedAt: new Date(), content: content as never, ...extra },
  })
  return { cohortId: cohort.id, planId: p.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  const admin = await auth.register(`ni-admin-${STAMP}@test.local`, PASS, 'المعتمِد')
  await auth.setRoles(admin.userId, ['academic_manager'])
  cookies.admin = await login(`ni-admin-${STAMP}@test.local`)
  adminUserId = admin.userId
  profileId = await register('a')
  await register('b')
})

describe('ملاحظاتُ الردّ بنودٌ يوافق عليها', () => {
  let cohortId = ''
  let planId = ''

  it('⚠️ ١) الردُّ يولّد بندا لكلّ خطوةٍ عليها ملاحظة — معتمَدا للمدرّب، و«مطلوب» إن كان فيها', async () => {
    ;({ cohortId, planId } = await plan('submitted'))
    const r = await call('POST', `/api/admin/cohort-plans/${planId}/decide`, 'admin', {
      approve: false,
      note: {
        general: 'شكرا على جهدك — بقيت أمورٌ صغيرة.',
        modules: 'مطلوب — مصدرٌ لكلّ محور: المحور 1 بلا مصدر\nمقترَح — المخرَج أوضح بفعلٍ يُرى',
        sessions: 'انقل اللقاء الثاني بعد الدوام',
      },
    })
    expect(r.statusCode).toBe(200)
    /* من الردّ نفسِه — لا من القراءة التي بعده */
    expect(await prisma.planEditSuggestion.count({ where: { planId, kind: 'note' } }), 'لم يولّدها الردّ').toBe(3)
    const notes = await notesOf(cohortId)
    expect(notes.map((x) => x.step)).toEqual(['general', 'modules', 'sessions'])
    expect(notes.every((x) => x.status === 'pending')).toBe(true)
    expect(notes.map((x) => x.required)).toEqual([false, true, false])
    const mods = notes.find((x) => x.step === 'modules')!
    expect(mods.view.titleAr).toBe('ملاحظةٌ على «المحاور ومواعيدها»')
    expect(mods.view.rows.map((x) => [x.tagAr, x.afterAr])).toEqual([
      ['مطلوب', 'مصدرٌ لكلّ محور: المحور 1 بلا مصدر'],
      ['مقترَح', 'المخرَج أوضح بفعلٍ يُرى'],
    ])
  })

  it('⚠️ ٢) الموافقةُ لا تكتب في الخطّة شيئا — و«لا أوافق» تحفظ كلمتَه ويراها المعتمِد', async () => {
    const before = (await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: planId }, select: { content: true } })).content
    const [general, mods, sessions] = await notesOf(cohortId)
    expect((await call('POST', `/api/trainer/plan-edits/${mods.id}/accept`, 'a', {})).statusCode).toBe(200)
    expect((await call('POST', `/api/trainer/plan-edits/${general.id}/accept`, 'a', {})).statusCode).toBe(200)
    const r = await call('POST', `/api/trainer/plan-edits/${sessions.id}/reject`, 'a', { noteAr: 'اللقاءُ مساءً أصلا' })
    expect(r.statusCode).toBe(200)
    const after = (await prisma.cohortDeliveryPlan.findUniqueOrThrow({ where: { id: planId }, select: { content: true } })).content
    expect(after, 'الموافقةُ كتبت في الخطّة').toEqual(before)
    const admin = (await call('GET', `/api/admin/cohorts/${cohortId}/plan-edits`, 'admin')).json() as Item[]
    const seen = admin.find((x) => x.id === sessions.id)!
    expect([seen.status, seen.noteAr]).toEqual(['rejected', 'اللقاءُ مساءً أصلا'])
    expect(admin.find((x) => x.id === mods.id)!.status).toBe('accepted')
  })

  it('⚠️ ٣) ولا تولد مرّتين — قراءةٌ ثانيةٌ ونداءٌ ثانٍ لا يزيدانها', async () => {
    expect(await new PlanEditService(prisma).ensureNoteItems(planId)).toBe(0)
    await notesOf(cohortId)
    expect(await prisma.planEditSuggestion.count({ where: { planId, kind: 'note' } })).toBe(3)
  })

  it('⚠️ ٣ب) والخطّةُ التي رُدّت قبل هذا تُستدرَك بنودُها عند أوّل قراءة — مرّةً واحدة', async () => {
    const old = await plan('changes_requested', {
      reviewedAt: new Date(Date.now() - 60_000), reviewedBy: adminUserId,
      reviewerNotes: { identity: 'مطلوب — المستوى: اختر مستوى الشعبة' }, reviewerNote: 'المستوى',
    })
    const [first, second] = await Promise.all([notesOf(old.cohortId), notesOf(old.cohortId)])
    expect(first.length + second.length).toBeGreaterThan(0)
    expect(await prisma.planEditSuggestion.count({ where: { planId: old.planId, kind: 'note' } }), 'وُلدت مرّتين').toBe(1)
    const [item] = await notesOf(old.cohortId)
    expect([item.step, item.required, item.status]).toEqual(['identity', true, 'pending'])
  })

  it('⚠️ ٤) ولا يقرّر فيها غيرُ مدرّب الشعبة — ولا يراها', async () => {
    const other = await plan('changes_requested', {
      reviewedAt: new Date(), reviewedBy: adminUserId, reviewerNotes: { modules: 'ملاحظة' }, reviewerNote: 'ملاحظة',
    })
    const [item] = await notesOf(other.cohortId)
    expect((await call('GET', `/api/trainer/cohorts/${other.cohortId}/plan-edits`, 'b')).statusCode).toBe(403)
    expect((await call('POST', `/api/trainer/plan-edits/${item.id}/accept`, 'b', {})).statusCode).toBe(403)
  })
})

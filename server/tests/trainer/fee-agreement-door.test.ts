/* «الاتفاقية» وحدَها للماليّة — والأجرُ لشعبةٍ واحدةٍ منها (٢٦ أكتوبر ٢٠٢٦).

   سُئل صاحبُ المنصّة: الأجرُ يُضبط في «الاتفاقية» من ملفّ المدرّب وحدَها، والماليّةُ تضبطه (قرارُ «C») ولا تفتح الملفّ —
   فيه طلبُه ومقابلتُه ووثائقُه. أين تغيّره؟ فقال «a»: تفتح «الاتفاقية» وحدَها. والشاشةُ يحرسها
   `src/tests/trainer/fee-agreement-door.test.ts`؛ وهذا يحرس الخادم:

   ① الماليّةُ تقرأ «الاتفاقية» وحدَها: أجرَه وعقودَه — بلا طلبٍ ولا مقابلةٍ ولا وثائقَ ولا رمزِ توقيع.
   ② ولا تقرأ الملفَّ كلَّه — بابُه باقٍ على `trainer.applications.view`.
   ③ ومن لا يضبط الأجرَ ولا يقرأ الملفَّ يُردّ، والردُّ يقول عددَ الصلاحيّات كما هو.
   ④ والدوراتُ واقتراحاتُه لمن يعمل فيها وحدَه — للمدير الأكاديميّ، لا للماليّة.
   ⑤ وشعبُه لقصر الأجر: شعبُه هو وحدَها بلا الملغاة، وكلٌّ بقاعدتها الخاصّة إن سرت — وسجلُّ أجره يسمّي الشعبة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

const STAMP = Date.now()
let prisma: PrismaClient
let app: FastifyInstance
let applicationId = ''
let profileId = ''
let ownCohort = ''
let cancelledCohort = ''
let otherCohort = ''
const cookies: Record<string, string> = {}

async function login(role: string, name: string) {
  const auth = new AuthService(prisma)
  const email = `door-${role}-${STAMP}@test.local`
  const { userId } = await auth.register(email, 'Admin#12345', name)
  await auth.setRoles(userId, [role])
  const { token } = await auth.login(email, 'Admin#12345')
  cookies[role] = `${SESSION_COOKIE}=${token}`
}

const get = (role: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie: cookies[role] } })
const agreement = (role: string) => get(role, `/api/admin/trainer-applications/${applicationId}/agreement`)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  await login('academic_manager', 'سارة المديرة')
  await login('finance', 'خالد الماليّة')
  await login('support', 'دعم')

  const row = await prisma.trainerApplication.create({
    data: {
      reference: `TR-DOOR-${STAMP}`, fullName: 'مدرّبة الاتفاقية', email: `door-trainer-${STAMP}@test.local`,
      phone: '790000000', bio: 'سيرة لا تقرؤها الماليّة', status: 'contract_pending',
    },
  })
  applicationId = row.id
  profileId = (await prisma.trainerProfile.create({ data: { applicationId } })).id
  await prisma.trainerCourseQualification.create({ data: { profileId, courseId: 'C-BIZ-101', status: 'qualified' } })
  await prisma.trainerCourseProposal.create({ data: { profileId, titleAr: 'اقتراح لا يخصّ الماليّة', status: 'submitted' } })
  await prisma.trainerContract.create({
    data: {
      profileId, title: 'عقد الاتفاقية', status: 'sent', bodyAr: 'نصّ', bodyHash: 'hash-door',
      tokenHash: `token-${STAMP}`, signerPhone: '+962790000000', signerIp: '10.0.0.1',
      compensationType: 'per_seat', compensationRate: 25, currency: 'JOD', sentAt: new Date(),
    },
  })

  const cohort = (title: string, status: string) =>
    prisma.cohort.create({ data: { courseId: 'C-BIZ-101', title: `${title} ${STAMP}`, status, capacity: 10 } })
  ownCohort = (await cohort('شعبته', 'open')).id
  cancelledCohort = (await cohort('شعبته الملغاة', 'cancelled')).id
  otherCohort = (await cohort('شعبة غيره', 'open')).id
  await prisma.cohortTrainer.create({ data: { cohortId: ownCohort, profileId, role: 'lead' } })
  await prisma.cohortTrainer.create({ data: { cohortId: cancelledCohort, profileId, role: 'lead' } })
}, 240_000)

describe('① الماليّة تقرأ «الاتفاقية» وحدها', () => {
  it('⚠️ أجره وعقوده — بلا طلب ولا مقابلة ولا وثائق', async () => {
    const res = await agreement('finance')
    expect(res.statusCode, res.body).toBe(200)
    const body = res.json() as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['activeCompensationRule', 'fullName', 'id', 'profile', 'readiness', 'reference', 'status'])
    for (const hidden of ['email', 'phone', 'bio', 'documents', 'documentUrls', 'interviews', 'reviews', 'statusHistory']) {
      expect(body, `وصلها ${hidden}`).not.toHaveProperty(hidden)
    }
    expect(res.body).not.toContain('سيرة لا تقرؤها الماليّة')
  })

  it('⚠️ وعقوده بقصّتها وأجرها — لا رمز توقيع ولا ما وقّع به', async () => {
    const body = (await agreement('finance')).json() as { profile: { contracts: Record<string, unknown>[] } }
    const [c] = body.profile.contracts
    expect(c).toMatchObject({ title: 'عقد الاتفاقية', status: 'sent', compensationType: 'per_seat', bodyHash: 'hash-door' })
    expect(Number(c.compensationRate)).toBe(25)
    for (const hidden of ['tokenHash', 'signerPhone', 'signerIp', 'bodyAr', 'signerAddressAr', 'dataChoiceTokenHash']) {
      expect(c, `وصلها ${hidden}`).not.toHaveProperty(hidden)
    }
  })
})

describe('② ولا تقرأ الملف كله', () => {
  it('⚠️ بابه باق على قراءة الطلبات', async () => {
    expect((await get('finance', `/api/admin/trainer-applications/${applicationId}`)).statusCode).toBe(403)
    expect((await get('academic_manager', `/api/admin/trainer-applications/${applicationId}`)).statusCode).toBe(200)
  })
})

describe('③ ومن لا يضبط الأجر ولا يقرأ الملف يرد', () => {
  it('⚠️ والرد يقول العدد كما هو', async () => {
    const res = await agreement('support')
    expect(res.statusCode).toBe(403)
    const msg = (res.json() as { error: { message_ar: string } }).error.message_ar
    expect(msg).toContain('إحدى هذه الصلاحيّات')
    expect(msg).not.toContain('إحدى صلاحيّتين')
  })
})

describe('④ والدورات واقتراحاته لمن يعمل فيها وحده', () => {
  it('⚠️ للمدير الأكاديمي — لا للماليّة', async () => {
    type P = { profile: { qualifications: unknown[]; courseProposals: { titleAr: string }[] } }
    const am = (await agreement('academic_manager')).json() as P
    expect(am.profile.qualifications).toHaveLength(1)
    expect(am.profile.courseProposals.map((p) => p.titleAr)).toEqual(['اقتراح لا يخصّ الماليّة'])
    const fin = (await agreement('finance')).json() as P
    expect(fin.profile.qualifications).toEqual([])
    expect(fin.profile.courseProposals).toEqual([])
  })
})

describe('⑤ وشعبه لقصر الأجر', () => {
  it('⚠️ شعبه هو وحدها بلا الملغاة — وكل بقاعدتها الخاصة إن سرت', async () => {
    const set = await app.inject({
      method: 'POST', url: '/api/admin/trainer-compensation-rules', headers: { cookie: cookies.finance },
      payload: { profileId, type: 'per_seat', rate: 40, cohortId: ownCohort },
    })
    expect(set.statusCode, set.body).toBe(201)
    for (const role of ['finance', 'academic_manager']) {
      const res = await get(role, `/api/admin/trainers/${profileId}/fee-cohorts`)
      expect(res.statusCode, `${role} ← ${res.body}`).toBe(200)
      const rows = res.json() as { id: string; rule: { rate: string } | null }[]
      expect(rows.map((r) => r.id)).toEqual([ownCohort])
      expect(Number(rows[0].rule?.rate)).toBe(40)
    }
    expect(otherCohort).not.toBe(ownCohort)
    expect((await get('support', `/api/admin/trainers/${profileId}/fee-cohorts`)).statusCode).toBe(403)
  })

  it('⚠️ وسجل أجره يسمي الشعبة — فلا يقرأ أجرها عاما', async () => {
    const res = await get('finance', `/api/admin/trainers/${profileId}/fee-history`)
    const rows = res.json() as { cohortId: string | null; cohortTitle: string | null }[]
    expect(rows.find((r) => r.cohortId === ownCohort)?.cohortTitle).toBe(`شعبته ${STAMP}`)
  })

  it('⚠️ والعامة لا تتبدل بقاعدة الشعبة — «الاتفاقية» تقول العامة', async () => {
    const body = (await agreement('finance')).json() as { activeCompensationRule: unknown }
    expect(body.activeCompensationRule).toBeNull()
  })
})

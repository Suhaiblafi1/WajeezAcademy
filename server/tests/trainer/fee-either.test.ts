/* من يضبط أجرَ المدرّب: المديرُ الأكاديميّ أو الماليّة — والأثرُ يقول من فعل (٢٦ أكتوبر ٢٠٢٦).

   سُئل صاحبُ المنصّة: اليومَ يضبطه المديرُ الأكاديميُّ في مُركِّب العقد ولا يضبطه في «الاتفاقية» من ملفّ المدرّب
   (يحتاج صلاحيّة الماليّة)، فأيُّ القواعد؟ فقال «C»: أيٌّ منهما، والأثرُ يقول من فعل.

   ① يضبطه كلٌّ منهما بالمسار نفسِه — ولا تُمنح إحداهما حبّةَ الأخرى.
   ② ومن لا يملك أيّا منهما يُردّ، والردُّ يسمّي الحبّتين.
   ③ وسجلُّ أجره يقول من ضبط كلَّ قاعدةٍ — الأحدثُ أوّلا — والقديمةُ تُغلق بتاريخها ولا تُحذف. */

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
let profileId = ''
const cookies: Record<string, string> = {}

async function login(role: string, name: string) {
  const auth = new AuthService(prisma)
  const email = `fee-${role}-${STAMP}@test.local`
  const { userId } = await auth.register(email, 'Admin#12345', name)
  await auth.setRoles(userId, [role])
  const { token } = await auth.login(email, 'Admin#12345')
  cookies[role] = `${SESSION_COOKIE}=${token}`
}

const setFee = (role: string, rate: number) => app.inject({
  method: 'POST', url: '/api/admin/trainer-compensation-rules', headers: { cookie: cookies[role] },
  payload: { profileId, type: 'per_seat', rate },
})
const history = (role: string) => app.inject({
  method: 'GET', url: `/api/admin/trainers/${profileId}/fee-history`, headers: { cookie: cookies[role] },
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  await login('academic_manager', 'سارة المديرة')
  await login('finance', 'خالد الماليّة')
  await login('support', 'دعم')
  const row = await prisma.trainerApplication.create({
    data: { reference: `TR-FEE-${STAMP}`, fullName: 'مدرب الأجر', email: `fee-trainer-${STAMP}@test.local`, status: 'conditionally_approved' },
  })
  profileId = (await prisma.trainerProfile.create({ data: { applicationId: row.id } })).id
}, 240_000)

describe('① يضبطه كل منهما بالمسار نفسه', () => {
  it('⚠️ المدير الأكاديمي — وكان يرد هنا', async () => {
    const res = await setFee('academic_manager', 30)
    expect(res.statusCode, res.body).toBe(201)
  })

  it('⚠️ والماليّة — كما كانت', async () => {
    const res = await setFee('finance', 35)
    expect(res.statusCode, res.body).toBe(201)
  })
})

describe('② ومن لا يملك أيا منهما يرد', () => {
  it('⚠️ لا يضبطه ولا يقرأ سجله — والرد يسمي الحبتين', async () => {
    const res = await setFee('support', 40)
    expect(res.statusCode).toBe(403)
    const msg = (res.json() as { error: { message_ar: string } }).error.message_ar
    expect(msg).toContain('إحدى صلاحيّتين')
    expect((await history('support')).statusCode).toBe(403)
  })
})

describe('③ وسجل أجره يقول من فعل', () => {
  it('⚠️ كل قاعدة باسم من ضبطها — الأحدث أولا، والسابقة مغلقة لا محذوفة', async () => {
    for (const role of ['academic_manager', 'finance']) {
      const res = await history(role)
      expect(res.statusCode, `${role} ← ${res.body}`).toBe(200)
      const rows = res.json() as { rate: string; createdByName: string | null; effectiveTo: string | null }[]
      expect(rows.map((r) => [Number(r.rate), r.createdByName])).toEqual([[35, 'خالد الماليّة'], [30, 'سارة المديرة']])
      expect(rows[0].effectiveTo, 'السارية مغلقة').toBeNull()
      expect(rows[1].effectiveTo, 'السابقة لم تغلق بتاريخها').not.toBeNull()
    }
    /* ولا تُعطى الماليّةُ حبّةَ المدير ولا العكس — الحارسُ يقبل أيّا منهما */
    expect(await prisma.trainerCompensationRule.count({ where: { profileId } })).toBe(2)
  })
})

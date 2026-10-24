/* بطاقةُ مدرّبٍ واحدٍ في «المدربون» — يقرؤها ملفُّه (`/admin/trainers/:id`، ٢٤ أكتوبر ٢٠٢٦).

   ① هي بطاقتُه في القائمة نفسُها — بالحكم نفسِه (`listForOps`) لا بنسخةٍ ثانيةٍ تفترق عنها.
   ② ومن لم يعبر إلى «المدربون» لا بطاقةَ له: ٤٠٤ — لا بطاقةٌ تقول «ينتظرك: تجهيز عقده» لمن موضعُه «العقود».
   ③ وبصلاحيّة القائمة نفسِها (`trainer.qualify`). */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

const STAMP = Date.now()
let prisma: PrismaClient
let app: FastifyInstance
let managerCookie = ''
let financeCookie = ''

/** ملفُّ مدرّبٍ بحال طلبه وعقده */
async function trainer(key: string, status: string, contract?: string) {
  const row = await prisma.trainerApplication.create({
    data: {
      reference: `TR-REC-${key}-${STAMP}`, fullName: `مدرب ${key}`, email: `rec-${key}-${STAMP}@test.local`,
      status, motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: row.id } })
  if (contract) await prisma.trainerContract.create({ data: { profileId: profile.id, title: `عقد ${key}`, status: contract } })
  return profile.id
}

async function cookieFor(role: string) {
  const auth = new AuthService(prisma)
  const email = `rec-${role}-${STAMP}@test.local`
  const { userId } = await auth.register(email, 'Admin#12345', role)
  await auth.setRoles(userId, [role])
  const { token } = await auth.login(email, 'Admin#12345')
  return `${SESSION_COOKIE}=${token}`
}

const card = (profileId: string, cookie = managerCookie) =>
  app.inject({ method: 'GET', url: `/api/admin/trainers/${profileId}/ops`, headers: { cookie } })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  managerCookie = await cookieFor('academic_manager')
  financeCookie = await cookieFor('finance')
}, 240_000)

describe('① بطاقته في القائمة نفسها', () => {
  it('⚠️ ما يقرؤه ملفه هو صفه في «المدربون» بعينه', async () => {
    const id = await trainer('sealed', 'active', 'countersigned')
    const res = await card(id)
    expect(res.statusCode, res.body).toBe(200)
    const listed = (await new TrainerReviewService(prisma).listForOps()).find((t) => t.profileId === id)
    expect(listed, 'ليس في القائمة — تعطّل الفحص').toBeTruthy()
    expect(res.json()).toEqual(JSON.parse(JSON.stringify(listed)))
  })
})

describe('② ومن لم يعبر لا بطاقة له', () => {
  it('⚠️ المقبول داخليا، ومن وقّع ولم نعتمد توقيعه — ٤٠٤', async () => {
    expect((await card(await trainer('accepted', 'conditionally_approved'))).statusCode).toBe(404)
    expect((await card(await trainer('signed', 'contract_pending', 'signed'))).statusCode).toBe(404)
  })

  it('ومن اعتمدنا توقيعه له بطاقته', async () => {
    expect((await card(await trainer('approvedSig', 'onboarding', 'signature_approved'))).statusCode).toBe(200)
  })
})

describe('③ وبصلاحية القائمة نفسها', () => {
  it('من لا يملك التأهيل لا يقرؤها', async () => {
    const id = await trainer('perm', 'active', 'countersigned')
    expect((await card(id, financeCookie)).statusCode).toBe(403)
  })
})

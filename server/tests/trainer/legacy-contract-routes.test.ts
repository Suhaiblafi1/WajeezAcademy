/* لا عقدَ بلا متن، ولا توقيعَ يُكتب عن صاحبه (١٥ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة «Remove both»).

   بابان قديمان بحارس `trainer.compensation.manage` — وهي عند الماليّة: الأوّلُ يُنشئ عقدا «مُرسَلا» بلا متن، والثاني
   يكتبه «موقَّعا» بلا توقيع صاحبه ولا اسمه القانونيّ ولا وثيقته، وينقل طلبَه. فسقطا. ويُطرقان هنا بجلسة الماليّة
   ومدير النظام: لا بابَ، ولا يتغيّر العقد. ووثيقةُ هويّته مع العقد لا تفتحها الماليّة (قرارُه «No — managers only»). */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let app: FastifyInstance
let auth: AuthService
const STAMP = Date.now()
let seq = 0

async function cookieFor(role: string) {
  const email = `lcr-${role}-${++seq}-${STAMP}@test.local`
  const { userId } = await auth.register(email, 'Staff#12345', role)
  await auth.setRoles(userId, [role])
  const { token } = await auth.login(email, 'Staff#12345')
  return { userId, cookie: `${SESSION_COOKIE}=${token}` }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
}, 240_000)

afterAll(async () => { await app.close() })

describe('البابان القديمان للعقد', () => {
  it('⚠️ الماليّة ومدير النظام: لا ينشئان عقدا بلا متن ولا يكتبان توقيع مدرّب عنه', async () => {
    const admin = await cookieFor('super_admin')
    const application = await prisma.trainerApplication.create({
      data: {
        reference: `TR-LCR-${STAMP}`, fullName: 'مدرب العقد', email: `lcr-trainer-${STAMP}@test.local`,
        status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(),
      },
    })
    await prisma.trainerProfile.create({ data: { applicationId: application.id } })
    /* عقدٌ مُرسَلٌ ينتظر توقيعَ صاحبه — بالدالّة الباقية للاختبارات */
    const contract = await new TrainerReviewService(prisma).createContract(application.id, admin.userId, { title: 'عقد ينتظر صاحبه' })

    for (const role of ['finance', 'super_admin']) {
      const { cookie } = role === 'super_admin' ? admin : await cookieFor(role)
      const create = await app.inject({
        method: 'POST', url: `/api/admin/trainer-applications/${application.id}/contracts`,
        headers: { cookie }, payload: { title: 'عقد بلا متن' },
      })
      expect(create.statusCode, `${role}: أنشأ عقدا بلا متن`).toBe(404)
      const sign = await app.inject({
        method: 'POST', url: `/api/admin/trainer-contracts/${contract.id}/sign`, headers: { cookie }, payload: {},
      })
      expect(sign.statusCode, `${role}: كتب توقيع المدرب عنه`).toBe(404)
    }
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contract.id } })
    expect(after.status, 'تغير العقد بلا توقيع صاحبه').toBe('sent')
    expect(await prisma.trainerContract.count({ where: { profile: { applicationId: application.id } } })).toBe(1)

    /* ═══ ووثيقةُ الهويّة لمن يعتمد التوقيع وحدَه — لا للماليّة («No — managers only») ═══ */
    const doc = await prisma.trainerContractDocument.create({
      data: { contractId: contract.id, kind: 'national_id', storageKey: `lcr-id-${STAMP}`, originalName: 'id.pdf', mime: 'application/pdf', sizeBytes: 10 },
    })
    const url = `/api/admin/trainer-contracts/${contract.id}/documents/${doc.id}/url`
    const finance = await cookieFor('finance')
    const byFinance = await app.inject({ method: 'GET', url, headers: { cookie: finance.cookie } })
    expect(byFinance.statusCode, 'فتحت الماليّة وثيقة هوية المدرب').toBe(403)
    expect(await prisma.auditEvent.count({ where: { action: 'trainer.contract.document_view', actorId: finance.userId } })).toBe(0)
    const byAdmin = await app.inject({ method: 'GET', url, headers: { cookie: admin.cookie } })
    expect(byAdmin.statusCode, 'لم يفتحها من يعتمد التوقيع').toBe(200)
  })
})

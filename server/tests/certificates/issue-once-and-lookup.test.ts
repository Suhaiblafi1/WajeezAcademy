/* مراجعةُ مسار الشهادات (٨ نوفمبر ٢٠٢٦) — عطبان ثبتا بتجربةٍ على القاعدة، والعلّةُ في `certificate.service.ts`
   و`learning-portal.routes.ts`.

   ① **وتصدر مرّةً واحدة** — ضغطتان على «أصدر» معا كانتا تُصدران للتسجيل الواحد شهادتين فعّالتين.
   ② **ولا تُعدَّد الأسماءُ بالتحقّق** — الأرقامُ مسلسلة والتحقّقُ بلا سقف: من مشى عليها جمع أسماءَ كلِّ من نال شهادة.
      فمن سأل عن عشرة أرقامٍ لا وجودَ لها في ساعةٍ يُوقف، ومن يتحقّق من شهادةٍ بيده لا يبلغه. */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CertificateService } from '../../services/certificate.service'
import { ProgressService } from '../../services/progress.service'
import { buildApp } from '../../http/app'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
let cohortId = ''
let seq = 0
const STAMP = Date.now()

/** تسجيلٌ لمتعلّمٍ موثَّق البريد — وقواعدُ الإكمال مستوفاةٌ بالمحاكاة: المفحوصُ هنا الإصدارُ لا القواعد */
async function completed(): Promise<string> {
  seq += 1
  const { userId } = await auth.register(`cert-once-${seq}-${STAMP}@test.local`, 'Learner#12345', `متعلم مكتمل ${seq}`)
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } })
  return (await prisma.enrollment.create({ data: { userId, cohortId, status: 'enrolled' } })).id
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  cohortId = (await prisma.cohort.create({
    data: { courseId: 'C-BIZ-101', title: `شعبة الإصدار مرة ${STAMP}`, status: 'active', currency: 'USD' } as never,
  })).id
  app = await buildApp(prisma)
}, 240_000)
afterAll(async () => { await app?.close() })

describe('① وتصدر مرة واحدة', () => {
  it('⚠️ ضغطتان على «أصدر» معا: تصدر واحدة وترد الأخرى', async () => {
    vi.spyOn(ProgressService.prototype, 'evaluateCompletion').mockResolvedValue({ complete: true, failures: [], percent: 100 } as never)
    const certs = new CertificateService(prisma)
    const e = await completed()
    const out = await Promise.allSettled([certs.issue(e, null), certs.issue(e, null)])
    expect(out.filter((r) => r.status === 'fulfilled'), 'صدرت للتسجيل شهادتان').toHaveLength(1)
    expect((out.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'already_issued' })
    expect(await prisma.certificate.count({ where: { enrollmentId: e, status: 'active' } })).toBe(1)
    vi.restoreAllMocks()
  })
})

describe('② ولا تعدد الأسماء بالتحقق', () => {
  it('⚠️ عشرة أرقام لا وجود لها توقف السائل — ومن يتحقق من شهادة يجدها', async () => {
    const ip = '10.66.0.7'
    const real = await prisma.certificate.findFirstOrThrow({ select: { number: true } })
    expect((await app.inject({ method: 'GET', url: `/api/v1/certificates/verify/${real.number}`, remoteAddress: ip })).statusCode).toBe(200)
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) {
      const res = await app.inject({ method: 'GET', url: `/api/v1/certificates/verify/WJ-CERT-2099-${String(80_000 + i)}`, remoteAddress: ip })
      statuses.push(res.statusCode)
    }
    expect(statuses.slice(0, 10).every((s) => s === 404), 'لم يقل لا شهادة').toBe(true)
    expect(statuses.slice(10), 'لم يوقف من عدد الأرقام').toEqual([429, 429])
    expect((await app.inject({ method: 'GET', url: `/api/v1/certificates/verify/${real.number}`, remoteAddress: '10.66.0.8' })).statusCode, 'أوقف غيره').toBe(200)
  })
})

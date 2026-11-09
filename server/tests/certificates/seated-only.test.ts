/* لا شهادةَ لتسجيلٍ سقط (٨ نوفمبر ٢٠٢٦) — والعلّةُ في `CertificateService.issue` و`LearnerRequestService.courseEligibility`.

   كان الإصدارُ يفحص قواعدَ الإكمال وحدَها: فمن انسحب أو رُدّ ثمنُه وأُخرج من شعبته يُقال له «مؤهّل»، وتصدر له الشهادة،
   ويعود تسجيلُه «مكتملا». والقواعدُ مستوفاةٌ بالمحاكاة: المفحوصُ هنا حالُ التسجيل لا القواعد. */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CertificateService } from '../../services/certificate.service'
import { ProgressService } from '../../services/progress.service'
import { LearnerRequestService } from '../../services/learner-request.service'

let prisma: PrismaClient
let auth: AuthService
let cohortId = ''
let seq = 0

const enrollment = async (status: string) => {
  seq += 1
  const { userId } = await auth.register(`seated-${seq}@test.local`, 'Learn#12345', `متعلم ${seq}`)
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } })
  const e = await prisma.enrollment.create({ data: { userId, cohortId, status } })
  return { userId, id: e.id }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  cohortId = (await prisma.cohort.create({ data: { courseId: 'C-BIZ-101', title: 'شعبة الشهادة القائمة', status: 'active', currency: 'USD' } as never })).id
  vi.spyOn(ProgressService.prototype, 'evaluateCompletion').mockResolvedValue({ complete: true, failures: [], percent: 100, rulesChecked: 3 } as never)
}, 240_000)
afterAll(() => { vi.restoreAllMocks() })

describe('لا شهادة لتسجيل سقط', () => {
  it('⚠️ المنسحب: لا يقال له «مؤهل»، ويرد الإصدار، ويبقى تسجيله منسحبا', async () => {
    const e = await enrollment('dropped')
    const elig = await new LearnerRequestService(prisma).courseEligibility(e.userId, e.id)
    expect(elig.eligible, 'قيل للمنسحب «مؤهل»').toBe(false)
    expect(elig.reasonsAr.join(' ')).toContain('منسحب')
    await expect(new CertificateService(prisma).issue(e.id, null), 'صدرت شهادة لمنسحب').rejects.toMatchObject({ code: 'not_seated' })
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } })).status, 'عاد المنسحب مكتملا').toBe('dropped')
    expect(await prisma.certificate.count({ where: { enrollmentId: e.id } })).toBe(0)
  })

  it('⚠️ وقائمة الانتظار كذلك', async () => {
    const e = await enrollment('waitlisted')
    await expect(new CertificateService(prisma).issue(e.id, null)).rejects.toMatchObject({ code: 'not_seated' })
  })

  it('ومن له مقعد قائم تصدر له كما كانت', async () => {
    const e = await enrollment('enrolled')
    expect((await new LearnerRequestService(prisma).courseEligibility(e.userId, e.id)).eligible).toBe(true)
    await new CertificateService(prisma).issue(e.id, null)
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: e.id } })).status).toBe('completed')
  })
})

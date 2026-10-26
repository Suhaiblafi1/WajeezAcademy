/* الشعبةُ ومدرّبُها رابطان كلٌّ إلى الآخر — وزرُّ «الحالات المتأخّرة» ذهب (٢٦ أكتوبر ٢٠٢٦، المرحلة السادسة).

   «خطّة لوحة الإدارة» (٠٥): «ملفُّ المدرّب يعرض شعبَه روابط، والشعبةُ تعرض مدرّبَها رابطا، ولا يحرّر أحدُهما الآخر».
   فقائمةُ الشعب تحمل معرّفَ طلب كلّ مدرّب — به يُفتح ملفُّه (`/admin/trainers/:id`). و(٠٦): «زرُّ مزامنة الحالات في
   «الشعب» يذهب؛ العاملُ يُجريها كلَّ ربع ساعة» — فالبابُ مغلق، والعاملُ باقٍ بمهمّته وفترتها. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { JOBS } from '../../worker/jobs'

let prisma: PrismaClient
let app: FastifyInstance
let cookie = ''
let cohortId = ''
let applicationId = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  app = await buildApp(prisma)
  const ops = await auth.register('links-ops@test.local', 'Ops#12345', 'مدير العمليات')
  await auth.setRoles(ops.userId, ['operations_manager'])
  cookie = `${SESSION_COOKIE}=${(await auth.login('links-ops@test.local', 'Ops#12345')).token}`

  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-LINKS-${Date.now()}`, fullName: 'مدرّب الروابط', email: 'links-trainer@test.local', status: 'active' },
  })
  applicationId = application.id
  const profile = await prisma.trainerProfile.create({ data: { applicationId } })
  const cohort = await prisma.cohort.create({ data: { courseId: 'C-BIZ-101', title: 'شعبة الروابط' } })
  cohortId = cohort.id
  await prisma.cohortTrainer.create({ data: { cohortId, profileId: profile.id, role: 'lead' } })
}, 240_000)

describe('اسم المدرّب في الشعبة رابط إلى ملفّه', () => {
  it('⚠️ قائمة الشعب تحمل معرّف طلبه — به يفتح «/admin/trainers/:id»', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/cohorts', headers: { cookie } })
    expect(res.statusCode, res.body).toBe(200)
    const row = (JSON.parse(res.body) as { id: string; trainers: { applicationId?: string; name: string }[] }[])
      .find((c) => c.id === cohortId)
    expect(row?.trainers).toHaveLength(1)
    expect(row?.trainers[0]?.name).toBe('مدرّب الروابط')
    expect(row?.trainers[0]?.applicationId, 'لا معرّف للملفّ — يبقى الاسم نصّا').toBe(applicationId)
  })
})

describe('زرّ «حالات متأخّرة عن تواريخها» ذهب — والعامل باق', () => {
  it('⚠️ بابه مغلق', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/cohorts/sync-statuses', headers: { cookie }, payload: { apply: false } })
    expect(res.statusCode).toBe(404)
  })

  it('⚠️ والعامل يجريها كلّ ربع ساعة — فلا شيء يتأخّر بذهاب الزرّ', () => {
    const job = JOBS.find((j) => j.key === 'cohort_status_sync')
    expect(job, 'ذهب الزرّ والعامل معا — فلا يحرّك الشعب أحد').toBeTruthy()
    expect(job!.everyMs).toBeLessThanOrEqual(15 * 60_000)
  })
})

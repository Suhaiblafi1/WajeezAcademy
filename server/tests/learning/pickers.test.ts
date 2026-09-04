/* بدائلُ لصقِ المعرّفات: بحثُ متعلّمٍ بالاسم، وجلساتُ الشعبة للاختيار.

   كان تسجيلُ متعلّمٍ يطلب «معرف المستخدم (UUID)» وربطُ Zoom يطلب «معرف
   الجلسة (UUID)» — وكلتا القيمتَين لا تظهران على أيّ شاشة في المنصّة، فلا
   سبيلَ لتعبئتهما إلّا من قاعدة البيانات (جولة ٢٠٢٦-٠٩، الرحلة ٧). فالبحثُ
   والقائمةُ هما ما يُغني عنهما، وهذا الاختبار يحفظ عقدَهما. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortService } from '../../services/cohort.service'

let prisma: PrismaClient
let cohorts: CohortService
let managerId = ''
let cohortId = ''
let laylaId = ''
const COURSE = 'C-BIZ-101'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  cohorts = new CohortService(prisma)

  const m = await auth.register('pickers-manager@test.local', 'Manager#12345', 'مدير أكاديمي')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])

  const layla = await auth.register('layla.picker@test.local', 'Learner#12345', 'ليلى المهنّا')
  laylaId = layla.userId
  await auth.setRoles(laylaId, ['learner'])
  const omar = await auth.register('omar.picker@test.local', 'Learner#12345', 'عمر الشمري')
  await auth.setRoles(omar.userId, ['learner'])

  const c = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبة المنتقيات', capacity: 5 })
  cohortId = c.id
}, 240_000)

describe('بحثُ متعلّمٍ بالاسم أو البريد', () => {
  it('يجد بالاسم الجزئيّ', async () => {
    const hits = await cohorts.searchLearners(cohortId, 'ليلى')
    expect(hits.map((h) => h.email)).toContain('layla.picker@test.local')
  })

  it('ويجد بالبريد، وبحروفٍ صغيرةٍ أو كبيرةٍ سواء', async () => {
    expect((await cohorts.searchLearners(cohortId, 'OMAR.PICKER')).map((h) => h.email))
      .toContain('omar.picker@test.local')
  })

  it('ولا يبحث بحرفٍ واحد — نتيجةٌ بلا معنى تُغري بالضغط', async () => {
    expect(await cohorts.searchLearners(cohortId, 'ل')).toEqual([])
    expect(await cohorts.searchLearners(cohortId, '   ')).toEqual([])
  })

  it('ولا يعرض إلّا المتعلّمين النشطين — لا الموظّفين ولا الموقوفين', async () => {
    const hits = await cohorts.searchLearners(cohortId, 'مدير')
    expect(hits.map((h) => h.id)).not.toContain(managerId)
  })

  it('ويقول من هو مسجَّلٌ في هذه الشعبة — فلا يُسجَّل مرّتين', async () => {
    expect((await cohorts.searchLearners(cohortId, 'ليلى'))[0].enrolled).toBe(false)
    /* التسجيلُ يُنشأ مباشرةً: المفحوصُ هو علمُ «مسجَّلٌ هنا» لا مراسمُ الفتح
       (ولها اختبارُها في cohorts.test.ts) */
    await prisma.enrollment.create({ data: { cohortId, userId: laylaId, status: 'enrolled' } })
    expect((await cohorts.searchLearners(cohortId, 'ليلى'))[0].enrolled).toBe(true)
    /* والحكمُ يخصّ هذه الشعبةَ وحدَها */
    const other = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةٌ أخرى' })
    expect((await cohorts.searchLearners(other.id, 'ليلى'))[0].enrolled).toBe(false)
  })
})

describe('جلساتُ الشعبة للاختيار', () => {
  it('مرتّبةٌ بالوقت، ولكلٍّ عنوانُها وحالُ ربطها', async () => {
    await cohorts.addSession(managerId, cohortId, {
      title: 'الجلسة الثانية', startsAt: new Date('2026-10-08T18:00:00Z'), endsAt: new Date('2026-10-08T20:00:00Z'),
    })
    await cohorts.addSession(managerId, cohortId, {
      title: 'الجلسة الأولى', startsAt: new Date('2026-10-01T18:00:00Z'), endsAt: new Date('2026-10-01T20:00:00Z'),
    })
    const sessions = await cohorts.sessionsFor(cohortId)
    expect(sessions.map((s) => s.title)).toEqual(['الجلسة الأولى', 'الجلسة الثانية'])
    expect(sessions.every((s) => s.hasZoom === false)).toBe(true)

    await cohorts.attachManualZoom(managerId, sessions[0].id, { joinUrl: 'https://zoom.us/j/123456789' })
    const after = await cohorts.sessionsFor(cohortId)
    expect(after[0].hasZoom, 'المربوطةُ تُعلَّم كي لا تُربط مرّتين').toBe(true)
    expect(after[1].hasZoom).toBe(false)
  })

  it('وشعبةٌ لا وجودَ لها تُرفض بـ٤٠٤ لا بقائمةٍ فارغة', async () => {
    await expect(cohorts.sessionsFor('00000000-0000-4000-8000-000000000000'))
      .rejects.toMatchObject({ code: 'not_found' })
  })
})

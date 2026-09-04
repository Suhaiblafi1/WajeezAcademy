/* لوحُ «ما ينتظرك»: يجمع العملَ من الطوابير، ولا يعرض ما لا يملكه صاحبُه.

   الأصلُ في جولة ٢٠٢٦-٠٩: عشرونَ شاشةً وما ينتظر قرارا موزَّعٌ عليها، فمعرفةُ
   «أيَّ شاشةٍ أفتح» صارت شرطا للعمل. واللوحُ يُلغي هذا الشرط — بشرطَين:
   أن يكون محسوبا من الحقيقة لا من طابورٍ يبلى، وأن يُرشَّح بالصلاحيّات. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CohortService } from '../../services/cohort.service'
import { StaffInboxService } from '../../services/staff-inbox.service'
import { ROLE_PERMISSIONS } from '../../auth/permissions'

let prisma: PrismaClient
let inbox: StaffInboxService
let cohorts: CohortService
let managerId = ''
let learnerId = ''
const COURSE = 'C-BIZ-101'
const permsOf = (role: string) => ROLE_PERMISSIONS[role] as readonly string[]

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  inbox = new StaffInboxService(prisma)
  cohorts = new CohortService(prisma)

  const m = await auth.register('inbox-manager@test.local', 'Manager#12345', 'مدير أكاديمي')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])
  const l = await auth.register('inbox-learner@test.local', 'Learner#12345', 'متعلّمُ اللوح')
  learnerId = l.userId
  await auth.setRoles(learnerId, ['learner'])
}, 240_000)

describe('اللوحُ يقول ما ينتظر فعلا', () => {
  it('لا يعرض بندا بعدّادٍ صفر — ولا يُختلَق عملٌ ليبدو مشغولا', async () => {
    const items = await inbox.forStaff(managerId, permsOf('academic_manager'))
    expect(items.filter((i) => i.count === 0)).toHaveLength(0)
  })

  it('ويُظهر مهمّةً أُسندت بالاسم، ويُعلّم المتأخّرةَ عاجلةً', async () => {
    await prisma.staffTask.create({
      data: {
        assigneeId: managerId, assignedBy: managerId, title: 'راجع طلبَ الشهادة',
        dueAt: new Date(Date.now() - 86_400_000), status: 'open',
      },
    })
    const items = await inbox.forStaff(managerId, permsOf('academic_manager'))
    const mine = items.find((i) => i.key === 'my_tasks')
    expect(mine?.count).toBe(1)
    expect(mine?.severity, 'ما فات موعدُه عاجل').toBe('urgent')
    expect(mine?.sample[0]).toContain('تأخّرت')
  })

  it('ويُظهر جلسةَ الأسبوع الناقصةَ مدرّبا أو رابطا — ولا يحسب المسودّة', async () => {
    const c = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةُ اللوح', capacity: 10, price: 100 })
    await cohorts.addSession(managerId, c.id, {
      title: 'جلسةُ الخطر',
      startsAt: new Date(Date.now() + 2 * 86_400_000),
      endsAt: new Date(Date.now() + 2 * 86_400_000 + 7_200_000),
    })
    await prisma.cohort.update({ where: { id: c.id }, data: { status: 'active' } })

    const items = await inbox.forStaff(managerId, permsOf('academic_manager'))
    const risk = items.find((i) => i.key === 'sessions_at_risk')
    expect(risk?.count).toBe(1)
    expect(risk?.severity).toBe('urgent')
    expect(risk?.sample[0]).toContain('بلا مدرّب')
    expect(risk?.sample[0]).toContain('بلا رابط')

    /* والمسودّةُ لا تُحسب: لا متعلّمَ فيها يُفاجَأ */
    const draft = await cohorts.create(managerId, { courseId: COURSE, title: 'مسودّةٌ بجلسة' })
    await cohorts.addSession(managerId, draft.id, {
      title: 'جلسةُ مسودّة',
      startsAt: new Date(Date.now() + 3 * 86_400_000),
      endsAt: new Date(Date.now() + 3 * 86_400_000 + 7_200_000),
    })
    const after = await inbox.forStaff(managerId, permsOf('academic_manager'))
    expect(after.find((i) => i.key === 'sessions_at_risk')?.count, 'المسودّةُ ليست خطرا').toBe(1)
  })

  it('ويُظهر اقتراحَ تأجيلٍ معلَّقا كعاجل، باسم شعبته', async () => {
    const c = await cohorts.create(managerId, { courseId: COURSE, title: 'شعبةُ الاقتراح' })
    const session = await cohorts.addSession(managerId, c.id, {
      title: 'جلسةٌ تُؤجَّل',
      startsAt: new Date(Date.now() + 10 * 86_400_000),
      endsAt: new Date(Date.now() + 10 * 86_400_000 + 7_200_000),
    })
    await prisma.sessionRescheduleRequest.create({
      data: {
        sessionId: session.id, requestedBy: managerId,
        currentStartsAt: session.startsAt,
        proposedStartsAt: new Date(Date.now() + 12 * 86_400_000),
        reason: 'سببٌ مكتوبٌ للإدارة',
      },
    })
    const items = await inbox.forStaff(managerId, permsOf('academic_manager'))
    const r = items.find((i) => i.key === 'reschedules')
    expect(r?.count).toBe(1)
    expect(r?.severity).toBe('urgent')
    expect(r?.sample[0]).toContain('شعبةُ الاقتراح')
  })

  it('والأعجلُ أوّلا — ترتيبُ القائمة هو ترتيبُ العمل', async () => {
    const items = await inbox.forStaff(managerId, permsOf('academic_manager'))
    const weight = { urgent: 0, attention: 1, info: 2 } as const
    const order = items.map((i) => weight[i.severity])
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
})

describe('ولا يعرض لأحدٍ ما لا يملك صلاحيّتَه', () => {
  it('المالية لا ترى اقتراحاتِ التأجيل ولا الجلساتِ ولا طابورَ المحتوى', async () => {
    const keys = (await inbox.forStaff(managerId, permsOf('finance'))).map((i) => i.key)
    expect(keys).not.toContain('reschedules')
    expect(keys).not.toContain('sessions_at_risk')
    expect(keys).not.toContain('content_review')
  })

  it('والدعمُ لا يرى الشعبَ، ويرى تذاكرَه', async () => {
    await prisma.supportTicket.create({
      data: { userId: learnerId, subject: 'رابطُ الجلسة لا يعمل', category: 'technical', status: 'open' },
    })
    const support = await inbox.forStaff(managerId, permsOf('support'))
    expect(support.map((i) => i.key)).not.toContain('reschedules')
    expect(support.find((i) => i.key === 'support')?.count).toBe(1)
  })

  it('ومن لا صلاحيّةَ له أصلا يرى مهامَّه المسندةَ وحدَها', async () => {
    const items = await inbox.forStaff(managerId, [])
    expect(items.map((i) => i.key)).toEqual(['my_tasks'])
  })
})

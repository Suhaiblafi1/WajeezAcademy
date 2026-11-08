/* سباقان في الكتالوج (٨ نوفمبر ٢٠٢٦) — والعلّةُ في `CatalogAdminService.decide` و`PublishingService.publish`.

   ① **القرارُ الأوّلُ يغلب** — مراجعان معا (يعتمد أحدُهما ويردّ الآخر) كانا يمضيان كلاهما: قراران متضادّان، والطلبُ «مردود»
      والاسمُ الذي فيه كُتب على الدورة.
   ② **والإصدارُ يُنشر مرّةً** — ضغطتان معا على «انشر» كانتا تكتبان لقطتين وحدثَي نشرٍ لإصدارٍ واحد. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CatalogAdminService } from '../../services/catalog-admin.service'
import { PublishingService } from '../../services/publishing.service'

let prisma: PrismaClient
let admin: CatalogAdminService
let maker = ''
let reviewerA = ''
let reviewerB = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  admin = new CatalogAdminService(prisma)
  maker = (await auth.register('dpo-maker@test.local', 'Maker#12345', 'صانع الطلب')).userId
  reviewerA = (await auth.register('dpo-a@test.local', 'Rev#12345', 'مراجع أ')).userId
  reviewerB = (await auth.register('dpo-b@test.local', 'Rev#12345', 'مراجع ب')).userId
}, 240_000)

describe('① القرار الأول يغلب', () => {
  it('⚠️ اعتماد ورد معا: يمضي واحد ويرد الآخر — والدورة تتبع القرار الذي مضى', async () => {
    const course = await prisma.course.findFirstOrThrow({
      where: { status: 'published' },
      select: { id: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } },
    })
    const before = course.versions[0]?.titleAr
    const { changeRequestId } = await admin.renameCourse(course.id, 'اسم يطلبه الصانع للتجربة', maker, [])
    const out = await Promise.allSettled([
      admin.decide(changeRequestId!, 'approve', undefined, reviewerA, []),
      admin.decide(changeRequestId!, 'reject', 'لا يناسب', reviewerB, []),
    ])
    expect(out.filter((r) => r.status === 'fulfilled'), 'مضى القراران كلاهما').toHaveLength(1)
    expect((out.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'bad_state' })
    expect(await prisma.contentApprovalDecision.count({ where: { changeRequestId: changeRequestId! } })).toBe(1)

    const cr = await prisma.contentChangeRequest.findUniqueOrThrow({ where: { id: changeRequestId! } })
    const now = (await prisma.courseVersion.findFirstOrThrow({ where: { courseId: course.id }, orderBy: { version: 'desc' } })).titleAr
    if (cr.status === 'approved') expect(now).toBe('اسم يطلبه الصانع للتجربة')
    else expect(now, 'رد الطلب وكتب اسمه على الدورة').toBe(before)
  })
})

describe('② والإصدار ينشر مرة', () => {
  it('⚠️ ضغطتان معا على «انشر»: لقطة واحدة وحدث نشر واحد', async () => {
    const pub = new PublishingService(prisma)
    const v = await pub.createDraftVersion('dpo-once', maker)
    const out = await Promise.allSettled([pub.publish(v.id, maker), pub.publish(v.id, maker)])
    expect(out.filter((r) => r.status === 'fulfilled'), 'نشر الإصدار مرتين').toHaveLength(1)
    expect((out.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'bad_state' })
    expect(await prisma.catalogSnapshot.count({ where: { catalogVersionId: v.id } })).toBe(1)
    expect(await prisma.catalogPublishEvent.count({ where: { catalogVersionId: v.id } })).toBe(1)
    expect(await prisma.catalogVersion.count({ where: { status: 'published' } })).toBe(1)
  })
})

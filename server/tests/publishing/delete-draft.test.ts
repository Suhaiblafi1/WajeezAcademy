/* حذف مسودة معلّقة — والحدود التي تمنعه من أن يصير حذفا للتاريخ.
 *
 * نشرٌ يخفق بعد إنشاء الإصدار يترك مسودة بلا لقطة: لا تُنشر (اللوحة لا تعرض
 * لها زرا)، ولا تُسترجع (لا لقطة فيها)، وتحجز تسميتها إلى الأبد. فكان على
 * المشغّل أن يخترع تسمية جديدة كلما أخفق نشر، بلا ما يفسّر له لماذا.
 *
 * والحذف في قاعدة نشر خطر بطبعه، فحدّاه شرطان لا ثالث لهما: مسودة فقط،
 * وبلا لقطة واحدة. الأول يحمي المنشور والمتجاوَز، والثاني يحمي كل ما قد
 * يكون هدف رجوع. وأكثر ما يهم هنا ليس أن الحذف يعمل، بل أنه **يرفض** —
 * ولذلك أغلب ما دونه اختبارات رفض.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { PublishingService } from '../../services/publishing.service'
import { AuthError } from '../../services/auth.service'
import { AuthService } from '../../services/auth.service'

let prisma: PrismaClient
let pub: PublishingService
let actorId: string

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  pub = new PublishingService(prisma)
  const u = await new AuthService(prisma).register('del-draft@test.local', 'Delete#12345', 'مشغّل النشر')
  actorId = u.userId
})

describe('حذف المسودة المعلّقة', () => {
  it('يحذف مسودة بلا لقطة ويحرّر تسميتها للاستعمال من جديد', async () => {
    const label = 'test.delete-01'
    const v = await pub.createDraftVersion(label, actorId)

    /* التسمية محجوزة ما دامت المسودة قائمة — هذا هو العطل الذي نعالجه */
    await expect(pub.createDraftVersion(label, actorId)).rejects.toThrow(AuthError)

    const r = await pub.deleteDraftVersion(v.id, actorId, 'تنظيف')
    expect(r).toEqual({ deleted: true, label })
    expect(await prisma.catalogVersion.findUnique({ where: { id: v.id } })).toBeNull()

    /* وتُستعمل بعده — وإلا فالحذف لم يحل شيئا */
    const again = await pub.createDraftVersion(label, actorId)
    expect(again.label).toBe(label)
    await pub.deleteDraftVersion(again.id, actorId)
  })

  it('يسجّل الحذف في التدقيق — الأثر يبقى بعد زوال المحذوف', async () => {
    const v = await pub.createDraftVersion('test.delete-audit', actorId)
    await pub.deleteDraftVersion(v.id, actorId, 'سبب مكتوب')

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'catalog.version.delete_draft', entityId: v.id },
    })
    expect(audit, 'حذفٌ بلا أثر تدقيق').toBeTruthy()
    expect(audit!.reason).toBe('سبب مكتوب')
    expect((audit!.before as { label?: string })?.label).toBe('test.delete-audit')
    /* السجل خارج CatalogPublishEvent عمدا: أحداث الإصدار تُحذف معه بالتتالي */
    expect(audit!.actorId).toBe(actorId)
  })

  it('يرفض إصدارا منشورا — لا يُمس المنشور مهما كان', async () => {
    const live = await prisma.catalogVersion.findFirst({ where: { status: 'published' } })
    expect(live, 'لا إصدار منشور — الاختبار بلا معنى').toBeTruthy()
    await expect(pub.deleteDraftVersion(live!.id, actorId)).rejects.toMatchObject({ code: 'not_draft' })
    expect(await prisma.catalogVersion.findUnique({ where: { id: live!.id } })).not.toBeNull()
  })

  it('يرفض مسودة تحمل لقطة — قد تكون هدف رجوع', async () => {
    const v = await pub.createDraftVersion('test.delete-snap', actorId)
    await prisma.catalogSnapshot.create({
      data: { catalogVersionId: v.id, payload: { probe: true }, payloadHash: 'probe-hash' },
    })
    await expect(pub.deleteDraftVersion(v.id, actorId)).rejects.toMatchObject({ code: 'has_snapshot' })
    expect(await prisma.catalogVersion.findUnique({ where: { id: v.id } })).not.toBeNull()

    await prisma.catalogSnapshot.deleteMany({ where: { catalogVersionId: v.id } })
    await pub.deleteDraftVersion(v.id, actorId)
  })

  it('يرفض معرّفا لا وجود له بـ404 لا بانهيار', async () => {
    await expect(
      pub.deleteDraftVersion('00000000-0000-0000-0000-000000000000', actorId),
    ).rejects.toMatchObject({ code: 'not_found', status: 404 })
  })
})

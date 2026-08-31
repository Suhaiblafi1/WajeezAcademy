/* البذر الكسول — فحصٌ واحد بدل تسعةٍ وتسعين كتابة في كلّ إقلاعٍ بارد.

   `seedRbac` تكتب upsert لكلّ صلاحيّة ودورٍ ومنح: نحو ٩٩ رحلةً **متتالية**
   إلى القاعدة. وكانت تُنادى في كلّ إقلاعٍ باردٍ لدالّة Vercel قبل خدمة أيّ
   طلب، والقاعدة على Neon عبر الشبكة. فأوّلُ من يفتح الموقع بعد خمولٍ ينتظرها
   كلَّها — وهو ما شكا منه صاحب المنصّة: «فتح الحساب والخروج يأخذ وقتا طويلا».

   والبذر يجري في البناء أصلا، فالنداء في مسار الطلب تكرارٌ لعملٍ تمّ. لكنّ
   حذفه بلا بديلٍ يترك قاعدةً غير مبذورة تردّ ٤٠٣ على كلّ شيء — فالفحص عدٌّ
   واحد، ولا يُبذَر إلّا إن نقص العدد. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { ensureRbacSeeded, seedRbac } from '../../auth/rbac-seed'
import { PERMISSIONS, ROLE_PERMISSIONS } from '../../auth/permissions'

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  await seedRbac(prisma) // القاعدة مبذورة — كحال الإنتاج بعد البناء
}, 240_000)

describe('البذر الكسول', () => {
  it('١) لا يكتب شيئا على قاعدةٍ مبذورة', async () => {
    const before = await prisma.$transaction([
      prisma.permission.count(),
      prisma.role.count(),
      prisma.rolePermission.count(),
    ])
    const r = await ensureRbacSeeded(prisma)
    expect(r.seeded, 'أُعيد البذر على قاعدةٍ كاملة').toBe(false)
    const after = await prisma.$transaction([
      prisma.permission.count(),
      prisma.role.count(),
      prisma.rolePermission.count(),
    ])
    expect(after).toEqual(before)
  })

  it('٢) ويبذر حين تنقص صلاحيّة — الحذف بلا بديلٍ يُغلق المنصّة', async () => {
    const victim = PERMISSIONS[PERMISSIONS.length - 1].key
    await prisma.rolePermission.deleteMany({ where: { permissionKey: victim } })
    await prisma.permission.delete({ where: { key: victim } })
    expect(await prisma.permission.count()).toBeLessThan(PERMISSIONS.length)

    const r = await ensureRbacSeeded(prisma)
    expect(r.seeded, 'لم يُبذَر رغم النقص').toBe(true)
    expect(await prisma.permission.count()).toBe(PERMISSIONS.length)
  })

  it('٣) ويبذر حين ينقص دور', async () => {
    const victim = Object.keys(ROLE_PERMISSIONS).at(-1)!
    await prisma.userRole.deleteMany({ where: { roleId: victim } })
    await prisma.role.delete({ where: { id: victim } })

    const r = await ensureRbacSeeded(prisma)
    expect(r.seeded).toBe(true)
    expect(await prisma.role.count()).toBeGreaterThanOrEqual(Object.keys(ROLE_PERMISSIONS).length)
  })

  it('٤) و`learner.portal` باقٍ بعد كلّ ذلك — البوّابة لا تُغلق بالإصلاح', async () => {
    const rp = await prisma.rolePermission.findFirst({
      where: { roleId: 'learner', permissionKey: 'learner.portal' },
    })
    expect(rp).not.toBeNull()
  })
})

/* بذر الأدوار والصلاحيات — idempotent: upsert بالمفاتيح الثابتة.
   لا ينشئ أي مستخدم تجريبي؛ الحسابات الحقيقية تُنشأ عبر التسجيل/الإدارة. */

import type { PrismaClient } from '@prisma/client'
import { PERMISSIONS, ROLE_NAMES_AR, ROLE_PERMISSIONS } from './permissions'

export async function seedRbac(prisma: PrismaClient): Promise<{ roles: number; permissions: number; grants: number }> {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: { key: p.key, description: p.description },
    })
  }
  let grants = 0
  for (const [roleId, keys] of Object.entries(ROLE_PERMISSIONS)) {
    await prisma.role.upsert({
      where: { id: roleId },
      update: { nameAr: ROLE_NAMES_AR[roleId] ?? roleId },
      create: { id: roleId, nameAr: ROLE_NAMES_AR[roleId] ?? roleId },
    })
    for (const key of keys) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionKey: { roleId, permissionKey: key } },
        update: {},
        create: { roleId, permissionKey: key },
      })
      grants++
    }
  }
  return {
    roles: Object.keys(ROLE_PERMISSIONS).length,
    permissions: PERMISSIONS.length,
    grants,
  }
}

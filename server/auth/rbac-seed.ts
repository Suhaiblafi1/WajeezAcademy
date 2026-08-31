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

/* ─────────── البذر الكسول: فحصٌ واحد بدل تسعةٍ وتسعين ───────────

   `seedRbac` تُنفّذ upsert لكلّ صلاحيّة (٦٧) وكلّ دور (٩) وكلّ منحٍ بينهما
   (٢٣) — نحو ٩٩ رحلةً **متتالية** إلى القاعدة. وكانت تُنادى في كلّ إقلاعٍ
   باردٍ لدالّة Vercel قبل خدمة أيّ طلب، والقاعدة على Neon عبر الشبكة لا
   في الذاكرة. فأوّلُ من يفتح الموقع بعد فترة خمولٍ ينتظرها كلَّها — وهو ما
   وصفه صاحب المنصّة: «فتح الحساب والخروج منه يأخذ وقتا طويلا».

   والبذر أصلا يجري في البناء: `scripts/vercel-build.sh` ينادي
   `catalog:import` وهي تبذر. فنداؤه في مسار الطلب تكرارٌ لعملٍ تمّ.

   ولا يُحذف بلا بديل: لو نُشرت قاعدةٌ بلا بذرٍ لردّ الخادم ٤٠٣ على كلّ شيء.
   فالفحص عدٌّ واحد — رحلةٌ واحدة — ولا يُبذَر إلّا إن نقص العدد. */
export async function ensureRbacSeeded(prisma: PrismaClient): Promise<{ seeded: boolean }> {
  try {
    const [permissions, roles] = await prisma.$transaction([
      prisma.permission.count(),
      prisma.role.count(),
    ])
    if (permissions >= PERMISSIONS.length && roles >= Object.keys(ROLE_PERMISSIONS).length) {
      return { seeded: false }
    }
  } catch {
    /* تعذّر العدّ — نبذر احتياطا بدل أن نخدم بصلاحيّاتٍ ناقصة */
  }
  await seedRbac(prisma)
  return { seeded: true }
}

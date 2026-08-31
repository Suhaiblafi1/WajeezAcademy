/* بذر الأدوار والصلاحيات — idempotent: upsert بالمفاتيح الثابتة.
   لا ينشئ أي مستخدم تجريبي؛ الحسابات الحقيقية تُنشأ عبر التسجيل/الإدارة. */

import type { PrismaClient } from '@prisma/client'
import { PERMISSIONS, ROLE_NAMES_AR, ROLE_PERMISSIONS } from './permissions'

/* ─────────── لماذا يُبتلع P2002 هنا ───────────

   `upsert` قراءةٌ ثمّ كتابة، لا عمليّةٌ ذرّية. فحين تُقلع عمليّتان معا على
   قاعدةٍ ينقصها صفٌّ — وهو ما يحدث بالضبط يوم تُضاف صلاحيّةٌ جديدة إلى
   `PERMISSIONS`، إذ يصير عدُّ `ensureRbacSeeded` ناقصا عند الجميع دفعةً
   واحدة — تقرأ كلتاهما «لا صفّ» ثمّ تُدخلان، فتنجح واحدةٌ وتسقط الأخرى
   بـ`P2002` على المفتاح الفريد.

   وسقوطُها خطأٌ في التشخيص لا في النتيجة: الصفُّ الذي أرادته موجودٌ الآن،
   أنشأه غيرُها. فالمقصود من هذه الدالّة — «تأكَّد أن هذه الصفوف موجودة» —
   قد تحقّق. فيُبتلع P2002 وحده، ولا يُبتلع غيرُه.

   وقد ظهر هذا فعلا في `test:e2e` بعد إضافة صلاحيّات التفويض الثلاث: سقط
   ملفٌّ مختلف في كلِّ تشغيلة بلا أن يسقط اختبارٌ واحدٌ بداخله. */
const UNIQUE_VIOLATION = 'P2002'

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === UNIQUE_VIOLATION
}

export async function seedRbac(prisma: PrismaClient): Promise<{ roles: number; permissions: number; grants: number }> {
  for (const p of PERMISSIONS) {
    try {
      await prisma.permission.upsert({
        where: { key: p.key },
        update: { description: p.description },
        create: { key: p.key, description: p.description },
      })
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
      /* أنشأه غيرُنا بين قراءتنا وكتابتنا — يبقى أن نضمن وصفَه */
      await prisma.permission.update({ where: { key: p.key }, data: { description: p.description } })
    }
  }
  let grants = 0
  for (const [roleId, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const nameAr = ROLE_NAMES_AR[roleId] ?? roleId
    try {
      await prisma.role.upsert({ where: { id: roleId }, update: { nameAr }, create: { id: roleId, nameAr } })
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
      await prisma.role.update({ where: { id: roleId }, data: { nameAr } })
    }
    /* المنحُ لا حقلَ فيه يُحدَّث (كان `update: {}`)، فـ`createMany` بتخطّي
       المكرَّر مكافئٌ له تماما — وذرّيٌّ في القاعدة، ورحلةٌ واحدة بدل ثلاثٍ
       وعشرين. وهذا يخدم أيضا ما يشكوه تعليقُ البذر الكسول أسفلَه. */
    await prisma.rolePermission.createMany({
      data: keys.map((key) => ({ roleId, permissionKey: key })),
      skipDuplicates: true,
    })
    grants += keys.length
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

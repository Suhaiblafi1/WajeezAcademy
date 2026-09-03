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

export async function seedRbac(prisma: PrismaClient): Promise<{ roles: number; permissions: number; grants: number; revoked: number }> {
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
  let revoked = 0
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
    /* ─── والمنحُ يُسحب أيضا، لا يُضاف فحسب ───

       كان البذرُ إضافةً محضة: يُنشئ ما نقص ولا يحذف ما زاد. فحذفُ حبّةٍ من
       `ROLE_PERMISSIONS` **لا أثرَ له على أيّ قاعدةٍ قائمة** — والصلاحيّاتُ
       تُقرأ في كلّ طلبٍ من صفوف `RolePermission` لا من الشيفرة
       (`auth.service.resolve`). فمن مَلَك حبّةً مرّةً بقيت له وإن نُزعت من
       المصفوفة، ولا يظهر الفرقُ إلّا في قاعدةٍ جديدةٍ كقاعدة الاختبارات.

       وقد ظهر هذا الآن بالضبط: فصلُ المالِ عن المديرِ الأكاديميّ (نزعُ
       `finance.payment.record` و`finance.refund.process` و`commerce.manage`
       و`settings.manage`) كان سيبقى حبرا على ورق في كلّ بيئةٍ تعمل.

       فالمصفوفةُ هي الحقيقة: ما ليس فيها يُسحب. ولا يُمسّ استثناءُ الشخص
       (`PermissionOverride`) — تلك حبّةٌ مُنحت لصاحبها بقرارٍ موثَّقٍ عليه،
       لا منحُ دورٍ. */
    const removed = await prisma.rolePermission.deleteMany({
      where: { roleId, permissionKey: { notIn: [...keys] } },
    })
    revoked += removed.count
    grants += keys.length
  }
  return {
    roles: Object.keys(ROLE_PERMISSIONS).length,
    permissions: PERMISSIONS.length,
    grants,
    revoked,
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
   فالفحص عدٌّ واحد — رحلةٌ واحدة — ولا يُبذَر إلّا إن نقص العدد.

   وسحبُ المنحِ الزائد (انظر `seedRbac`) ليس من هذا الفحص: عدُّ الأدوار
   والصلاحيّات لا يكشف منحا زائدا. فمصدرُه البذرُ في النشر
   (`scripts/vercel-build.sh` → `catalog:import`) لا مسارُ الطلب — وهو
   الموضعُ الصحيح: مطابقةُ المصفوفة عملُ إصدارٍ لا عملُ كلّ إقلاع. */
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

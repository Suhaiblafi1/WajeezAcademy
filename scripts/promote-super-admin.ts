#!/usr/bin/env node
/* ترقيةُ حسابٍ موجود إلى «مدير النظام الأعلى» — لأوّلِ مديرٍ خاصّة.
 *
 * التسجيلُ يمنح `learner` وحده، وبذرُ الأدوار لا يُنشئ مستخدما، وتعيينُ
 * دورٍ من الشاشة محكومٌ بالرتبة: لا يمنح `super_admin` إلّا `super_admin`.
 * فقاعدةٌ بلا مديرِ نظامٍ لا سبيلَ إليها من الواجهة أصلا — وهذا السبيل.
 *
 * يُضيف الدورَ ولا ينزع شيئا (فالمتعلّم يبقى متعلّما)، ويبذر الأدوارَ إن
 * كانت ناقصة، ويسجّل الفعلَ في الأثر بلا فاعلٍ (النظام).
 *
 *   npx tsx scripts/promote-super-admin.ts you@example.com            يعرض ولا يكتب
 *   npx tsx scripts/promote-super-admin.ts you@example.com --apply    ينفّذ
 *
 * على الإنتاج: عيّن DATABASE_URL في البيئة قبل التشغيل. ومحلّيّا بلا
 * DATABASE_URL يُستعمل PostgreSQL المدمج.
 */

import { getPrisma } from '../server/db/client'
import { ensureRbacSeeded } from '../server/auth/rbac-seed'
import { ROLE_NAMES_AR } from '../server/auth/permissions'
import { recordAudit } from '../server/services/audit'

const ROLE = 'super_admin'
const APPLY = process.argv.includes('--apply')
const emailArg = process.argv.slice(2).find((a) => !a.startsWith('--'))

const usage = () => {
  console.error('الاستعمال: npx tsx scripts/promote-super-admin.ts <email> [--apply]')
  process.exit(2)
}

const main = async () => {
  if (!emailArg) usage()
  const email = emailArg!.trim().toLowerCase()
  if (!email.includes('@')) usage()

  const prisma = await getPrisma()

  const user = await prisma.user.findUnique({
    where: { email },
    include: { roles: { select: { roleId: true } } },
  })
  if (!user) {
    console.error(`لا حسابَ بهذا البريد: ${email}`)
    console.error('سجّل الحسابَ أوّلا من الموقع (أو من /admin/users) ثمّ أعد التشغيل.')
    process.exit(1)
  }

  const held = user.roles.map((r) => r.roleId)
  const heldAr = held.map((r) => ROLE_NAMES_AR[r] ?? r).join(' · ') || 'بلا دور'
  console.log(`الحساب: ${user.displayName} <${user.email}> · الحالة: ${user.status}`)
  console.log(`يحمل: ${heldAr}`)

  if (held.includes(ROLE)) {
    console.log('')
    console.log('يحمل دورَ مدير النظام الأعلى بالفعل — لا شيءَ يُكتب.')
    return
  }
  if (user.status !== 'active') {
    console.log('')
    console.log(`تنبيه: الحسابُ ليس نشطا (${user.status}) — الدورُ يُضاف لكنّ الدخولَ يبقى ممنوعا حتّى يُرفع الإيقاف.`)
  }

  if (!APPLY) {
    console.log('')
    console.log(`سيُضاف الدور: ${ROLE_NAMES_AR[ROLE]} (${ROLE})`)
    console.log(`لم يُكتب شيء. للتنفيذ: npx tsx scripts/promote-super-admin.ts ${email} --apply`)
    return
  }

  /* قاعدةٌ لم تُبذَر بعد لا تحوي صفَّ الدور، والمفتاحُ الأجنبيّ يرفض. */
  const { seeded } = await ensureRbacSeeded(prisma)
  if (seeded) console.log('بُذرت الأدوارُ والصلاحيات (كانت ناقصة).')

  await prisma.userRole.createMany({
    data: [{ userId: user.id, roleId: ROLE }],
    skipDuplicates: true,
  })
  await recordAudit(prisma, {
    actorId: null,
    action: 'admin.user.promote',
    entityType: 'user',
    entityId: user.id,
    meta: { email: user.email, added: [ROLE], via: 'scripts/promote-super-admin.ts' },
    reason: 'ترقيةٌ من سطر الأوامر — تأسيسُ مدير النظام',
  })

  console.log('')
  console.log(`✔ أُضيف دورُ ${ROLE_NAMES_AR[ROLE]} إلى ${user.email}`)
  console.log('الصلاحياتُ تُقرأ من القاعدة في كلّ طلب؛ يكفي أن يُحدِّث الصفحةَ أو يدخل من جديد.')
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1) })

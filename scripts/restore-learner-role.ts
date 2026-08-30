#!/usr/bin/env node
/* إعادة دور `learner` لكلّ حساب فقده.
 *
 * `setRoles` كان يحذف الأدوار كلّها ثمّ يكتب الجديدة، والتسجيل يمنح `learner`
 * وحده — فكلّ من رُقّي إلى دورٍ إداريّ فقده صامتا. والشريط يعرض «تعلّمي»
 * و«خزانتي» بينما الخادم يردّ ٤٠٣، فيبدو الموقع معطوبا.
 *
 * أُصلح المصدر في auth.service.ts (الترقية تُضيف ولا تنزع). وهذا للحسابات
 * التي فقدته قبل الإصلاح.
 *
 *   npx tsx scripts/restore-learner-role.ts            يعرض ولا يكتب
 *   npx tsx scripts/restore-learner-role.ts --apply    ينفّذ
 */

import { getPrisma } from '../server/db/client'

const APPLY = process.argv.includes('--apply')

const main = async () => {
  const prisma = await getPrisma()
  const users = await prisma.user.findMany({
    include: { roles: { select: { roleId: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const missing = users.filter((u) => !u.roles.some((r) => r.roleId === 'learner'))

  console.log(`حسابات: ${users.length} · بلا دور learner: ${missing.length}`)
  for (const u of missing) {
    const held = u.roles.map((r) => r.roleId).join(' · ') || 'بلا دور'
    console.log(`   ${APPLY ? '✔' : '·'} ${u.displayName} <${u.email}> — يحمل: ${held}`)
    if (APPLY) {
      await prisma.userRole.create({ data: { userId: u.id, roleId: 'learner' } })
    }
  }
  console.log('')
  console.log(`${APPLY ? 'أُعيد الدور لـ' : 'سيُعاد الدور لـ'} ${missing.length} حسابا`)
  if (!APPLY && missing.length > 0) console.log('لم يُكتب شيء. للتنفيذ: npx tsx scripts/restore-learner-role.ts --apply')
  if (APPLY && missing.length > 0) console.log('على كلّ حساب أن يخرج ويدخل من جديد لتُحدَّث صلاحيات جلسته.')
}

main().catch((e) => { console.error(e); process.exit(1) })

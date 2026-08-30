/* دور `learner` أرضيّة لا تُنزع بترقية.

   `setRoles` كان يحذف الأدوار كلّها ثمّ يكتب الجديدة، والتسجيل يمنح `learner`
   وحده. فكلّ حسابٍ رُقّي إلى دورٍ إداريّ فقد بوابة المتعلّم صامتا: الشريط
   يعرض «تعلّمي» و«خزانتي» بينما /api/learner/my-learning يردّ ٤٠٣ «لا تملك
   الصلاحية المطلوبة» — فيبدو الموقع معطوبا وهو يطبّق قاعدةً لم يقصدها أحد.

   وقع هذا على حساب صاحب المنصّة نفسه: أُبلغ أنّ الموقع «لم يعد يعمل»، وكانت
   بوابة المتعلّم تُرفض له وحده لأنّه إداريّ.

   والقاعدة التي يحرسها هذا الملف: الدور الوظيفيّ يُضاف فوق الأرضيّة لا
   مكانها — فالإداريّ إنسانٌ يشتري دورة ويحضر شعبة وينال شهادة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { ROLE_PERMISSIONS } from '../../auth/permissions'

let prisma: PrismaClient
let auth: AuthService

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
}, 180_000)

const rolesOf = async (userId: string) =>
  (await prisma.userRole.findMany({ where: { userId } })).map((r) => r.roleId).sort()

describe('دور learner أرضيّة', () => {
  it('الترقية إلى دور إداريّ لا تنزع learner', async () => {
    const { userId: id } = await auth.register(`base.${Date.now()}@wajeez.test`, 'Passw0rd!x', 'حساب اختبار')
    expect(await rolesOf(id)).toContain('learner')

    await auth.setRoles(id, ['academic_manager'])
    const after = await rolesOf(id)
    expect(after, 'الترقية محت learner — تُغلق بوابة المتعلّم بلا قصد').toContain('learner')
    expect(after).toContain('academic_manager')
  })

  it('ولا تتكرّر حين تُطلب صراحةً', async () => {
    const { userId: id } = await auth.register(`dup.${Date.now()}@wajeez.test`, 'Passw0rd!x', 'حساب اختبار')
    await auth.setRoles(id, ['learner', 'trainer'])
    const rows = await prisma.userRole.findMany({ where: { userId: id, roleId: 'learner' } })
    expect(rows.length).toBe(1)
  })

  it('والصلاحية التي تفتح البوابة ما زالت في learner وحده — فالأرضيّة ضرورية', () => {
    const holders = Object.entries(ROLE_PERMISSIONS)
      .filter(([, keys]) => (keys as readonly string[]).includes('learner.portal'))
      .map(([role]) => role)
    /* super_admin يأخذ كل الصلاحيات، وما عداه: learner وحده */
    expect(holders.filter((r) => r !== 'super_admin')).toEqual(['learner'])
  })
})

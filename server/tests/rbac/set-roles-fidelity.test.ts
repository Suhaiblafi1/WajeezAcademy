/* `setRoles` عمليّة «تعيين» أمينة: ما يصل هو ما يصير.

   محرّر الأدوار في اللوحة يُحمّل أدوار الحساب الحاليّة عند فتحه، والإداريّ
   يعدّل المجموعة كاملةً ثمّ يحفظ. فاستبدالُ المجموعة هو الصواب، ولا يجوز
   أن تُضيف الخدمة من عندها دورا لم يختره أحد.

   وهذا الملفّ يحرس ذلك لأنّي كسرتُه: فرضتُ بقاء `learner` مع كلّ دور، ظنّا
   أنّ الترقية تنزعه صامتا — وكان الظنّ خطأ، ومن فقده فقده بإزالة علامته.
   فصار الإداريّ يرى في اللوحة دورا لا يستطيع نزعه ولا يعرف من أضافه.

   والقاعدة المضادّة محروسةٌ هنا أيضا: التسجيل يمنح `learner`، فلا يُفقد
   أحدٌ بوابتَه لأنّ أحدا لم يمنحه إيّاها أصلا. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { ROLE_PERMISSIONS } from '../../auth/permissions'

let prisma: PrismaClient
let auth: AuthService

const rolesOf = async (userId: string) =>
  (await prisma.userRole.findMany({ where: { userId }, select: { roleId: true } }))
    .map((r) => r.roleId).sort()

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
}, 240_000)

describe('أمانة تعيين الأدوار', () => {
  it('١) التسجيل يمنح «متعلّم» — البوابة مفتوحةٌ بلا تدخّل', async () => {
    const u = await auth.register('roles-fresh@test.local', 'Fresh#12345', 'حسابٌ جديد')
    expect(await rolesOf(u.userId)).toEqual(['learner'])
  })

  it('٢) الترقية تُبقي ما اختاره الإداريّ — لا تنقص', async () => {
    const u = await auth.register('roles-promote@test.local', 'Promote#12345', 'مُرقّى')
    await auth.setRoles(u.userId, ['learner', 'academic_manager'])
    expect(await rolesOf(u.userId)).toEqual(['academic_manager', 'learner'])
  })

  it('٣) ولا تزيد: مجموعةٌ بلا «متعلّم» تُكتب كما هي', async () => {
    const u = await auth.register('roles-staff-only@test.local', 'Staff#12345', 'وظيفيّ بحت')
    await auth.setRoles(u.userId, ['academic_manager'])
    expect(await rolesOf(u.userId)).toEqual(['academic_manager'])
  })

  it('٤) ونزعُ «متعلّم» يغلق بوابة التعلّم فعلا — لا صوريّا', async () => {
    const u = await auth.register('roles-revoke@test.local', 'Revoke#12345', 'مُنتزَع')
    await auth.setRoles(u.userId, ['support'])
    const { token } = await auth.login('roles-revoke@test.local', 'Revoke#12345')
    const ctx = await auth.resolve(token)
    expect(ctx?.permissions).not.toContain('learner.portal')

    /* ويعود بإعادة الدور — ما اشتُري لم يُمَسّ */
    await auth.setRoles(u.userId, ['support', 'learner'])
    const back = await auth.resolve((await auth.login('roles-revoke@test.local', 'Revoke#12345')).token)
    expect(back?.permissions).toContain('learner.portal')
  })

  it('٥) دور «متعلّم» يحمل صلاحية بوابته — وإلّا فالمنح بلا أثر', () => {
    expect(ROLE_PERMISSIONS.learner).toContain('learner.portal')
  })
})

/* البذر تحت التزاحم — لأنّ إضافة صلاحيّةٍ واحدة تُشعل الأسطول كلَّه.

   `ensureRbacSeeded` تحرس بعدٍّ واحد: إن كان عدد الصلاحيّات في القاعدة
   أقلَّ من `PERMISSIONS.length` بذرت. فيوم نضيف صلاحيّةً جديدة إلى الثابت
   يصير العدُّ ناقصا **عند كلِّ عمليّةٍ تُقلع في تلك اللحظة** — وملفّات
   الاختبار تُقلع متوازية على قاعدةٍ واحدة. فيقرأ الجميع «لم تُبذر» ويكتب
   الجميع، و`upsert` قراءةٌ ثمّ كتابةٌ لا عمليّةٌ ذرّية: فينجح واحدٌ ويسقط
   الباقون بـP2002 على `(roleId, permissionKey)`.

   وهذا ما حدث فعلا بعد إضافة صلاحيّات التفويض الثلاث: سقط ملفٌّ مختلف في
   كلِّ تشغيلة — `catalog` مرّة و`support` أخرى — بلا أن يسقط اختبارٌ واحد
   بداخله. عرَضٌ يتنقّل، وسببُه واحد.

   والبذر مقصودٌ أن يكون idempotent كما يقول رأسُ ملفّه. فالحارس هنا أن
   يبقى كذلك تحت التزاحم لا في التتابع وحده. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { seedRbac } from '../../auth/rbac-seed'
import { PERMISSIONS, ROLE_PERMISSIONS } from '../../auth/permissions'

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
})

describe('بذر الأدوار والصلاحيات تحت التزاحم', () => {
  it('خمسُ عمليّات بذرٍ متزامنة لا تُسقط واحدة', async () => {
    /* تُفرَّغ المنوح أولا كي يكون البذر إدخالا لا تحديثا — فالتزاحم لا يظهر
       إلّا على الإدخال: خمسُ عمليّاتٍ تقرأ «لا صفّ» ثمّ تكتب كلُّها. وهذه
       هي حالُ القاعدة يوم تُضاف صلاحيّةٌ جديدة إلى الثابت. */
    await prisma.rolePermission.deleteMany({})

    const runs = await Promise.allSettled([
      seedRbac(prisma), seedRbac(prisma), seedRbac(prisma), seedRbac(prisma), seedRbac(prisma),
    ])
    const failed = runs.filter((r) => r.status === 'rejected')
    expect(failed.map((r) => String((r as PromiseRejectedResult).reason))).toEqual([])
  })

  it('ولا تُكرّر صفّا: العدد بعد التزاحم هو العدد المقصود', async () => {
    const permissions = await prisma.permission.count()
    expect(permissions).toBe(PERMISSIONS.length)

    const expectedGrants = Object.values(ROLE_PERMISSIONS).reduce((n, keys) => n + keys.length, 0)
    const grants = await prisma.rolePermission.count()
    expect(grants).toBe(expectedGrants)
  })
})

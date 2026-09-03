/* ثلاثةُ أحكامٍ على الأدوار، كلٌّ منها ثغرةٌ قبل إصلاحها:

   ١) **فصلُ المال عن الأكاديميّ.** كانت حزمةُ المدير الأكاديميّ تجمع تسجيلَ
      المتعلّمِ في شعبةٍ **و**تسجيلَ دفعته **و**اعتمادَ استردادها **و**تبديلَ
      مفاتيح مزوّد الدفع نفسِه. أربعةُ أعمالٍ في يد، وثلاثةٌ منها ليست عملَه.

   ٢) **المنسّقُ الأكاديميّ.** ولم يكن على المنصّة بابٌ بينهما: من أراد أن
      يوكّل تشغيلَ الشعبِ والتسجيلَ وإصدارَ الشهادات إلى موظّفٍ لم يجد إلّا
      «مديرَ عمليّات» (لا شهادةَ يصدرها ولا مادّةً يديرها ولا شعبةً يفتحها) أو
      «مديرا أكاديميّا» بحزمته كاملة. فكان منحُ عملِ يومٍ منحا لمفاتيح البيت.

   ٣) **«متقدّم» حالةٌ لا منصب.** `trainer_applicant` كان دورا يُسند بالاسم
      من شاشة المستخدمين. ومن أُسند إليه يدا وقع في حسابٍ لا بوابةَ فيه، ومن
      نُزع عنه يدا فقد طلبَه وهو في الطابور. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import {
  LIFECYCLE_ROLES, ROLE_NAMES_AR, ROLE_PERMISSIONS, ROLE_RANK, refuseRoleAssignment,
} from '../../auth/permissions'
import { seedRbac } from '../../auth/rbac-seed'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance

async function cookieFor(email: string, role: string): Promise<string> {
  const password = 'Roles#123456'
  const user = await auth.register(email, password, role)
  await auth.setRoles(user.userId, [role])
  const { token } = await auth.login(email, password)
  return `${SESSION_COOKIE}=${token}`
}

const UUID = '00000000-0000-4000-8000-000000000000'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
}, 240_000)

describe('كلُّ دورٍ معلَنٍ مكتملُ التعريف', () => {
  /* أُضيف دورٌ جديدٌ في هذه الجولة، وإضافةُ دورٍ بلا رتبةٍ تجعل رتبتَه صفرا
     فلا يُدير أحدا ولا يُدار — وبلا اسمٍ عربيٍّ يُعرض معرّفُه للموظّف. */
  it('لكلّ دورٍ في المصفوفة رتبةٌ واسمٌ عربيٌّ وحبّةٌ واحدةٌ على الأقلّ', () => {
    for (const role of Object.keys(ROLE_PERMISSIONS)) {
      expect(ROLE_RANK[role], `الدور ${role} بلا رتبة`).toBeGreaterThan(0)
      expect(ROLE_NAMES_AR[role], `الدور ${role} بلا اسمٍ عربيّ`).toBeTruthy()
      expect(ROLE_PERMISSIONS[role].length, `الدور ${role} بلا صلاحيّة`).toBeGreaterThan(0)
    }
  })

  it('ويُبذَر في القاعدة بمنحه حرفيّا — بلا استثناءِ الجديد', async () => {
    for (const role of Object.keys(ROLE_PERMISSIONS)) {
      const row = await prisma.role.findUnique({ where: { id: role }, include: { permissions: true } })
      expect(row, `الدور ${role} غيرُ مبذور`).toBeTruthy()
      expect(row!.permissions.map((g) => g.permissionKey).sort(), `منحُ ${role} لا تطابق المصفوفة`)
        .toEqual([...ROLE_PERMISSIONS[role]].sort())
    }
  })
})

describe('المصفوفةُ هي الحقيقة: البذرُ يسحب المنحَ الزائد أيضا', () => {
  /* الأصل: كان البذرُ إضافةً محضة. فنزعُ حبّةٍ من `ROLE_PERMISSIONS` لا أثرَ
     له على أيّ قاعدةٍ قائمة — والصلاحيّاتُ تُقرأ في كلّ طلبٍ من صفوف
     `RolePermission` (`auth.service.resolve`) لا من الشيفرة. ففصلُ المال عن
     المدير الأكاديميّ كان سيبقى حبرا على ورقٍ في كلّ بيئةٍ تعمل. */
  it('حبّةٌ ليست في المصفوفة تُسحب عند البذر — ولو كانت مغروسةً في القاعدة', async () => {
    await prisma.rolePermission.create({
      data: { roleId: 'academic_manager', permissionKey: 'finance.payment.record' },
    })
    const before = await prisma.rolePermission.count({
      where: { roleId: 'academic_manager', permissionKey: 'finance.payment.record' },
    })
    expect(before).toBe(1)

    const out = await seedRbac(prisma)
    expect(out.revoked, 'لم يُسحب شيء').toBeGreaterThan(0)
    expect(await prisma.rolePermission.count({
      where: { roleId: 'academic_manager', permissionKey: 'finance.payment.record' },
    }), 'بقيت الحبّةُ بعد البذر').toBe(0)
  })

  it('ولا يُمسّ استثناءُ الشخص — تلك حبّةٌ مُنحت بقرارٍ موثَّقٍ عليه', async () => {
    const { userId } = await auth.register('override-keep@test.local', 'Keep#123456', 'صاحبُ استثناء')
    await prisma.userPermission.create({
      data: { userId, permissionKey: 'finance.payment.record', effect: 'grant', reason: 'تفويضٌ موثَّقٌ لأسبوع' },
    })
    await seedRbac(prisma)
    expect(await prisma.userPermission.count({ where: { userId } })).toBe(1)
  })
})

describe('المديرُ الأكاديميّ: يرى المالَ ولا يحرّكه', () => {
  let cookie = ''
  beforeAll(async () => { cookie = await cookieFor('sep-academic@test.local', 'academic_manager') })

  it('يقرأ الفواتيرَ والاستردادات — فيعرف أدفع المتعلّمُ أم لا', async () => {
    for (const url of ['/api/admin/invoices', '/api/admin/refunds']) {
      const res = await app.inject({ method: 'GET', url, headers: { cookie } })
      expect(res.statusCode, url).toBe(200)
    }
  })

  it('ولا يسجّل دفعةً ولا يعتمد استردادا', async () => {
    const pay = await app.inject({
      method: 'POST', url: `/api/admin/invoices/${UUID}/manual-payment`,
      headers: { cookie }, payload: { methodNote: 'تحويلٌ بنكيّ' },
    })
    expect(pay.statusCode, 'سجّل دفعةً بعد الفصل').toBe(403)
    const refund = await app.inject({
      method: 'POST', url: `/api/admin/payments/${UUID}/refund`,
      headers: { cookie }, payload: { amount: 100, reason: 'سببٌ مكتوب' },
    })
    expect(refund.statusCode, 'اعتمد استردادا بعد الفصل').toBe(403)
  })

  it('ولا يبدّل مزوّدَ الدفعِ ومفاتيحَه', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/integrations', headers: { cookie } })
    expect(res.statusCode).toBe(403)
  })

  it('ولا يصنع كوبونا — الطلباتُ والكوبوناتُ بندٌ ماليّ', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/coupons', headers: { cookie },
      payload: { code: 'ACADEMIC50', percentOff: 50 },
    })
    expect(res.statusCode).toBe(403)
  })

  it('والمنعُ يقول ما الصلاحيّةُ ومن يملكها — لا «لا تملك الصلاحية» وحدَها', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/admin/invoices/${UUID}/manual-payment`,
      headers: { cookie }, payload: { methodNote: 'تحويلٌ بنكيّ' },
    })
    const body = res.json() as { error: { message_ar: string; required: string } }
    expect(body.error.required).toBe('finance.payment.record')
    expect(body.error.message_ar).toContain('المالية')
  })
})

describe('المالية تملك الطلبَ الذي دُفع عنه', () => {
  it('تصنع كوبونا وتقرأ الكوبونات — وكان ذلك بيد الأكاديميّ وحدَه', async () => {
    const cookie = await cookieFor('sep-finance@test.local', 'finance')
    const made = await app.inject({
      method: 'POST', url: '/api/admin/coupons', headers: { cookie },
      payload: { code: 'FIN25', percentOff: 25 },
    })
    expect(made.statusCode).toBe(201)
    const list = await app.inject({ method: 'GET', url: '/api/admin/coupons', headers: { cookie } })
    expect(list.statusCode).toBe(200)
  })

  it('ولا تبدّل مفاتيحَ مزوّد الدفع — تلك لمدير النظام', async () => {
    const cookie = await cookieFor('sep-finance2@test.local', 'finance')
    const res = await app.inject({ method: 'GET', url: '/api/admin/integrations', headers: { cookie } })
    expect(res.statusCode).toBe(403)
  })
})

describe('المنسّقُ الأكاديميّ: يُشغّل ولا يقرّر سياسةً', () => {
  let cookie = ''
  beforeAll(async () => { cookie = await cookieFor('coordinator@test.local', 'academic_coordinator') })

  it('يفتح الشعبَ ويجدولها ويصدر الشهاداتِ المستحقّة', async () => {
    for (const url of ['/api/admin/cohorts', '/api/admin/learner-requests']) {
      const res = await app.inject({ method: 'GET', url, headers: { cookie } })
      expect(res.statusCode, url).toBe(200)
    }
    const made = await app.inject({
      method: 'POST', url: '/api/admin/cohorts', headers: { cookie },
      payload: { courseId: 'C-BIZ-101', title: 'شعبةُ المنسّق', capacity: 12, price: 400 },
    })
    expect(made.statusCode, 'لم يستطع إنشاءَ شعبة').toBe(201)
  })

  it('ولا ينشر متنا ولا يرجع بإصدارٍ سابق ولا يرى لوحَ النشر', async () => {
    const publish = await app.inject({
      method: 'POST', url: `/api/admin/publishing/versions/${UUID}/publish`, headers: { cookie }, payload: {},
    })
    expect(publish.statusCode, 'نشر').toBe(403)
    const rollback = await app.inject({
      method: 'POST', url: '/api/admin/publishing/rollback', headers: { cookie },
      payload: { targetVersionId: UUID, reasonAr: 'سببٌ مكتوب' },
    })
    expect(rollback.statusCode, 'رجوع').toBe(403)
    const versions = await app.inject({ method: 'GET', url: '/api/admin/publishing/versions', headers: { cookie } })
    expect(versions.statusCode, 'لوحُ النشر').toBe(403)
  })

  it('ولا يرى مالا ولا يحرّكه', async () => {
    const invoices = await app.inject({ method: 'GET', url: '/api/admin/invoices', headers: { cookie } })
    expect(invoices.statusCode).toBe(403)
    const pay = await app.inject({
      method: 'POST', url: `/api/admin/invoices/${UUID}/manual-payment`,
      headers: { cookie }, payload: { methodNote: 'تحويل' },
    })
    expect(pay.statusCode).toBe(403)
  })

  it('ولا يفتح قائمةَ المستخدمين ولا سجلَّ الأثر ولا التكاملات', async () => {
    for (const url of ['/api/admin/users', '/api/admin/audit', '/api/admin/integrations']) {
      const res = await app.inject({ method: 'GET', url, headers: { cookie } })
      expect(res.statusCode, url).toBe(403)
    }
  })

  it('ورتبتُه دون مديرِ العمليّات وفوق الدعم — فلا يُدير من يُديره', () => {
    expect(ROLE_RANK.academic_coordinator).toBeLessThan(ROLE_RANK.operations_manager)
    expect(ROLE_RANK.academic_coordinator).toBeGreaterThan(ROLE_RANK.support)
  })
})

describe('«متقدّم لعضوية التدريب» حالةٌ لا تُسند', () => {
  it('لا تُضاف بالتعيين — ولو كان المعيِّنُ مديرَ النظام', () => {
    const refusal = refuseRoleAssignment(['super_admin'], ['trainer_applicant'])
    expect(refusal).toMatchObject({ code: 'lifecycle_role' })
    expect(refusal!.message_ar).toContain('طلبات المدربين')
  })

  it('ولا تُنزَع به — فطلبُ صاحبها لا يُفقَد من الطابور', () => {
    expect(refuseRoleAssignment(['super_admin'], ['learner'], ['trainer_applicant']))
      .toMatchObject({ code: 'lifecycle_role' })
  })

  it('وما بقيت كما هي عُدِّلت الأدوارُ الأخرى بحرّيّة', () => {
    expect(refuseRoleAssignment(['super_admin'], ['trainer_applicant', 'learner'], ['trainer_applicant']))
      .toBeNull()
  })

  it('وكلُّ دورِ حالةٍ محكومٌ بالقاعدة نفسِها — لا استثناءَ يُنسى', () => {
    for (const role of LIFECYCLE_ROLES) {
      expect(refuseRoleAssignment(['super_admin'], [role]), role).toMatchObject({ code: 'lifecycle_role' })
    }
  })

  it('والخادمُ يرفضها على إنشاء الحساب لا في الاختبار وحدَه', async () => {
    const cookie = await cookieFor('lifecycle-super@test.local', 'super_admin')
    const res = await app.inject({
      method: 'POST', url: '/api/admin/users', headers: { cookie },
      payload: { email: 'fake.applicant@test.local', displayName: 'متقدّمٌ مختلَق', roleIds: ['trainer_applicant'] },
    })
    expect(res.statusCode).toBe(403)
    expect((res.json() as { error: { code: string } }).error.code).toBe('lifecycle_role')
    expect(await prisma.user.findUnique({ where: { email: 'fake.applicant@test.local' } }), 'أُنشئ الحسابُ رغم الرفض').toBeNull()
  })
})

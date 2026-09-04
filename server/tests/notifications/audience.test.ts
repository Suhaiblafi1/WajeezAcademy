/* جمهور الإشعار — جرسُ كلِّ بوابةٍ يعرض ما يخصّها وحدها.

   العطب الذي يحرسه هذا الملفّ: الإشعار كان يحمل صاحبَه ولا يحمل بوابتَه،
   و`myNotifications` تُرجع كلَّ ما لصاحب الحساب. فمن يحمل دورا إداريا يرى في
   جرس «تعلّمي» إشعارا نصّه «طلب انضمام مدرب — راجعه»: شأنُ إدارةٍ في موضع
   المتعلّم. ولأنّ الأدوار تجتمع في شخصٍ واحد (المالك متعلّمٌ وإداريّ معا)
   لا يكفي فصلُ الحسابات — الفصل بالجمهور.

   ولا يُخفي هذا شيئا: الحارس الثالث يثبت أنّ الإداريّ باقٍ في سجلّ الإدارة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { EarningsService } from '../../services/earnings.service'
import { NotificationService, notifyRole } from '../../services/notification.service'

const EMAIL = 'ntf-audience-staff@test.local'
const PASSWORD = 'Staff#12345'

let prisma: PrismaClient
let notifications: NotificationService
let app: FastifyInstance
let cookie = ''
/** حسابٌ واحد يجمع الأدوار الثلاثة — هو موضع العطب نفسه */
let staffId: string
let profileId = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  notifications = new NotificationService(prisma)
  app = await buildApp(prisma)
  await app.ready()
  const auth = new AuthService(prisma)
  const u = await auth.register(EMAIL, PASSWORD, 'إداريّ ومتعلّم')
  staffId = u.userId
  await auth.setRoles(staffId, ['support'])
  await auth.setRoles(staffId, ['support', 'trainer'])
  cookie = `${SESSION_COOKIE}=${(await auth.login(EMAIL, PASSWORD)).token}`

  /* وله ملفّ مدرّبٍ أيضا — ليمرّ كشفُ المستحقّات من منتجه الحقيقيّ */
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-AUD-${Date.now()}`, fullName: 'إداريّ ومتعلّم', email: EMAIL,
      phone: '0790000021', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: staffId, isVerified: true },
  })
  profileId = profile.id
}, 240_000)

/** ما يراه الجرس فعلا — عبر HTTP كما تناديه البوابة، لا عبر الخدمة */
async function bell(audience?: string) {
  const q = audience ? `?audience=${audience}` : ''
  const list = await app.inject({ method: 'GET', url: `/api/learner/notifications${q}`, headers: { cookie } })
  const count = await app.inject({ method: 'GET', url: `/api/learner/notifications/unread-count${q}`, headers: { cookie } })
  expect(list.statusCode).toBe(200)
  expect(count.statusCode).toBe(200)
  return {
    keys: (list.json() as { templateKey: string | null }[]).map((n) => n.templateKey),
    unread: (count.json() as { unread: number }).unread,
  }
}

describe('فصل جمهور الإشعارات', () => {
  it('1) إشعار الدور الوظيفيّ لا يظهر في جرس بوابة المتعلّم', async () => {
    await notifyRole(prisma, ['support'], {
      channel: 'in_app', templateKey: 'admin.support.ticket',
      title: 'تذكرة دعم جديدة', body: 'وصلت تذكرة تحتاج مراجعة',
    })
    const written = await prisma.notification.findMany({ where: { userId: staffId, templateKey: 'admin.support.ticket' } })
    expect(written.length).toBe(1)
    expect(written[0].audience).toBe('staff')

    expect(await notifications.myNotifications(staffId)).toEqual([])
    expect(await notifications.unreadCount(staffId)).toBe(0)
  })

  it('2) إشعار المتعلّم يظهر في جرسه — التصفية لا تُفرغ الجرس', async () => {
    const n = await notifications.notify({
      userId: staffId, channel: 'in_app', title: 'اعتُمد تسجيلك', body: 'رسالة تخصّ تعلّمك',
    })
    /* `notify` يُرجع `null` عند الكتم (المهمّة ٧٢) — وهذا بلا `templateKey`
       فلا صنفَ له ولا يُكتَم. والتأكيدُ يقول ذلك صراحةً. */
    expect(n, 'إشعارٌ بلا صنفٍ يجب أن يمضي').not.toBeNull()
    expect(n!.status).toBe('sent')

    const mine = await notifications.myNotifications(staffId)
    expect(mine.map((m) => m.id)).toEqual([n!.id])
    expect(await notifications.unreadCount(staffId)).toBe(1)
  })

  it('3) الإشعار الإداريّ لم يُفقَد — يقرأه صاحبه من جرس بوابته الإدارية', async () => {
    const staffBell = await notifications.myNotifications(staffId, 'staff')
    expect(staffBell.map((n) => n.templateKey)).toEqual(['admin.support.ticket'])
    expect(await notifications.unreadCount(staffId, 'staff')).toBe(1)

    const log = await notifications.listLog()
    const admin = log.filter((l) => l.userId === staffId && l.templateKey === 'admin.support.ticket')
    expect(admin.length).toBe(1)
    expect(admin[0].audience).toBe('staff')
  })

  /* من منتجه الحقيقيّ لا بجمهورٍ يكتبه الاختبار: وإلّا حَرَس الاختبارُ نفسَه.
     أوّل صياغةٍ لهذا الحارس نادت `notify` مباشرةً بـ`audience: 'trainer'`،
     فنزعُ الجمهور من `EarningsService` أبقى الاختبار أخضر. */
  it('4) كشف المستحقّات في جرس المدرّب لا في جرس تعلُّمه', async () => {
    await new EarningsService(prisma).create(staffId, {
      profileId, period: '2026-08',
      items: [{ description: 'تدريب شعبة', amount: 120 }],
    })
    expect((await notifications.myNotifications(staffId, 'trainer')).map((n) => n.templateKey))
      .toEqual(['trainer_payout'])
    /* جرس المتعلّم بقي على إشعاره وحده */
    expect((await notifications.myNotifications(staffId)).map((n) => n.templateKey)).toEqual([null])
  })

  /* الحارس الأخير على المسلك الذي تناديه البوابة فعلا: الخدمة قد تُصفّي
     صحيحا والنقطة تتجاهل الوسيط، فيعود العطب من بابه. */
  it('5) على HTTP: كلّ بوابةٍ تسأل بجمهورها فتُجاب به', async () => {
    expect(await bell('learner')).toEqual({ keys: [null], unread: 1 })
    expect(await bell('staff')).toEqual({ keys: ['admin.support.ticket'], unread: 1 })
    expect(await bell('trainer')).toEqual({ keys: ['trainer_payout'], unread: 1 })
    /* وبلا وسيط: `learner` — قارئٌ قديم يرى ما كان يخصّه لا كلَّ شيء */
    expect(await bell()).toEqual({ keys: [null], unread: 1 })
  })

  it('6) جمهورٌ مجهول يُرَدّ لا يُترجَم إلى «كلّ شيء»', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/learner/notifications?audience=all', headers: { cookie },
    })
    /* ٤٢٢ هي اصطلاح التطبيق للتحقق الفاشل — المهمّ أنّه رَدٌّ لا تجاهل */
    expect(res.statusCode).toBe(422)
  })
})

/* اختبار E2E للإشعارات:
   in_app يصل فورا ويُقرأ ويُعلَّم؛ القنوات الخارجية غير الموصولة تنتظر بلا محاولة؛
   وما رده المزود يُعاد حتى الحد ثم يفشل؛ القوالب بمتغيرات {{key}}.
   لا إرسال حقيقي في التطوير — بوابة البريد ترد كل إرسال (`mail-gate`). */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { NotificationService } from '../../services/notification.service'

let prisma: PrismaClient
let notifications: NotificationService
let userId: string
let managerId: string

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  notifications = new NotificationService(prisma)

  const u = await auth.register('ntf-user@test.local', 'User#12345', 'مستخدم الإشعارات')
  userId = u.userId
  const m = await auth.register('ntf-manager@test.local', 'Manager#12345', 'مدير الإشعارات')
  managerId = m.userId
  await auth.setRoles(managerId, ['academic_manager'])
}, 240_000)

/* `notify` صار يُرجع `null` حين يكتم صاحبُ الحساب صنفَ الإشعار (المهمّة ٧٢).
   وإشعاراتُ هذا الملفّ بلا `templateKey`، فلا صنفَ لها ولا تُكتَم — والتأكيدُ
   هنا يقول ذلك صراحةً بدل `!` صامتة. */
function sent<T>(v: T | null): NonNullable<T> {
  expect(v, 'أُشعِر بأنّه مكتوم وهو لا صنفَ له — الكتمُ يجب أن يقع بالتفضيل وحدَه').not.toBeNull()
  return v as NonNullable<T>
}

describe('الإشعارات', () => {
  it('1) قالب بمتغيرات {{key}} يُنشأ ويُملأ', async () => {
    await notifications.upsertTemplate(managerId, {
      key: 'enrollment_approved', channel: 'in_app',
      titleAr: 'اعتُمد تسجيلك', bodyAr: 'مرحبا {{name}} — اعتُمد تسجيلك في {{course}}',
    })
    const rendered = await notifications.renderTemplate('enrollment_approved', 'in_app', { name: 'سالم', course: 'أساسيات AI' })
    expect(rendered.body).toBe('مرحبا سالم — اعتُمد تسجيلك في أساسيات AI')
    await expect(notifications.renderTemplate('missing', 'in_app', {}))
      .rejects.toMatchObject({ code: 'no_template' })
  })

  it('2) إشعار داخلي يصل فورا ويُحسب غير مقروء ثم يُعلَّم مقروءا', async () => {
    const n = sent(await notifications.notify({ userId, channel: 'in_app', title: 'أهلا', body: 'رسالة داخلية' }))
    expect(n.status).toBe('sent')
    expect(await notifications.unreadCount(userId)).toBe(1)
    await notifications.markRead(userId, n.id)
    expect(await notifications.unreadCount(userId)).toBe(0)
    expect((await notifications.myNotifications(userId)).length).toBe(1)
  })

  /* وتغيّر الثالثُ والرابع (٨ نوفمبر ٢٠٢٦): القناةُ غيرُ الموصولة لا تُعلَّم «فشلت» — لم يحاول أحد — بل تنتظر بلا
     عدّاد. وما ردّه المزوّدُ يبقى في الطابور حتّى الحدّ، ثمّ «فشل». والحارسُ الكامل `mail-retry.test.ts`. */
  it('3) قناة خارجية غير موصولة لا تُحاوَل — تنتظر بلا عداد', async () => {
    const n = sent(await notifications.notify({ userId, channel: 'sms', title: 'تجربة', body: 'بلا مزود' }))
    expect(n.status).toBe('queued')
    expect(n.attempts).toBe(0)
  })

  it('4) ما رده المزود يبقى في الطابور حتى الحد ثم يفشل — ثم ترفض إعادة المحاولة', async () => {
    /* القناةُ موصولةٌ بمفتاح، وبوّابةُ البريد ترفض في الاختبار (`mail-gate`) — فهو رفضٌ حقيقيٌّ من `sendEmail` */
    const had = process.env.RESEND_API_KEY
    process.env.RESEND_API_KEY = 're_test_key'
    try {
      const n = sent(await notifications.notify({ userId, channel: 'email', title: 'تجربة', body: 'مرفوض' }))
      expect(n.status).toBe('queued')
      expect(n.attempts).toBe(1)
      expect(n.lastError).toBeTruthy()
      const due = () => prisma.notification.update({ where: { id: n.id }, data: { claimedAt: new Date(Date.now() - 6 * 60_000) } })
      await due()
      expect((await notifications.attemptSend(n.id)).attempts).toBe(2)
      await due()
      const last = await notifications.attemptSend(n.id)
      expect(last.attempts).toBe(3)
      expect(last.status).toBe('failed')
      await expect(notifications.retry(n.id)).rejects.toMatchObject({ code: 'max_attempts' })
    } finally {
      if (had === undefined) delete process.env.RESEND_API_KEY
      else process.env.RESEND_API_KEY = had
    }
  })

  it('5) إعادة محاولة إشعار ناجح مرفوضة', async () => {
    const n = sent(await notifications.notify({ userId, channel: 'in_app', title: 'وصل', body: 'تم' }))
    await expect(notifications.retry(n.id)).rejects.toMatchObject({ code: 'bad_state' })
  })

  it('6) السجل يُرشَّح بالحالة', async () => {
    const failed = await notifications.listLog('failed')
    expect(failed.every((n) => n.status === 'failed')).toBe(true)
    expect(failed.length).toBeGreaterThanOrEqual(1)
  })
})

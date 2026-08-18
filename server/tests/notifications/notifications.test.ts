/* اختبار E2E للإشعارات:
   in_app يصل فورا ويُقرأ ويُعلَّم؛ القنوات الخارجية تفشل بأمان بلا مزود؛
   إعادة المحاولة حتى الحد الأقصى ثم الرفض؛ القوالب بمتغيرات {{key}}.
   لا إرسال حقيقي في التطوير — المزود الخارجي غير الموصول يفشل مسجلا. */

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
    const n = await notifications.notify({ userId, channel: 'in_app', title: 'أهلا', body: 'رسالة داخلية' })
    expect(n.status).toBe('sent')
    expect(await notifications.unreadCount(userId)).toBe(1)
    await notifications.markRead(userId, n.id)
    expect(await notifications.unreadCount(userId)).toBe(0)
    expect((await notifications.myNotifications(userId)).length).toBe(1)
  })

  it('3) قناة خارجية بلا مزود تفشل بأمان وتُسجل', async () => {
    const n = await notifications.notify({ userId, channel: 'email', title: 'تجربة', body: 'بلا مزود' })
    expect(n.status).toBe('failed')
    expect(n.attempts).toBe(1)
    expect(n.lastError).toBeTruthy()
  })

  it('4) إعادة المحاولة حتى الحد الأقصى ثم الرفض', async () => {
    const n = await notifications.notify({ userId, channel: 'sms', title: 'تجربة', body: 'بلا مزود' })
    const r1 = await notifications.retry(n.id)
    expect(r1.attempts).toBe(2)
    const r2 = await notifications.retry(n.id)
    expect(r2.attempts).toBe(3)
    await expect(notifications.retry(n.id)).rejects.toMatchObject({ code: 'max_attempts' })
  })

  it('5) إعادة محاولة إشعار ناجح مرفوضة', async () => {
    const n = await notifications.notify({ userId, channel: 'in_app', title: 'وصل', body: 'تم' })
    await expect(notifications.retry(n.id)).rejects.toMatchObject({ code: 'bad_state' })
  })

  it('6) السجل يُرشَّح بالحالة', async () => {
    const failed = await notifications.listLog('failed')
    expect(failed.every((n) => n.status === 'failed')).toBe(true)
    expect(failed.length).toBeGreaterThanOrEqual(2)
  })
})

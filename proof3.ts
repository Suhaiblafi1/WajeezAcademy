import { getPrisma, disconnectPrisma } from './server/db/client'
import { dispatchQueuedNotifications } from './server/worker/jobs'
import { getEmailConfig } from './server/services/integrations.service'
const main = async () => {
  const prisma = await getPrisma()
  const cfg = await getEmailConfig(prisma)
  console.log('RESULT قناةُ البريد:', cfg.enabled ? 'موصولة' : 'مغلقة', '· مفتاح:', cfg.apiKey ? 'موجود' : 'غائب', '· من:', cfg.fromEmail)
  const u = await prisma.user.create({ data: { email: `learner${Date.now()}@example.com`, displayName: 'متعلّم تجربة', passwordHash: 'x', status: 'active' } })
  const n = await prisma.notification.create({ data: { userId: u.id, channel: 'email', audience: 'learner', templateKey: 'verify_email', title: 'وثّق بريدك', body: 'الرابط في الرسالة', status: 'queued', queuedAt: new Date() } })
  console.log('RESULT قبل الدورة:', (await prisma.notification.findUnique({ where: { id: n.id } }))!.status)
  const r = await dispatchQueuedNotifications(prisma)
  console.log('RESULT خبرُ الدورة:', r.summaryAr)
  const a = (await prisma.notification.findUnique({ where: { id: n.id } }))!
  console.log('RESULT بعد الدورة:', a.status, '· أُرسلت:', a.sentAt ? 'نعم' : 'لا', '· خطأ:', a.lastError ?? 'لا شيء')
  await disconnectPrisma()
}
main()

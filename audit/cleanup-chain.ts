/* تنظيف بيانات اختبارات السلسلة — معاينة جافة افتراضياً، الحذف مع --apply
   الهدف فقط: مستخدمون chain-*@wajeez.local وشعب «شعبة اختبار السلسلة%» */
import { getPrisma, disconnectPrisma } from '../server/db/client'

const apply = process.argv.includes('--apply')
const prisma = await getPrisma()

const users = await prisma.user.findMany({ where: { email: { startsWith: 'chain-' } }, select: { id: true } })
const userIds = users.map((u) => u.id)
const cohorts = await prisma.cohort.findMany({ where: { title: { startsWith: 'شعبة اختبار السلسلة' } }, select: { id: true } })
const cohortIds = cohorts.map((c) => c.id)

console.log(`مستخدمون اختباريون: ${userIds.length} · شعب اختبارية: ${cohortIds.length}`)
const counts = {
  طلبات_تسجيل: await prisma.enrollmentRequest.count({ where: { userId: { in: userIds } } }),
  تسجيلات: await prisma.enrollment.count({ where: { userId: { in: userIds } } }),
  طلبات_شراء: await prisma.order.count({ where: { userId: { in: userIds } } }),
}
console.log(counts)
if (!apply) {
  console.log('— معاينة فقط. أعد التشغيل مع --apply للحذف.')
  await disconnectPrisma()
  process.exit(0)
}

const del = async (label, p) => console.log(`حُذف ${label}: ${(await p).count}`)
await del('استردادات', prisma.refund.deleteMany({ where: { payment: { invoice: { order: { userId: { in: userIds } } } } } }))
await del('مدفوعات', prisma.payment.deleteMany({ where: { invoice: { order: { userId: { in: userIds } } } } }))
await del('فواتير', prisma.invoice.deleteMany({ where: { order: { userId: { in: userIds } } } }))
await del('طلبات شراء', prisma.order.deleteMany({ where: { userId: { in: userIds } } })) // بنودها تتبعها متتالياً
await del('تسجيلات', prisma.enrollment.deleteMany({ where: { userId: { in: userIds } } })) // حضورها وتقدمها يتبعها
await del('طلبات تسجيل', prisma.enrollmentRequest.deleteMany({ where: { userId: { in: userIds } } }))
await del('مستخدمون', prisma.user.deleteMany({ where: { id: { in: userIds } } })) // جلساتهم وإشعاراتهم وملفاتهم تتبعهم
await del('شعب', prisma.cohort.deleteMany({ where: { id: { in: cohortIds } } })) // جلساتها ومدربوها وخططها يتبعونها
console.log('— تم التنظيف')
await disconnectPrisma()

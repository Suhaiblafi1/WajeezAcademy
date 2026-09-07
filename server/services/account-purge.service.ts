/* الحذفُ النهائيّ لحساب — بصمتُه أوّلا، ثمّ المحو.

   القاعدةُ الأولى: يُحذف من لم يترك أثرا، ويُوقَف من ترك. فحذفُ مشترٍ يمحو
   فواتيرَه، وحذفُ متعلّمٍ يمحو شهاداتَه، ودفترُ المال لا يُمحى بنقرة.

   والقاعدةُ الثانية — وهي سببُ هذا الملفّ — أنّ لصاحب المنصّة أن يمحو
   حساباتَ التجربة والديمو **بسجلّها**: شعبةٌ ديمو وطلبُ شراءٍ ديمو وتقييمٌ
   ديمو ليست دفترا يُحفظ بل ركامَ فحصٍ يُزال. فالحذفُ القسريّ لمدير النظام
   الأعلى وحده، بسببٍ يُكتب، وبصمةُ ما مُحي تُسجَّل في الأثر قبل المحو.

   ولماذا المحوُ اليدويّ لا `Cascade` في المخطَّط: أربعةَ عشرَ جدولا تشير
   إلى المستخدم بلا تسلسل عن قصد — كي لا يمحو خطأٌ واحد سجلا كاملا. فنمحوها
   هنا واحدا واحدا، بترتيبٍ يحترم مفاتيحَها، داخلَ معاملةٍ واحدة: إمّا كلٌّ
   أو لا شيء. */

import type { PrismaClient, Prisma } from '@prisma/client'

export interface AccountFootprint {
  enrollments: number
  orders: number
  certificates: number
  tickets: number
  ratings: number
  advisorCases: number
  advisorAssignments: number
  advisorRequests: number
  cohortMessages: number
  rescheduleRequests: number
  trainerProfile: boolean
  trainerApplication: boolean
}

export async function accountFootprint(prisma: PrismaClient, userId: string): Promise<AccountFootprint> {
  const [
    enrollments, orders, certificates, tickets, ratings, advisorCases, advisorAssignments, advisorRequests,
    cohortMessages, rescheduleRequests, trainerProfile, trainerApplication,
  ] = await Promise.all([
    prisma.enrollment.count({ where: { userId } }),
    prisma.order.count({ where: { userId } }),
    prisma.certificate.count({ where: { enrollment: { userId } } }),
    prisma.supportTicket.count({ where: { userId } }),
    prisma.rating.count({ where: { raterId: userId } }),
    prisma.advisorCase.count({ where: { clientId: userId } }),
    prisma.advisorAssignment.count({ where: { advisorId: userId } }),
    prisma.advisorRequest.count({ where: { advisorId: userId } }),
    prisma.cohortMessage.count({ where: { authorId: userId } }),
    prisma.sessionRescheduleRequest.count({ where: { requestedBy: userId } }),
    prisma.trainerProfile.count({ where: { userId } }),
    prisma.trainerApplication.count({ where: { userId } }),
  ])
  return {
    enrollments, orders, certificates, tickets, ratings, advisorCases, advisorAssignments, advisorRequests,
    cohortMessages, rescheduleRequests, trainerProfile: trainerProfile > 0, trainerApplication: trainerApplication > 0,
  }
}

/** ما يمنع الحذفَ العاديّ — بالعدد وبالاسم، كي يُقرأ لا كي يُخمَّن */
export function footprintBlockersAr(f: AccountFootprint): string[] {
  const b: string[] = []
  if (f.orders > 0) b.push(`${f.orders} طلبَ شراءٍ وفواتيرَه`)
  if (f.enrollments > 0) b.push(`${f.enrollments} تسجيلا في شعب`)
  if (f.certificates > 0) b.push(`${f.certificates} شهادة`)
  if (f.tickets > 0) b.push(`${f.tickets} تذكرةَ دعم`)
  if (f.ratings > 0) b.push(`${f.ratings} تقييما`)
  if (f.advisorCases > 0) b.push(`${f.advisorCases} حالةَ استشارة`)
  if (f.advisorAssignments > 0) b.push(`${f.advisorAssignments} إسنادَ استشارة`)
  if (f.advisorRequests > 0) b.push(`${f.advisorRequests} طلبَ مستشار`)
  if (f.cohortMessages > 0) b.push(`${f.cohortMessages} رسالةً في شعب`)
  if (f.rescheduleRequests > 0) b.push(`${f.rescheduleRequests} طلبَ تأجيل جلسة`)
  if (f.trainerProfile) b.push('ملفَّ مدرّب')
  return b
}

/** المحوُ القسريّ: كلُّ ما يشير إلى الحساب يُزال أو يُفكّ، ثمّ الحساب. معاملةٌ واحدة. */
export async function purgeAccountWithHistory(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    /* ما يُفكّ لا يُمحى: سجلٌّ يبقى بلا صاحب أفضلُ من سجلٍّ يُمحى بصاحبه */
    await tx.trainerProfile.updateMany({ where: { userId }, data: { userId: null } })
    await tx.trainerApplication.updateMany({ where: { userId }, data: { userId: null } })
    await tx.lead.updateMany({ where: { userId }, data: { userId: null } })
    await tx.learnerPathDraft.updateMany({ where: { userId }, data: { userId: null } })
    await tx.advisorRequest.updateMany({ where: { decidedById: userId }, data: { decidedById: null } })
    await tx.advisorCase.updateMany({ where: { clientId: userId }, data: { clientId: null } })

    /* ما يُمحى — الأبناءُ قبل الآباء حيث لا تسلسل */
    await tx.advisorRequest.deleteMany({ where: { advisorId: userId } })
    await tx.advisorAssignment.deleteMany({ where: { advisorId: userId } })
    await tx.rating.deleteMany({ where: { raterId: userId } })
    await tx.supportTicket.deleteMany({ where: { userId } })
    await tx.sessionRescheduleRequest.deleteMany({ where: { requestedBy: userId } })
    await tx.cohortMessage.deleteMany({ where: { authorId: userId } })
    /* ─────────── الشهادةُ تُمحى صراحةً، ولا تُترك لسلسلةٍ لا وجودَ لها ───────────

       كان هنا سطرٌ واحدٌ وفوقَه تعليقٌ يقول «التسجيلُ يسلسل إلى الحضور
       والمحاولات **والشهادات**». والحضورُ والمحاولاتُ تسلسل فعلا؛ **والشهادةُ
       لا**: `Certificate.enrollment` هي العلاقةُ الوحيدةُ في المخطَّط كلِّه
       التي تحمل `onDelete: Restrict` — واحدةٌ من مئةٍ وأربعٍ وعشرين، مقصودةٌ
       ومشروحةٌ هناك: رقمُ الشهادة معلَنٌ للناس ويُتحقَّق منه برابط، فلا يمحوه
       حذفُ تسجيل.

       فكان **كلُّ متعلّمٍ صدرت له شهادةٌ يُسقط المعاملةَ كلَّها** عند هذا
       السطر: القاعدةُ ترفض، ولا يُمحى شيء. وفحصُ البصمة لا يحرس من ذلك —
       بل هو الذي يوصل إلى هنا: حين توجد موانعُ يُنادى هذا المسارُ بعينه،
       فالحارسُ يحرس الطريقَ العاديَّ ويترك القسريّ.

       ولا يُصلَح بتحويل القيد إلى `Cascade`: ذلك يعيد العطبَ الذي وُضع
       القيدُ له — أيُّ حذفِ تسجيلٍ في أيّ مسارٍ يمحو شهادةً صادرة. فالمحوُ
       **صريحٌ هنا وحدَه**، في المسار المأذون له، وبقرارٍ مكتوب: من مُحي
       حسابُه بالسجلّ (حسابُ ديمو أو تجربة) تُمحى شهادتُه معه.

       والفرعان يذهبان معها بالسلسلة: `CertificateVerification` و
       `CertificateRevocation` كلتاهما `Cascade` من الشهادة. */
    await tx.certificate.deleteMany({ where: { enrollment: { userId } } })

    /* ثمّ التسجيلُ — ويسلسل إلى الحضور والمحاولات والتسليمات والتقدّم */
    await tx.enrollment.deleteMany({ where: { userId } })

    /* دفترُ المال: الدفعاتُ ثمّ الفواتيرُ ثمّ الطلبات — لا تسلسلَ بينها عمدا */
    const orders = await tx.order.findMany({ where: { userId }, select: { id: true } })
    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id)
      const invoices = await tx.invoice.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })
      if (invoices.length > 0) {
        const invoiceIds = invoices.map((i) => i.id)
        await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } })
        await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } })
      }
      await tx.order.deleteMany({ where: { id: { in: orderIds } } })
    }

    /* والباقي يسلسل من المخطَّط: الأدوار، الجلسات، الإشعارات، الملفّ، الخطط… */
    await tx.user.delete({ where: { id: userId } })
  })
}

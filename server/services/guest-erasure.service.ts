/* بياناتُ من لم يسجّل تُمحى بعد ستة أشهر بلا نشاط (١٩ أكتوبر ٢٠٢٦).

   ═══ العطب ═══

   رقمُ من لم ينشئ حسابا وبريدُه واسمُه يبقون أبدا: زائرٌ ترك رقمَه آخرَ التشخيص
   (`requestContactAsGuest`)، وعميلٌ راسله مستشارٌ على واتساب (`whatsapp-hook.service.ts`)،
   ومن أدخله المستشارُ بيده (`createOwnCase`). والزائرُ وافق أن نتواصل معه «بخصوص نتيجتك
   فقط» — لا أن يبقى رقمُه عندنا بلا أجل.

   ═══ القرار ═══

   قرارُ صاحب المنصّة بين ثلاثة (تُمحى بعد سنةٍ بلا نشاط · بعد ستة أشهر · تبقى):
   **«B» — بعد ستة أشهر.** أشدُّ للخصوصيّة، ومن ينتظر موسما بعيدا يُفقد أسرع.

   ═══ ما يُمحى وما يبقى ═══

   ١) **الاسمُ والرقمُ والبريدُ ونتيجةُ التشخيص** — من العميل المحتمل ومن حالاته.
   ٢) **وكلُّ نصٍّ حرٍّ في حالاته**: ملخّصاتُ التواصل والملاحظاتُ والمتابعاتُ والمهامُّ
      وأسبابُ الطلبات. فيها ما كتبناه نحن (`عاد يطلب … الاسم: … واتساب: …`، وملاحظةُ
      الدمج بالرقم والبريد)، وما كتبه المستشارُ ولا يُعرف ما فيه. ومحوُ اسمٍ بعينه منها
      يترك رقما ثانيا أو اسما أوّلَ كُتب بغير صيغته — فيُمحى النصُّ كلُّه.
   ٣) **وأجراسُ حالاته** — في عنوانها اسمُه.
   ٤) **وتُغلق حالاتُه المفتوحة.** لا أحدَ يُتواصل معه بعدها.
   ٥) **ويبقى عددُه في التقارير**: الصفوفُ نفسُها بلا ما يدلّ على صاحبها — الحالةُ
      وإسنادُها وأوقاتُ التواصل ومن سجّله. فلا يتغيّر رقمٌ في «أداء المستشار».

   ═══ ما «النشاط» ═══

   كلُّ ما يقول إنّ أحدا يعمل في الحالة أو إنّ صاحبَها عاد: تواصلٌ سُجّل (ومنه ما
   أخبرت به منصّةُ واتساب، ومن عاد يطلب من آخر التشخيص)، أو ملاحظةٌ أو متابعةٌ أو
   مهمّةٌ أو طلب، أو تغيّرت الحالةُ نفسُها، أو أُسندت لمستشار — حالةٌ أُسندت أمس لا
   تُمحى قبل أن يصلها مستشارُها. والمتابعةُ المجدولةُ بعدُ نشاطٌ آتٍ. والأجلُ يُعدّ
   من آخرها، ومن ولادة العميل المحتمل إن لم يكن شيء.

   ═══ وما لا يمسّه ═══

   من له حساب — العميلُ المحتملُ المربوطُ (`userId`) أو حالةٌ لها صاحبُ حساب
   (`clientId`): بياناتُه بياناتُ حسابه، ولها بابُها (`account-purge.service.ts`).

   ولا البريدُ الذي تُرك لكود خصم (`MarketingLead`) أو لـ«أبلغني» (`RegistrationInterest`
   و`CourseInterest`): وعدُه غيرُ هذا الوعد. وقرارُ صاحب المنصّة فيه (١٩ أكتوبر ٢٠٢٦) بين
   اثنين (يُمحى بعد ستة أشهر من آخر زيارة أو بعد إبلاغه · يبقى): **«B» — يبقى.**

   والشرطُ نفسُه يُعاد في المحو داخل المعاملة لا في البحث وحدَه: تواصلٌ سُجّل
   بين البحث والمحو يُبقي صاحبَه.

   والحارس: `server/tests/advisors/guest-erasure.test.ts`. */

import { Prisma, type PrismaClient } from '@prisma/client'
import { recordAudit } from './audit'

/** ستة أشهر بلا نشاط — قرارُ صاحب المنصّة */
export const GUEST_IDLE_DAYS = 183
/** ما يُكتب مكانَ الاسم — الحقلُ لا يقبل فراغا */
export const ERASED_NAME_AR = 'بيانات محذوفة'
/** وما يُكتب مكانَ كلّ نصٍّ حرٍّ في حالاته */
export const ERASED_TEXT_AR = 'حذف بعد ستة أشهر بلا نشاط'
/** أقصى ما يُمحى في الدورة — والتالية تُكمل */
export const GUEST_ERASE_BATCH = 500

const DAY_MS = 86_400_000
const CLOSED_STATUSES = ['closed', 'enrolled', 'not_interested']

/** من لم يسجّل ولم يقع على حالاته شيءٌ منذ `cutoff` */
function idleGuestWhere(cutoff: Date): Prisma.LeadWhereInput {
  const since = { gte: cutoff }
  return {
    userId: null, erasedAt: null, createdAt: { lt: cutoff },
    cases: {
      none: {
        OR: [
          { clientId: { not: null } },
          { updatedAt: since },
          { nextFollowUpAt: since },
          { contactEvents: { some: { createdAt: since } } },
          { notes: { some: { createdAt: since } } },
          { followUps: { some: { OR: [{ createdAt: since }, { scheduledAt: since }, { doneAt: since }] } } },
          { tasks: { some: { OR: [{ createdAt: since }, { dueAt: since }, { doneAt: since }] } } },
          { requests: { some: { updatedAt: since } } },
          { assignments: { some: { assignedAt: since } } },
        ],
      },
    },
  }
}

/** ما يُمحى من حالات العميل المحتمل بعد محو اسمه ورقمه — تُغلق المفتوحةُ ويُمحى كلُّ نصٍّ حرٍّ فيها وأجراسُها.
    وتناديه أيضا يدُ المدير حين يحذف من عبّأ نموذج المنحة (`grant-registrants.service.ts`)، بنصٍّ يقول من حذف. */
export async function eraseLeadCases(tx: Prisma.TransactionClient, id: string, textAr: string): Promise<string[]> {
  const caseIds = (await tx.advisorCase.findMany({ where: { leadId: id }, select: { id: true } })).map((c) => c.id)
  await tx.advisorCase.updateMany({ where: { leadId: id, status: { notIn: CLOSED_STATUSES } }, data: { status: 'closed' } })
  await tx.advisorCase.updateMany({
    where: { leadId: id }, data: { diagnosticSnapshot: Prisma.DbNull, nextAction: null, nextFollowUpAt: null },
  })
  if (caseIds.length > 0) {
    const inCases = { caseId: { in: caseIds } }
    await tx.contactEvent.updateMany({ where: inCases, data: { summary: textAr } })
    await tx.advisorNote.updateMany({ where: inCases, data: { body: textAr } })
    await tx.followUp.updateMany({ where: inCases, data: { note: null } })
    await tx.advisorTask.updateMany({ where: inCases, data: { title: textAr } })
    await tx.advisorRequest.updateMany({ where: inCases, data: { reasonAr: textAr, decisionNoteAr: null } })
    await tx.notification.deleteMany({
      where: {
        OR: caseIds.flatMap((caseId) => [
          { data: { path: ['caseId'], equals: caseId } },
          { data: { path: ['otherCaseId'], equals: caseId } },
        ]),
      },
    })
  }
  return caseIds
}

export async function eraseIdleGuests(prisma: PrismaClient, now = new Date()): Promise<{ erased: number }> {
  const cutoff = new Date(now.getTime() - GUEST_IDLE_DAYS * DAY_MS)
  const leads = await prisma.lead.findMany({
    where: idleGuestWhere(cutoff), select: { id: true }, orderBy: { createdAt: 'asc' }, take: GUEST_ERASE_BATCH,
  })

  let erased = 0
  for (const { id } of leads) {
    const done = await prisma.$transaction(async (tx) => {
      const { count } = await tx.lead.updateMany({
        where: { id, ...idleGuestWhere(cutoff) },
        data: { fullName: ERASED_NAME_AR, email: null, phone: null, diagnosticSnapshot: Prisma.DbNull, erasedAt: now },
      })
      if (count === 0) return false

      const caseIds = await eraseLeadCases(tx, id, ERASED_TEXT_AR)
      for (const caseId of caseIds) {
        await recordAudit(tx, {
          action: 'advisor.case.guest_erased', entityType: 'advisor_case', entityId: caseId,
          meta: { leadId: id, idleDays: GUEST_IDLE_DAYS },
        })
      }
      return true
    })
    if (done) erased++
  }
  return { erased }
}

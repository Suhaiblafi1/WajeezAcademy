/* العميلُ المحتمل يلحق حسابَه حين يُثبت بريدَه (١٨ أكتوبر ٢٠٢٦).

   ═══ العطب ═══

   عميلٌ محتملٌ يولد بلا حساب من بابين: الزائرُ يترك رقمَه آخرَ التشخيص
   (`requestContactAsGuest`)، والمستشارُ يُدخل من قابله (`createOwnCase`). فإن
   أنشأ صاحبُه حسابا بعدها ببريده نفسِه بقيت حالتُه بلا صاحب حساب: لا يرى
   المستشارُ تسجيلاتِه ولا تقدّمَه، ولا يقع في «طلابي» — كأنّهما شخصان.

   ═══ ولمَ عند التوثيق لا عند التسجيل ═══

   قرارُ صاحب المنصّة بين ثلاثة (الربطُ عند التسجيل، أو عنده بعلامة «لم يوثَّق»،
   أو عند التوثيق): **عند التوثيق**. التسجيلُ يقبل أيَّ بريدٍ يُكتب، فمن سجّل
   ببريد غيره يلحق حالةَ ذاك — نتيجتَه وملاحظاتِ مستشاره. والتوثيقُ لا يُضيف
   خطوةً على أحد: رسالتُه تصل مع التسجيل أصلا، والشراءُ ينتظره أصلا — فمن
   اشترى ربطناه.

   ═══ والأبوابُ الثلاثة التي تُثبت البريد ═══

   رابطُ التوثيق، وتوثيقُ الموظّف بيده، ورابطُ الدعوة أو الاستعادة (`resetPassword`
   — الدليلُ نفسُه، والعلّةُ هناك في البند ٦٧). كلُّها تنادي هذا، فلا يُنسى
   بابٌ رابعٌ يُضاف يوما إلّا أن يُنسى التوثيقُ معه.

   ═══ وما لا يمسّه ═══

   عميلٌ محتملٌ له حسابٌ آخر، وحالةٌ لها صاحبُ حساب — لا تُنقل من صاحبها. والربطُ
   **لا يُسقط التوثيق**: يقع بعده، وما تعثّر فيه لا يردّ صاحبَه عن بريدٍ أثبته. */

import type { PrismaClient } from '@prisma/client'
import { recordAudit } from './audit'

export async function linkLeadsToVerifiedAccount(
  prisma: PrismaClient,
  userId: string,
  actorId: string | null = userId,
): Promise<{ leads: number; cases: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId }, select: { email: true, displayName: true, emailVerifiedAt: true },
  })
  /* حارسُ القرار نفسِه: لا ربطَ لبريدٍ لم يُثبَت، ولو ناداه بابٌ قبل أوانه */
  if (!user?.emailVerifiedAt) return { leads: 0, cases: 0 }

  const leads = await prisma.lead.findMany({
    where: { userId: null, email: { equals: user.email, mode: 'insensitive' } },
    select: { id: true, fullName: true },
  })
  if (leads.length === 0) return { leads: 0, cases: 0 }
  const leadIds = leads.map((l) => l.id)

  const cases = await prisma.advisorCase.findMany({
    where: { leadId: { in: leadIds }, clientId: null },
    select: {
      id: true, leadId: true,
      assignments: { where: { unassignedAt: null }, select: { advisorId: true } },
    },
  })

  await prisma.$transaction(async (tx) => {
    await tx.lead.updateMany({ where: { id: { in: leadIds }, userId: null }, data: { userId } })
    if (cases.length > 0) {
      await tx.advisorCase.updateMany({ where: { id: { in: cases.map((c) => c.id) }, clientId: null }, data: { clientId: userId } })
    }
    for (const c of cases) {
      await recordAudit(tx, {
        actorId, action: 'advisor.case.client_linked', entityType: 'advisor_case', entityId: c.id,
        meta: { userId, leadId: c.leadId },
      })
    }
  })

  /* ومستشارُه يُبلَّغ: صار يرى تسجيلاتِه وتقدّمَه، وصار في «طلابي» حين يسجّل.
     والاستيرادُ هنا لا في الرأس: خدمةُ الإشعار تستورد خدمةَ الهويّة، وهذه
     تناديها خدمةُ الهويّة — فالاستيرادُ في الرأس دائرةٌ بين الوحدتين. */
  const assigned = cases.flatMap((c) => c.assignments.map((a) => ({ caseId: c.id, advisorId: a.advisorId })))
  if (assigned.length > 0) {
    const { safeNotify } = await import('./notification.service')
    for (const a of assigned) {
      await safeNotify(prisma, {
        userId: a.advisorId, channel: 'in_app', audience: 'staff',
        templateKey: 'advisor.case.client_linked',
        title: 'عميلك أنشأ حسابه',
        body: `«${user.displayName}» أنشأ حسابه ووثّق بريده — صار تقدّمه ظاهرا في حالته.`,
        data: { caseId: a.caseId },
      })
    }
  }
  return { leads: leadIds.length, cases: cases.length }
}

/** الربطُ بعد التوثيق لا يردّ التوثيقَ إن تعثّر — بريدٌ أثبته صاحبُه لا يُنقض بخطأٍ عندنا */
export async function linkLeadsAfterVerification(prisma: PrismaClient, userId: string, actorId?: string | null) {
  try {
    await linkLeadsToVerifiedAccount(prisma, userId, actorId ?? userId)
  } catch (e) {
    console.error('[lead-link] تعذّر ربط العميل المحتمل بحسابه بعد التوثيق', e)
  }
}

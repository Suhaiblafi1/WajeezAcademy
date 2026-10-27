/* مخاطبة المدرب لشعبته.

   كان المدرب يرى المتعثّر ولا يملك أن يخاطبه: التغذية الراجعة تُكتب على تسليم،
   ومن لم يُسلّم شيئا لا يبلغه شيء. فصار له أن يخاطبه — والرسالة تُسجَّل ثم
   تُوصَّل: السجلّ هو الأثر الباقي يُقرأ عند المراجعة، والإشعار وسيلةُ بلوغٍ لا
   سجلّ: من مسحه لم يمسح الرسالة.

   ═══ وذهب «اقتراحُ التأجيل» من هنا (٢٧ أكتوبر ٢٠٢٦، المرحلة السادسة — ج) ═══
   كان الموعدُ يُقترح ولا يُغيَّر حتّى تعتمده الإدارة (`SessionRescheduleRequest`). ثمّ صار المدرّبُ ينقل لقاءَه
   بنفسه (١٧ سبتمبر ٢٠٢٦، `CohortService.trainerMoveSession`)، فلم يُقترح بعده شيء. واختار صاحبُ المنصّة
   («a») أن يخرج الاقتراحُ وطابورُه، وتبقى أدواتُ التأجيل الأربع الأخرى. والجدولُ باقٍ بما فيه أثرا. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { safeNotify } from './notification.service'

const MAX_BODY = 2000

export class CohortMessageService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /* ═══ مستشارو الشعبة — من هم فعلا (ع-١) ═══

     سؤالُ ع-١ كان: «مستشارو دورته» أهم المسنَدون إلى الشعبة أم من يتابعون
     متعلّميها؟ والجوابُ في المخطّط لا في الرأي: **لا رابطَ بين مستشارٍ وشعبة
     ولا بينه وبين دورة**. المستشارُ يُسنَد إلى **حالة** (`AdvisorAssignment`
     ← `AdvisorCase`)، والحالةُ لها `clientId` — أي إنسان.

     فالطريقُ الوحيدُ الذي تسنده البيانات: متعلّمو الشعبة ← حالاتُهم ←
     المسنَدون إليها إسنادا **قائما** (`unassignedAt: null`).

     والإسنادُ المُلغى لا يُخاطَب: من رُفعت عنه الحالةُ لا شأنَ له بها. */
  private async cohortAdvisorIds(cohortId: string): Promise<string[]> {
    const learners = await this.prisma.enrollment.findMany({
      where: { cohortId, status: { not: 'dropped' } },
      select: { userId: true },
    })
    if (learners.length === 0) return []
    const assignments = await this.prisma.advisorAssignment.findMany({
      where: {
        unassignedAt: null,
        case: { clientId: { in: learners.map((l) => l.userId) } },
      },
      select: { advisorId: true },
    })
    /* المستشارُ الواحدُ قد يتابع عدّةَ متعلّمين في الشعبة — ويصله واحدة */
    return [...new Set(assignments.map((a) => a.advisorId))]
  }

  /** رسالةٌ إلى الشعبة كلّها أو إلى متعلّم بعينه أو إلى مستشاري متعلّميها */
  async send(authorId: string, cohortId: string, input: {
    audience: 'cohort' | 'learner' | 'advisors'
    enrollmentId?: string
    body: string
  }) {
    const body = input.body.trim()
    if (body.length < 2) throw new AuthError('empty_message', 'اكتب رسالتك أولا')
    if (body.length > MAX_BODY) throw new AuthError('message_too_long', `الرسالة ${MAX_BODY} حرفا كحد أقصى`)

    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { id: true, title: true },
    })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)

    /* المستقبلون يُحسبون من الشعبة نفسها لا ممّا يُرسله المُنادي — ورسالةٌ
       إلى متعلّم تُتحقَّق من كونه في هذه الشعبة، وإلّا خاطب مدرّبٌ متعلّم
       شعبةٍ ليست له بمعرّفٍ يُخمَّن. */
    /* ── فرعُ المستشارين: مستقبلوه ليسوا متعلّمين فلا يمرّ بحسابهم ── */
    if (input.audience === 'advisors') {
      const advisorIds = await this.cohortAdvisorIds(cohortId)
      if (advisorIds.length === 0) {
        throw new AuthError(
          'no_advisors',
          'لا مستشار قائم على أحد من متعلّمي هذه الشعبة — فلا أحد تصله رسالتك',
          409,
        )
      }
      const message = await this.prisma.cohortMessage.create({
        data: {
          cohortId, authorId, audience: 'advisors', enrollmentId: null,
          body, recipients: advisorIds.length,
        },
      })
      const author = await this.prisma.user.findUnique({
        where: { id: authorId }, select: { displayName: true },
      })
      for (const userId of advisorIds) {
        /* والمستشارُ يقرأ من جانب الفريق لا من جانب المتعلّم */
        await safeNotify(this.prisma, {
          userId, channel: 'in_app', audience: 'staff',
          title: `رسالة من مدرّب — ${cohort.title}`,
          body: `${author?.displayName ?? 'مدرّب الشعبة'}: ${body.slice(0, 240)}`,
          data: { cohortId, messageId: message.id },
        })
      }
      await recordAudit(this.prisma, {
        actorId: authorId, action: 'cohort.message.send', entityType: 'cohort', entityId: cohortId,
        meta: { messageId: message.id, audience: 'advisors', recipients: advisorIds.length },
      })
      return message
    }

    const where = input.audience === 'learner'
      ? { id: input.enrollmentId, cohortId, status: { not: 'dropped' } }
      : { cohortId, status: { not: 'dropped' } }
    if (input.audience === 'learner' && !input.enrollmentId) {
      throw new AuthError('no_recipient', 'حدّد المتعلّم المقصود')
    }
    const recipients = await this.prisma.enrollment.findMany({
      where, select: { id: true, userId: true },
    })
    if (recipients.length === 0) {
      throw new AuthError(
        input.audience === 'learner' ? 'not_in_cohort' : 'no_learners',
        input.audience === 'learner' ? 'هذا المتعلّم ليس في شعبتك' : 'لا مسجّلين في هذه الشعبة بعد',
        input.audience === 'learner' ? 403 : 409,
      )
    }

    const message = await this.prisma.cohortMessage.create({
      data: {
        cohortId, authorId, audience: input.audience,
        enrollmentId: input.audience === 'learner' ? input.enrollmentId : null,
        body, recipients: recipients.length,
      },
    })

    const author = await this.prisma.user.findUnique({ where: { id: authorId }, select: { displayName: true } })
    const title = input.audience === 'cohort'
      ? `إعلان من مدرّبك — ${cohort.title}`
      : `رسالة من مدرّبك — ${cohort.title}`
    for (const r of recipients) {
      await safeNotify(this.prisma, {
        userId: r.userId, channel: 'in_app', audience: 'learner',
        /* والرسالةُ كاملةً (١٩ أكتوبر ٢٠٢٦): كانت تُقصّ عند ٢٤٠ حرفا من ٢٠٠٠ يقبلها المدرّب (`MAX_BODY`)،
           ولا موضعَ آخرَ في بوّابة المتعلّم يقرأ باقيها — فيصله نصفُ الإعلان ولا يدري أنّه نصف. */
        title, body: `${author?.displayName ?? 'مدرّبك'}: ${body}`,
        data: { cohortId, messageId: message.id },
      })
    }

    await recordAudit(this.prisma, {
      actorId: authorId, action: 'cohort.message.send', entityType: 'cohort', entityId: cohortId,
      meta: { messageId: message.id, audience: input.audience, recipients: recipients.length },
    })
    return message
  }

  /** سجلّ ما أُرسل في الشعبة — الأحدث أولا */
  async list(cohortId: string) {
    return this.prisma.cohortMessage.findMany({
      where: { cohortId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        author: { select: { displayName: true } },
        enrollment: { select: { user: { select: { displayName: true } } } },
      },
    })
  }
}

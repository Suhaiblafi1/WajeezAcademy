/* دعواتُ التقويم — ملفُّ ICS يفتحه قوقل وآبل وأوتلوك.

   وُلد هذا الملفّ من قطعِ `operations.routes` (كان خمسَ مئةٍ وسبعةَ عشرَ
   سطرا يجمع أربعةَ مجالاتٍ لا يجمعها إلّا أنّها «عمليّات»: المستشارون،
   ودعواتُ التقويم، والسيرُ الذاتيّة، والتجارةُ وخطّافُ الدفع). واسمُ
   «العمليّات» لا يقول لقارئه أين يبحث — والقطعُ بحسب المجال يقول. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { CalendarService } from '../../services/calendar/calendar.service'
import { requireAuth } from '../auth-plugin'

export function registerCalendarRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const calendar = new CalendarService(prisma)

  /* ════ دعوات التقويم — ملفّ ICS يفتحه قوقل وآبل وأوتلوك ════

     ولماذا ملفٌّ لا واجهةُ قوقل: الواجهةُ تلزمها OAuth وموافقةُ كلّ
     مستخدمٍ على حدة، وتربطنا بمزوّدٍ واحد. والملفُّ معيارٌ يفتحه الجميع.
     والصلاحيةُ محروسةٌ في الخدمة: الجلسةُ لمن سجّل فيها، والمقابلةُ
     لصاحبها أو لمن يراجع الطلبات. */
  app.get('/api/calendar/cohort-sessions/:sessionId.ics', {
    preHandler: requireAuth,
    schema: { tags: ['calendar'], summary: 'دعوة تقويم لجلسة شعبة — لمن سجّل فيها' },
  }, async (req, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params)
    const { filename, content } = await calendar.cohortSessionIcs(sessionId, req.auth!.userId, {
      manageAll: req.auth!.permissions.includes('cohort.manage'),
      trainerOperate: req.auth!.permissions.includes('trainer.cohort.operate'),
    })
    return reply
      .header('content-type', 'text/calendar; charset=utf-8')
      .header('content-disposition', `attachment; filename="${filename}"`)
      .send(content)
  })

  app.get('/api/calendar/trainer-interviews/:interviewId.ics', {
    preHandler: requireAuth,
    schema: { tags: ['calendar'], summary: 'دعوة تقويم لمقابلة مدرّب — لصاحبها أو لمن يراجع' },
  }, async (req, reply) => {
    const { interviewId } = z.object({ interviewId: z.string().uuid() }).parse(req.params)
    const me = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { email: true } })
    const { filename, content } = await calendar.trainerInterviewIcs(interviewId, {
      email: me?.email,
      canReview: req.auth!.permissions.includes('trainer.applications.review'),
    })
    return reply
      .header('content-type', 'text/calendar; charset=utf-8')
      .header('content-disposition', `attachment; filename="${filename}"`)
      .send(content)
  })
}

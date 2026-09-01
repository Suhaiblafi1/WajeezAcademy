/* الطلبةُ المسجَّلون — بابٌ واحد لأربعة أدوار، ونطاقُ كلٍّ يُشتقّ من صلاحيّاته.

   ولا حارسَ صلاحيةٍ واحد هنا: `requirePermission` تسأل عن مفتاحٍ بعينه،
   والبابُ يخدم ثلاثة مفاتيح مختلفة بثلاثة نطاقات. فالحراسةُ في `scopeFor`:
   من لا نطاقَ له يُردّ ٤٠٣، ومن له نطاقٌ يرى نطاقَه وحدَه.

   وهذا أضيقُ لا أوسع: `requirePermission('enrollment.manage')` كانت ستغلق
   البابَ على المدرّب والمستشار معا، فيُبنى لكلٍّ بابُه — وثلاثةُ أبوابٍ
   لسؤالٍ واحد تفترق. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requireAuth } from '../auth-plugin'
import { AuthError } from '../../services/auth.service'
import { LearnersService, scopeFor, canWrite, type LearnerScope } from '../../services/learners.service'

export function registerLearnerRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const learners = new LearnersService(prisma)

  /** نطاقُ صاحب الجلسة — أو ٤٠٣ لمن لا نطاق له */
  const scoped = (req: { auth?: { userId: string; permissions: string[] } | null }): LearnerScope => {
    const scope = scopeFor({ userId: req.auth!.userId, permissions: req.auth!.permissions })
    if (!scope) throw new AuthError('forbidden', 'حسابك لا يرى الطلبة المسجَّلين', 403)
    return scope
  }

  app.get('/api/staff/learners', {
    preHandler: requireAuth,
    schema: { tags: ['learners'], summary: 'الطلبة المسجَّلون في نطاقك — الكلّ، أو طلبةُ شعبك، أو عملاءُ حالاتك' },
  }, async (req) => {
    const scope = scoped(req)
    const q = z.object({
      q: z.string().trim().max(80).optional(),
      cohortId: z.string().uuid().optional(),
    }).parse(req.query)
    return { scope: scope.kind, canWrite: canWrite(scope), learners: await learners.list(scope, q) }
  })

  app.get('/api/staff/learners/:userId', {
    preHandler: requireAuth,
    schema: { tags: ['learners'], summary: 'طالبٌ بعينه — حسابُه وتسجيلاتُه، في حدود نطاقك' },
  }, async (req) => {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.params)
    return learners.detail(scoped(req), userId)
  })

  app.post('/api/staff/learners/:userId/enrollments', {
    preHandler: requireAuth,
    schema: { tags: ['learners'], summary: 'تسجيلُ طالبٍ في شعبة — بصلاحية إدارة التسجيل' },
  }, async (req, reply) => {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.params)
    const { cohortId } = z.object({ cohortId: z.string().uuid() }).parse(req.body)
    return reply.status(201).send(await learners.addToCohort(scoped(req), userId, cohortId, req.auth!.userId))
  })

  app.delete('/api/staff/learners/enrollments/:enrollmentId', {
    preHandler: requireAuth,
    schema: { tags: ['learners'], summary: 'إخراجُ طالبٍ من شعبة — انسحابٌ موثَّق لا محوٌ للسجلّ' },
  }, async (req) => {
    const { enrollmentId } = z.object({ enrollmentId: z.string().uuid() }).parse(req.params)
    const body = z.object({ note: z.string().trim().max(300).optional() }).parse(req.body ?? {})
    return learners.removeFromCohort(scoped(req), enrollmentId, req.auth!.userId, body.note)
  })

  app.patch('/api/staff/learners/:userId', {
    preHandler: requireAuth,
    schema: { tags: ['learners'], summary: 'تعديلُ حساب طالب — الاسم والبريد والحالة' },
  }, async (req) => {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.params)
    const patch = z.object({
      displayName: z.string().trim().min(2).max(80).optional(),
      email: z.string().trim().toLowerCase().email().optional(),
      status: z.enum(['active', 'suspended']).optional(),
    }).parse(req.body)
    return learners.updateAccount(scoped(req), userId, req.auth!.userId, patch)
  })
}

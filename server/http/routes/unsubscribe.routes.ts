/* إلغاءُ الاشتراك في رسائل التسويق — بابان عامّان بلا حساب (١١ نوفمبر ٢٠٢٦). والعلّةُ في `mail-optout.service.ts`.

   · `/api/public/unsubscribe` — تناديه صفحةُ `/unsubscribe` حين يضغط الزرّ. لا يُلغى بفتح الرابط وحدَه: فاحصو الروابط
     في البريد يفتحون كلَّ رابطٍ قبل صاحبه.
   · `/api/public/unsubscribe/one-click` — رأسُ `List-Unsubscribe-Post` (RFC 8058): يرسله صندوقُ الوارد نفسُه حين يضغط
     صاحبُ البريد «إلغاء الاشتراك» بجانب اسم المرسل. والرمزُ في الرابط، والمتنُ لا يُقرأ.

   والرمزُ موقَّعٌ ببريده — رمزٌ لا يصحّ يُردّ بلا أن يُقال شيءٌ عن أحد. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { optOut } from '../../services/mail-optout.service'

const BAD_LINK_AR = 'رابط الإلغاء غير صحيح. افتحه من الرسالة كما وصلتك.'

export function registerUnsubscribeRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.post('/api/public/unsubscribe', {
    config: { rateLimit: { max: 30, timeWindow: '15 minutes' } },
    schema: { tags: ['public'], summary: 'إلغاء الاشتراك في رسائل التسويق — برمز الرابط الموقع' },
  }, async (req, reply) => {
    const body = z.object({ t: z.string().max(600), purpose: z.string().max(40).nullable().optional() }).parse(req.body ?? {})
    const out = await optOut(prisma, body.t, body.purpose)
    if (!out.ok) return reply.status(400).send({ error: 'bad_link', message: BAD_LINK_AR })
    return { ok: true, email: out.email }
  })

  app.post('/api/public/unsubscribe/one-click', {
    config: { rateLimit: { max: 60, timeWindow: '15 minutes' } },
    schema: { tags: ['public'], summary: 'إلغاء الاشتراك بنقرة واحدة من صندوق الوارد (RFC 8058)' },
  }, async (req, reply) => {
    const { t } = z.object({ t: z.string().max(600) }).parse(req.query)
    const out = await optOut(prisma, t)
    return reply.status(out.ok ? 200 : 400).send(out.ok ? { ok: true } : { error: 'bad_link', message: BAD_LINK_AR })
  })
}

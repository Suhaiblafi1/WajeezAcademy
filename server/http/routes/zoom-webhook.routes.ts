/* نقطةُ استقبال أحداث Zoom.

   ── ما تفعله ──

   الجلسةُ تنتهي، فيبلّغ Zoom. ومن ذلك البلاغ تُعرف بدايتُها الحقيقيّة
   ونهايتُها ومدّتُها وعددُ من حضر — بدل أن يُسجّل المدرّبُ أربعةَ أزرارٍ
   لكلّ متعلّمٍ من ذاكرته بعد أن ينتهي اللقاء.

   ── ثلاثةُ شروطٍ لا يصحّ الاستقبالُ بدونها ──

   ١) **التحقّقُ من التوقيع**، وإلّا فهي نقطةٌ مفتوحةٌ على الإنترنت تقبل أيَّ
      جسمٍ يُرسَل إليها — فيكتب من شاء حضورا مختلَقا في سجلٍّ أكاديميّ.
      وبلا سرٍّ مضبوطٍ تُرفض كلُّ الأحداث: الرفضُ الصامتُ أسلمُ من القبول
      الصامت.

   ٢) **تحدّي إثبات الملكيّة** (`endpoint.url_validation`): يرسله Zoom مرّةً
      عند حفظ العنوان في لوحته، وينتظر ردًّا يحمل الرمزَ نفسَه مبصوما. ومن
      لم يردّه لم تُفعَّل نقطتُه أصلا — فلا يصل حدثٌ واحدٌ بعد ذلك، بلا خطأ
      يُقرأ في أيّ مكان.

   ٣) **الردُّ سريعا** ٢٠٠: Zoom يُعيد المحاولةَ إن تأخّر الردُّ أو أخطأ،
      ويُعطّل النقطةَ بعد تكرار الفشل. فما يطول من عمل يقع بعد الردّ لا قبله.

   ── وما لا تفعله ──

   لا تثق بجسم الحدث في تحديد الجلسة: `meetingId` يُطابَق بصفٍّ عندنا، وما
   لا يُطابَق يُتجاهَل بصمت. فالبلاغُ عن اجتماعٍ لا نعرفه ليس خطأً — قد يكون
   اجتماعا أنشأه أحدٌ في الحساب نفسِه من خارج المنصّة. */

import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import { getZoomConfig, verifyZoomWebhook, zoomUrlValidationReply } from '../../services/zoom.service'
import { ZoomEventService } from '../../services/zoom-events.service'

interface ZoomEvent {
  event?: string
  payload?: {
    plainToken?: string
    object?: {
      id?: number | string
      uuid?: string
      start_time?: string
      end_time?: string
      duration?: number
      participant?: { user_name?: string; email?: string; join_time?: string; leave_time?: string }
    }
  }
}

export function registerZoomWebhookRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const events = new ZoomEventService(prisma)

  app.post('/api/webhooks/zoom', {
    schema: { tags: ['webhooks'], summary: 'أحداثُ Zoom — توقيعٌ إلزاميٌّ وردٌّ سريع' },
  }, async (req, reply) => {
    const config = await getZoomConfig(prisma)
    const body = (req.body ?? {}) as ZoomEvent
    const raw = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {})
    const signature = String(req.headers['x-zm-signature'] ?? '')
    const timestamp = String(req.headers['x-zm-request-timestamp'] ?? '')

    /* تحدّي الملكيّة: يصل موقَّعا كغيره، ويُردّ عليه بالرمز مبصوما */
    if (body.event === 'endpoint.url_validation') {
      const plain = body.payload?.plainToken
      if (!config.webhookSecret || !plain) return reply.status(400).send({ error: 'no_secret' })
      return reply.status(200).send(zoomUrlValidationReply(config.webhookSecret, plain))
    }

    if (!verifyZoomWebhook(config, raw, signature, timestamp)) {
      /* لا تفصيلَ في الردّ: من يجرّب التوقيعاتِ لا يُعان بمعرفة أيّها قارب */
      return reply.status(401).send({ error: 'bad_signature' })
    }

    /* الردُّ أوّلا ثمّ العمل: Zoom يُعطّل نقطةً تتأخّر أو تُخطئ مرارا */
    void reply.status(200).send({ ok: true })
    await events.handle(body.event ?? '', body.payload?.object ?? {}).catch((e: unknown) => {
      console.error('[zoom-webhook]', body.event, e)
    })
  })
}

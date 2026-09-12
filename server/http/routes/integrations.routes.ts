/* مسارات التكاملات — شاشة الإدارة تدير الدفع والبريد من هنا.
   القراءة مقنَّعة دائما (لا سر كامل يغادر)، الحفظ موثق وبصلاحية settings.manage،
   وفحصا الاتصال حيان: يضربان خادم المزود/البريد فعلا لا محاكاة. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requirePermission } from '../auth-plugin'
import { SystemHealthService } from '../../services/system-health.service'
import {
  getPaymentConfig, getEmailConfig, savePaymentConfig, saveEmailConfig, saveZoomConfig, maskedIntegrationsView,
  getCalendlyConfig, saveCalendlyConfig,
} from '../../services/integrations.service'
import { getZoomConfig, zoomProbe, forgetZoomToken } from '../../services/zoom.service'
import { registerCalendlyWebhook, CalendlyApiError } from '../../services/calendly-api.service'
import { publicSiteUrl } from '../../services/notification.service'
import { sendEmail } from '../../services/mail'
import { recordAudit } from '../../services/audit'

export function registerIntegrationRoutes(app: FastifyInstance, prisma: PrismaClient) {
  /* ─────────── «هل النظامُ سليم؟» ───────────

     سؤالٌ لم يكن له جوابٌ إلّا في سجلّات الخادم — ولم يكن للخادم سجلٌّ حتّى
     هذا الفرع. والصفحةُ تقرأ الحالةَ القائمةَ في القاعدة وتقول ما تعنيه:
     «٤٣ إشعارا في الطابور منذ يومَين ولا عاملَ يُرسلها» جوابٌ، و«٤٣» ليس.

     وصلاحيّتُها `settings.manage` — أي مديرُ النظام وحدَه بعد فصل المال
     (المرحلة ٢هـ): البنودُ تكشف حالةَ مزوّد الدفع والبريد وأرقامَ محاولات
     الدخول الفاشلة، وهي شأنُ من يملك الإعدادات. */
  const health = new SystemHealthService(prisma)
  app.get('/api/admin/system-health', {
    preHandler: requirePermission('settings.manage'),
    schema: { tags: ['admin-integrations'], summary: 'صحّةُ النظام — محسوبةٌ من حالة القاعدة الآن' },
  }, async () => health.snapshot())

  /* عرض مقنَّع — مفاتيح بآخر 4 خانات فقط */
  app.get('/api/admin/integrations', {
    preHandler: requirePermission('settings.manage'),
    schema: { tags: ['admin-integrations'], summary: 'إعدادات التكامل — عرض مقنَّع' },
  }, async () => maskedIntegrationsView(prisma))

  app.put('/api/admin/integrations/payment', {
    preHandler: requirePermission('settings.manage'),
    schema: { tags: ['admin-integrations'], summary: 'حفظ مزود الدفع ومفاتيحه' },
  }, async (req) => {
    const body = z.object({
      enabled: z.boolean(),
      driver: z.enum(['test', 'manual', 'moyasar', 'stripe']),
      publishableKey: z.string().max(200).optional(),
      secretKey: z.string().max(200).optional(),
      webhookSecret: z.string().max(200).optional(),
    }).parse(req.body)
    await savePaymentConfig(prisma, req.auth!.userId, body)
    return maskedIntegrationsView(prisma)
  })

  app.put('/api/admin/integrations/email', {
    preHandler: requirePermission('settings.manage'),
    schema: { tags: ['admin-integrations'], summary: 'حفظ إعدادات البريد (Resend)' },
  }, async (req) => {
    const body = z.object({
      enabled: z.boolean(),
      apiKey: z.string().max(200).optional(),
      fromName: z.string().max(120).optional(),
      fromEmail: z.string().email().max(200).optional(),
    }).parse(req.body)
    await saveEmailConfig(prisma, req.auth!.userId, body)
    return maskedIntegrationsView(prisma)
  })

  app.put('/api/admin/integrations/zoom', {
    preHandler: requirePermission('settings.manage'),
    schema: { tags: ['admin-integrations'], summary: 'حفظ إعدادات Zoom (Server-to-Server OAuth)' },
  }, async (req) => {
    const body = z.object({
      enabled: z.boolean(),
      accountId: z.string().max(200).optional(),
      clientId: z.string().max(200).optional(),
      clientSecret: z.string().max(200).optional(),
      hostEmail: z.string().max(200).optional(),
    }).parse(req.body)
    await saveZoomConfig(prisma, req.auth!.userId, body)
    /* المفاتيحُ تبدّلت فالرمزُ المحفوظُ في الذاكرة صار لحسابٍ آخر — يُنسى */
    forgetZoomToken()
    return maskedIntegrationsView(prisma)
  })

  app.put('/api/admin/integrations/calendly', {
    preHandler: requirePermission('settings.manage'),
    schema: { tags: ['admin-integrations'], summary: 'حفظ مفتاح توقيع Calendly ورمزِه الشخصيّ' },
  }, async (req) => {
    const body = z.object({
      enabled: z.boolean(),
      signingKey: z.string().max(400).optional(),
      /* الرمزُ يُحفظ منذ صارت المزامنةُ سؤالا دوريّا — يسأل العاملُ الخلفيُّ
         بلا إنسانٍ يلصقه كلَّ مرّة. وعلّةُ النقض في `CalendlyConfig`. */
      token: z.string().max(400).optional(),
      /* يُقبل بأيّ صورةٍ صحيحة ويُطبَّع في الخدمة — والرفضُ يحمل سببَه نصّا */
      bookingUrl: z.string().max(400).optional(),
    }).parse(req.body)
    await saveCalendlyConfig(prisma, req.auth!.userId, body)
    return maskedIntegrationsView(prisma)
  })

  /* ─────────── تسجيلُ اشتراك Calendly من الشاشة ───────────

     لا تُنشئ لوحةُ Calendly الاشتراكَ بالضغط — يُنشأ من واجهتها البرمجيّة.
     فكان يلزم SSH وسطرُ أوامر؛ وصار زرّا هنا.

     والرمزُ الشخصيُّ يُمرَّر ولا يُخزَّن: هو مفتاحُ حساب Calendly كلِّه، ولا
     حاجةَ به بعد النداء. والمعاينةُ هي الافتراضيّ — `apply` صريحةٌ تُنشئ. */
  app.post('/api/admin/integrations/calendly/register', {
    preHandler: requirePermission('settings.manage'),
    config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
    schema: { tags: ['admin-integrations'], summary: 'تسجيلُ اشتراك Calendly — معاينةٌ افتراضا' },
  }, async (req) => {
    const body = z.object({
      /* الرمزُ صار محفوظا للمزامنة الدوريّة، فلا يُلصَق ثانيةً هنا. ويبقى
         تمريرُه ممكنا لفحص رمزٍ قبل حفظه. */
      token: z.string().trim().min(10).max(400).optional(),
      apply: z.boolean().optional().default(false),
    }).parse(req.body)
    const config = await getCalendlyConfig(prisma)
    if (!config.signingKey) {
      return { ok: false, message: 'احفظ مفتاحَ التوقيع أوّلا — به يتحقّق الخادمُ من كلّ حدث' }
    }
    const token = body.token ?? config.token
    if (!token) return { ok: false, message: 'لا رمزَ شخصيٌّ محفوظ — احفظه أوّلا ثمّ افحص' }
    try {
      const result = await registerCalendlyWebhook({
        token, signingKey: config.signingKey, siteUrl: publicSiteUrl(), apply: body.apply,
      })
      if (result.applied) {
        /* الرمزُ لا يُسجَّل ولا طرفٌ منه — والمسجَّلُ أنّ اشتراكا أُنشئ */
        await recordAudit(prisma, {
          actorId: req.auth!.userId, action: 'integration.calendly.register',
          entityType: 'integration_setting', entityId: 'calendly',
          meta: { callbackUrl: result.callbackUrl, subscription: result.subscription?.uri ?? null },
        })
      }
      const message = result.outcome === 'existing'
        ? (result.missingEvents.length > 0
          ? `اشتراكٌ قائمٌ على عنواننا — لكن ينقصه: ${result.missingEvents.join(' · ')}. احذفه من Calendly ثمّ سجّل من جديد.`
          : 'اشتراكٌ قائمٌ على عنواننا بالحدثين — لا حاجةَ لإنشاءِ ثانٍ.')
        : result.outcome === 'created'
          ? `أُنشئ الاشتراك — ${result.account.name} · جرّب حجزا حقيقيّا الآن.`
          : `لا اشتراكَ على عنواننا بعد (${result.callbackUrl}) — اضغط «سجّل الاشتراك» لإنشائه.`
      return { ok: true, ...result, message }
    } catch (e) {
      if (e instanceof CalendlyApiError) return { ok: false, message: e.message }
      throw e
    }
  })

  /* فحصُ Zoom — يطلب رمزا فعلا، فلا يُقال «سليم» لمفاتيحَ لم تُجرَّب */
  app.post('/api/admin/integrations/zoom/test', {
    preHandler: requirePermission('settings.manage'),
    schema: { tags: ['admin-integrations'], summary: 'فحص حي لمفاتيح Zoom' },
  }, async (req) => {
    const result = await zoomProbe(await getZoomConfig(prisma))
    await recordAudit(prisma, {
      actorId: req.auth!.userId, action: 'integration.zoom.test', entityType: 'integration_setting', entityId: 'zoom',
      meta: { ok: result.ok },
    })
    return result
  })

  /* فحص اتصال الدفع — استعلام خفيف حقيقي على واجهة المزود */
  app.post('/api/admin/integrations/payment/test', {
    preHandler: requirePermission('settings.manage'),
    schema: { tags: ['admin-integrations'], summary: 'فحص حي لمفاتيح مزود الدفع' },
  }, async () => {
    const config = await getPaymentConfig(prisma)
    if (!config.enabled) return { ok: false, message: 'مزود الدفع غير مفعّل — فعّله واحفظ أولا' }
    if (config.driver === 'test') return { ok: true, message: 'المزود الاختباري يعمل — لا مال حقيقي' }
    if (config.driver === 'manual') return { ok: true, message: 'الدفع اليدوي جاهز — يُسجل من شاشة المالية بصلاحية موثقة' }
    if (!config.secretKey) return { ok: false, message: 'لا مفتاح سري محفوظا — أدخله واحفظ ثم افحص' }

    const probe = config.driver === 'moyasar'
      ? { url: 'https://api.moyasar.com/v1/payments?page=1', auth: `Basic ${Buffer.from(`${config.secretKey}:`).toString('base64')}` }
      : { url: 'https://api.stripe.com/v1/balance', auth: `Bearer ${config.secretKey}` }
    try {
      const res = await fetch(probe.url, { headers: { Authorization: probe.auth } })
      if (res.ok) return { ok: true, message: `اتصال ${config.driver === 'moyasar' ? 'Moyasar' : 'Stripe'} ناجح — المفاتيح صحيحة` }
      if (res.status === 401 || res.status === 403) return { ok: false, message: 'رفض المزود المفتاح السري — تأكد من نسخه كاملا' }
      return { ok: false, message: `رد المزود غير متوقع (HTTP ${res.status})` }
    } catch {
      return { ok: false, message: 'تعذر الوصول لخادم المزود — تحقق من الشبكة' }
    }
  })

  /* فحص البريد — رسالة تجريبية حقيقية لعنوان يختاره المدير */
  app.post('/api/admin/integrations/email/test', {
    preHandler: requirePermission('settings.manage'),
    schema: { tags: ['admin-integrations'], summary: 'إرسال بريد تجريبي حقيقي' },
  }, async (req) => {
    const { to } = z.object({ to: z.string().email() }).parse(req.body)
    const config = await getEmailConfig(prisma)
    const result = await sendEmail(config, {
      to,
      subject: 'بريد تجريبي — أكاديمية وجيز',
      text: 'إن وصلتك هذه الرسالة فإعدادات البريد سليمة، وقناة email في الإشعارات جاهزة للعمل الحقيقي.',
    })
    await recordAudit(prisma, {
      actorId: req.auth!.userId, action: 'integration.email.test', entityType: 'integration_setting', entityId: 'email',
      meta: { to, ok: result.ok, error: result.error },
    })
    return result.ok
      ? { ok: true, message: `أُرسل بريد تجريبي إلى ${to} — تحقق من صندوق الوارد (أو الرسائل غير المرغوبة)` }
      : { ok: false, message: result.error }
  })

  /* للمتعلم: مزود الدفع الفعال — معلومة عامة آمنة (المفتاح العلني معدّ للنشر أصلا) */
  app.get('/api/learner/payment-provider', {
    schema: { tags: ['commerce'], summary: 'مزود الدفع الفعال — يوجّه زر الدفع في الواجهة' },
  }, async () => {
    const config = await getPaymentConfig(prisma)
    return {
      driver: config.enabled ? config.driver : 'test',
      publishableKey: config.enabled ? config.publishableKey ?? null : null,
    }
  })
}

/* تجميع تطبيق Fastify — كوكيز، OpenAPI موثق، أخطاء موحدة، مسارات */

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import type { PrismaClient } from '@prisma/client'
import { AuthService } from '../services/auth.service'
import { errorHandler } from './errors'
import { registerAuth } from './auth-plugin'
import { registerAuthRoutes } from './routes/auth.routes'
import { registerAdminUserRoutes } from './routes/admin-users.routes'
import { registerCatalogRoutes } from './routes/catalog.routes'
import { registerPublishingRoutes } from './routes/publishing.routes'
import { registerTrainerApplicationRoutes } from './routes/trainer-applications.routes'
import { registerAdminTrainerRoutes } from './routes/admin-trainer.routes'
import { registerTrainerPortalRoutes } from './routes/trainer-portal.routes'
import { registerAdminLearningRoutes } from './routes/admin-learning.routes'
import { registerLearningPortalRoutes } from './routes/learning-portal.routes'
import { registerPublicCatalogRoutes } from './routes/public.routes'
import { registerPathDraftRoutes } from './routes/path-drafts.routes'
import { registerOperationsRoutes } from './routes/operations.routes'
import { registerSupportRoutes } from './routes/support.routes'
import { registerNotificationRoutes } from './routes/notifications.routes'
import { registerReportRoutes } from './routes/reports.routes'
import { registerProfileRoutes } from './routes/profile.routes'
import { registerSearchRoutes } from './routes/search.routes'
import { registerIntegrationRoutes } from './routes/integrations.routes'
import { registerDemoRoutes } from './routes/demo.routes'
import { registerAnalyticsRoutes } from './routes/analytics.routes'

export async function buildApp(prisma: PrismaClient) {
  const app = Fastify({ logger: false })
  const auth = new AuthService(prisma)

  /* الجسم الخام محفوظا مع الجسم المحلَّل — لتوقيع webhook الدفع.
     كان المسار يوقّع `JSON.stringify(req.body)`: إعادةُ تسلسلٍ لا الجسمَ الأصلي.
     وStripe يوقّع البايتات كما أرسلها حرفا بحرف، وأي فرق في ترتيب المفاتيح أو
     المسافات يغيّر التوقيع — فكان كل حدث حقيقي سيُرفض بـ«توقيع غير صالح»،
     أي مالٌ يُقبض ولا يُسوّى تسجيلُه أبدا. */
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    ;(req as unknown as { rawBody?: string }).rawBody = body as string
    if (!body || (body as string).length === 0) return done(null, undefined)
    try {
      done(null, JSON.parse(body as string))
    } catch (e) {
      const err = e as Error & { statusCode?: number }
      err.statusCode = 400
      done(err, undefined)
    }
  })

  await app.register(cors, {
    origin: process.env.WEB_ORIGIN?.split(',') ?? ['http://localhost:7100'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  await app.register(cookie)
  /* ترويسات أمان على كل استجابة (API + /docs) — تعمل في الدالة السحابية أيضا:
     CSP وnosniff وframeguard وReferrer-Policy وHSTS. الاستثناء الوحيد المقصود:
     unsafe-inline في script/style داخل CSP لأن توثيق Swagger UI يعتمد عليهما —
     وهو صفحة توثيق داخلية، ولا يمتد أثره إلى الواجهة (ترويساتها في vercel.json) */
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
  /* تحديد معدل الطلبات — سقف عام لكل IP (يُسترخى في بيئة الاختبار الآلية فقط)،
     وتُشدَّد نقاط الهوية في مساراتها (10/5د للدخول والتسجيل، 5/15د للاستعادة) */
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'
  await app.register(rateLimit, { max: isTestEnv ? 100_000 : 300, timeWindow: '1 minute' })
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Wajeez Academy API',
        description: 'واجهة أكاديمية وجيز — هوية وصلاحيات وكتالوج أكاديمي محكوم بالإصدارات',
        version: '0.1.0',
      },
    },
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  app.setErrorHandler(errorHandler)
  registerAuth(app, auth)

  app.get('/api/health', { schema: { tags: ['system'], summary: 'فحص حياة الخادم وقاعدة البيانات' } }, async () => {
    await prisma.$queryRaw`SELECT 1`
    return { ok: true, time: new Date().toISOString() }
  })

  /* «كيف أعرف أن المنشور هو آخر نسخة؟» — سؤال كان جوابه تنقّلا بين لوحة
     Vercel وGitHub ومقارنة بصمات بالعين. وهو سؤال يتكرر بعد كل دفعة.

     العنوان الواحد يجيبه: الالتزام الذي بُني منه الكود العامل، واللقطة التي
     يقرأها المحرك، وهل هما من نفس الالتزام. والمقارنة ممكنة أصلا لأن تسمية
     اللقطة الآلية تحمل بصمة التزامها (auto-<sha7>-<hash6>) — فالخادم يقارن
     نفسه بنفسه بلا مصدر خارجي.

     ولا يكشف شيئا ليس معلنا: بصمة التزام في مستودع، وتسمية لقطة منشورة. */
  app.get('/api/version', { schema: { tags: ['system'], summary: 'النسخة العاملة واللقطة المنشورة — هل هما من نفس الالتزام؟' } }, async () => {
    const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null
    const sha7 = sha ? sha.slice(0, 7) : null
    const { getActiveSnapshot } = await import('../catalog/snapshot-builder')
    const active = await getActiveSnapshot(prisma)
    const payload = active?.payload as
      | { questions?: { questions?: unknown[] }; coreCatalog?: { launch_pathways?: unknown[]; courses?: unknown[] } }
      | undefined

    /* التسمية الآلية شكلان: auto-<sha7>-<hash6> حين يعرف البناء التزامه،
       وauto-<hash12> حين لا يعرفه (نشر محلي). والثاني لا يحمل بصمة التزام،
       فالحكم عليه بعدم التطابق كذبٌ صريح — وهو ما فعله أول تنفيذ لهذا المسار
       حتى كشفه الاختبار: قارن sha7 بأول ١٢ حرفا من بصمة المحتوى فأعلن اختلافا
       لا وجود له. لا يُحكم إلا حين توجد بصمة التزام فعلا. */
    const auto = active?.label?.startsWith('auto-') ?? false
    const withCommit = active?.label?.match(/^auto-([0-9a-f]{7})-[0-9a-f]{6}(?:-\d+)?$/)
    const labelSha = withCommit ? withCommit[1] : null
    const inSync = sha7 && labelSha ? sha7 === labelSha : null

    return {
      الكود: {
        الالتزام: sha7,
        الفرع: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        رسالة_الالتزام: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split('\n')[0] ?? null,
        البيئة: process.env.VERCEL_ENV ?? 'محلية',
      },
      اللقطة_المنشورة: {
        التسمية: active?.label ?? null,
        من_التزام: labelSha,
        نُشرت_آليا: auto,
        أسئلة: payload?.questions?.questions?.length ?? null,
        مسارات: payload?.coreCatalog?.launch_pathways?.length ?? null,
        دورات: payload?.coreCatalog?.courses?.length ?? null,
      },
      /* الاختلاف وحده لا يقول أيّهما أقدم. وكانت العبارة تجزم بأن اللقطة «من
         التزام أقدم» في كل اختلاف — ورُصدت تكذب أثناء نشر متعثّر: اللقطة كانت
         من الالتزام الجديد والدالة ما زالت تخدم القديم، فقالت العكس تماما.
         ولا يملك هذا المسار تاريخ الالتزامين ليرتّبهما، فيصف ما يراه ولا يخمّن. */
      متطابقان:
        inSync === null
          ? 'لا يمكن الحكم — لقطة يدوية أو تشغيل محلي'
          : inSync
            ? 'نعم — الكود واللقطة من نفس الالتزام'
            : 'لا — الكود واللقطة من التزامين مختلفين؛ الأرجح أن نشرا جاريا لم يكتمل بعد',
      الوقت: new Date().toISOString(),
    }
  })

  registerAuthRoutes(app, auth)
  registerAdminUserRoutes(app, prisma, auth)
  registerCatalogRoutes(app, prisma)
  registerPublishingRoutes(app, prisma)
  registerTrainerApplicationRoutes(app, prisma)
  registerAdminTrainerRoutes(app, prisma)
  registerTrainerPortalRoutes(app, prisma)
  registerAdminLearningRoutes(app, prisma)
  registerLearningPortalRoutes(app, prisma)
  registerPublicCatalogRoutes(app, prisma)
  registerPathDraftRoutes(app, prisma)
  registerOperationsRoutes(app, prisma)
  registerSupportRoutes(app, prisma)
  registerNotificationRoutes(app, prisma)
  registerReportRoutes(app, prisma)
  registerProfileRoutes(app, prisma)
  registerSearchRoutes(app, prisma)
  registerIntegrationRoutes(app, prisma)
  registerAnalyticsRoutes(app, prisma)
  /* مسارات الديمو: /status يخبر الواجهة بالوضع، و/switch-role يرفض 404 ما لم DEMO_MODE=true */
  registerDemoRoutes(app, auth)

  return app
}

/* تجميع تطبيق Fastify — كوكيز، OpenAPI موثق، أخطاء موحدة، مسارات */

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import cors from '@fastify/cors'
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

export async function buildApp(prisma: PrismaClient) {
  const app = Fastify({ logger: false })
  const auth = new AuthService(prisma)

  await app.register(cors, {
    origin: process.env.WEB_ORIGIN?.split(',') ?? ['http://localhost:7100'],
    credentials: true,
  })
  await app.register(cookie)
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

  registerAuthRoutes(app, auth)
  registerAdminUserRoutes(app, prisma, auth)
  registerCatalogRoutes(app, prisma)
  registerPublishingRoutes(app, prisma)
  registerTrainerApplicationRoutes(app, prisma)
  registerAdminTrainerRoutes(app, prisma)
  registerTrainerPortalRoutes(app, prisma)
  registerAdminLearningRoutes(app, prisma)
  registerLearningPortalRoutes(app, prisma)

  return app
}

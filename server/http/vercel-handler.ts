/* دالة Vercel السحابية — تغلّف خادم Fastify كاملاً كدالة واحدة.
   تلتقط كل مسارات /api/* (و/docs للتوثيق) مع الحفاظ على المسار الأصلي.
   نسخة التطبيق تُبنى مرة واحدة وتُخزَّن مؤقتاً بين الاستدعاءات الدافئة. */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { FastifyInstance } from 'fastify'
import { getPrisma } from '../db/client'
import { seedRbac } from '../auth/rbac-seed'
import { buildApp } from './app'

let cached: FastifyInstance | null = null

async function getApp(): Promise<FastifyInstance> {
  if (cached) return cached
  const prisma = await getPrisma()
  await seedRbac(prisma) // idempotent — آمنة عند كل إقلاع بارد
  cached = await buildApp(prisma)
  await cached.ready()
  return cached
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp()
  app.server.emit('request', req, res)
}

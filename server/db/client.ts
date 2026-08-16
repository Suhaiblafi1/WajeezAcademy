/* عميل Prisma الموحد — Prisma 7 عبر محول pg.
   كل طبقات الخادم (Repository/Service) تستورد من هنا فقط. */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { ensureEmbeddedPostgres } from './embedded'

let client: PrismaClient | null = null

/** عميل حي — يستخدم DATABASE_URL إن ضُبطت، وإلا يشغّل PostgreSQL المدمج */
export async function getPrisma(): Promise<PrismaClient> {
  if (client) return client
  const connectionString = process.env.DATABASE_URL ?? await ensureEmbeddedPostgres()
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  return client
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect()
    client = null
  }
}

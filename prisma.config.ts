/* تهيئة Prisma 7 — رابط القاعدة يأتي من البيئة أو من PostgreSQL المدمج المحلي */
import { defineConfig } from 'prisma/config'

const url =
  process.env.DATABASE_URL ??
  'postgresql://wajeez:wajeez_local@localhost:5433/wajeez'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url },
})

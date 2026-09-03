/* عنوان الأكاديمية وأصل روابطها — ما تراه رسائلُنا الخارجة.

   البابان اللذان يخرج منهما شيء إلى خارج الموقع هما: عنوان المرسِل، وأصل
   الروابط داخل الرسالة. كلاهما كان يسقط إلى قيمة لا تصلح في الإنتاج — عنوان
   فارغ يمنع الإرسال كليا، وlocalhost في رابط لا يفتح عند أحد. */

import { beforeAll, afterEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { getEmailConfig, ACADEMY_EMAIL } from '../../services/integrations.service'
import { publicSiteUrl } from '../../services/notification.service'

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 180_000)

const ENV_KEYS = ['APP_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'RESEND_FROM_EMAIL'] as const
const saved: Record<string, string | undefined> = {}
for (const k of ENV_KEYS) saved[k] = process.env[k]
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('عنوان المرسِل', () => {
  it('يسقط على عنوان الأكاديمية لا على فراغ يمنع الإرسال', async () => {
    await prisma.integrationSetting.upsert({
      where: { provider: 'email' },
      update: { enabled: true, config: { apiKey: 're_test' } },
      create: { provider: 'email', enabled: true, config: { apiKey: 're_test' } },
    })
    delete process.env.RESEND_FROM_EMAIL
    const c = await getEmailConfig(prisma)
    expect(c.fromEmail).toBe(ACADEMY_EMAIL)
    expect(c.fromEmail).not.toBe('')
  })

  it('إعداد صريح يغلب الافتراضي', async () => {
    await prisma.integrationSetting.update({
      where: { provider: 'email' },
      data: { config: { apiKey: 're_test', fromEmail: 'other@wajeez.co' } },
    })
    delete process.env.RESEND_FROM_EMAIL
    expect((await getEmailConfig(prisma)).fromEmail).toBe('other@wajeez.co')
  })

  it('متغير البيئة يغلب الاثنين', async () => {
    process.env.RESEND_FROM_EMAIL = 'env@wajeez.co'
    expect((await getEmailConfig(prisma)).fromEmail).toBe('env@wajeez.co')
  })
})

describe('أصل روابط الرسائل', () => {
  it('APP_URL أولا، بلا شرطة مائلة زائدة', () => {
    process.env.APP_URL = 'https://academy.example/'
    expect(publicSiteUrl()).toBe('https://academy.example')
  })

  it('نطاق إنتاج Vercel حين لا APP_URL — لا localhost', () => {
    delete process.env.APP_URL
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'wajeez-academy.vercel.app'
    expect(publicSiteUrl()).toBe('https://wajeez-academy.vercel.app')
  })

  it('المحلي آخر الخيارات لا أولها', () => {
    delete process.env.APP_URL
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    expect(publicSiteUrl()).toBe('http://localhost:7100')
  })
})

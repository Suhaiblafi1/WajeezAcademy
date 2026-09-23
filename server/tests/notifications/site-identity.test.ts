/* عنوان الأكاديمية وأصل روابطها — ما تراه رسائلُنا الخارجة.

   البابان اللذان يخرج منهما شيء إلى خارج الموقع هما: عنوان المرسِل، وأصل
   الروابط داخل الرسالة. كلاهما كان يسقط إلى قيمة لا تصلح في الإنتاج — عنوان
   فارغ يمنع الإرسال كليا، وlocalhost في رابط لا يفتح عند أحد. */

import { beforeAll, afterEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { getEmailConfig, ACADEMY_EMAIL, ACADEMY_CONTACT_EMAIL } from '../../services/integrations.service'
import { publicSiteUrl } from '../../services/notification.service'

let prisma: PrismaClient

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
}, 180_000)

const ENV_KEYS = ['APP_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'RESEND_FROM_EMAIL', 'RESEND_REPLY_TO'] as const
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

/* ═══ عنوانُ الردّ — ما يراه المستخدمُ حين يضغط «ردّ» ═══

   قرارُ صاحب المنصّة (٢٣ سبتمبر ٢٠٢٦): العنوانُ الظاهرُ واحد، Academy@wajeez.co.
   وقد نُشر القرارُ وبقيت الرسائلُ تحمل `Reply-To: support@wajeezacademy.com` —
   لأنّ `deploy/.env.production` يسكن الخادمَ ولا يدخل Git، وقد نُسخ عن قالبٍ
   كان يقول ذلك، ومتغيّرُ البيئة يغلب الشيفرة. فعنوانٌ مهجورٌ على نطاق الإرسال
   يُستبدل بالعنوان الواحد أينما ضُبط: في البيئة أو في شاشة الإدارة. */
describe('عنوان الردّ', () => {
  const setDb = (config: Record<string, string>) => prisma.integrationSetting.upsert({
    where: { provider: 'email' },
    update: { enabled: true, config: { apiKey: 're_test', ...config } },
    create: { provider: 'email', enabled: true, config: { apiKey: 're_test', ...config } },
  })

  it('بلا ضبطٍ: لا يُفرض شيء، ويسقط mail.ts على العنوان الواحد', async () => {
    await setDb({})
    delete process.env.RESEND_REPLY_TO
    expect((await getEmailConfig(prisma)).replyTo).toBeUndefined()
  })

  it.each([
    'support@wajeezacademy.com', 'SUPPORT@WajeezAcademy.com', ' privacy@wajeezacademy.com ', 'billing@wajeezacademy.com',
  ])('عنوانٌ مهجورٌ في البيئة (%s) يُستبدل بالعنوان الواحد', async (stale) => {
    await setDb({})
    process.env.RESEND_REPLY_TO = stale
    expect((await getEmailConfig(prisma)).replyTo).toBe(ACADEMY_CONTACT_EMAIL)
  })

  it('وعنوانٌ مهجورٌ محفوظٌ من شاشة الإدارة كذلك', async () => {
    await setDb({ replyTo: 'support@wajeezacademy.com' })
    delete process.env.RESEND_REPLY_TO
    expect((await getEmailConfig(prisma)).replyTo).toBe(ACADEMY_CONTACT_EMAIL)
  })

  it('وعنوانٌ على نطاقٍ آخر يُحترم — فالحارسُ على المهجور لا على كلّ اختيار', async () => {
    await setDb({})
    process.env.RESEND_REPLY_TO = 'team@wajeez.co'
    expect((await getEmailConfig(prisma)).replyTo).toBe('team@wajeez.co')
  })
})

describe('أصل روابط الرسائل', () => {
  it('APP_URL أولا، بلا شرطة مائلة زائدة', () => {
    process.env.APP_URL = 'https://academy.example/'
    expect(publicSiteUrl()).toBe('https://academy.example')
  })

  it('المحلي احتياطيٌّ حين لا APP_URL', () => {
    delete process.env.APP_URL
    expect(publicSiteUrl()).toBe('http://localhost:7100')
  })
})

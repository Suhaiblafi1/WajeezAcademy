/* خريطةُ الموقع وllms.txt تُجابان من الخادم — بالقاعدة الحقيقيّة لا بخدمةٍ مُصطنَعة.

   `deploy/Caddyfile` يوجّههما إلى هنا. فإن لم يُسجَّل المسار أو سقط الاستعلام في
   القاعدة، ردّ Caddy ٤٠٤ أو ٥٠٠ لقوقل — وخريطةٌ لا تُجلب أسوأُ من ساكنةٍ ناقصة. */
import { beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'

let app: FastifyInstance

beforeAll(async () => {
  await setupTestDb()
  app = await buildApp(await testPrisma())
}, 180_000)

describe('خريطةُ الموقع وllms.txt من الخادم', () => {
  it('/sitemap.xml خريطةٌ صالحةٌ فيها الصفحاتُ العامّة', async () => {
    const res = await app.inject({ method: 'GET', url: '/sitemap.xml' })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.headers['content-type']).toContain('application/xml')
    expect(res.body.startsWith('<?xml')).toBe(true)
    expect(res.body).toContain('<loc>https://www.wajeezacademy.com/diagnostic</loc>')
  })

  it('/llms.txt نصٌّ بصيغة llmstxt.org', async () => {
    const res = await app.inject({ method: 'GET', url: '/llms.txt' })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.headers['content-type']).toContain('text/plain')
    expect(res.body.split('\n')[0]).toMatch(/^# /)
    expect(res.body).toContain('## الأسئلة الشائعة')
  })
})

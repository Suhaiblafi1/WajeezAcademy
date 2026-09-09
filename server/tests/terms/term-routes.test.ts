/* مساراتُ الفصول تُجاب — لا تُردّ ٤٠٤.

   ═══ العطب ═══

   `term.routes.ts` مكتوبٌ كاملا: الفصلُ القادمُ للعامّة، والتقويمُ، والإنشاءُ،
   ونافذةُ التسجيل، والتوزيعُ، والنشر — ولم يُسجَّل في `app.ts` قطّ. فكلُّ
   نداءٍ إليه ٤٠٤، والتقويمُ العامّ فارغٌ في الإنتاج، و«الفصل القادم» لا يظهر
   في أيّ سطح، ولا أحدَ يشتكي لأنّ الواجهةَ تبتلع الخطأ وتعرض ما كان.

   واختباراتُ الفصول كلُّها كانت تنادي الخدماتِ مباشرةً — فلم يرَ أحدٌ أنّ
   البابَ إليها من HTTP مقفل. وهذا الملفُّ يمشي من الباب. (٨ سبتمبر ٢٠٢٦) */
import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let app: FastifyInstance
let adminCookie = ''

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  app = await buildApp(prisma)
  const u = await auth.register('term-routes-admin@test.local', 'Admin#12345', 'مديرُ النظام')
  await auth.setRoles(u.userId, ['super_admin'])
  const { token } = await auth.login('term-routes-admin@test.local', 'Admin#12345')
  adminCookie = `${SESSION_COOKIE}=${token}`
}, 180_000)

describe('مساراتُ الفصول مسجَّلةٌ في التطبيق', () => {
  it('العامّةُ تسأل «متى الفصل القادم؟» فتُجاب — ولو بلا فصل', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/public/upcoming-term' })
    expect(res.statusCode, 'المسارُ غيرُ مسجَّل — ٤٠٤').toBe(200)
    expect(res.json()).toHaveProperty('term')
    const cal = await app.inject({ method: 'GET', url: '/api/public/term-calendar' })
    expect(cal.statusCode).toBe(200)
    expect(cal.json()).toHaveProperty('calendar')
  })

  it('والإدارةُ تُنشئ فصلا بحدوده المحسوبة، وتراه في القائمة، وتنشر تقويمَه', async () => {
    const created = await app.inject({
      method: 'POST', url: '/api/admin/terms', headers: { cookie: adminCookie },
      payload: { year: 2031, season: 'feb_apr' },
    })
    expect(created.statusCode, created.body).toBe(201)
    const term = created.json() as { id: string; titleAr: string; startsOn: string; endsOn: string }
    expect(term.titleAr).toBe('موسم الربيع 2031')
    expect(term.startsOn.slice(0, 10)).toBe('2031-02-01')
    expect(term.endsOn.slice(0, 10)).toBe('2031-04-30')

    const list = await app.inject({ method: 'GET', url: '/api/admin/terms?all=true', headers: { cookie: adminCookie } })
    expect(list.statusCode).toBe(200)
    expect((list.json() as { id: string }[]).map((t) => t.id)).toContain(term.id)

    const published = await app.inject({ method: 'POST', url: `/api/admin/terms/${term.id}/publish-calendar`, headers: { cookie: adminCookie }, payload: {} })
    expect(published.statusCode).toBe(200)
    expect((published.json() as { calendarPublishedAt: string | null }).calendarPublishedAt).not.toBeNull()
  })

  it('و«الفصل القادم» هو المنشورُ لا الأقربُ تاريخا — فالمنشورُ قُصد أن يُرى', async () => {
    const mk = async (season: string) => {
      const res = await app.inject({ method: 'POST', url: '/api/admin/terms', headers: { cookie: adminCookie }, payload: { year: 2029, season } })
      expect(res.statusCode, res.body).toBe(201)
      return (res.json() as { id: string }).id
    }
    const unpublishedEarlier = await mk('aug_oct')
    const publishedLater = await mk('nov_jan')
    const published = await app.inject({ method: 'POST', url: `/api/admin/terms/${publishedLater}/publish-calendar`, headers: { cookie: adminCookie }, payload: {} })
    expect(published.statusCode).toBe(200)

    const res = await app.inject({ method: 'GET', url: '/api/public/upcoming-term' })
    const term = (res.json() as { term: { id: string; calendarPublished: boolean } }).term
    expect(term.id, 'اختار الأقربَ غيرَ المنشور').toBe(publishedLater)
    expect(term.id).not.toBe(unpublishedEarlier)
    expect(term.calendarPublished).toBe(true)

    const cal = await app.inject({ method: 'GET', url: '/api/public/term-calendar' })
    expect((cal.json() as { calendar: unknown }).calendar, 'التقويمُ العامّ فارغٌ والمنشورُ خلفه').not.toBeNull()
  })

  it('وبلا جلسةٍ يُردّ الطلبُ لا يُهمَل — ٤٠١ لا ٤٠٤', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/terms' })
    expect(res.statusCode).toBe(401)
  })
})

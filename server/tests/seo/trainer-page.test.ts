/* صفحةُ المدرّب `/t/:slug` مُهيَّأةً — بالقاعدة الحقيقيّة وبوّابتها.

   كانت تُقدَّم لقوقل بقالب الرئيسة وcanonicalها. والمقيس هنا: أنّ المدرّبَ الذي يجوز عرضُ اسمه
   يُجاب بصفحته (عنوانُه وcanonicalُه وPerson ونصُّه)، وأنّ من نُزع اعتمادُ نشره لا يُقرأ اسمُه فيها
   ولا في الخريطة، وأنّ زاحفَ المعاينة يبقى على صورة رابطه. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'
import { resetTemplateCache } from '../../services/trainer-seo-page'

let prisma: PrismaClient
let app: FastifyInstance
let profileId = ''
const S = Date.now().toString(36).slice(-5)
const SLUG = `seo-trainer-${S}`
const NAME = `ريمُ الاختبار ${S}`
const dir = mkdtempSync(join(tmpdir(), 'wajeez-dist-'))
const prevDist = process.env.WEB_DIST

/** قالبٌ يحاكي `dist/index.html` بوسومه كما يكتبها `index.html` */
const TEMPLATE = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <title>مسارك يبدأ من فهمك — أكاديمية وجيز</title>
    <meta name="description" content="وصف الرئيسة" />
    <link rel="canonical" href="https://www.wajeezacademy.com/" />
    <meta property="og:title" content="t" />
    <meta property="og:description" content="d" />
    <meta property="og:url" content="https://www.wajeezacademy.com/" />
    <meta property="og:image" content="https://www.wajeezacademy.com/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:title" content="t" />
    <meta name="twitter:description" content="d" />
    <meta name="twitter:image" content="https://www.wajeezacademy.com/og-image.png" />
    <script type="application/ld+json">
    { "@context": "https://schema.org" }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-abcdefgh.js"></script>
  </body>
</html>`

beforeAll(async () => {
  writeFileSync(join(dir, 'index.html'), TEMPLATE)
  process.env.WEB_DIST = dir
  resetTemplateCache()
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  const user = await prisma.user.create({ data: { email: `seo-t-${S}@test.local`, passwordHash: 'x', displayName: NAME } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `TA-SEO-${S}`, fullName: NAME, email: `seo-t-${S}@test.local`, status: 'active', userId: user.id },
  })
  const profile = await prisma.trainerProfile.create({
    data: {
      userId: user.id, applicationId: application.id, publicSlug: SLUG,
      publicVisibility: true, isVerified: true, publishApprovedAt: new Date(),
      headline: 'مدربة تسويق رقمي', bioPublic: 'عشر سنوات في التسويق.\n\nدربت فرقا في شركات كبرى.',
    },
  })
  profileId = profile.id
  /* «له دوراتٌ منشورةٌ هذا الفصلَ أو بعده» — مسارٌ منشورٌ بلا فصلٍ يكفي (`livePathWhere`) */
  await prisma.trainerPath.create({
    data: { profileId, titleAr: 'مسار التسويق', status: 'published', blurbAr: 'من الصفر إلى خطة', slug: `${SLUG}-p`, publishedAt: new Date() },
  })
}, 240_000)

afterAll(() => {
  process.env.WEB_DIST = prevDist
  resetTemplateCache()
  rmSync(dir, { recursive: true, force: true })
})

const canonicalOf = (h: string) => /<link rel="canonical" href="([^"]*)"/.exec(h)?.[1]

describe('صفحة المدرّب المهيّأة', () => {
  it('تجاب بوسومه ونصّه وPerson — لا بقالب الرئيسة', async () => {
    const res = await app.inject({ method: 'GET', url: `/t/${SLUG}`, headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } })
    expect(res.statusCode, res.body).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(canonicalOf(res.body)).toBe(`https://www.wajeezacademy.com/t/${SLUG}`)
    expect(res.body).toContain(`<title>${NAME} — أكاديمية وجيز</title>`)
    expect(res.body).toContain('<meta name="robots" content="index, follow')
    expect(res.body).toContain('عشر سنوات في التسويق.')
    expect(res.body).toContain('مسار التسويق')
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(res.body)![1].replace(/\\u003c/g, '<'))
    const types = (ld['@graph'] as { '@type': string }[]).map((n) => n['@type'])
    expect(types).toEqual(expect.arrayContaining(['ProfilePage', 'Person', 'BreadcrumbList']))
    /* والتطبيقُ نفسُه يُحمَّل — الإنسانُ يرى الصفحةَ الحيّة */
    expect(res.body).toContain('/assets/index-abcdefgh.js')
  })

  it('وزاحف المعاينة يبقى على صورة رابطه', async () => {
    const res = await app.inject({ method: 'GET', url: `/t/${SLUG}`, headers: { 'x-wajeez-preview': '1', 'user-agent': 'WhatsApp/2.23' } })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<meta name="robots" content="noindex" />')
    expect(res.body).not.toContain('/assets/index-abcdefgh.js')
  })

  it('ومسار لا مدرّب له ٤٠٤ بلا فهرسة', async () => {
    const res = await app.inject({ method: 'GET', url: '/t/no-such-trainer-xyz' })
    expect(res.statusCode).toBe(404)
    expect(res.body).toContain('<meta name="robots" content="noindex, nofollow" />')
  })

  it('ويدخل الخريطة وllms.txt', async () => {
    const map = await app.inject({ method: 'GET', url: '/sitemap.xml' })
    expect(map.body).toContain(`<loc>https://www.wajeezacademy.com/t/${SLUG}</loc>`)
    const llms = await app.inject({ method: 'GET', url: '/llms.txt' })
    expect(llms.body).toContain(NAME)
  })

  it('ومن نزع اعتماد نشره لا يقرأ اسمه في صفحته ولا في الخريطة', async () => {
    await prisma.trainerProfile.update({ where: { id: profileId }, data: { publishApprovedAt: null } })
    try {
      const res = await app.inject({ method: 'GET', url: `/t/${SLUG}` })
      expect(res.statusCode).toBe(404)
      expect(res.body).not.toContain(NAME)
      const map = await app.inject({ method: 'GET', url: '/sitemap.xml' })
      expect(map.body).not.toContain(`/t/${SLUG}<`)
      const llms = await app.inject({ method: 'GET', url: '/llms.txt' })
      expect(llms.body).not.toContain(NAME)
    } finally {
      await prisma.trainerProfile.update({ where: { id: profileId }, data: { publishApprovedAt: new Date() } })
    }
  })
})

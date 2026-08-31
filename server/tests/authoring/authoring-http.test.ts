/* تأليف المتن عبر HTTP — الفصلُ بين الكتابة والنشر يجب أن يصمد على السلك.

   الحبّتان قائمتان أصلا: `catalog.course.edit` تكتب، و`catalog.course.publish`
   تقرّر. والمديرُ الأكاديميّ يملكهما معا — وهذا مقصود. لكنّ الفصلَ هو ما
   يجعل التفويض ذا معنى: أن يُمنح كاتبٌ حبّةَ الكتابة وحدها فيكتب ولا ينشر.

   فلو حَرَست المساراتُ بحبّةٍ واحدة لانهار ذلك كلُّه بلا أن يظهر في اختبارِ
   خدمةٍ واحد. ولهذا يُختبر هنا على المسار لا على الصنف. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
let writerCookie = ''
let managerCookie = ''
let learnerCookie = ''
let moduleId = ''

const STAMP = Date.now()

async function userWith(email: string, role: string, grants: string[] = []): Promise<string> {
  const password = 'Authoring#12345'
  const u = await auth.register(email, password, role)
  await auth.setRoles(u.userId, [role])
  for (const key of grants) {
    await prisma.userPermission.create({
      data: { userId: u.userId, permissionKey: key, effect: 'grant', reason: 'اختبار الفصل بين الكتابة والنشر' },
    })
  }
  const { token } = await auth.login(email, password)
  return `${SESSION_COOKIE}=${token}`
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  await app.ready()

  /* كاتبٌ لا ينشر: متعلّمٌ مُنح حبّةَ الكتابة وحدها — أوضحُ صورةٍ للفصل */
  writerCookie = await userWith(`writer-${STAMP}@test.local`, 'learner', ['catalog.course.edit'])
  managerCookie = await userWith(`acad-${STAMP}@test.local`, 'academic_manager')
  learnerCookie = await userWith(`plain-${STAMP}@test.local`, 'learner')

  const base = await prisma.courseModuleVersion.findFirst({
    where: { status: 'published', bodyAr: { not: null } }, orderBy: { version: 'asc' },
  })
  moduleId = base!.moduleId
  await prisma.courseModuleVersion.deleteMany({
    where: { moduleId, status: { in: ['draft', 'in_review'] } },
  })
})

describe('تأليف المتن عبر HTTP', () => {
  it('متعلّمٌ بلا حبّةٍ لا يرى الطابور أصلا', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/admin/authoring/worklist', headers: { cookie: learnerCookie } })
    expect(r.statusCode).toBe(403)
  })

  it('والكاتبُ يفتح مسوّدةً ويحفظ فيها', async () => {
    const open = await app.inject({
      method: 'POST', url: `/api/admin/authoring/${moduleId}/draft`, headers: { cookie: writerCookie },
    })
    expect(open.statusCode).toBe(200)
    const save = await app.inject({
      method: 'PUT', url: `/api/admin/authoring/${moduleId}/draft`, headers: { cookie: writerCookie },
      payload: { bodyAr: '# درسٌ كتبه كاتبٌ لا ينشر\n\nفقرةٌ أولى.' },
    })
    expect(save.statusCode).toBe(200)
  })

  it('وصيغةٌ منكسرة تُردّ بـ422 برسالةٍ عربية تقول ما الخطأ', async () => {
    const r = await app.inject({
      method: 'PUT', url: `/api/admin/authoring/${moduleId}/draft`, headers: { cookie: writerCookie },
      payload: { checksAr: 'س: سؤالٌ بلا خيارات' },
    })
    expect(r.statusCode).toBe(422)
    expect(r.body).toMatch(/[؀-ۿ]/)
  })

  it('ويرفعها للمراجعة — ثمّ يُمنع من نشرها هو', async () => {
    const submit = await app.inject({
      method: 'POST', url: `/api/admin/authoring/${moduleId}/submit`, headers: { cookie: writerCookie },
    })
    expect(submit.statusCode).toBe(200)

    const selfPublish = await app.inject({
      method: 'POST', url: `/api/admin/authoring/${moduleId}/review`, headers: { cookie: writerCookie },
      payload: { decision: 'publish' },
    })
    /* ٤٠٣ لأنّه لا يملك حبّةَ النشر — والحبّتان منفصلتان فعلا */
    expect(selfPublish.statusCode).toBe(403)
  })

  it('والمديرُ الأكاديميّ ينشرها — فتصير هي المقروءة', async () => {
    const r = await app.inject({
      method: 'POST', url: `/api/admin/authoring/${moduleId}/review`, headers: { cookie: managerCookie },
      payload: { decision: 'publish' },
    })
    expect(r.statusCode).toBe(200)
    const readable = await prisma.courseModuleVersion.findFirst({
      where: { moduleId, status: { in: ['published', 'approved'] } }, orderBy: { version: 'desc' },
    })
    expect(readable?.bodyAr ?? '').toContain('كاتبٌ لا ينشر')
  })
})

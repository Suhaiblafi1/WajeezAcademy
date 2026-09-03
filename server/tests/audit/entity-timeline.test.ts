/* أثرُ الشيء في موضعه — و«هل يُسجَّل ما يجب أن يُسجَّل؟»

   سجلُّ الأثر يُكتب من كلّ خدمةٍ في المنصّة، وكان يُقرأ في شاشةٍ واحدةٍ
   عامّة: من أراد أن يعرف «من غيّر هذه الشعبة» فتح شاشةً أخرى، وعرف نوعَ
   الكيان ومعرّفَه من ٣٦ حرفا، ثمّ رشّح. فالجوابُ مكتوبٌ ولا يُقرأ حيث يُسأل.

   والقسمُ الثاني هنا أهمُّ من الأوّل: اختبارُ تغطيةٍ يمرّ على الأفعال التي
   **لا يجوز** أن تقع بلا أثر، ويُنفّذها فعلا عبر HTTP ثمّ يسأل السجلّ. وقد
   كشف أوّلَ تشغيلٍ له ثغرةً حقيقيّة: **تعيينُ الأدوار لم يكن يُسجَّل** — وهو
   أعلى فعلٍ سلطةً على المنصّة، به يصير حسابٌ مديرَ نظامٍ أعلى. وكان ما هو
   أدنى منه مسجَّلا: الإيقافُ والأرشفةُ ومنحُ حبّةٍ واحدةٍ باستثناء. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { auditActionAr, entityTypeAr } from '../../../src/application/audit/labels'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
let superCookie = ''
let targetId = ''

interface TimelineEvent {
  action: string; actionAr: string; actorAr: string; reason: string | null; changed: string[]
}
interface Timeline { entityTypeAr: string; total: number; events: TimelineEvent[] }

async function timeline(entityType: string, entityId: string): Promise<Timeline> {
  const res = await app.inject({
    method: 'GET', url: `/api/admin/audit/entity/${entityType}/${entityId}`, headers: { cookie: superCookie },
  })
  expect(res.statusCode, `أثرُ ${entityType}`).toBe(200)
  return res.json() as Timeline
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)

  const boss = await auth.register('audit-super@test.local', 'Audit#123456', 'مديرُ النظام')
  await auth.setRoles(boss.userId, ['super_admin'])
  const { token } = await auth.login('audit-super@test.local', 'Audit#123456')
  superCookie = `${SESSION_COOKIE}=${token}`

  const made = await app.inject({
    method: 'POST', url: '/api/admin/users', headers: { cookie: superCookie },
    payload: { email: 'audit-target@test.local', displayName: 'حسابٌ يُتابَع أثرُه', roleIds: ['support'] },
  })
  expect(made.statusCode).toBe(201)
  const body = made.json() as { id?: string; userId?: string }
  targetId = body.id ?? body.userId ?? ''
  expect(targetId, 'لم يُعرف معرّفُ الحساب المُنشأ').toBeTruthy()
}, 240_000)

describe('المعجمُ يغطّي كلَّ فعلٍ تكتبه الخدمات', () => {
  /* لا مفتاحَ لاتينيٌّ يُعرض للموظّف: كلُّ فعلٍ إمّا له عبارةٌ كاملة، وإمّا
     تُركَّب من مقاطعَ كلُّها في المعجم. وما سقط يُعرض بمفتاحه — فالاختبار
     يمنع سقوطَ الجديد صامتا. */
  it('كلُّ فعلٍ في شيفرة الخادم له اسمٌ عربيّ', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) { if (name !== 'tests' && name !== 'node_modules') walk(full) }
        else if (name.endsWith('.ts')) files.push(full)
      }
    }
    walk('server')
    const actions = new Set<string>()
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(/action: '([a-z0-9._]+)'/g)) actions.add(m[1])
    }
    expect(actions.size, 'لم يُقرأ أيُّ فعلٍ من الشيفرة').toBeGreaterThan(100)
    const untranslated = [...actions].filter((a) => auditActionAr(a) === a)
    expect(untranslated, `أفعالٌ بلا اسمٍ عربيّ: ${untranslated.join(', ')}`).toEqual([])
  })

  it('وكلُّ نوعِ كيانٍ كذلك', () => {
    for (const t of ['user', 'cohort', 'enrollment', 'refund', 'trainer_application', 'support_ticket']) {
      expect(entityTypeAr(t), t).not.toBe(t)
    }
  })
})

describe('تغطيةُ الأثر: أفعالُ السلطة لا تقع بلا تسجيل', () => {
  it('تعيينُ الأدوار يُسجَّل، بقائمةِ ما قبلَه وما بعده', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/admin/users/${targetId}/roles`, headers: { cookie: superCookie },
      payload: { roleIds: ['academic_coordinator', 'support'] },
    })
    expect(res.statusCode).toBe(200)

    const t = await timeline('user', targetId)
    const rolesSet = t.events.find((e) => e.action === 'roles.set')
    expect(rolesSet, 'تعيينُ الأدوار وقع بلا أثر').toBeTruthy()
    expect(rolesSet!.actionAr).toBe('تعيينُ أدوارِ حساب')
    expect(rolesSet!.changed, '«قبل» و«بعد» لا تُقرأ').toContain('roles')

    const row = await prisma.auditEvent.findFirst({
      where: { entityType: 'user', entityId: targetId, action: 'roles.set' },
      orderBy: { createdAt: 'desc' },
    })
    expect((row!.before as { roles: string[] }).roles).toEqual(['support'])
    expect((row!.after as { roles: string[] }).roles).toEqual(['academic_coordinator', 'support'])
  })

  it('والإيقافُ والأرشفةُ بسببهما المكتوب', async () => {
    const suspend = await app.inject({
      method: 'POST', url: `/api/admin/users/${targetId}/suspend`, headers: { cookie: superCookie }, payload: {},
    })
    expect(suspend.statusCode).toBe(200)
    const archive = await app.inject({
      method: 'POST', url: `/api/admin/users/${targetId}/archive`, headers: { cookie: superCookie },
      payload: { reason: 'انتهى تعاونُنا نهايةَ الفصل — قرارٌ إداريّ' },
    })
    expect(archive.statusCode).toBe(200)

    const t = await timeline('user', targetId)
    const actions = t.events.map((e) => e.action)
    expect(actions).toContain('admin.user.suspend')
    expect(actions).toContain('admin.user.archive')
    const arch = t.events.find((e) => e.action === 'admin.user.archive')!
    expect(arch.reason, 'الأرشفةُ بلا سببٍ مقروء').toContain('انتهى تعاونُنا')
    expect(arch.actionAr).toBe('أرشفةُ حساب')
  })

  it('وإنشاءُ الحساب أوّلَ حدثٍ في أثره — والأحدثُ أوّلا', async () => {
    const t = await timeline('user', targetId)
    expect(t.entityTypeAr).toBe('حساب')
    expect(t.events.at(-1)!.action, 'الترتيبُ ليس من الأحدث').toBe('admin.user.create')
    expect(t.total).toBeGreaterThanOrEqual(4)
  })

  it('والفاعلُ يُسمّى: اسمُ من فعل، أو «النظام» إن لم يكن بشرا', async () => {
    const t = await timeline('user', targetId)
    for (const e of t.events) expect(e.actorAr, e.action).toBeTruthy()
    expect(t.events.map((e) => e.actorAr)).toContain('مديرُ النظام')
  })

  it('وأثرُ الشعبة يُقرأ في شعبتها: إنشاءٌ وجلسة', async () => {
    const made = await app.inject({
      method: 'POST', url: '/api/admin/cohorts', headers: { cookie: superCookie },
      payload: { courseId: 'C-BIZ-101', title: 'شعبةُ الأثر', capacity: 8, price: 300 },
    })
    expect(made.statusCode).toBe(201)
    const cohortId = (made.json() as { id: string }).id
    const session = await app.inject({
      method: 'POST', url: `/api/admin/cohorts/${cohortId}/sessions`, headers: { cookie: superCookie },
      payload: {
        title: 'الجلسةُ الأولى',
        startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        endsAt: new Date(Date.now() + 3 * 86_400_000 + 5_400_000).toISOString(),
      },
    })
    expect(session.statusCode).toBe(201)

    const t = await timeline('cohort', cohortId)
    expect(t.entityTypeAr).toBe('شعبة')
    const actions = t.events.map((e) => e.action)
    expect(actions).toContain('cohort.create')
    expect(actions).toContain('cohort.session.add')
    expect(t.events.find((e) => e.action === 'cohort.session.add')!.actionAr).toBe('إضافةُ جلسةٍ إلى شعبة')
  })
})

describe('ولا يُقرأ الأثرُ بلا صلاحيّته', () => {
  it('المنسّقُ الأكاديميّ يُردّ عن أثر أيّ كيان — `audit.view` وحدها بابُه', async () => {
    const u = await auth.register('audit-coord@test.local', 'Coord#123456', 'منسّق')
    await auth.setRoles(u.userId, ['academic_coordinator'])
    const { token } = await auth.login('audit-coord@test.local', 'Coord#123456')
    const res = await app.inject({
      method: 'GET', url: `/api/admin/audit/entity/user/${targetId}`,
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('والزائرُ بلا جلسةٍ ٤٠١', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/admin/audit/entity/user/${targetId}` })
    expect(res.statusCode).toBe(401)
  })
})

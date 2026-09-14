/* الحذفُ جملةً على قاعدةٍ حقيقيّة — والعطبُ في المسافة بين القراءة والضغط.

   ثلاثةُ أشياءَ لا تُرى إلّا هنا:

   ١) **التنفيذُ لا يثق بالمعاينة.** بينهما دقائقُ يشتري فيها أحدُهم دورةً
      أو تصل شهادة. فلو نُفِّذ على ما قُرئ لَمُحي حسابٌ صار له سجلٌّ بعد أن
      قُرئ فارغا — والمعاينةُ للقارئ لا للآلة.

   ٢) **الدفعةُ تُقسَم ولا تسقط.** من حمل شيئا يُردّ ويبقى، ومن لم يحمل
      يُحذف — لا «كلُّها أو لا شيء» فيصير بندا لا يُستعمل.

   ٣) **والأثرُ يُقرأ دفعةً واحدةً لا واحدا وثلاثين حذفا متفرّقا في ثانية.** */

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
let superCookie = ''
let superId = ''
let opsCookie = ''

const STAMP = Date.now()
const cookieFor = async (email: string, password: string) =>
  `${SESSION_COOKIE}=${(await auth.login(email, password)).token}`

const mkUser = async (tag: string, roles: string[] = ['learner']) => {
  const u = await auth.register(`bp-${tag}-${STAMP}@test.local`, 'Pass#12345', `حساب ${tag}`)
  await auth.setRoles(u.userId, roles)
  return u.userId
}

/** ما يجعل الحسابَ «يحمل شيئا» — طلبُ شراءٍ يكفي، ودفترُ المال لا يُمحى بنقرة */
const giveOrder = async (userId: string) => {
  await prisma.order.create({ data: { userId, subtotal: 100, total: 100, status: 'paid' } })
}

interface PreviewBody {
  rows: { id: string; email: string; deletable: boolean; whyAr: string | null }[]
  deletable: number
  refused: number
  error?: { code: string; message_ar: string }
}

const post = async (url: string, cookie: string, payload: unknown) =>
  app.inject({ method: 'POST', url, headers: { cookie }, payload: payload as object })

const json = <T>(res: { body: string }) => JSON.parse(res.body) as T

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)

  const sa = await auth.register(`bp-super-${STAMP}@test.local`, 'Super#12345', 'مدير النظام')
  superId = sa.userId
  await auth.setRoles(superId, ['super_admin'])
  superCookie = await cookieFor(`bp-super-${STAMP}@test.local`, 'Super#12345')

  /* من يملك الحذفَ الفرديَّ ولا يملك الجملة — وهو الفرقُ الذي يُحرَس */
  const ops = await auth.register(`bp-ops-${STAMP}@test.local`, 'Ops#12345', 'مدير العمليات')
  await auth.setRoles(ops.userId, ['operations_manager'])
  for (const key of ['admin.users.manage', 'admin.users.purge']) {
    await prisma.userPermission.create({
      data: { userId: ops.userId, permissionKey: key, effect: 'grant', reason: 'اختبارُ حدِّ الجملة' },
    })
  }
  opsCookie = await cookieFor(`bp-ops-${STAMP}@test.local`, 'Ops#12345')
}, 240_000)

describe('المعاينةُ تقول القسمةَ قبل أن يقع شيء', () => {
  it('تفصل من يُحذف عمّن يُردّ، وتسمّي ما يحمله المردود', async () => {
    const empty = await mkUser('prev-empty')
    const carrying = await mkUser('prev-carrying')
    await giveOrder(carrying)

    const view = json<PreviewBody>(await post('/api/admin/users/bulk-purge/preview', superCookie, { ids: [empty, carrying] }))
    expect(view.deletable).toBe(1)
    expect(view.refused).toBe(1)
    expect(view.rows.find((r) => r.id === empty)?.deletable).toBe(true)
    const refused = view.rows.find((r) => r.id === carrying)!
    expect(refused.deletable).toBe(false)
    expect(refused.whyAr, 'سببُ الردّ لا يسمّي ما يحمله').toContain('طلبَ شراء')

    /* ولا يقع شيءٌ من المعاينة — وهو أوّلُ ما يُفحص في بابٍ لا رجعةَ فيه */
    expect(await prisma.user.count({ where: { id: { in: [empty, carrying] } } })).toBe(2)
  })

  it('ولا يحذف الضاغطُ حسابَه من هنا', async () => {
    const view = json<PreviewBody>(await post('/api/admin/users/bulk-purge/preview', superCookie, { ids: [superId] }))
    expect(view.deletable).toBe(0)
    expect(view.rows[0].whyAr).toContain('حسابَك')
  })
})

describe('التنفيذُ يُعيد الحسابَ ولا يثق بما قُرئ', () => {
  /* ═══ الحارسُ الذي يبرّر الملفَّ كلَّه ═══

     يُقرأ الحسابُ فارغا، ثمّ يشتري صاحبُه دورةً، ثمّ يُضغط الزرّ بالعدد
     الذي قُرئ. فلو نُفِّذ على المعاينة لَمُحي دفترُ ماله. */
  it('حسابٌ اكتسب سجلّا بعد المعاينة: تُردّ الدفعةُ ولا يُمحى', async () => {
    const a = await mkUser('drift-a')
    const b = await mkUser('drift-b')

    const view = json<PreviewBody>(await post('/api/admin/users/bulk-purge/preview', superCookie, { ids: [a, b] }))
    expect(view.deletable).toBe(2)

    /* وبين القراءة والضغط: اشترى */
    await giveOrder(b)

    const res = await post('/api/admin/users/bulk-purge', superCookie, { ids: [a, b], confirmCount: '2' })
    expect(res.statusCode, 'نُفِّذ على معاينةٍ تقادمت').toBe(409)
    expect(json<{ error: { message_ar: string } }>(res).error.message_ar).toContain('1')

    /* ولا شيءَ وقع — لا الفارغُ ولا المشتري */
    expect(await prisma.user.count({ where: { id: { in: [a, b] } } })).toBe(2)
  })

  it('والعددُ الخاطئُ يُردّ ولا يُحذف منه شيء', async () => {
    const a = await mkUser('wrong-a')
    const b = await mkUser('wrong-b')
    const res = await post('/api/admin/users/bulk-purge', superCookie, { ids: [a, b], confirmCount: '3' })
    expect(res.statusCode).toBe(409)
    expect(await prisma.user.count({ where: { id: { in: [a, b] } } })).toBe(2)
  })

  it('والعددُ الصحيح: يُحذف المقبولُ ويبقى المردودُ بسجلّه', async () => {
    const gone = await mkUser('exec-gone')
    const stays = await mkUser('exec-stays')
    await giveOrder(stays)

    const res = await post('/api/admin/users/bulk-purge', superCookie, { ids: [gone, stays], confirmCount: '1' })
    expect(res.statusCode).toBe(200)
    const out = json<{ purged: number; refused: number; batchId: string }>(res)
    expect(out.purged).toBe(1)
    expect(out.refused, 'المردودُ لا يُعدّ — فالخبرُ يقول رقما واحدا ويكذب').toBe(1)

    expect(await prisma.user.findUnique({ where: { id: gone } })).toBeNull()
    expect(await prisma.user.findUnique({ where: { id: stays } }), 'مُحي حسابٌ يحمل دفترَ مال').not.toBeNull()
    expect(await prisma.order.count({ where: { userId: stays } })).toBe(1)
  })
})

describe('أثرُ الدفعة يُقرأ دفعةً', () => {
  it('لكلّ محذوفٍ صفُّه، وللدفعة صفُّها، ومرجعُها واحدٌ يجمعها', async () => {
    const ids = [await mkUser('audit-a'), await mkUser('audit-b')]
    const res = await post('/api/admin/users/bulk-purge', superCookie, { ids, confirmCount: '2' })
    expect(res.statusCode).toBe(200)
    const { batchId } = json<{ batchId: string }>(res)
    expect(batchId).toBeTruthy()

    const rows = await prisma.auditEvent.findMany({
      where: { entityType: 'user', entityId: { in: [...ids, batchId] } },
    })
    const each = rows.filter((r) => r.action === 'admin.user.purge')
    const summary = rows.filter((r) => r.action === 'admin.users.purge_bulk')
    expect(each).toHaveLength(2)
    expect(summary).toHaveLength(1)

    /* ═══ ولولا المرجعُ المشترك ═══
       لَقُرئ السجلُّ بعد ستّة أشهر «حذفَين غيرِ مفسَّرَين يتلو أحدُهما الآخرَ
       في ثانية» — لا «عمليّةً واحدةً مقصودة». */
    for (const r of [...each, ...summary]) {
      expect((r.meta as { batchId?: string } | null)?.batchId, 'صفُّ أثرٍ بلا مرجعِ دفعة').toBe(batchId)
    }
    /* واسمُ من ذهب يبقى في الأثر: بعد المحو لا صفَّ يُشار إليه */
    expect((each[0].meta as { email?: string }).email).toContain('bp-audit-')
  })
})

describe('الحبّةُ للأعلى وحدَه', () => {
  it('من يملك الحذفَ الفرديَّ لا يملك الجملةَ', async () => {
    const victim = await mkUser('rbac-victim')
    for (const url of ['/api/admin/users/bulk-purge/preview', '/api/admin/users/bulk-purge']) {
      const res = await post(url, opsCookie, { ids: [victim], confirmCount: '1' })
      expect(res.statusCode, `${url} مفتوحٌ لمن لا يملك الحبّة`).toBe(403)
    }
    expect(await prisma.user.findUnique({ where: { id: victim } })).not.toBeNull()
  })

  it('والدفعةُ لها سقفٌ على المدخَل', async () => {
    const many = Array.from({ length: 201 }, () => crypto.randomUUID())
    const res = await post('/api/admin/users/bulk-purge/preview', superCookie, { ids: many })
    expect(res.statusCode).toBe(400)
  })
})

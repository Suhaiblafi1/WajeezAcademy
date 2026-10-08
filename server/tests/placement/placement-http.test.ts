/* اختبارُ تحديد مستوى الإنجليزيّة على HTTP الفعلي (٨ أكتوبر ٢٠٢٦).

   قراراتُ صاحب المنصّة: «أكتبه مسوّدةً ويراجعه مدرّبُ الإنجليزيّة في بوّابته»،
   و«لا يُعرض قبل اعتماده». فيُحرس هنا:
     ١) الاستيرادُ يُنشئ ولا يُحدّث — ما عدّله المراجعُ لا يمحوه نشرٌ تالٍ.
     ٢) الاختبارُ مغلقٌ ما دامت أسئلتُه مسوّدة: لا أسئلةَ تُقرأ ولا تصحيح.
     ٣) المراجعةُ خلف `placement.review`: مدرّبٌ بلا منحٍ يُردّ، وبالمنح يراجع.
     ٤) بعد الاعتماد يُفتح — والجوابُ الصحيحُ لا يغادر الخادم، والتصحيحُ يحدّد المستوى.

     ٥) وفحوصُ المجالات تُستورَد معتمَدةً فتُفتح فورا («تُفتح فورا وتُراجَع بعدُ»)،
        وكلُّ موضوعٍ في بنكه لا يُخلَط بغيره.

   ⚠ أُثبت سقوطُه: (أ) حُدّث الصفُّ في الاستيراد (`update` بالنصّ) فسقط ١،
   (ب) أُرسل السؤالُ كاملا في المسار العامّ فسقط ٤، (ج) نُزع `preHandler` من
   مسار المراجعة فسقط ٣ — ثمّ أُعيد كلٌّ فخضرّ. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { importPlacementDraft } from '../../catalog/placement-importer'
import draft from '../../../src/data/placement/english-placement.draft.v1.json'
import type { PlacementItem } from '../../../src/domain/placement/english-placement'
import fieldDraft from '../../../src/data/placement/field-checks.draft.v1.json'
import type { FieldItem } from '../../../src/domain/placement/field-check'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance
let trainerCookie = ''
let reviewerCookie = ''
let managerCookie = ''

const items = (draft as { items: PlacementItem[] }).items
const fieldItems = (fieldDraft as { items: FieldItem[] }).items
const ALL = items.length + fieldItems.length

async function cookieFor(email: string, password: string): Promise<string> {
  const { token } = await auth.login(email, password)
  return `${SESSION_COOKIE}=${token}`
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)
  await app.ready()

  const trainer = await auth.register('pl-trainer@test.local', 'Trainer#12345', 'مدرّب')
  await auth.setRoles(trainer.userId, ['trainer'])
  trainerCookie = await cookieFor('pl-trainer@test.local', 'Trainer#12345')

  /* مدرّبُ الإنجليزيّة: مدرّبٌ كغيره، ومُنح المراجعةَ بعينها */
  const reviewer = await auth.register('pl-english@test.local', 'English#12345', 'مدرّب الإنجليزيّة')
  await auth.setRoles(reviewer.userId, ['trainer'])
  await prisma.userPermission.create({
    data: { userId: reviewer.userId, permissionKey: 'placement.review', effect: 'grant', reason: 'مدرّبُ الإنجليزيّة يراجع الاختبار' },
  })
  reviewerCookie = await cookieFor('pl-english@test.local', 'English#12345')

  const manager = await auth.register('pl-manager@test.local', 'Manager#12345', 'مدير')
  await auth.setRoles(manager.userId, ['academic_manager'])
  managerCookie = await cookieFor('pl-manager@test.local', 'Manager#12345')
}, 240_000)

describe('١) الاستيرادُ يُنشئ ولا يُحدّث', () => {
  it('أوّلُ استيرادٍ يُنشئ الثلاثين مسوّدة، والثاني لا يمسّ تعديلَ المراجع', async () => {
    await prisma.placementQuestion.deleteMany({})
    expect(await importPlacementDraft(prisma)).toEqual({ created: ALL, kept: 0 })
    expect(await prisma.placementQuestion.count({ where: { subject: 'english', status: 'draft' } })).toBe(items.length)
    /* وفحوصُ المجالات معتمَدةٌ من أوّل استيراد — «تُفتح فورا وتُراجَع بعدُ» */
    expect(await prisma.placementQuestion.count({ where: { subject: { not: 'english' }, status: 'approved' } })).toBe(fieldItems.length)

    await prisma.placementQuestion.update({ where: { id: items[0].id }, data: { stem: 'Edited by reviewer', status: 'approved' } })
    expect(await importPlacementDraft(prisma)).toEqual({ created: 0, kept: ALL })
    const row = await prisma.placementQuestion.findUniqueOrThrow({ where: { id: items[0].id } })
    expect(row.stem).toBe('Edited by reviewer')
    expect(row.status).toBe('approved')

    /* ويُعاد إلى المسوّدة الأصليّة لما بعده */
    await prisma.placementQuestion.deleteMany({})
    await importPlacementDraft(prisma)
  })
})

describe('٢) مغلقٌ ما دامت أسئلتُه مسوّدة', () => {
  it('لا أسئلةَ تُقرأ ولا تصحيح', async () => {
    const bank = await app.inject({ method: 'GET', url: '/api/public/placement/english' })
    expect(bank.statusCode).toBe(200)
    expect(bank.json()).toEqual({ open: false, items: [] })
    const score = await app.inject({ method: 'POST', url: '/api/public/placement/english/score', payload: { answers: {} } })
    expect(score.statusCode).toBe(409)
  })
})

describe('٣) المراجعةُ خلف `placement.review`', () => {
  it('الزائرُ ٤٠١، والمدرّبُ بلا منحٍ ٤٠٣', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/placement/english/review' })).statusCode).toBe(401)
    const r = await app.inject({ method: 'GET', url: '/api/placement/english/review', headers: { cookie: trainerCookie } })
    expect(r.statusCode).toBe(403)
    const d = await app.inject({
      method: 'POST', url: `/api/placement/english/review/${items[0].id}/decide`,
      headers: { cookie: trainerCookie }, payload: { approve: true },
    })
    expect(d.statusCode).toBe(403)
  })

  it('مدرّبُ الإنجليزيّة بالمنح يرى الأجوبةَ ويعدّل — والمديرُ الأكاديميُّ كذلك', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/placement/english/review', headers: { cookie: reviewerCookie } })
    expect(list.statusCode).toBe(200)
    expect(list.json().items).toHaveLength(items.length)
    expect(list.json().items[0]).toHaveProperty('answer_index')
    expect((await app.inject({ method: 'GET', url: '/api/placement/english/review', headers: { cookie: managerCookie } })).statusCode).toBe(200)

    const edit = await app.inject({
      method: 'PATCH', url: `/api/placement/english/review/${items[0].id}`,
      headers: { cookie: reviewerCookie }, payload: { stem: 'She ___ a teacher.' },
    })
    expect(edit.statusCode).toBe(200)
    expect(edit.json().stem).toBe('She ___ a teacher.')
    expect(await prisma.auditEvent.count({ where: { action: 'placement.question.update', entityId: items[0].id } })).toBe(1)
  })

  it('ولا يُقبل خياران بالنصّ نفسِه', async () => {
    const r = await app.inject({
      method: 'PATCH', url: `/api/placement/english/review/${items[1].id}`,
      headers: { cookie: reviewerCookie }, payload: { options: ['a', 'b', 'a', 'c'] },
    })
    expect(r.statusCode).toBe(400)
  })
})

describe('٤) بعد الاعتماد يُفتح — والجوابُ لا يغادر الخادم', () => {
  it('يُعتمَد الكلّ فيُفتح، والمتعلّمُ يرى الأسئلةَ بلا أجوبتها', async () => {
    for (const i of items) {
      const r = await app.inject({
        method: 'POST', url: `/api/placement/english/review/${i.id}/decide`,
        headers: { cookie: reviewerCookie }, payload: { approve: true },
      })
      expect(r.statusCode).toBe(200)
    }
    const bank = await app.inject({ method: 'GET', url: '/api/public/placement/english' })
    expect(bank.json().open).toBe(true)
    expect(bank.json().items).toHaveLength(items.length)
    for (const i of bank.json().items) expect(i).not.toHaveProperty('answer_index')
    expect(await prisma.auditEvent.count({ where: { action: 'placement.question.approve' } })).toBe(items.length)
  })

  it('والتصحيحُ يحدّد المستوى: من أصاب A1 وA2 كلَّها وأخطأ ما فوقها فهو A2', async () => {
    const answers: Record<string, number> = {}
    for (const i of items) {
      const right = i.level === 'A1' || i.level === 'A2'
      answers[i.id] = right ? i.answer_index : (i.answer_index + 1) % 4
    }
    const r = await app.inject({ method: 'POST', url: '/api/public/placement/english/score', payload: { answers } })
    expect(r.statusCode).toBe(200)
    expect(r.json().cefr).toBe('A2')
    expect(r.json().level).toBe('a2')
  })

  it('والمُسقَطُ يخرج من الاختبار', async () => {
    await app.inject({
      method: 'POST', url: `/api/placement/english/review/${items[0].id}/decide`,
      headers: { cookie: managerCookie }, payload: { approve: false, note: 'غامض' },
    })
    const bank = await app.inject({ method: 'GET', url: '/api/public/placement/english' })
    expect(bank.json().items.map((i: { id: string }) => i.id)).not.toContain(items[0].id)
  })

  it('والفخُّ المملوءُ يُردّ', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/public/placement/english/score', payload: { answers: {}, website: 'x' } })
    expect(r.statusCode).toBe(400)
  })
})

describe('٥) فحوصُ المجالات — مفتوحةٌ فورا، وكلُّ موضوعٍ في بنكه', () => {
  const data = fieldItems.filter((i) => i.subject === 'data')

  it('فحصُ تحليل البيانات مفتوحٌ بلا مراجعة، وأسئلتُه وحدَها بلا أجوبتها', async () => {
    const bank = await app.inject({ method: 'GET', url: '/api/public/placement/data' })
    expect(bank.statusCode).toBe(200)
    expect(bank.json().open).toBe(true)
    expect(bank.json().items.map((i: { id: string }) => i.id).sort()).toEqual(data.map((i) => i.id).sort())
    for (const i of bank.json().items) expect(i).not.toHaveProperty('answer_index')
  })

  it('والتصحيحُ يصعد السلّم: من أصاب الأساسيَّ والمتوسّطَ كلَّه وأخطأ المتقدّمَ فهو «متوسّط»', async () => {
    const answers: Record<string, number> = {}
    for (const i of data) answers[i.id] = i.level === 'lead' ? (i.answer_index + 1) % 4 : i.answer_index
    const r = await app.inject({ method: 'POST', url: '/api/public/placement/data/score', payload: { answers } })
    expect(r.statusCode).toBe(200)
    expect(r.json().level).toBe('independent')
    const none = await app.inject({ method: 'POST', url: '/api/public/placement/data/score', payload: { answers: {} } })
    expect(none.json().level).toBe('none')
  })

  it('وموضوعٌ لا اختبارَ له يُردّ، ولا يُعدَّل سؤالُ مجالٍ من رابط موضوعٍ آخر', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/public/placement/finance' })).statusCode).toBe(422)
    const cross = await app.inject({
      method: 'POST', url: `/api/placement/english/review/${data[0].id}/decide`,
      headers: { cookie: reviewerCookie }, payload: { approve: false },
    })
    expect(cross.statusCode).toBe(404)
  })
})

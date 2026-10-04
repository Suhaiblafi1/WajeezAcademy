/* إعلانُ الإدارة إلى المدرّبين — نافذةٌ تُقرأ، ويُعلَم من قرأها (٤ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «أعطهم النصيحةَ وتأكّد أنّهم قرؤوها — ولا تمنع أحدا»، واختار
   نافذةً فيها «قرأتُه» وإشعارا في الجرس وقائمةً بمن قرأ. ويُحرَس هنا:

   ① **الإرسالُ بيد صاحب الحبّة وحدَه** (`staff.notify`) — لا المديرُ الأكاديميُّ ولا
      المدرّب، ولا يصل شيءٌ بنصٍّ ناقص.
   ② **ويصل من يفتح بوّابةَ المدرّب فعلا** — ولا يُكتب من لا تظهر له النافذةُ أبدا
      (ملفٌّ موقوف، أو دورٌ بلا ملفّ، أو حسابٌ موقوف، أو متعلّم)، فيبقى في القائمة
      «لم يقرأ» إلى الأبد. ومعه جرسُه وأثرُ المرسِل.
   ③ **والقائمةُ تفرّق ثلاثة** — رآه، وقرأه، ولم يفتح بوّابتَه — و«قرأتُه» يُسكت
      بندَ الجرس الذي يحمله، ولا يمسّ جرسَ غيره، ولا يتغيّر وقتُه بالتكرار.
   ④ **ولا يقرأ أحدٌ إعلانا لم يُرسَل إليه.**
   ⑤ **والمرسَلُ «للمدرّبين الآن وحدَهم»** لا يُكتب فيه من صار مدرّبا بعده.
   ⑥ **ومن صار مدرّبا بعد إعلانٍ مفتوحٍ للمنضمّين** يُكتب أوّلَ ما يفتح بوّابتَه، ومعه
      جرسٌ واحد — حتّى اليوم الذي اختاره المرسِل، لا بعده. ولا يُكتب من لا بوّابةَ له،
      ولا يُقبل يومٌ مضى ولا أبعدُ من سنة. («اعرضه لمن ينضمّ بعدُ أيضا» — ٤ أكتوبر ٢٠٢٦) */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { addDays } from '../../../src/application/trainer/axis-timeline'
import { zonedDay } from '../../../src/application/trainer/cohort-period'

let prisma: PrismaClient
let auth: AuthService
let app: FastifyInstance

const STAMP = Date.now()
const PASS = 'Annc#12345'
const cookieFor = async (email: string) => `${SESSION_COOKIE}=${(await auth.login(email, PASS)).token}`

interface Person { id: string; email: string; cookie: string }
const people: Record<string, Person> = {}

/** حسابٌ بدوره — ومعه ملفُّ مدرّبٍ إن طُلب، موقوفا أو لا */
async function person(key: string, roles: string[], opts: { profile?: 'active' | 'suspended' } = {}) {
  const email = `annc-${key}-${STAMP}@test.local`
  const { userId } = await auth.register(email, PASS, `مدرّب ${key}`)
  await auth.setRoles(userId, roles)
  if (opts.profile) {
    const appRow = await prisma.trainerApplication.create({
      data: { reference: `WJ-ANNC-${key}-${STAMP}`, email, fullName: `مدرّب ${key}`, status: 'active' },
    })
    await prisma.trainerProfile.create({
      data: { applicationId: appRow.id, userId, suspendedAt: opts.profile === 'suspended' ? new Date() : null },
    })
  }
  people[key] = { id: userId, email, cookie: await cookieFor(email) }
  return people[key]
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  app = await buildApp(prisma)

  await person('super', ['super_admin'])
  await person('academic', ['academic_manager'])
  await person('a', ['trainer'], { profile: 'active' })
  await person('b', ['trainer'], { profile: 'active' })
  await person('susp', ['trainer'], { profile: 'suspended' })
  await person('noprofile', ['trainer'])
  await person('learner', ['learner'])
  /* حسابٌ موقوفٌ بعد أن دخل: ملفُّه سليم، والحسابُ لا يُفتح */
  await person('off', ['trainer'], { profile: 'active' })
  await prisma.user.update({ where: { id: people.off.id }, data: { status: 'suspended' } })
}, 240_000)

const TITLE = 'موعدُ بدء الشُّعب — اقتراحٌ من الإدارة'
const BODY = 'الزملاءُ المدرّبون الكرام،\n\nنقترح أن تبدأ الشُّعبُ في أواخر نوفمبر أو في ديسمبر.'
let announcementId = ''

const post = (who: string, url: string, payload?: unknown) =>
  app.inject({ method: 'POST', url, headers: { cookie: people[who].cookie }, payload: payload as object })
const get = (who: string, url: string) =>
  app.inject({ method: 'GET', url, headers: { cookie: people[who].cookie } })

describe('① الإرسالُ بيد صاحب الحبّة وحدَه', () => {
  it('⚠️ المديرُ الأكاديميُّ والمدرّبُ لا يرسلان ولا يرون القائمة', async () => {
    for (const who of ['academic', 'a']) {
      expect((await post(who, '/api/admin/trainer-announcements', { titleAr: TITLE, bodyAr: BODY })).statusCode, who).toBe(403)
      expect((await get(who, '/api/admin/trainer-announcements')).statusCode, who).toBe(403)
    }
    expect(await prisma.trainerAnnouncement.count({ where: { titleAr: TITLE } }), 'أُرسل بيد من لا يملكه').toBe(0)
  })

  it('ولا يُرسَل بنصٍّ ناقص', async () => {
    expect((await post('super', '/api/admin/trainer-announcements', { titleAr: 'ع', bodyAr: BODY })).statusCode).toBe(422)
    expect((await post('super', '/api/admin/trainer-announcements', { titleAr: TITLE, bodyAr: 'قصير' })).statusCode).toBe(422)
    expect(await prisma.trainerAnnouncement.count({ where: { titleAr: TITLE } })).toBe(0)
  })
})

describe('② ويصل من يفتح بوّابةَ المدرّب فعلا — ومعه جرسُه وأثرُ المرسِل', () => {
  it('⚠️ يُكتب للمدرّبَين النشطَين وحدَهما من هؤلاء', async () => {
    const r = await post('super', '/api/admin/trainer-announcements', { titleAr: TITLE, bodyAr: BODY })
    expect(r.statusCode, r.body).toBe(201)
    announcementId = r.json().id
    const rows = await prisma.trainerAnnouncementRecipient.findMany({ where: { announcementId } })
    const to = new Set(rows.map((x) => x.userId))
    expect(r.json().recipients, 'العددُ المردودُ غيرُ المكتوب').toBe(rows.length)
    expect(to.has(people.a.id) && to.has(people.b.id), 'لم يصل مدرّبا نشطا').toBe(true)
    for (const who of ['susp', 'noprofile', 'off', 'learner', 'super', 'academic']) {
      expect(to.has(people[who].id), `كُتب «${who}» ولن تظهر له النافذةُ أبدا`).toBe(false)
    }
  })

  it('⚠️ وجرسُ بوّابته — بالإعلان نفسِه في بياناته', async () => {
    const bell = await prisma.notification.findMany({
      where: { userId: people.a.id, templateKey: 'trainer.announcement' },
    })
    expect(bell, 'أُرسل ولم يصل جرسَه').toHaveLength(1)
    expect(bell[0]).toMatchObject({ audience: 'trainer', channel: 'in_app', status: 'sent', title: TITLE })
    expect((bell[0].data as { announcementId?: string }).announcementId).toBe(announcementId)
    expect(await prisma.notification.count({
      where: { userId: people.learner.id, templateKey: 'trainer.announcement' },
    }), 'وصل جرسَ متعلّم').toBe(0)
  })

  it('وأثرٌ باسم من أرسله', async () => {
    const log = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.announcement.send', entityId: announcementId },
    })
    expect(log?.actorId).toBe(people.super.id)
  })
})

describe('③ والقائمةُ تفرّق ثلاثة — و«قرأتُه» يُسكت جرسَه وحدَه', () => {
  it('⚠️ يراه المدرّبُ في بوّابته لم يُقرأ', async () => {
    const r = await get('a', '/api/trainer/announcements')
    expect(r.statusCode, r.body).toBe(200)
    const mine = (r.json() as { id: string; readAt: string | null; bodyAr: string }[]).find((x) => x.id === announcementId)
    expect(mine, 'أُرسل إليه ولا يراه في بوّابته').toBeDefined()
    expect(mine!.readAt).toBeNull()
    expect(mine!.bodyAr).toBe(BODY)
  })

  it('⚠️ ظهرت له النافذة: «رآه» — وأوّلُ مرّةٍ وحدَها تُكتب', async () => {
    const first = await post('a', `/api/trainer/announcements/${announcementId}/seen`)
    expect(first.statusCode, first.body).toBe(200)
    const again = await post('a', `/api/trainer/announcements/${announcementId}/seen`)
    expect(again.json().seenAt).toBe(first.json().seenAt)
    const d = (await get('super', `/api/admin/trainer-announcements/${announcementId}`)).json() as {
      recipients: { userId: string; seenAt: string | null; readAt: string | null }[]
    }
    const a = d.recipients.find((x) => x.userId === people.a.id)!
    const b = d.recipients.find((x) => x.userId === people.b.id)!
    expect(a.seenAt).not.toBeNull()
    expect(a.readAt).toBeNull()
    expect(b.seenAt, 'كُتب «رآه» لمن لم يفتح بوّابتَه').toBeNull()
  })

  it('⚠️ «قرأتُه»: يُكتب، ويصير بندُ جرسه مقروءا — ولا يمسّ جرسَ زميله', async () => {
    const r = await post('a', `/api/trainer/announcements/${announcementId}/read`)
    expect(r.statusCode, r.body).toBe(200)
    const row = await prisma.trainerAnnouncementRecipient.findUnique({
      where: { announcementId_userId: { announcementId, userId: people.a.id } },
    })
    expect(row?.readAt).not.toBeNull()
    const bellA = await prisma.notification.findFirst({ where: { userId: people.a.id, templateKey: 'trainer.announcement' } })
    const bellB = await prisma.notification.findFirst({ where: { userId: people.b.id, templateKey: 'trainer.announcement' } })
    expect(bellA?.status, 'قرأه في النافذة وبقي الجرسُ يعدّه').toBe('read')
    expect(bellB?.status, 'قراءةُ واحدٍ أسكتت جرسَ غيره').toBe('sent')
  })

  it('والتكرارُ لا يغيّر وقتَ القراءة الأوّل', async () => {
    const before = await prisma.trainerAnnouncementRecipient.findUnique({
      where: { announcementId_userId: { announcementId, userId: people.a.id } },
    })
    const again = await post('a', `/api/trainer/announcements/${announcementId}/read`)
    expect(new Date(again.json().readAt).getTime()).toBe(before!.readAt!.getTime())
  })

  it('⚠️ وقائمةُ الإدارة: قرأه واحد، ومن لم يقرأ أوّلا', async () => {
    const list = (await get('super', '/api/admin/trainer-announcements')).json() as {
      items: { id: string; read: number; seen: number; total: number }[]
    }
    const item = list.items.find((x) => x.id === announcementId)!
    expect(item.read).toBe(1)
    expect(item.seen, 'من قرأ عُدّ «رآه ولم يؤكّد»').toBe(0)
    const d = (await get('super', `/api/admin/trainer-announcements/${announcementId}`)).json() as {
      recipients: { userId: string; readAt: string | null }[]
    }
    const at = (id: string) => d.recipients.findIndex((x) => x.userId === id)
    expect(at(people.b.id), 'من قرأ قبل من لم يقرأ — والمتابَعُ من لم يقرأ').toBeLessThan(at(people.a.id))
  })
})

describe('④ ولا يقرأ أحدٌ إعلانا لم يُرسَل إليه', () => {
  it('⚠️ مدرّبٌ لم يُرسَل إليه يُردّ — ومتعلّمٌ لا يبلغ الباب', async () => {
    expect((await post('susp', `/api/trainer/announcements/${announcementId}/read`)).statusCode).toBe(404)
    expect((await post('noprofile', `/api/trainer/announcements/${announcementId}/seen`)).statusCode).toBe(404)
    expect((await post('learner', `/api/trainer/announcements/${announcementId}/read`)).statusCode).toBe(403)
    expect(await prisma.trainerAnnouncementRecipient.count({
      where: { announcementId, userId: { in: [people.susp.id, people.noprofile.id] } },
    })).toBe(0)
  })
})

describe('⑤ والمرسَلُ «للمدرّبين الآن وحدَهم» لا يُكتب فيه من صار مدرّبا بعده', () => {
  it('⚠️ مدرّبٌ جديدٌ بعد الإرسال: يُحسب لما يُرسَل غدا، ولا يُكتب فيما أُرسل', async () => {
    const before = (await get('super', '/api/admin/trainer-announcements')).json() as { audience: number }
    await person('late', ['trainer'], { profile: 'active' })
    const after = (await get('super', '/api/admin/trainer-announcements')).json() as { audience: number }
    expect(after.audience).toBe(before.audience + 1)
    const mine = (await get('late', '/api/trainer/announcements')).json() as { id: string }[]
    expect(mine.some((x) => x.id === announcementId)).toBe(false)
  })
})

describe('⑥ ومن صار مدرّبا بعد إعلانٍ مفتوحٍ للمنضمّين — حتّى اليوم الذي اختاره المرسِل', () => {
  const OPEN = 'إعلانٌ مفتوحٌ لمن ينضمّ بعده'
  let openId = ''
  const bells = (who: string) =>
    prisma.notification.count({ where: { userId: people[who].id, templateKey: 'trainer.announcement' } })

  it('⚠️ يُكتب أوّلَ ما يفتح بوّابتَه، ومعه جرسٌ واحد — وما أُرسل «للآن وحدَهم» لا يصله', async () => {
    const r = await post('super', '/api/admin/trainer-announcements', {
      titleAr: OPEN, bodyAr: BODY, lateJoinersUntil: addDays(zonedDay(new Date()), 10),
    })
    expect(r.statusCode, r.body).toBe(201)
    openId = r.json().id
    await person('late2', ['trainer'], { profile: 'active' })
    const ids = ((await get('late2', '/api/trainer/announcements')).json() as { id: string }[]).map((x) => x.id)
    expect(ids, 'انضمّ في المدّة ولم يصله').toContain(openId)
    expect(ids, 'وصله ما أُرسل للمدرّبين يومَها وحدَهم').not.toContain(announcementId)
    expect(await bells('late2'), 'كُتب ولم يصل جرسَه').toBe(1)
    await get('late2', '/api/trainer/announcements')
    expect(await bells('late2'), 'جرسٌ ثانٍ بفتح البوّابة ثانية').toBe(1)
    const d = (await get('super', `/api/admin/trainer-announcements/${openId}`)).json() as { recipients: { userId: string }[] }
    expect(d.recipients.some((x) => x.userId === people.late2.id), 'لا يظهر في قائمة الإدارة').toBe(true)
  })

  it('⚠️ ومن لا بوّابةَ له لا يُكتب ولو طرق الباب', async () => {
    await get('noprofile', '/api/trainer/announcements')
    expect(await prisma.trainerAnnouncementRecipient.count({
      where: { announcementId: openId, userId: people.noprofile.id },
    })).toBe(0)
  })

  it('⚠️ وبعد انقضاء اليوم لا يُكتب أحدٌ جديد', async () => {
    await prisma.trainerAnnouncement.update({ where: { id: openId }, data: { lateJoinersUntil: new Date(Date.now() - 60_000) } })
    await person('late3', ['trainer'], { profile: 'active' })
    const ids = ((await get('late3', '/api/trainer/announcements')).json() as { id: string }[]).map((x) => x.id)
    expect(ids, 'انقضت المدّةُ ووصله').not.toContain(openId)
  })

  it('ولا يُقبل يومٌ مضى، ولا أبعدُ من سنة، ولا يومٌ لا وجودَ له', async () => {
    const today = zonedDay(new Date())
    for (const day of [addDays(today, -1), addDays(today, 400), '2026-13-40']) {
      const r = await post('super', '/api/admin/trainer-announcements', { titleAr: 'إعلانٌ بيومٍ خطأ', bodyAr: BODY, lateJoinersUntil: day })
      expect(r.statusCode, day).toBe(422)
    }
    expect(await prisma.trainerAnnouncement.count({ where: { titleAr: 'إعلانٌ بيومٍ خطأ' } })).toBe(0)
  })
})

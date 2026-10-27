/* طلبُ الانضمام مستشارا — من النموذج إلى حسابٍ مفعَّلٍ في خطوةٍ واحدة (٢٧ أكتوبر ٢٠٢٦، المرحلة السابعة).

   قراراتُ صاحب المنصّة: لا اتّفاقيّة («b») — يُقبَل بنسبته فيُفعَّل؛ والنموذجُ يسأل عن الوصول الرقميّ («A» مع
   المتابعين)؛ والنسبةُ تُقترح ٥٪. وهنا على قاعدةٍ حقيقيّةٍ وبالمسارات نفسِها:

   ① النموذجُ العامّ يحفظ الطلبَ برقمه ووصولِه مجموعا، ويصل صاحبَه بريدُ استلامٍ بالشروط، ويصل من يقرّر جرسُه.
      وحقلُ الفخّ، والشروطُ غيرُ المقبولة، ورابطُ `javascript:` — كلُّها تُردّ. وعشرةٌ في ربع ساعةٍ من عنوانٍ واحدٍ سقفُه.
   ② ولا طلبان قائمان لبريدٍ واحد، ولا طلبٌ ممّن هو مستشار.
   ③ والقبولُ لحسابٍ جديد: دورُ مستشارٍ وحدَه، ونسبتُه بأثرها، ودعوةُ تفعيل — ولا يُحسم الطلبُ مرّتين. وما سقط بعد
      الحسم يردّه قيدَ المراجعة، والقبولُ الثاني يدعو الحسابَ الذي لم يُفعَّل.
   ④ ولحسابٍ قائم: يُضاف الدورُ ولا يُنزع غيرُه، وبريدُه يدلّه على بوّابته. والمؤرشَفُ لا يُقبَل من هنا.
   ⑤ والاعتذارُ يحسم الطلبَ ويصله سببُه إن كُتب.
   ⑥ والطابورُ وقرارُه لحبّة `advisor.manage` وحدَها، و«ما ينتظرك» يعدّ القائم منه. */

import { beforeAll, beforeEach, describe, expect as vexpect, it, vi } from 'vitest'
import { plainExpect } from '../helpers/plain-expect'
const expect = plainExpect(vexpect)
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'

const outbox = vi.hoisted(() => [] as { to: string; subject: string; text: string }[])
vi.mock('../../services/notification.service', async (orig) => {
  const real = await orig<typeof import('../../services/notification.service')>()
  return {
    ...real,
    sendDirectEmail: async (_p: unknown, input: { to: string; subject: string; text: string }) => {
      outbox.push({ to: input.to, subject: input.subject, text: input.text })
      return { status: 'sent' as const }
    },
  }
})

import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { StaffInboxService } from '../../services/staff-inbox.service'
import { ADVISOR_TERMS_AR } from '../../../src/application/advisor/application'

let prisma: PrismaClient
let app: FastifyInstance
let auth: AuthService
let bossCookie = ''
let bossId = ''
let financeCookie = ''
const STAMP = Date.now()
let seq = 0

const form = (over: Record<string, unknown> = {}) => {
  seq += 1
  return {
    fullName: `متقدم ${seq}`,
    email: `adv-${seq}-${STAMP}@Test.Local`,
    phoneCountryCode: '+962', phone: '791234567', country: 'الأردن',
    employment: 'freelance', experienceYears: '3-5', experienceAr: 'أرشد طلاب الجامعة إلى دورات مهنية منذ ٣ سنوات',
    hoursPerWeek: '10-20', audiences: ['university_students', 'social_audience'],
    accounts: [
      { platform: 'instagram', url: 'instagram.com/adv' + seq, followers: 30000 },
      { platform: 'tiktok', url: 'https://www.tiktok.com/@adv' + seq, followers: 12000 },
    ],
    communities: [{ kind: 'whatsapp', name: 'طلاب الهندسة', members: 900 }],
    promotedBefore: true, promotedAr: 'روجت لدورة برمجة فسجل منها ٤٠ طالبا',
    motivationAr: 'أريد أن أوصل طلابي إلى مسارات تفيدهم فعلا، ووجيز تقيس فجواتهم قبل أن تقترح عليهم.',
    termsAccepted: true,
    ...over,
  }
}
/* ولكلّ طلبٍ عنوانُه: السقفُ عشرةٌ لكلّ عنوانٍ في ربع ساعة، وله اختبارُه وحدَه */
let address = 0
const submit = (body: Record<string, unknown>, remoteAddress = `10.7.${(address += 1)}.1`) =>
  app.inject({ method: 'POST', url: '/api/v1/advisor-applications', payload: body, remoteAddress })
const approve = (id: string, commissionPct: number, cookie = bossCookie) =>
  app.inject({ method: 'POST', url: `/api/admin/advisor-applications/${id}/approve`, headers: { cookie }, payload: { commissionPct } })
const reject = (id: string, noteAr?: string, cookie = bossCookie) =>
  app.inject({ method: 'POST', url: `/api/admin/advisor-applications/${id}/reject`, headers: { cookie }, payload: noteAr ? { noteAr } : {} })
const rowOf = (reference: string) => prisma.advisorApplication.findUniqueOrThrow({ where: { reference } })
const mailsTo = (email: string) => outbox.filter((m) => m.to === email.toLowerCase())

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  await app.ready()
  auth = new AuthService(prisma)
  const sessionFor = async (email: string, role: string) => {
    const u = await auth.register(email, 'Advisors#12345', role)
    await auth.setRoles(u.userId, [role])
    const { token } = await auth.login(email, 'Advisors#12345')
    return { cookie: `${SESSION_COOKIE}=${token}`, userId: u.userId }
  }
  const boss = await sessionFor(`adv-boss-${STAMP}@test.local`, 'super_admin')
  bossCookie = boss.cookie
  bossId = boss.userId
  financeCookie = (await sessionFor(`adv-finance-${STAMP}@test.local`, 'finance')).cookie
}, 240_000)

beforeEach(() => { outbox.length = 0 })

describe('① النموذج العام', () => {
  it('⚠️ يحفظ الطلب برقمه ووصوله مجموعا — ويصل صاحبه بريد بالشروط، ومن يقرر جرسه', async () => {
    const body = form()
    const res = await submit(body)
    vexpect(res.statusCode, res.body).toBe(201)
    const { reference } = res.json() as { reference: string }
    expect(reference).toMatch(new RegExp(`^WJ-AD-${new Date().getFullYear()}-\\d{4}$`))

    const row = await rowOf(reference)
    expect(row.email, 'البريد يحفظ بحروف صغيرة').toBe(String(body.email).toLowerCase())
    expect(row.reachTotal, 'المتابعون والأعضاء مجموعا').toBe(30000 + 12000 + 900)
    expect(row.status).toBe('submitted')
    expect(row.termsAcceptedAt).not.toBeNull()
    expect((row.accounts as { url: string }[])[0]!.url, 'الرابط بلا https يكمل').toBe(`https://instagram.com/adv${seq}`)

    const [mail] = mailsTo(row.email)
    expect(mail!.subject).toContain(reference)
    for (const term of ADVISOR_TERMS_AR) expect(mail!.text).toContain(term)

    const bell = await prisma.notification.findFirst({
      where: { userId: bossId, templateKey: 'admin.advisor_application' }, orderBy: { queuedAt: 'desc' },
    })
    expect(bell?.body).toContain(reference)
  })

  it('⚠️ وحقل الفخ والشروط غير المقبولة ورابط javascript ترد — ولا يحفظ شيء', async () => {
    const before = await prisma.advisorApplication.count()
    vexpect((await submit({ ...form(), website: 'https://spam.example' })).statusCode).toBe(400)
    vexpect((await submit(form({ termsAccepted: false }))).statusCode).toBe(422)
    vexpect((await submit(form({ accounts: [{ platform: 'x', url: 'javascript:alert(1)', followers: 5 }] }))).statusCode).toBe(422)
    vexpect(await prisma.advisorApplication.count()).toBe(before)
  })

  it('⚠️ وعشرة في ربع ساعة من عنوان واحد سقفه — والحادي عشر يرد', async () => {
    const codes: number[] = []
    for (let i = 0; i < 11; i += 1) codes.push((await submit(form(), '10.99.99.99')).statusCode)
    vexpect(codes.slice(0, 10).every((c) => c === 201), codes.join(',')).toBe(true)
    vexpect(codes[10]).toBe(429)
  })
})

describe('② لا طلبان قائمان لبريد واحد', () => {
  it('⚠️ الثاني يرد برقم الأول — ولو بحروف كبيرة', async () => {
    const body = form()
    const first = (await submit(body)).json() as { reference: string }
    const again = await submit({ ...form(), email: String(body.email).toUpperCase() })
    vexpect(again.statusCode).toBe(409)
    expect(again.body).toContain(first.reference)
  })

  it('ومن هو مستشار بالفعل لا يقدم', async () => {
    const email = `adv-already-${STAMP}@test.local`
    const u = await auth.register(email, 'Advisors#12345', 'مستشار قائم')
    await auth.setRoles(u.userId, ['advisor'])
    vexpect((await submit(form({ email }))).statusCode).toBe(409)
  })
})

describe('③ القبول لحساب جديد — خطوة واحدة', () => {
  it('⚠️ دور مستشار وحده، ونسبته بأثرها، ودعوة تفعيل — ولا يحسم مرتين', async () => {
    const { reference } = (await submit(form())).json() as { reference: string }
    const app0 = await rowOf(reference)
    outbox.length = 0

    const res = await approve(app0.id, 5)
    vexpect(res.statusCode, res.body).toBe(200)
    const out = res.json() as { userId: string; newAccount: boolean }
    vexpect(out.newAccount).toBe(true)

    const user = await prisma.user.findUniqueOrThrow({ where: { id: out.userId }, include: { roles: true, advisorProfile: true } })
    vexpect(user.email).toBe(app0.email)
    vexpect(user.status, 'حساب لم يدخله صاحبه بعد').toBe('invited')
    vexpect(user.roles.map((r) => r.roleId)).toEqual(['advisor'])
    vexpect(Number(user.advisorProfile?.commissionPct)).toBe(5)

    const decided = await rowOf(reference)
    vexpect(decided.status).toBe('approved')
    vexpect(decided.userId).toBe(out.userId)
    vexpect(decided.decidedBy).toBe(bossId)
    vexpect(Number(decided.commissionPct)).toBe(5)

    const audits = await prisma.auditEvent.findMany({ where: { OR: [{ entityId: app0.id }, { entityId: out.userId }] } })
    vexpect(audits.map((a) => a.action).sort()).toEqual(['advisor.application.approve', 'advisor.commission.set'])
    vexpect(audits.every((a) => a.actorId === bossId)).toBe(true)

    const [mail] = mailsTo(app0.email)
    expect(mail!.text).toContain('/auth/reset?token=')
    expect(mail!.text).toContain('٥٪')

    vexpect((await approve(app0.id, 7)).statusCode, 'قبل مرتين').toBe(409)
    vexpect((await reject(app0.id)).statusCode, 'اعتذر عن مقبول').toBe(409)
  })

  it('⚠️ وما سقط بعد الحسم يرده قيد المراجعة — والقبول الثاني يدعو الحساب الذي لم يفعل', async () => {
    const { reference } = (await submit(form())).json() as { reference: string }
    const row = await rowOf(reference)
    const fail = vi.spyOn(AuthService.prototype, 'issueInvite').mockRejectedValueOnce(new Error('انقطع الاتصال'))
    vexpect((await approve(row.id, 5)).statusCode).toBe(500)
    fail.mockRestore()
    const back = await rowOf(reference)
    vexpect(back.status, 'بقي مقبولا بلا دعوة ولا بريد').toBe('submitted')
    vexpect(back.decidedBy).toBeNull()

    outbox.length = 0
    const res = await approve(row.id, 5)
    vexpect(res.statusCode, res.body).toBe(200)
    const [mail] = mailsTo(row.email)
    expect(mail!.text, 'دل على بوابة لا كلمة له يدخلها بها').toContain('/auth/reset?token=')
    vexpect((await rowOf(reference)).status).toBe('approved')
  })
})

describe('④ القبول لحساب قائم', () => {
  it('⚠️ يضاف الدور ولا ينزع غيره — وبريده يدله على بوابته بلا دعوة', async () => {
    const email = `adv-learner-${STAMP}@test.local`
    const learner = await auth.register(email, 'Advisors#12345', 'متعلم يتقدم')
    const { reference } = (await submit(form({ email }))).json() as { reference: string }
    outbox.length = 0

    const res = await approve((await rowOf(reference)).id, 7.5)
    vexpect(res.statusCode, res.body).toBe(200)
    const out = res.json() as { userId: string; newAccount: boolean }
    vexpect(out).toMatchObject({ userId: learner.userId, newAccount: false })
    const roles = (await prisma.userRole.findMany({ where: { userId: learner.userId } })).map((r) => r.roleId).sort()
    vexpect(roles).toEqual(['advisor', 'learner'])
    const [mail] = mailsTo(email)
    expect(mail!.text).toContain('/advisor')
    expect(mail!.text).not.toContain('/auth/reset')
  })

  it('والمؤرشف لا يقبل من هنا — ويبقى الطلب قائما', async () => {
    const email = `adv-archived-${STAMP}@test.local`
    const u = await auth.register(email, 'Advisors#12345', 'حساب مؤرشف')
    const { reference } = (await submit(form({ email }))).json() as { reference: string }
    await prisma.user.update({ where: { id: u.userId }, data: { status: 'archived' } })
    vexpect((await approve((await rowOf(reference)).id, 5)).statusCode).toBe(409)
    vexpect((await rowOf(reference)).status).toBe('submitted')
  })
})

describe('⑤ الاعتذار', () => {
  it('⚠️ يحسم الطلب ويصله سببه', async () => {
    const { reference } = (await submit(form())).json() as { reference: string }
    const row = await rowOf(reference)
    outbox.length = 0
    vexpect((await reject(row.id, 'نبحث الآن عن مستشارين في السعودية')).statusCode).toBe(200)
    const decided = await rowOf(reference)
    vexpect(decided.status).toBe('rejected')
    vexpect(decided.decisionNoteAr).toBe('نبحث الآن عن مستشارين في السعودية')
    expect(mailsTo(row.email)[0]!.text).toContain('نبحث الآن عن مستشارين في السعودية')
    vexpect(await prisma.auditEvent.count({ where: { entityId: row.id, action: 'advisor.application.reject' } })).toBe(1)
    vexpect(await prisma.user.count({ where: { email: row.email } }), 'أنشئ حساب لمن اعتذرنا له').toBe(0)
  })
})

describe('⑥ لمن يملك القرار', () => {
  it('⚠️ الطابور والقبول والاعتذار لحبة advisor.manage وحدها', async () => {
    const { reference } = (await submit(form())).json() as { reference: string }
    const id = (await rowOf(reference)).id
    vexpect((await app.inject({ method: 'GET', url: '/api/admin/advisor-applications', headers: { cookie: financeCookie } })).statusCode).toBe(403)
    vexpect((await approve(id, 5, financeCookie)).statusCode).toBe(403)
    vexpect((await reject(id, undefined, financeCookie)).statusCode).toBe(403)
    const list = await app.inject({ method: 'GET', url: '/api/admin/advisor-applications', headers: { cookie: bossCookie } })
    vexpect(list.statusCode).toBe(200)
    const rows = list.json() as { reference: string; reachTotal: number; accounts: unknown[] }[]
    vexpect(rows.find((r) => r.reference === reference)).toMatchObject({ reachTotal: 42900 })
  })

  it('⚠️ و«ما ينتظرك» يعد القائم منها لمن يملكها', async () => {
    const inbox = new StaffInboxService(prisma)
    const waiting = await prisma.advisorApplication.count({ where: { status: 'submitted' } })
    const item = (await inbox.forStaff(bossId, ['advisor.manage'])).find((i) => i.key === 'advisor_applications')
    vexpect(item?.count).toBe(waiting)
    vexpect(item?.href).toBe('/admin/advisor-applications')
    vexpect((await inbox.forStaff(bossId, ['finance.view'])).map((i) => i.key)).not.toContain('advisor_applications')
  })
})

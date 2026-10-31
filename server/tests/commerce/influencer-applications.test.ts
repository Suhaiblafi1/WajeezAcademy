/* «انضم كمؤثر» — من صفحة الاتّفاق إلى كودٍ وحسابٍ مدعوٍّ في خطوةٍ واحدة (٣١ أكتوبر ٢٠٢٦).

   طلبُ صاحب المنصّة: «جهّز رابطا لاتّفاقيّة المؤثّر… ومنها يتقدّم، فيظهر في قائمة المتقدّمين باسمه وبريده وحسابٍ
   ينتظر تفعيلي». والعلّةُ في `influencer-application.service.ts`. وهنا على قاعدةٍ حقيقيّةٍ وبالمسارات نفسِها:

   ① أرقامُ الاتّفاق من إعدادات منحة المؤثّرين حيّة — تتغيّر النسبةُ فيتغيّر ما تقوله الصفحة.
   ② والطلبُ يُحفظ برقمه ووصولِه وبالشروط التي قبلها بأرقام يومها، ويصله بريدُ استلامٍ بها، ويصل من يقرّر جرسُه.
      وحقلُ الفخّ، والشروطُ غيرُ المقبولة، وبلا حساب، ورابطُ `javascript:` — تُردّ. وعشرةٌ في ربع ساعةٍ سقفُه.
   ③ ولا طلبان قائمان لبريدٍ واحد، ولا طلبٌ ممّن له ملفُّ مؤثّر.
   ④ والقبولُ: مؤثّرٌ بكوده المطبَّع وعمولته، وحسابٌ مدعوٌّ بدور المؤثّر ودعوةُ تفعيل، والطلبُ مقبولٌ بأثره — ولا يُحسم
      مرّتين، ولا بكودٍ مأخوذ. وما سقط بعد الحسم يردّه قيدَ المراجعة بلا مؤثّرٍ معلَّق، فيُقبَل ثانيةً بالكود نفسِه.
   ⑤ والاعتذارُ يحسم الطلبَ ويصله سببُه، ولا حساب.
   ⑥ والطابورُ وقرارُه لحبّة `commerce.manage` وحدَها، الأوسعُ وصولا أوّلا، و«ما ينتظرك» يعدّ القائم.
   ⑦ والدفعةُ الزائدةُ على رصيده تُردّ بخيارَيها، وتُسجَّل سلفةً بـ`advance` — في الأثر وفي بريده. */

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
import { GrantService } from '../../services/grant.service'
import { InfluencerService } from '../../services/influencer.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { StaffInboxService } from '../../services/staff-inbox.service'
import { INFLUENCER_GRANT_SLUG } from '../../../src/application/commerce/grant'
import { INFLUENCER_COMMISSION_DEFAULT } from '../../../src/application/commerce/influencer'
import { influencerTermsAr } from '../../../src/application/commerce/influencer-application'

let prisma: PrismaClient
let app: FastifyInstance
let auth: AuthService
let bossCookie = ''
let bossId = ''
let supportCookie = ''
const STAMP = Date.now()
let seq = 0

const form = (over: Record<string, unknown> = {}) => {
  seq += 1
  return {
    fullName: `مؤثرة ${seq}`,
    email: `infapp-${seq}-${STAMP}@Test.Local`,
    phoneCountryCode: '+962', phone: '791234567',
    accounts: [
      { platform: 'instagram', url: 'instagram.com/inf' + seq, followers: 30000 },
      { platform: 'tiktok', url: 'https://www.tiktok.com/@inf' + seq, followers: 12000 },
    ],
    pitchAr: 'قصص أسبوعية عن التعلم ومنشور مع كل فصل جديد',
    termsAccepted: true,
    ...over,
  }
}
let address = 0
const submit = (body: Record<string, unknown>, remoteAddress = `10.8.${(address += 1)}.1`) =>
  app.inject({ method: 'POST', url: '/api/v1/influencer-applications', payload: body, remoteAddress })
const approve = (id: string, code: string, commissionPercent = INFLUENCER_COMMISSION_DEFAULT, cookie = bossCookie) =>
  app.inject({ method: 'POST', url: `/api/admin/influencer-applications/${id}/approve`, headers: { cookie }, payload: { code, commissionPercent } })
const reject = (id: string, noteAr?: string, cookie = bossCookie) =>
  app.inject({ method: 'POST', url: `/api/admin/influencer-applications/${id}/reject`, headers: { cookie }, payload: noteAr ? { noteAr } : {} })
const rowOf = (reference: string) => prisma.influencerApplication.findUniqueOrThrow({ where: { reference } })
const mailsTo = (email: string) => outbox.filter((m) => m.to === email.toLowerCase())

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  app = await buildApp(prisma)
  await app.ready()
  auth = new AuthService(prisma)
  const sessionFor = async (email: string, role: string) => {
    const u = await auth.register(email, 'Influence#12345', role)
    await auth.setRoles(u.userId, [role])
    const { token } = await auth.login(email, 'Influence#12345')
    return { cookie: `${SESSION_COOKIE}=${token}`, userId: u.userId }
  }
  const boss = await sessionFor(`infapp-boss-${STAMP}@test.local`, 'super_admin')
  bossCookie = boss.cookie
  bossId = boss.userId
  /* موظّفٌ بلا `commerce.manage` — الدعمُ يرى المنصّةَ ولا يملك المؤثّرين */
  supportCookie = (await sessionFor(`infapp-support-${STAMP}@test.local`, 'support')).cookie
}, 240_000)

beforeEach(() => { outbox.length = 0 })

describe('① أرقام الاتفاق حية', () => {
  it('⚠️ من إعدادات منحة المؤثرين والعمولة المقترحة — وتغيير النسبة يغير ما تقوله الصفحة', async () => {
    const grant = new GrantService(prisma, INFLUENCER_GRANT_SLUG)
    const s = await grant.settings()
    const first = (await app.inject({ method: 'GET', url: '/api/v1/influencer-applications/deal' })).json()
    vexpect(first).toMatchObject({ percentOff: s.percentOff, maxCourses: s.maxCourses, commissionPercent: INFLUENCER_COMMISSION_DEFAULT })
    await grant.update({ percentOff: 40, maxCourses: 3 }, bossId)
    const after = (await app.inject({ method: 'GET', url: '/api/v1/influencer-applications/deal' })).json()
    vexpect(after).toMatchObject({ percentOff: 40, maxCourses: 3 })
    await grant.update({ percentOff: s.percentOff, maxCourses: s.maxCourses }, bossId)
  })
})

describe('② الطلب', () => {
  it('⚠️ يحفظ برقمه ووصوله والشروط بأرقام يومها — ويصله بريد بها، ومن يقرر جرسه', async () => {
    const body = form()
    const res = await submit(body)
    vexpect(res.statusCode, res.body).toBe(201)
    const { reference } = res.json() as { reference: string }
    expect(reference).toMatch(new RegExp(`^WJ-IN-${new Date().getFullYear()}-\\d{4}$`))

    const row = await rowOf(reference)
    expect(row.email, 'البريد يحفظ بحروف صغيرة').toBe(String(body.email).toLowerCase())
    vexpect(row.reachTotal, 'المتابعون مجموعا').toBe(42000)
    vexpect(row.status).toBe('submitted')
    vexpect(row.termsAcceptedAt).not.toBeNull()
    expect((row.accounts as { url: string }[])[0]!.url, 'الرابط بلا https يكمل').toBe(`https://instagram.com/inf${seq}`)
    const s = await new GrantService(prisma, INFLUENCER_GRANT_SLUG).settings()
    const terms = influencerTermsAr({ percentOff: s.percentOff, maxCourses: s.maxCourses, commissionPercent: INFLUENCER_COMMISSION_DEFAULT })
    vexpect(row.termsAr, 'الشروط التي قبلها بنصها').toEqual(terms)

    const [mail] = mailsTo(row.email)
    expect(mail!.subject).toContain(reference)
    for (const term of terms) expect(mail!.text).toContain(term)

    const bell = await prisma.notification.findFirst({
      where: { userId: bossId, templateKey: 'admin.influencer_application' }, orderBy: { queuedAt: 'desc' },
    })
    expect(bell?.body).toContain(reference)
  })

  it('⚠️ وحقل الفخ والشروط غير المقبولة وبلا حساب ورابط javascript ترد — ولا يحفظ شيء', async () => {
    const before = await prisma.influencerApplication.count()
    vexpect((await submit({ ...form(), website: 'https://spam.example' })).statusCode).toBe(400)
    vexpect((await submit(form({ termsAccepted: false }))).statusCode).toBe(422)
    vexpect((await submit(form({ accounts: [] }))).statusCode).toBe(422)
    vexpect((await submit(form({ accounts: [{ platform: 'x', url: 'javascript:alert(1)', followers: 5 }] }))).statusCode).toBe(422)
    vexpect(await prisma.influencerApplication.count()).toBe(before)
  })

  it('⚠️ وعشرة في ربع ساعة من عنوان واحد سقفه — والحادي عشر يرد', async () => {
    const codes: number[] = []
    for (let i = 0; i < 11; i += 1) codes.push((await submit(form(), '10.98.98.98')).statusCode)
    vexpect(codes.slice(0, 10).every((c) => c === 201), codes.join(',')).toBe(true)
    vexpect(codes[10]).toBe(429)
  })
})

describe('③ لا طلبان قائمان لبريد واحد', () => {
  it('⚠️ الثاني يرد برقم الأول — ولو بحروف كبيرة', async () => {
    const body = form()
    const first = (await submit(body)).json() as { reference: string }
    const again = await submit({ ...form(), email: String(body.email).toUpperCase() })
    vexpect(again.statusCode).toBe(409)
    expect(again.body).toContain(first.reference)
  })

  it('ومن له ملف مؤثر لا يقدم', async () => {
    const email = `infapp-already-${STAMP}@test.local`
    const svc = new InfluencerService(prisma)
    await svc.create({ nameAr: 'مؤثر قائم', code: `HAS${STAMP % 100000}`, commissionPercent: 15, email }, bossId)
    vexpect((await submit(form({ email }))).statusCode).toBe(409)
  })
})

describe('④ القبول — خطوة واحدة', () => {
  it('⚠️ مؤثر بكوده المطبع وعمولته، وحساب مدعو بدور المؤثر ودعوة — ولا يحسم مرتين', async () => {
    const { reference } = (await submit(form())).json() as { reference: string }
    const row = await rowOf(reference)
    outbox.length = 0
    const code = `ap${seq}x`

    const res = await approve(row.id, ` ${code} `, 18)
    vexpect(res.statusCode, res.body).toBe(200)
    const out = res.json() as { influencerId: string; userId: string; newAccount: boolean }
    vexpect(out.newAccount).toBe(true)

    const inf = await prisma.influencer.findUniqueOrThrow({ where: { id: out.influencerId } })
    vexpect(inf).toMatchObject({ code: code.toUpperCase(), commissionPercent: 18, nameAr: row.fullName, userId: out.userId, active: true })
    const user = await prisma.user.findUniqueOrThrow({ where: { id: out.userId }, include: { roles: true } })
    vexpect(user.email).toBe(row.email)
    vexpect(user.status, 'حساب ينتظر تفعيله').toBe('invited')
    vexpect(user.roles.map((r) => r.roleId)).toContain('influencer')
    vexpect(await prisma.passwordResetToken.count({ where: { userId: user.id, purpose: 'invite', usedAt: null } })).toBe(1)

    const decided = await rowOf(reference)
    vexpect(decided).toMatchObject({ status: 'approved', influencerId: out.influencerId, decidedBy: bossId })
    vexpect(await prisma.auditEvent.count({ where: { entityId: row.id, action: 'influencer.application.approve', actorId: bossId } })).toBe(1)

    const mails = mailsTo(row.email)
    vexpect(mails.some((m) => m.text.includes('/auth/reset?token=')), 'لم تصله دعوة التفعيل').toBe(true)
    const welcome = mails.find((m) => m.subject.includes('قبلناك'))
    expect(welcome?.text).toContain(code.toUpperCase())
    expect(welcome?.text).toContain(`/grant/i/${code.toUpperCase()}`)
    expect(welcome?.text).toContain('عمولتك 18%')

    vexpect((await approve(row.id, 'OTHER1')).statusCode, 'قبل مرتين').toBe(409)
    vexpect((await reject(row.id)).statusCode, 'اعتذر عن مقبول').toBe(409)
  })

  it('⚠️ ولا يقبل بكود مأخوذ أو لا يصلح — ويبقى الطلب قائما', async () => {
    const taken = `TK${STAMP % 100000}`
    await new InfluencerService(prisma).create({ nameAr: 'صاحب الكود', code: taken, commissionPercent: 15 }, bossId)
    const { reference } = (await submit(form())).json() as { reference: string }
    const row = await rowOf(reference)
    vexpect((await approve(row.id, taken.toLowerCase())).statusCode).toBe(409)
    vexpect((await approve(row.id, 'a b!')).statusCode).toBe(400)
    vexpect((await rowOf(reference)).status).toBe('submitted')
  })

  it('⚠️ وما سقط بعد الحسم يرده قيد المراجعة بلا مؤثر معلق — ويقبل ثانية بالكود نفسه', async () => {
    const { reference } = (await submit(form())).json() as { reference: string }
    const row = await rowOf(reference)
    const code = `RETRY${seq}`
    const fail = vi.spyOn(AuthService.prototype, 'issueInvite').mockRejectedValueOnce(new Error('انقطع الاتصال'))
    vexpect((await approve(row.id, code)).statusCode).toBe(500)
    fail.mockRestore()
    const back = await rowOf(reference)
    vexpect(back.status, 'بقي مقبولا بلا دعوة').toBe('submitted')
    vexpect(back.influencerId).toBeNull()
    vexpect(await prisma.influencer.count({ where: { code } }), 'بقي مؤثر بكود بلا طلب').toBe(0)

    outbox.length = 0
    const res = await approve(row.id, code)
    vexpect(res.statusCode, res.body).toBe(200)
    vexpect(mailsTo(row.email).some((m) => m.text.includes('/auth/reset?token=')), 'لم يدع الحساب الذي لم يفعل').toBe(true)
    vexpect((await rowOf(reference)).status).toBe('approved')
  })

  it('ولحساب قائم: يضاف الدور ولا ينزع غيره — وبريده يدله على صفحته', async () => {
    const email = `infapp-learner-${STAMP}@test.local`
    const learner = await auth.register(email, 'Influence#12345', 'متعلمة تتقدم')
    const { reference } = (await submit(form({ email }))).json() as { reference: string }
    outbox.length = 0
    const res = await approve((await rowOf(reference)).id, `LRN${seq}`)
    vexpect(res.statusCode, res.body).toBe(200)
    vexpect(res.json()).toMatchObject({ userId: learner.userId, newAccount: false })
    const roles = (await prisma.userRole.findMany({ where: { userId: learner.userId } })).map((r) => r.roleId).sort()
    vexpect(roles).toEqual(['influencer', 'learner'])
    const welcome = mailsTo(email).find((m) => m.subject.includes('قبلناك'))
    expect(welcome?.text).toContain('/influencer')
    expect(welcome?.text).not.toContain('/auth/reset')
  })
})

describe('⑤ الاعتذار', () => {
  it('⚠️ يحسم الطلب ويصله سببه — ولا حساب', async () => {
    const { reference } = (await submit(form())).json() as { reference: string }
    const row = await rowOf(reference)
    outbox.length = 0
    vexpect((await reject(row.id, 'نبحث الآن عن جمهور في الأردن')).statusCode).toBe(200)
    const decided = await rowOf(reference)
    vexpect(decided.status).toBe('rejected')
    vexpect(decided.decisionNoteAr).toBe('نبحث الآن عن جمهور في الأردن')
    expect(mailsTo(row.email)[0]!.text).toContain('نبحث الآن عن جمهور في الأردن')
    vexpect(await prisma.auditEvent.count({ where: { entityId: row.id, action: 'influencer.application.reject' } })).toBe(1)
    vexpect(await prisma.user.count({ where: { email: row.email } }), 'أنشئ حساب لمن اعتذرنا له').toBe(0)
  })
})

describe('⑥ لمن يملك القرار', () => {
  it('⚠️ الطابور والقبول والاعتذار لحبة commerce.manage وحدها — والأوسع وصولا أولا', async () => {
    const small = (await submit(form({ accounts: [{ platform: 'x', url: 'x.com/small' + seq, followers: 10 }] }))).json() as { reference: string }
    const big = (await submit(form({ accounts: [{ platform: 'youtube', url: 'youtube.com/@big' + seq, followers: 900_000_000 }] }))).json() as { reference: string }
    const id = (await rowOf(small.reference)).id
    vexpect((await app.inject({ method: 'GET', url: '/api/admin/influencer-applications', headers: { cookie: supportCookie } })).statusCode).toBe(403)
    vexpect((await approve(id, 'NOPE', 15, supportCookie)).statusCode).toBe(403)
    vexpect((await reject(id, undefined, supportCookie)).statusCode).toBe(403)
    const list = await app.inject({ method: 'GET', url: '/api/admin/influencer-applications', headers: { cookie: bossCookie } })
    vexpect(list.statusCode).toBe(200)
    const rows = list.json() as { reference: string; email: string; fullName: string; accounts: unknown[] }[]
    vexpect(rows[0]!.reference, 'الأوسع وصولا ليس أولا').toBe(big.reference)
    vexpect(rows.find((r) => r.reference === small.reference)).toMatchObject({ accounts: [{ followers: 10 }] })
  })

  it('⚠️ و«ما ينتظرك» يعد القائم منها لمن يملكها', async () => {
    const inbox = new StaffInboxService(prisma)
    const waiting = await prisma.influencerApplication.count({ where: { status: 'submitted' } })
    const item = (await inbox.forStaff(bossId, ['commerce.manage'])).find((i) => i.key === 'influencer_applications')
    vexpect(item?.count).toBe(waiting)
    vexpect(item?.href).toBe('/admin/influencer-grant')
    vexpect((await inbox.forStaff(bossId, ['advisor.manage'])).map((i) => i.key)).not.toContain('influencer_applications')
  })
})

describe('⑦ الدفعة الزائدة على رصيده', () => {
  it('⚠️ ترد بخياريها ولا تسجل — وتسجل سلفة بـadvance في الأثر وبريده', async () => {
    const svc = new InfluencerService(prisma)
    const email = `infapp-payout-${STAMP}@test.local`
    const { id } = await svc.create({ nameAr: 'مؤثر السلفة', code: `ADV${STAMP % 100000}`, commissionPercent: 15, email }, bossId)
    const post = (payload: Record<string, unknown>) =>
      app.inject({ method: 'POST', url: `/api/admin/influencers/${id}/payouts`, headers: { cookie: bossCookie }, payload })

    const refused = await post({ amount: 20, noteAr: 'دفعة مقدمة' })
    vexpect(refused.statusCode, refused.body).toBe(409)
    const err = (refused.json() as { error: { code: string; message_ar: string } }).error
    vexpect(err.code).toBe('payout_exceeds_balance')
    expect(err.message_ar).toContain('سلفة')
    vexpect(await prisma.influencerPayout.count({ where: { influencerId: id } }), 'سجلت دفعة لم يخترها أحد').toBe(0)

    const ok = await post({ amount: 20, noteAr: 'دفعة مقدمة', advance: true })
    vexpect(ok.statusCode, ok.body).toBe(201)
    vexpect((ok.json() as { totals: { balance: number } }).totals.balance).toBe(-20)
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: id, action: 'influencer.payout' } })
    vexpect(audit.meta).toMatchObject({ amount: 20, advance: true, balanceBefore: 0, advanceAmount: 20 })
    const mail = await prisma.outboxMail.findFirstOrThrow({ where: { to: email, purpose: 'influencer.notice' } })
    expect(mail.text).toContain('سلفة')
  })
})

/* صفحةُ «منحة أعضاء وجيز» على الخادم (٢٠ أكتوبر ٢٠٢٦) — والعلّةُ في رأس `grant-landing.service.ts`.

   ① **النموذجُ يعطي الكودَ فورا** — عميلٌ محتملٌ بوسوم الحملة، وكودُه في الردّ وفي بريده.
   ② **ومن عبّأه ثانيةً لا يُعرض له الكود** — يُرسَل إلى البريد المحفوظ ويُقال أين، بلا عميلٍ ثانٍ ولا كودٍ ثانٍ.
   ③ **والمنحةُ المغلقةُ لا تُسقط العميل** — يُحفظ ويُقال السبب.
   ④ **وما لا يُقبل يُردّ** — رقمٌ ليس رقما، ومجالٌ من غير القائمة.
   ⑤ **والدوراتُ للزائر بلا أجور المدرّبين** — دوراتٌ فقط بفصلها، وما لا يُشترى لا يُعرض.
   ⑥ **و«تواصل مع مستشار» حالةٌ واحدة** تُسند — وبمرجعٍ صحيحٍ وحدَه.
   ⑦ **والوسومُ تُنظَّف** — ما ليس وسما يُترك.
   ⑧ **ونتائجُ الحملة بالقناة والدفعة** — والشراءُ يُنسب إلى قناة صاحب الكود ولو اشترى به غيرُه.
   ⑨ **والسؤالان الاختياريّان** — يُحفظان إن أجاب، ولا يُسقطان نموذجا تُركا فيه، وما ليس من القائمة يُردّ؛
      ومجالُ كلّ دورةٍ مفتوحةٍ في الردّ (منه يُختار)، والمستشارُ يقرأ ما أجاب.
   ⑩ **وما اختاره من دوراتٍ يُحفظ في ملفّه** — ما يُشترى في حملته وحدَه وبحدّ دوراتها، ويقرؤه بأسمائها من يتابعه.

   وما يقرأ دوراتِ المنحة يقرؤها بساعة ٢٠٩٩ (`NOW`) وشعبُه بعدها — فالفصلُ فصلُ أقرب شعبةٍ لم تبدأ في القاعدة
   كلِّها، والعلّةُ في رأس `grant-courses.test.ts`. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { makeAdvisor } from '../helpers/advisor'
import { AuthService } from '../../services/auth.service'
import { GrantService } from '../../services/grant.service'
import { GrantLandingService, grantResults, maskEmail } from '../../services/grant-landing.service'
import { CommerceService } from '../../services/commerce.service'
import { grantRegistrants } from '../../services/grant-followup.service'
import { approvedPlanBy } from '../helpers/approved-trainer'
import { courseDomain } from '../../../src/application/catalog/course-domain'
import { INFLUENCER_GRANT_SLUG } from '../../../src/application/commerce/grant'

let prisma: PrismaClient
let grants: GrantService
let landing: GrantLandingService
let ownerId = ''
let profileId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()
const DAY = 86_400_000
const NOW = new Date(Date.UTC(2099, 0, 20))

const nextCourse = () => {
  const id = pool.shift()
  if (!id) throw new Error('نفدت الدوراتُ المنشورة')
  return id
}
async function cohort(courseId: string, over: Record<string, unknown> = {}) {
  const c = await prisma.cohort.create({
    data: {
      plans: { create: approvedPlanBy(profileId) },
      courseId, title: `شعبة صفحة المنحة ${++seq}`, status: 'open', registrationOpen: true, financialReady: true,
      price: 150, currency: 'USD', capacity: 20, startsAt: new Date(NOW.getTime() + 30 * DAY), ...over,
    } as never,
  })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead', assignedBy: ownerId } })
  return c
}
const person = (over: Partial<{
  fullName: string; phone: string; email: string; workField: string; channel: string; wave: string; careerLevel: string | null; interests: string[]
}> = {}) => ({
  fullName: `قارئ وجيز ${++seq}`, phone: `0791${String(500000 + seq)}`, email: `member-${seq}-${STAMP}@test.local`,
  workField: 'الموارد البشرية', ...over,
})

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  grants = new GrantService(prisma)
  landing = new GrantLandingService(prisma)
  ownerId = (await auth.register(`gl-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  const advisor = (await auth.register(`gl-adv-${STAMP}@test.local`, 'Advisor#12345', 'مستشار الحملة')).userId
  await makeAdvisor(prisma, auth, advisor)
  const user = await prisma.user.create({ data: { email: `gl-tr-${STAMP}@wajeez.test`, displayName: 'مدرب', passwordHash: 'x' } })
  const app = await prisma.trainerApplication.create({ data: { reference: `WJ-TR-GL-${STAMP}`, fullName: 'مدرب', email: user.email, status: 'active' } })
  profileId = (await prisma.trainerProfile.create({ data: { userId: user.id, applicationId: app.id, publicVisibility: true, isVerified: true, publishApprovedAt: new Date() } })).id
  await prisma.trainerCompensationRule.create({ data: { profileId, type: 'per_seat', rate: 50, effectiveFrom: new Date(Date.now() - DAY) } })
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' } })).map((c) => c.id)
  await grants.update({ active: true, percentOff: 60, maxCodes: null, maxCourses: 4, closesAt: null }, ownerId)
}, 240_000)

describe('① النموذج يعطي الكود فورا', () => {
  it('⚠️ عميل بوسوم الحملة، وكوده في الرد وفي بريده', async () => {
    const p = person({ channel: 'whatsapp', wave: '1' })
    const out = await landing.apply(p)
    expect(out.grant?.code).toMatch(/^WG-/)
    expect(out.grant?.sentTo).toBeNull()
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: out.ref } })
    expect(lead).toMatchObject({ source: 'campaign', campaign: 'wajeez-members', channel: 'whatsapp', wave: '1', workField: 'الموارد البشرية', email: p.email })
    expect(lead.consentAr).toContain('كود المنحة')
    const mail = await prisma.outboxMail.findFirst({ where: { to: p.email, purpose: 'grant.code' }, orderBy: { createdAt: 'desc' } })
    expect(mail?.text, 'لم يصل الكود بريده').toContain(out.grant!.code!)
  })
})

describe('①ب وبريد الكود ورابط الهدية (٢٧ أكتوبر ٢٠٢٦)', () => {
  /* قرارُ صاحب المنصّة: «رسالةُ البريد يجب أن تكون احترافيّة»، و«لا تستخدم كلمة عضو بل مستخدم وجيز»، و«الرابط قصير جدّا» */
  it('⚠️ بريد الكود بقالب الأكاديمية — شكر لقارئ وجيز وكوده وزر دوراته، ولا «عضو» ولا «مستخدم»', async () => {
    const p = person({})
    const out = await landing.apply(p)
    const mail = await prisma.outboxMail.findFirstOrThrow({ where: { to: p.email, purpose: 'grant.code' }, orderBy: { createdAt: 'desc' } })
    expect(mail.subject).toBe('كود منحة وجيز الخاص بك')
    expect(mail.html, 'بلا قالب الأكاديمية').toBeTruthy()
    for (const t of ['منحتك جاهزة', 'شكرا لأنك من قراء وجيز', `كود منحتك: ${out.grant!.code}`, 'اختر دوراتك:', '/grant']) {
      expect(mail.text, t).toContain(t)
    }
    expect(`${mail.subject}\n${mail.text}`, 'عادت «عضو» أو «مستخدم»').not.toMatch(/أعضاء|عضو|مستخدم/)
    /* والكودُ حتى حدّ دوراته لا مرّةً واحدة (٢٨ أكتوبر ٢٠٢٦) — كان البريدُ يقول «يستعمل مرة واحدة» */
    expect(mail.text, 'عاد «مرة واحدة» في بريد الكود').not.toContain('مرة واحدة')
    expect(mail.text).toContain('في أكثر من طلب حتى حد دوراته')
  })

  it('⚠️ رابط الهدية القصير يصنع مرة لكل وجهة ويعاد — إلى صفحة المنحة بوسم الهدية', async () => {
    const a = await landing.view()
    const b = await landing.view()
    expect(a.sharePath).toMatch(/^\/s\/[A-Za-z0-9]+$/)
    expect(b.sharePath, 'صنع رابطا ثانيا للوجهة نفسها').toBe(a.sharePath)
    const row = await prisma.shortLink.findUniqueOrThrow({ where: { code: a.sharePath!.slice('/s/'.length) } })
    expect(row).toMatchObject({ target: '/grant?ch=share', purpose: 'grant.share', revokedAt: null })
    expect(await prisma.shortLink.count({ where: { target: '/grant?ch=share', purpose: 'grant.share' } })).toBe(1)
  })
})

describe('② ومن عبأه ثانية لا يعرض له الكود', () => {
  it('⚠️ يرسل إلى البريد المحفوظ ويقال أين — بلا عميل ثان ولا كود ثان', async () => {
    const p = person()
    const first = await landing.apply(p)
    const other = `stranger-${STAMP}@test.local`
    const again = await landing.apply({ ...p, email: other })
    expect(again.ref).toBe(first.ref)
    expect(again.grant?.code, 'عرض كود صاحب الرقم لمن كتب رقمه').toBeNull()
    expect(again.grant?.sentTo).toBe(maskEmail(p.email))
    expect(await prisma.lead.count({ where: { phone: p.phone } })).toBe(1)
    expect(await prisma.grantCode.count({ where: { leadId: first.ref } })).toBe(1)
    expect(await prisma.outboxMail.count({ where: { to: p.email, purpose: 'grant.code' } }), 'لم يرسل ثانية إلى صاحبه').toBe(2)
    expect(await prisma.outboxMail.count({ where: { to: other } }), 'أرسل الكود إلى بريد غريب').toBe(0)
  })
})

describe('③ والمنحة المغلقة لا تسقط العميل', () => {
  it('⚠️ يحفظ ويقال السبب', async () => {
    await grants.update({ active: false }, ownerId)
    try {
      const p = person()
      const out = await landing.apply(p)
      expect(out.grant).toBeNull()
      expect(out.reasonAr).toBe('المنحة مغلقة الآن')
      expect(await prisma.lead.count({ where: { email: p.email, campaign: 'wajeez-members' } })).toBe(1)
    } finally {
      await grants.update({ active: true }, ownerId)
    }
  })

  /* ومن نفدت أكوادُها يبقى عند سببه في الصفحة، ويعود إلى النموذج حين تُزاد — فالصفحةُ تسأل `soldOut` (٢٨ أكتوبر ٢٠٢٦) */
  it('⚠️ نفدت الأكواد: الصفحة تقول ذلك وهي مفتوحة — وحين تزاد لا تقوله', async () => {
    const s = await grants.settings()
    await grants.update({ maxCodes: s.issued }, ownerId)
    try {
      const v = await landing.view()
      expect(v.campaign.open).toBe(true)
      expect(v.campaign.soldOut, 'نفدت ولم تقل').toBe(true)
      const out = await landing.apply(person())
      expect(out.grant).toBeNull()
      expect(out.reasonAr).toBe('انتهت المنح المتاحة')
    } finally {
      await grants.update({ maxCodes: null }, ownerId)
    }
    expect((await landing.view()).campaign.soldOut, 'زيدت وبقيت تقول نفدت').toBe(false)
  })
})

describe('④ وما لا يقبل يرد', () => {
  it('⚠️ رقم ليس رقما، ومجال من غير القائمة', async () => {
    await expect(landing.apply(person({ phone: 'abc' }))).rejects.toMatchObject({ code: 'bad_phone' })
    await expect(landing.apply(person({ workField: 'مجال مختلق' }))).rejects.toMatchObject({ code: 'bad_field' })
  })
})

describe('⑤ والدورات للزائر بلا أجور المدربين', () => {
  it('⚠️ دورات فقط بفصلها — لا أجر ولا هامش ولا اقتراحات في الرد، وما أغلقت شعبته لا يعرض', async () => {
    const [a, b] = [nextCourse(), nextCourse()]
    await cohort(a)
    const cb = await cohort(b)
    await prisma.cohort.update({ where: { id: cb.id }, data: { registrationOpen: false } })

    const v = await landing.view(NOW)
    const json = JSON.stringify(v)
    expect(json, 'خرج أجر المدرب إلى الزائر').not.toMatch(/seatCost|margin|ruleRate|ruleType/)
    expect(Object.keys(v).sort(), 'عاد في الرد غير الدورات').toEqual(['campaign', 'openCourses', 'sharePath', 'termAr'])
    /* ولا عددَ للمنح الباقية — «العددُ الكبير قد يقلّل من قيمتها» (٢١ أكتوبر ٢٠٢٦) */
    /* و`soldOut` نعم/لا لا عدد: لا يقول إلّا «نفدت» حين نفدت — وهو ما يقوله النموذجُ نفسُه يومَها (٢٨ أكتوبر ٢٠٢٦) */
    expect(Object.keys(v.campaign).sort(), 'خرج عدد المنح إلى الزائر').toEqual(['closesAt', 'maxCourses', 'open', 'percentOff', 'soldOut'])
    expect(typeof v.campaign.soldOut, 'صار عددا').toBe('boolean')
    const row = v.openCourses.find((x) => x.courseId === a)!
    expect(row.price).toBe(150)
    /* والمقاعدُ والمدرّبُ لصفّ الدورة — والمدرّبُ اسمُه وصورتُه ومعرّفُه وحدها */
    expect(row.seatsLeft).toBe(20)
    expect(Object.keys(row.trainer ?? {}).sort(), 'خرج من ملف المدرب غير اسمه وصورته').toEqual(['id', 'name', 'photoUrl'])
    expect(v.openCourses.some((x) => x.courseId === b), 'عرض دورة أغلقت شعبتها').toBe(false)
    expect(v.termAr).toBe('موسم الربيع 2099')
  })

  /* «"تفاصيل الدورة" أريد أن تبدلها بسهمٍ للأسفل، وينسدل نبذةٌ بسيطة: عنها وأهدافُها ولمن هي» — قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦) */
  it('⚠️ ونبذة كل دورة في الرد من آخر نسخة لها — وعدها وثلاثة أهداف بترتيبها ولمن هي', async () => {
    const a = nextCourse()
    await cohort(a)
    const last = await prisma.courseVersion.findFirstOrThrow({ where: { courseId: a }, orderBy: { version: 'desc' } })
    await prisma.courseVersion.create({
      data: {
        courseId: a, version: last.version + 1, titleAr: last.titleAr, totalHours: last.totalHours,
        shortPromiseAr: 'تكتب خطتك في أسبوع.', audienceAr: 'لمن يبدأ عملا جديدا.',
        objectives: { create: ['يحدد', 'يبني', 'يقيّم', 'ينفذ'].map((textAr, i) => ({ sequence: 4 - i, textAr })) },
      },
    })
    const row = (await landing.view(NOW)).openCourses.find((x) => x.courseId === a)!
    expect(row.summary, 'النبذة من غير آخر نسخة').toEqual({ aboutAr: 'تكتب خطتك في أسبوع.', goalsAr: ['ينفذ', 'يقيّم', 'يبني'], audienceAr: 'لمن يبدأ عملا جديدا.' })
  })

  /* «عندما تتعارض دوراتٌ يجب أن تظهر فورا» و«اقترح له دوراتٍ لا تتعارض» — قرارا صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦) */
  it('⚠️ ومواعيد لقاءات كل شعبة في الرد — المعتمد وحده، لا الملغى ولا المبدئي ولا ما ينتظر الاعتماد', async () => {
    const a = nextCourse()
    const c = await cohort(a)
    const at = (d: number) => new Date(NOW.getTime() + d * DAY)
    const add = (d: number, over: Record<string, unknown> = {}) => prisma.cohortSession.create({
      data: { cohortId: c.id, title: `لقاء ${d}`, startsAt: at(d), endsAt: new Date(at(d).getTime() + 7_200_000), ...over } as never,
    })
    await add(31)
    await add(32, { status: 'cancelled' })
    await add(33, { placeholder: true })
    await add(34, { approvalState: 'pending' })
    await add(35, { endsAt: null })
    const row = (await landing.view(NOW)).openCourses.find((x) => x.courseId === a)!
    expect(row.sessions.map((x) => x.startsAt.toISOString()), 'خرج لقاء لا يعلن').toEqual([at(31).toISOString(), at(35).toISOString()])
    expect(Object.keys(row.sessions[0]).sort(), 'خرج من اللقاء غير موعده').toEqual(['endsAt', 'startsAt'])
  })
})

describe('⑥ وتواصل مع مستشار حالة واحدة', () => {
  it('⚠️ تسند تلقائيا — والثانية لا تنشئ حالة، والمرجع الخاطئ يرد', async () => {
    const out = await landing.apply(person())
    await landing.askAdvisor(out.ref, 'أريد أن أعرف أي دورة تناسبني')
    await landing.askAdvisor(out.ref)
    const cases = await prisma.advisorCase.findMany({ where: { leadId: out.ref }, include: { assignments: true, contactEvents: true } })
    expect(cases).toHaveLength(1)
    expect(cases[0].assignments.some((x) => x.unassignedAt === null), 'لم تسند').toBe(true)
    expect(cases[0].contactEvents[0]?.summary).toContain('أي دورة تناسبني')
    await expect(landing.askAdvisor('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('⑦ والوسوم تنظف', () => {
  it('ما ليس وسما يترك', async () => {
    const out = await landing.apply(person({ channel: 'WhatsApp', wave: '<script>' }))
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: out.ref } })
    expect(lead.channel).toBe('whatsapp')
    expect(lead.wave).toBeNull()
  })
})

describe('⑧ ونتائج الحملة بالقناة والدفعة', () => {
  it('⚠️ من عبأ ومن أخذ كودا ومن اشترى وبكم — والمهدى يحسب لقناة صاحب الكود', async () => {
    const ch = `t${STAMP % 1_000_000_000}`
    const a = await landing.apply(person({ channel: ch, wave: '1', workField: 'الهندسة' }))
    const b = await landing.apply(person({ channel: ch, wave: '1', workField: 'الهندسة' }))
    await landing.apply(person({ channel: ch, wave: '2' }))
    /* صديقٌ اشترى بكود الأوّل */
    const friend = (await new AuthService(prisma).register(`gl-friend-${STAMP}@test.local`, 'Friend#12345', 'صديق')).userId
    const commerce = new CommerceService(prisma)
    const c = await cohort(nextCourse())
    const out = await commerce.checkout(friend, [c.id], a.grant!.code!)
    await commerce.payOrder(out.orderId, friend, `gl-${out.orderId}`)
    /* وآخرُ فتح طلبا بكود الثاني ولم يدفع — لا يُعدّ شراءً */
    const idle = (await new AuthService(prisma).register(`gl-idle-${STAMP}@test.local`, 'Idle#12345', 'لم يدفع')).userId
    await commerce.checkout(idle, [(await cohort(nextCourse())).id], b.grant!.code!)

    const r = await grantResults(prisma)
    const w1 = r.rows.find((x) => x.channel === ch && x.wave === '1')!
    expect(w1).toMatchObject({ leads: 2, codes: 2, bought: 1, revenue: 60 })
    expect(r.rows.find((x) => x.channel === ch && x.wave === '2')).toMatchObject({ leads: 1, codes: 1, bought: 0, revenue: 0 })
    expect(r.fields.find((f) => f.workField === 'الهندسة')!.leads).toBeGreaterThanOrEqual(2)
    expect(r.totals.leads).toBeGreaterThanOrEqual(3)
  })
})

/* «عندما يقوم بالدفع لا يظهر نفس السعر… يجب أن يصلح ويتغيّر من جهتك» — واختار صاحبُ المنصّة المطابقةَ بالبريد (٢٧ أكتوبر ٢٠٢٦) */
describe('⑧ب وكود منحته لصاحب الحساب ببريد النموذج', () => {
  it('⚠️ بريد حسابه بريد نموذج في الحملة يأخذ كوده — بلا فرق حروف، ويكتب الأثر، ولا يأخذه غيره ولا من حملة أخرى', async () => {
    const p = person()
    const out = await landing.apply(p)
    /* وعبّأه ثانيةً فلم يُعرض الكود — هذا من يحتاجه */
    expect((await landing.apply(p)).grant?.code).toBeNull()
    const owner = (await new AuthService(prisma).register(p.email.toUpperCase(), 'Owner#12345', p.fullName)).userId
    expect(await landing.myCode(owner, '10.0.0.9')).toEqual({ code: out.grant!.code, percentOff: out.grant!.percentOff })
    expect(await prisma.auditEvent.count({ where: { action: 'coupon.grant_claim', entityId: out.ref, actorId: owner } })).toBe(1)
    const other = (await new AuthService(prisma).register(`gl-other-${STAMP}@test.local`, 'Other#12345', 'غيره')).userId
    expect(await landing.myCode(other), 'أخذ كود غيره').toEqual({ code: null })
    expect(await new GrantLandingService(prisma, INFLUENCER_GRANT_SLUG).myCode(owner), 'أخذ كود حملة أخرى').toEqual({ code: null })
  })

  /* والحدُّ على الكود في كلّ مشترياته (صاحب المنصة، ٢٨ أكتوبر ٢٠٢٦): يعاد ما بقيت له دورات، ولا يعاد إذا بلغ حده */
  it('⚠️ وكود اشتري به يعاد ما بقيت له دورات — ولا يعاد إذا بلغ حده، ولو أهداه فاشترى به صديقه', async () => {
    const p = person()
    const out = await landing.apply(p)
    const friend = (await new AuthService(prisma).register(`gl-gift-${STAMP}@test.local`, 'Friend#12345', 'صديق')).userId
    const commerce = new CommerceService(prisma)
    const buy = async (n: number) => {
      const ids: string[] = []
      for (let i = 0; i < n; i++) ids.push((await cohort(nextCourse())).id)
      const o = await commerce.checkout(friend, ids, out.grant!.code!)
      await commerce.payOrder(o.orderId, friend, `gl-gift-${o.orderId}`)
    }
    await buy(1)
    const owner = (await new AuthService(prisma).register(p.email, 'Owner#12345', p.fullName)).userId
    expect((await landing.myCode(owner)).code, 'لم يعد كود بقيت له دورات').toBe(out.grant!.code)
    await buy((await grants.settings()).maxCourses - 1)
    expect(await landing.myCode(owner)).toEqual({ code: null })
  })

  /* كلُّ كودٍ يحمل نسبتَه يومَ أُعطي — فإن غيّر صاحبُ المنصّة نسبةَ الحملة بعده سُعّرت الصفحةُ بالجديدة ودُفع بالقديمة */
  it('⚠️ ونسبة كوده يوم أعطي — لا نسبة الحملة اليوم', async () => {
    const p = person()
    const out = await landing.apply(p)
    expect(out.grant!.percentOff).toBe(60)
    await grants.update({ percentOff: 50 }, ownerId)
    try {
      const owner = (await new AuthService(prisma).register(p.email, 'Owner#12345', p.fullName)).userId
      expect((await landing.myCode(owner)).percentOff, 'قيلت نسبة الحملة اليوم').toBe(60)
      /* ومن عبّأه ثانيةً يقال له نسبةُ كوده لا نسبةُ اليوم */
      expect((await landing.apply(p)).grant!.percentOff).toBe(60)
    } finally {
      await grants.update({ percentOff: 60 }, ownerId)
    }
  })
})

describe('⑨ والسؤالان الاختياريان', () => {
  it('⚠️ يحفظان إن أجاب، ولا يسقطان نموذجا تركا فيه — وما ليس من القائمة يرد', async () => {
    const hr = courseDomain('C-HR-101')
    const mkt = courseDomain('C-MKT-101')
    const full = await landing.apply(person({ careerLevel: 'مدير', interests: [hr, mkt, hr] }))
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: full.ref } })
    expect(lead.careerLevel).toBe('مدير')
    expect(lead.interests, 'المكرر يحفظ مرة').toEqual([hr, mkt])

    const bare = await landing.apply(person())
    expect(bare.grant?.code, 'أسقط نموذجا ترك فيه الاختياري').toMatch(/^WG-/)
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: bare.ref } })).toMatchObject({ careerLevel: null, interests: [] })

    await expect(landing.apply(person({ careerLevel: 'رئيس الكون' }))).rejects.toMatchObject({ code: 'bad_level' })
    await expect(landing.apply(person({ interests: ['مجال مختلق'] }))).rejects.toMatchObject({ code: 'bad_interests' })
    await expect(landing.apply(person({ interests: [hr, mkt, courseDomain('C-AI-101'), courseDomain('C-PM-101')] })))
      .rejects.toMatchObject({ code: 'bad_interests' })
  })

  it('⚠️ مجال كل دورة مفتوحة في الرد — والمستشار يقرأ ما أجاب', async () => {
    const id = nextCourse()
    await cohort(id)
    const v = await landing.view(NOW)
    expect(v.openCourses.find((x) => x.courseId === id)?.domainAr).toBe(courseDomain(id))

    const out = await landing.apply(person({ workField: 'الهندسة', careerLevel: 'موظف بخبرة', interests: [courseDomain('C-PM-101')] }))
    await landing.askAdvisor(out.ref)
    const kase = await prisma.advisorCase.findFirstOrThrow({ where: { leadId: out.ref } })
    expect(kase.nextAction).toContain('مجاله: الهندسة')
    expect(kase.nextAction, 'لم يقرأ المستشار مستواه').toContain('مستواه: موظف بخبرة')
    expect(kase.nextAction, 'لم يقرأ ما يريد تطويره').toContain(`يريد: ${courseDomain('C-PM-101')}`)
  })
})

describe('⑩ وما اختاره من دورات يحفظ في ملفه', () => {
  it('⚠️ ما يشترى في حملته وحده وبحد دوراتها — ويقرؤه بأسمائها من يتابعه', async () => {
    const [a, b, c] = [nextCourse(), nextCourse(), nextCourse()]
    await cohort(a)
    await cohort(b)
    const cc = await cohort(c)
    await prisma.cohort.update({ where: { id: cc.id }, data: { registrationOpen: false } })
    const out = await landing.apply(person())

    /* المكرّرُ مرّةً، وما أغلقت شعبتُه وما لا وجودَ له لا يُكتبان */
    expect((await landing.savePicks(out.ref, [a, c, a, b, 'C-NOPE-999'], NOW)).picks).toEqual([a, b])
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: out.ref } })
    expect(lead.grantPicks).toEqual([a, b])
    expect(lead.grantPicksAt, 'لم يكتب متى اختار').not.toBeNull()

    /* ومن يتابعه يقرؤها بأسمائها */
    const titleOf = async (id: string) => (await prisma.courseVersion.findFirstOrThrow({ where: { courseId: id }, orderBy: { version: 'desc' } })).titleAr
    const row = (await grantRegistrants(prisma)).find((r) => r.id === out.ref)!
    expect(row.picks).toEqual([await titleOf(a), await titleOf(b)])

    /* وبحدّ دورات الحملة */
    await grants.update({ active: true, percentOff: 60, maxCodes: null, maxCourses: 1, closesAt: null }, ownerId)
    try {
      expect((await landing.savePicks(out.ref, [b, a], NOW)).picks).toEqual([b])
    } finally {
      await grants.update({ active: true, percentOff: 60, maxCodes: null, maxCourses: 4, closesAt: null }, ownerId)
    }
    await expect(landing.savePicks('00000000-0000-4000-8000-000000000000', [a], NOW)).rejects.toMatchObject({ code: 'not_found' })
  })
})

/* متابعُ المؤثّر يقرأ «منحة <المؤثّر>» وقيمةَ خصمه — على الخادم (٢٢ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة في صفحة كاسيت: «ركّز على قيمة الخصم، لا كم تدفع الأكاديميّةُ عنك؛ ولا تذكر "منحة مؤثرين وجيز" لأنّها
   منحةُ كاسيت». والاسمُ من `grantTitleAr` و`influencerGrantNameAr` (`src/application/commerce/grant.ts`)، والسطرُ من
   `grantPicksSavingPreheaderAr` (`grant-landing.ts`). وهنا ما يصل المتابعَ نفسَه:
   ① **بريدُ كوده** — «كود منحة كاسيت الخاص بك».
   ② **بطاقةُ كوده ولوحُ شرائه** — `learnerGrant.titleAr` و`quote.grantNameAr` «منحة كاسيت»، واسمُ الحملة الداخليُّ باقٍ
      في `nameAr` تُقرأ به حملتُه.
   ③ **وتذكيرُه بما اختاره** — «خصمك 45% — توفر $45.00» لا «ومنحتك تدفع عنك»، ولا «قيمة منحتك».
   والصفحةُ في `src/tests/commerce/influencer-grant-name.test.ts`. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { CommerceService } from '../../services/commerce.service'
import { GrantService, learnerGrant } from '../../services/grant.service'
import { GrantLandingService } from '../../services/grant-landing.service'
import { InfluencerService } from '../../services/influencer.service'
import { sendGrantReminders } from '../../services/grant-followup.service'
import { approvedPlanBy } from '../helpers/approved-trainer'
import { INFLUENCER_GRANT_NAME_AR, INFLUENCER_GRANT_SLUG, grantPrice } from '../../../src/application/commerce/grant'
import { fmtMoney } from '../../../src/application/text/format-ar'

let prisma: PrismaClient
let auth: AuthService
let commerce: CommerceService
let grant: GrantService
let landing: GrantLandingService
let influencers: InfluencerService
let ownerId = ''
let profileId = ''
let pool: string[] = []
let seq = 0
const STAMP = Date.now()
const NAME = `كاسيت ${STAMP % 10000}`
const CODE = `KNAME${STAMP % 10000}`

const person = (over: Record<string, unknown> = {}) => ({
  fullName: `متابع الاسم ${++seq}`, phone: `+962794${String(500000 + seq)}`, email: `inf-name-${seq}-${STAMP}@test.local`,
  workField: 'الموارد البشرية', ...over,
})
async function openCohort(price = 100) {
  const courseId = pool.shift()
  if (!courseId) throw new Error('نفدت الدورات المنشورة')
  const id = (await prisma.cohort.create({
    data: {
      plans: { create: approvedPlanBy(profileId) },
      courseId, title: `شعبة اسم المنحة ${++seq}`, status: 'open', registrationOpen: true, financialReady: true,
      price, currency: 'USD', capacity: 20, startsAt: new Date(Date.now() + 30 * 86_400_000),
    } as never,
  })).id
  /* ومدرّبُها منشور — فتظهر في صفحة المؤثّر (`grant-courses.service.ts#pool`) */
  await prisma.cohortTrainer.create({ data: { cohortId: id, profileId, role: 'lead', assignedBy: ownerId } })
  return { id, courseId }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  commerce = new CommerceService(prisma)
  grant = new GrantService(prisma, INFLUENCER_GRANT_SLUG)
  landing = new GrantLandingService(prisma, INFLUENCER_GRANT_SLUG)
  influencers = new InfluencerService(prisma)
  ownerId = (await auth.register(`inf-name-owner-${STAMP}@test.local`, 'Owner#12345', 'صاحب المنصة')).userId
  const user = await prisma.user.create({ data: { email: `inf-name-tr-${STAMP}@wajeez.test`, displayName: 'مدرب منحة المؤثر', passwordHash: 'x' } })
  const application = await prisma.trainerApplication.create({
    data: { reference: `WJ-TR-INFNAME-${STAMP}`, fullName: 'مدرب منحة المؤثر', email: user.email, status: 'active' },
  })
  profileId = (await prisma.trainerProfile.create({
    data: { userId: user.id, applicationId: application.id, publicVisibility: true, isVerified: true, publishApprovedAt: new Date() },
  })).id
  pool = (await prisma.course.findMany({ where: { status: 'published' }, select: { id: true }, orderBy: { id: 'desc' } })).map((c) => c.id)
  await grant.update({ active: true }, ownerId)
  await influencers.create({ nameAr: NAME, code: CODE, commissionPercent: 15, email: `${CODE.toLowerCase()}-${STAMP}@test.local` }, ownerId)
}, 240_000)

describe('① بريد كوده', () => {
  it('⚠️ «كود منحة <المؤثر> الخاص بك» — لا «منحة مؤثرين وجيز»', async () => {
    const p = person({ influencerCode: CODE })
    await landing.apply(p)
    const mail = await prisma.outboxMail.findFirstOrThrow({ where: { to: p.email, purpose: 'grant.code' }, orderBy: { createdAt: 'desc' } })
    expect(mail.subject).toBe(`كود منحة ${NAME} الخاص بك`)
    expect(`${mail.subject}\n${mail.text}\n${mail.html}`, 'قيل اسم الحملة الداخلي لمتابع').not.toContain(INFLUENCER_GRANT_NAME_AR)
  })
})

describe('② بطاقة كوده ولوح شرائه', () => {
  it('⚠️ «منحة <المؤثر>» حيث يرى اسم منحته — واسم الحملة الداخلي باق لعد ما بقي', async () => {
    const p = person({ influencerCode: CODE })
    const out = await landing.apply(p)
    const userId = (await auth.register(p.email, 'Learner#12345', p.fullName)).userId
    const mine = await learnerGrant(prisma, userId)
    expect(mine).toMatchObject({ code: out.grant!.code, titleAr: `منحة ${NAME}`, nameAr: INFLUENCER_GRANT_NAME_AR })
    const { id } = await openCohort(100)
    const q = await commerce.quote(userId, [id], out.grant!.code!)
    expect(q.grantNameAr, 'لوح الشراء يسمي منحته باسم الحملة').toBe(`منحة ${NAME}`)
  })
})

describe('③ تذكيره بما اختاره', () => {
  it('⚠️ «خصمك 45% — توفر $…» — لا «تدفع عنك» ولا «قيمة منحتك»', async () => {
    const HOUR = 3_600_000
    const T = new Date(Date.now() + 5 * 24 * HOUR)
    const had = await prisma.integrationSetting.findUnique({ where: { provider: 'email' }, select: { enabled: true, config: true } })
    const cfg = { apiKey: 'test-key', fromEmail: 'no-reply@test.local' }
    await prisma.integrationSetting.upsert({ where: { provider: 'email' }, update: { enabled: true, config: cfg }, create: { provider: 'email', enabled: true, config: cfg } })
    try {
      await grant.update({ closesAt: T }, ownerId)
      const p = person({ influencerCode: CODE })
      const out = await landing.apply(p)
      /* دورةٌ من صفحة مؤثّره كما يراها — وبسعرها يُحسب ما يوفّره */
      const { courseId } = await openCohort(100)
      const course = (await landing.influencerView(CODE)).openCourses.find((c) => c.courseId === courseId)!
      expect(course, 'لا دورة في صفحة المؤثر').toBeDefined()
      await prisma.lead.update({ where: { id: out.ref }, data: { grantPicks: [course.courseId] } })
      const saved = fmtMoney(course.price - grantPrice(course.price, 45))
      await sendGrantReminders(prisma, new Date(T.getTime() - 62.9 * HOUR), INFLUENCER_GRANT_SLUG)
      const m = await prisma.outboxMail.findFirstOrThrow({ where: { to: p.email, purpose: 'grant.reminder' } })
      const all = `${m.subject}\n${m.text}\n${m.html}`
      expect(m.html, 'سطر ما قبل الفتح').toContain(`ما اخترته: دورة واحدة، خصمك 45% — توفر ${saved}.`)
      expect(m.text).toContain('خصمك 45%')
      expect(m.text).toContain(`توفر ${saved}`)
      expect(all, 'قيل ما تدفعه الأكاديمية عنه').not.toMatch(/تدفع عنك|تدفعها الأكاديمية عنك|قيمة منحتك/)
      expect(all).not.toContain(INFLUENCER_GRANT_NAME_AR)
    } finally {
      await grant.update({ closesAt: null }, ownerId)
      if (had) await prisma.integrationSetting.update({ where: { provider: 'email' }, data: { enabled: had.enabled, config: had.config as never } })
      else await prisma.integrationSetting.delete({ where: { provider: 'email' } })
    }
  })
})

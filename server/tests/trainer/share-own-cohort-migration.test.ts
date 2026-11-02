/* ترحيلُ «شارك دوراتك تخصّ شعبةَ المدرّب» (٢ نوفمبر ٢٠٢٦) — `20261102090000_trainer_share_own_cohort`.

   جرى الترحيلُ على قاعدةٍ فارغةٍ حين هُيّئت قاعدةُ الاختبار، فتُقرأ جملُه من ملفّه **نفسِه** وتُنفَّذ على صفوفٍ تُصنع هنا
   (على حذو `merge-first-job-migration.test.ts`). وما يُفحص:

   ① الرابطُ القصيرُ القديمُ يُوجَّه إلى شعبته برمزه نفسِه — وبحروف `cohortLinkUrl` فيجده `shortOf` ولا يسكّ غيرَه.
   ② ورابطٌ قصيرٌ لغير «شارك دوراتك» لا يُمسّ.
   ③ اسما شعبتَي أماني الحديد كما طلبت، ورقمُ الشعبة يبقى، والاسمُ المجرّدُ («الدفعة الأولى») يأخذ اسمَ دورته مصحَّحا.
   ④ وشعبةُ مدرّبٍ آخرَ للدورة نفسِها لا تُمسّ، ولا الدورةُ العليا.
   ⑤ ولكلّ تغييرٍ أثر، والجملُ تُعاد فلا تفسد ولا تكرّر الأثر. */

import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { cohortLinkUrl } from '../../services/referral.service'
import { sharedCohortTitleAr } from '../../../src/application/learning/cohort-title'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
let prisma: PrismaClient

const statements = readFileSync(join(root, 'prisma/migrations/20261102090000_trainer_share_own_cohort/migration.sql'), 'utf8')
  .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
  .split(';').map((x) => x.trim()).filter(Boolean)
const migrate = async () => { for (const st of statements) await prisma.$executeRawUnsafe(st) }

const AI = 'C-SHARE-AI'
const LEAD = 'C-SHARE-LEAD'
const AI_TITLE = 'الذكاء الاصطناعي مساعدك الشخصي: ابحث عن وظيفة، وأدر بريدك، وابن موقعك بنفسك'
const LEAD_TITLE = 'القيادة للمديرين الجديد: مواءمة أداء الفريق مع أهداف المؤسسة - من التعلم إلى التطبيق'
const AI_AFTER = 'الذكاء الاصطناعي مساعدك الشخصي: اكتب Prompt بذكاء، واستخدم تطبيقات سهلة في عملك اليومي، وتعامل معه بأخلاقيات'
const LEAD_AFTER = 'القيادة للمديرين الجدد: مواءمة أداء الفريق مع أهداف المؤسسة - من التعلم إلى التطبيق'

let seq = 0
async function trainer(fullName: string) {
  seq += 1
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-SO-${Date.now()}-${seq}`, fullName, email: `so-${seq}-${Date.now()}@test.local`,
      status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  return (await prisma.trainerProfile.create({ data: { applicationId: app.id } })).id
}
const cohort = async (courseId: string, title: string, profileId: string) => {
  const c = await prisma.cohort.create({ data: { courseId, title, status: 'open', registrationOpen: true } })
  await prisma.cohortTrainer.create({ data: { cohortId: c.id, profileId, role: 'lead' } })
  return c.id
}

let aiCohort: string, leadCohort: string, otherCohort: string
let oldShare: string, otherPurpose: string

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  for (const [id, titleAr] of [[AI, AI_TITLE], [LEAD, LEAD_TITLE]]) {
    await prisma.course.create({ data: { id, status: 'published', currentVersion: 1, versions: { create: { version: 1, titleAr, totalHours: 10 } } } })
  }
  const amani = await trainer('أماني الحديد')
  const other = await trainer('مدرب آخر')
  aiCohort = await cohort(AI, `${AI_TITLE} — شعبة ١`, amani)
  leadCohort = await cohort(LEAD, 'الدفعة الأولى', amani)
  otherCohort = await cohort(LEAD, `${LEAD_TITLE} — شعبة ٢`, other)

  const ref = await prisma.trainerReferralLink.create({ data: { cohortId: aiCohort, profileId: amani, code: 'WJ-SHAREOWN' } })
  oldShare = (await prisma.shortLink.create({ data: { code: 'SOWN01', target: `/build/${AI}?ref=${ref.code}`, purpose: 'share-kit' } })).id
  otherPurpose = (await prisma.shortLink.create({ data: { code: 'SOWN02', target: `/build/${AI}?ref=${ref.code}`, purpose: 'other' } })).id
  await migrate()
}, 240_000)

describe('ترحيل «شارك دوراتك» إلى شعبة المدرب', () => {
  it('⚠️ الرابط القصير القديم يفتح شعبته برمزه نفسه — وبحروف `cohortLinkUrl`', async () => {
    const row = await prisma.shortLink.findUniqueOrThrow({ where: { id: oldShare } })
    const u = new URL(cohortLinkUrl('https://w.test', AI, aiCohort, 'WJ-SHAREOWN'))
    expect(row.code).toBe('SOWN01')
    expect(row.target).toBe(`${u.pathname}${u.search}`)
    expect(row.target).toContain(`cohort=${aiCohort}`)
  })

  it('⚠️ ورابط لغير «شارك دوراتك» لا يمس', async () => {
    expect((await prisma.shortLink.findUniqueOrThrow({ where: { id: otherPurpose } })).target).toBe(`/build/${AI}?ref=WJ-SHAREOWN`)
  })

  it('⚠️ اسما شعبتيها كما طلبت — والرقم يبقى، والاسم المجرد يأخذ اسم دورته مصححا', async () => {
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: aiCohort } })).title).toBe(`${AI_AFTER} — شعبة ١`)
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: leadCohort } })).title).toBe(LEAD_AFTER)
  })

  it('⚠️ وشعبة مدرب آخر للدورة نفسها لا تمس، ولا الدورة العليا', async () => {
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: otherCohort } })).title).toBe(`${LEAD_TITLE} — شعبة ٢`)
    const v = await prisma.courseVersion.findFirstOrThrow({ where: { courseId: LEAD, version: 1 } })
    expect(v.titleAr).toBe(LEAD_TITLE)
  })

  it('⚠️ ولكل تغيير أثر — والجمل تعاد فلا تفسد ولا تكرر الأثر', async () => {
    const audits = () => prisma.auditEvent.count({ where: { action: 'cohort.update', entityId: { in: [aiCohort, leadCohort] } } })
    expect(await audits()).toBe(2)
    await migrate()
    expect(await audits()).toBe(2)
    expect((await prisma.cohort.findUniqueOrThrow({ where: { id: aiCohort } })).title).toBe(`${AI_AFTER} — شعبة ١`)
    expect((await prisma.shortLink.findUniqueOrThrow({ where: { id: oldShare } })).code).toBe('SOWN01')
  })

  it('⚠️ وما ينشر عنها اسم شعبتها لا اسم الدورة العليا', async () => {
    const c = await prisma.cohort.findUniqueOrThrow({ where: { id: leadCohort } })
    expect(sharedCohortTitleAr(c.title, LEAD_TITLE)).toBe(LEAD_AFTER)
  })
})

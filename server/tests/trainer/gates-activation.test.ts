/* متى يُشترَط العقدُ — بقاعدةٍ حقيقيّة.
 *
 * ── ولمَ لا تكفي قراءةُ المصدر ──
 *
 * حارسُ `src/tests` يرى `offerGatesActivation` مستدعاةً ويرى أنّ الوسيطَ
 * يمرّ على العقود كلِّها. ولا يُثبت أنّ `contractPrefill` **تردّ فعلا**
 * ما يُنتظَر منها على صفوفٍ حقيقيّة — وهي الدالّةُ التي تقرؤها الشاشةُ
 * والمركِّبُ معا.
 *
 * وأدقُّ ما يُقاس: **حسابٌ نشطٌ وموادٌّ لم تُعتمَد**. تلك هي الصورةُ التي
 * كانت تخرج بلا شرطٍ ولا خَتم، وهي التي رآها صاحبُ المنصّة في عقده.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'

let prisma: PrismaClient
let review: TrainerReviewService

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  review = new TrainerReviewService(prisma)
  const auth = new AuthService(prisma)
  const admin = await auth.register('gates-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  await auth.setRoles(admin.userId, ['academic_manager'])
}, 240_000)

let seq = 0
/** مرشّحٌ بحالةٍ وعقودٍ موصوفةٍ بأختامها */
async function mk(status: string, stamps: (Date | null)[]) {
  seq += 1
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-GA-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`,
      email: `ga-${seq}-${Date.now()}@test.local`,
      status, motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  for (const [i, metAt] of stamps.entries()) {
    await prisma.trainerContract.create({
      data: {
        profileId: profile.id, title: `عقدٌ ${i}`,
        status: metAt ? 'countersigned' : 'draft',
        bodyVersion: 'v-test', bodyAr: 'متنٌ', requiredDocuments: [],
        gatesActivation: true, conditionMetAt: metAt,
      },
    })
  }
  return app
}

describe('المقياسُ اعتمادُ الموادّ لا حالةُ الحساب', () => {
  /* ═══ الصورةُ التي كانت تسقط ═══
     حسابُه نشطٌ لأنّه قبل الدعوةَ قبل أن يُركَّب عقدُه، وموادُّه لم
     تُعتمَد بعد. وكان يخرج عقدُه بلا شرطٍ ولا طورٍ ثانٍ. */
  it('نشطُ الحساب ولم تُعتمَد موادُّه — يُشترَط عقدُه', async () => {
    const app = await mk('active', [])
    const pre = await review.contractPrefill(app.id)
    expect(pre.gatesActivation, 'خرج عقدُه بلا شرطٍ وموادُّه لم تُعتمَد').toBe(true)
  })

  it('وله عقدٌ قائمٌ لم يُختَم — يُشترَط كذلك', async () => {
    const app = await mk('active', [null])
    expect((await review.contractPrefill(app.id)).gatesActivation).toBe(true)
  })

  /* ═══ وهذه هي التي نجا منها نقضُ «أحدثُ عقدٍ وحدَه» ═══
     عقدٌ قديمٌ مختوم، ومسوّدةٌ جديدةٌ بعده. والعقودُ تُقرأ بالأحدث، فأخذُ
     أوّلِها يقرأ المسوّدةَ فيُعاد اشتراطُه وقد اعتُمد. */
  it('واعتُمدت موادُّه قديما ثمّ رُكّبت له مسوّدة — لا يُعاد اشتراطُه', async () => {
    const app = await mk('active', [new Date('2026-08-01'), null])
    const pre = await review.contractPrefill(app.id)
    expect(pre.gatesActivation, 'أُعيد اشتراطُ من اعتُمدت موادُّه').toBe(false)
  })

  it('ومن اعتُمدت موادُّه لا يُشترَط', async () => {
    const app = await mk('active', [new Date('2026-08-01')])
    expect((await review.contractPrefill(app.id)).gatesActivation).toBe(false)
  })

  /* ولا يُقاس بالحالة: مرشّحٌ لم يُفعَّل واعتُمدت موادُّه لا يُشترَط،
     وهو عكسُ ما كان يقوله المقياسُ القديم بالضبط. */
  it('ولا أثرَ لحالة الحساب في الحكم', async () => {
    const conditioned = await mk('contract_pending', [new Date('2026-08-01')])
    expect((await review.contractPrefill(conditioned.id)).gatesActivation,
      'حالةُ الحساب غلبت اعتمادَ الموادّ').toBe(false)
  })
})

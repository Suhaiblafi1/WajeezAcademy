/* «أعِدِ الموادَّ بملاحظات» من الشاشة — بقاعدةٍ حقيقيّة.
 *
 * ── ما يقيسه، وما لا يقيسه غيرُه ──
 *
 * `condition-trainer-actions.test.ts` يقيس **الدالّةَ**: تُستأنف المهلةُ
 * مضافا إليها مدّةُ التجميد، وتُردُّ بلا ملاحظات، وتصله إشعارا. وكلُّ ذلك
 * محروسٌ ولا يُعاد هنا.
 *
 * والذي لم يكن محروسا شيئان، وهما العطبُ بعينه:
 *
 * ① **الطابورُ كان أعمى**: `listContracts` لا تجلب أعمدةَ الشرط، فلا تعرف
 *    الشاشةُ أنّ موادَّ إنسانٍ عندها للتقييم — ولا زرَّ يُعرَض لحالٍ لا يُرى.
 * ② **والمسارُ لم يُقَس عبر HTTP**: الدالّةُ مختبَرةٌ نداءً مباشرا، والمسارُ
 *    الذي تبلغه الشاشةُ (بجلسةٍ وصلاحيّةٍ وجسمِ طلب) لم يُطرَق قطّ.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { buildApp } from '../../http/app'
import { SESSION_COOKIE } from '../../http/auth-plugin'
import { contractAcks, CONDITION_CLAUSE_MARK } from '../../../src/application/trainer/contract-body'
import { conditionPhase } from '../../../src/application/trainer/conditional-offer'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let app: FastifyInstance
let adminId = ''
let adminCookie = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const DAY = 86_400_000
const BODY = `نصُّ اتفاقيّةٍ للاختبار — البند 1.

${CONDITION_CLAUSE_MARK} لا عقد نهائي. ونفاذه معلق على قبول الأكاديمية لمواد المدرب.`
const ACKS = contractAcks(true).map((a) => a.key)

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  app = await buildApp(prisma)
  const admin = await auth.register('msb-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
  adminCookie = (await auth.login('msb-admin@test.local', 'Admin#12345')).token
}, 240_000)

let seq = 0

/** عرضٌ مشروطٌ وُقّع، وأعلن صاحبُه اكتمالَ موادّه — فالمهلةُ مجمَّدة */
async function frozenOffer() {
  seq += 1
  const email = `msb-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مرشّحٌ ${seq}`)
  await auth.setRoles(user.userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-MSB-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: 'onboarding', motivation: 'اختبار', privacyConsentAt: new Date(),
      userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: user.userId },
  })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `عرضٌ مشروطٌ ${seq}`, status: 'draft',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: [], signerEmail: email, gatesActivation: true,
      orientationAt: new Date(Date.now() - 2 * DAY),
      conditionDeadlineAt: new Date(Date.now() + 5 * DAY),
    },
  })
  const sent = await review.sendContract(contract.id, adminId)
  const token = decodeURIComponent(sent.signingUrl.split('/c/')[1])
  await review.signContractByToken(token, {
    legalName: `الاسمُ القانونيُّ ${seq}`, addressAr: 'عمّان — بناية ١٢',
    phone: '+962790000000', bodyHash: sha256(BODY), acks: [...ACKS],
  })
  /* وهو يجمّدها بنفسه — لا بيدٍ في القاعدة */
  await review.declareMaterialsComplete(user.userId)
  return { contract, profile, application, userId: user.userId }
}

const row = (id: string) => prisma.trainerContract.findUniqueOrThrow({ where: { id } })

describe('الطابورُ يرى الطورَ — ولم يكن يراه', () => {
  it('قائمةُ العقود تحمل أعمدةَ الشرط، فيُقرأ المجمَّدُ مجمَّدا', async () => {
    const t = await frozenOffer()
    const { contracts } = await review.listContracts()
    const found = contracts.find((c) => c.id === t.contract.id)
    expect(found, 'العقدُ ليس في القائمة أصلا').toBeTruthy()
    /* ولا `toHaveProperty` وحدَها: عمودٌ يُعاد فارغا لا يُرى في شاشة */
    expect(found!.conditionPausedAt, 'القائمةُ لا تقول إنّ موادَّه عندنا').toBeTruthy()
    expect(found!.conditionDeadlineAt, 'ولا تقول ما مهلتُه').toBeTruthy()

    /* والطورُ يُقرأ من مصدره الواحد على ما أعادته القائمة — وهو ما تفعله
       الشاشةُ بالحرف. فلو نقص عمودٌ لَقُرئ الطورُ غيرَ طوره. */
    expect(conditionPhase({
      orientationAt: found!.orientationAt,
      conditionDeadlineAt: found!.conditionDeadlineAt,
      conditionPausedAt: found!.conditionPausedAt,
      conditionMetAt: found!.conditionMetAt,
    })).toBe('under_review')
  })
})

describe('والمسارُ الذي تبلغه الشاشةُ يعمل بجلسةٍ وصلاحيّة', () => {
  it('يُعاد بملاحظاتٍ فتُرفَع عنه التجميدُ وتُزاد مهلتُه بمدّة التجميد', async () => {
    const t = await frozenOffer()
    /* ═══ ومدّةُ التجميد تُجعَل مقيسةً ═══

       الإعلانُ والإعادةُ يقعان في هذا الاختبار في أجزاءٍ من الثانية، فالمدّةُ
       المضافةُ صفرٌ تقريبا — و`toBeGreaterThanOrEqual` عليها تخضرّ ولو لم
       يُضَف شيءٌ البتّة، أي تقيس لا شيء. فيُؤخَّر خَتمُ التجميد يومَين،
       ويُقاس أنّ المهلةَ زادت يومَين. */
    await prisma.trainerContract.update({
      where: { id: t.contract.id },
      data: { conditionPausedAt: new Date(Date.now() - 2 * DAY) },
    })
    const before = await row(t.contract.id)
    expect(before.conditionPausedAt, 'لم تتجمّد أصلا — فالقياسُ على غير موضعه').toBeTruthy()

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/trainer-contracts/${t.contract.id}/return-materials`,
      cookies: { [SESSION_COOKIE]: adminCookie },
      payload: { notesAr: 'ينقص محورُ التقويم في الوحدة الثالثة' },
    })
    expect(res.statusCode, res.body).toBe(200)

    const after = await row(t.contract.id)
    expect(after.conditionPausedAt, 'بقيت مجمّدةً بعد الإعادة').toBeNull()
    const added = after.conditionDeadlineAt!.getTime() - before.conditionDeadlineAt!.getTime()
    /* يومان بهامشِ دقيقة — فوقتُ مراجعتنا لا يُحسب عليه ولا يُهدى له يومٌ لم ننتظره */
    expect(added, `المضافُ ${Math.round(added / 60000)} دقيقةً لا يومَين`)
      .toBeGreaterThan(2 * DAY - 60_000)
    expect(added, 'أُضيف أكثرُ من مدّة التجميد').toBeLessThan(2 * DAY + 60_000)
    /* ويعود إلى طورٍ تسير فيه مهلتُه — فالعاملُ يراه من جديد */
    expect(conditionPhase({
      conditionDeadlineAt: after.conditionDeadlineAt,
      conditionPausedAt: after.conditionPausedAt,
      conditionMetAt: after.conditionMetAt,
    })).toBe('running')
  })

  it('ولا يُعاد بملاحظةٍ أقصرَ من حدِّ الخادم — والشاشةُ تمنعها قبله', async () => {
    const t = await frozenOffer()
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/trainer-contracts/${t.contract.id}/return-materials`,
      cookies: { [SESSION_COOKIE]: adminCookie },
      payload: { notesAr: 'قصر' },
    })
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect((await row(t.contract.id)).conditionPausedAt, 'رُفع التجميدُ بلا ملاحظةٍ مقبولة')
      .toBeTruthy()
  })

  it('والبابُ محروسٌ — بلا جلسةٍ لا يُعاد شيء', async () => {
    const t = await frozenOffer()
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/trainer-contracts/${t.contract.id}/return-materials`,
      payload: { notesAr: 'ملاحظةٌ كافيةٌ طولا' },
    })
    expect(res.statusCode).toBeGreaterThanOrEqual(401)
    expect(res.statusCode).toBeLessThan(404)
    expect((await row(t.contract.id)).conditionPausedAt, 'رُفع التجميدُ بلا جلسة').toBeTruthy()
  })
})

/* توقيعُ العرض المشروط ينقل الطلبَ إلى «تهيئة» — بقاعدةٍ حقيقيّة.
 *
 * ── العطبُ الذي يحرسه ──
 *
 * `signContractByToken` كانت تكتب التوقيعَ ولا تحرّك حالةَ الطلب، فيبقى
 * `contract_pending` بعد أن وقّع. وثلاثةُ أشياءَ تنبني على الحالة وتسقط معها:
 *
 * ① بابُ الموادّ (`MATERIALS_STATUSES` = `onboarding` و`active`) يبقى مقفلا،
 *   ويُقرأ على من وقّع: «بوّابتك تُفتح بتوقيع عرضك المشروط — وقّعْه ثمّ
 *   ادخلها». فيُطالَب برفعِ موادٍّ من بابٍ لا يُفتح إلّا بما فعله.
 * ② و`remindConditionDeadlines` تشترط `application.status = 'onboarding'`،
 *   فلا يُذكَّر بقُرب انقضاء مهلته.
 * ③ و`noticeLapsedConditions` مثلُها، فلا يُبلَّغ بانقضائها. تنقضي في صمت.
 *
 * والمسارُ القديمُ (`signContract` المهجورة) كان ينقله، وضاع النقلُ حين صار
 * التوقيعُ من رابطه.
 *
 * ── وما يُقاس هنا: الأثرُ لا السطر ──
 *
 * لا يكفي أن تُقرأ الحالةُ `onboarding`: هي وسيلةٌ لا غاية. فيُسأل البابُ
 * نفسُه (`canWorkOnMaterials`) ويُشغَّل العاملُ نفسُه ويُعَدُّ من وجدهم —
 * فلو نُقل إلى حالةٍ أخرى تُقرأ «متقدّمةً» ولا يفتح بها بابٌ لَاحمرّ.
 *
 * ── والوجهُ الثاني: من لا تهيئةَ له لا يُحرَّك ──
 *
 * بندٌ يُوثَّق على مدرّبٍ **نشطٍ أصلا** (`gatesActivation = false`) طلبُه
 * `active`، و`active → onboarding` لا تُجيزه الخريطة. فتوقيعُه لا يمسّ حالتَه
 * — وإلّا عُطّل مدرّبٌ يعمل بتوقيعه بندا. وهي مصيدةُ `sendContract` نفسُها
 * التي دُفعت هناك بسؤال الحالة.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { contractAcks, CONDITION_CLAUSE_MARK } from '../../../src/application/trainer/contract-body'
import { canWorkOnMaterials } from '../../../src/application/trainer/portal-access'

let prisma: PrismaClient
let auth: AuthService
let review: TrainerReviewService
let adminId = ''

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const BODY = `نصُّ اتفاقيّةٍ للاختبار — البند 1 وما بعده.

${CONDITION_CLAUSE_MARK} لا عقد نهائي. ونفاذه معلق على قبول الأكاديمية لمواد المدرب.`
const DAY = 24 * 3600_000

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('door-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

let seq = 0

/** عقدٌ مرسَلٌ ينتظر التوقيعَ — بحالةِ طلبٍ تُطلَب وبنوعِ عقدٍ يُطلَب */
async function readyToSign(opts: { gatesActivation: boolean; appStatus: string }) {
  seq += 1
  const email = `door-${seq}-${Date.now()}@test.local`
  const user = await auth.register(email, 'Trainer#12345', `مرشّحٌ ${seq}`)
  await auth.setRoles(user.userId, ['trainer'])
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-DOOR-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`, email,
      status: opts.appStatus, motivation: 'اختبار', privacyConsentAt: new Date(),
      userId: user.userId,
    },
  })
  const profile = await prisma.trainerProfile.create({
    data: { applicationId: application.id, userId: user.userId, isVerified: true },
  })
  const contract = await prisma.trainerContract.create({
    data: {
      profileId: profile.id, title: `عقدُ ${seq}`, status: 'draft',
      bodyVersion: 'v-test', bodyAr: BODY, bodyHash: sha256(BODY),
      requiredDocuments: [], signerEmail: email,
      gatesActivation: opts.gatesActivation,
      /* ومهلةٌ تقارب: بها يُسأل العاملُ سؤالا له جواب */
      conditionDeadlineAt: opts.gatesActivation ? new Date(Date.now() + DAY) : null,
    },
  })
  const sent = await review.sendContract(contract.id, adminId)
  return {
    application, profile, contract,
    token: decodeURIComponent(sent.signingUrl.split('/c/')[1]),
  }
}

const sign = (token: string) => review.signContractByToken(token, {
  legalName: 'الاسمُ القانونيُّ الكامل', addressAr: 'عمّان — بناية ١٢',
  phone: '+962790000000', bodyHash: sha256(BODY),
  acks: contractAcks(true).map((a) => a.key),
})

describe('التوقيعُ يفتح بابَ الموادّ', () => {
  it('ينقل العرضَ المشروطَ إلى «تهيئة»، فيُفتح البابُ ويجده العامل', async () => {
    const { application, token } = await readyToSign({
      gatesActivation: true, appStatus: 'conditionally_approved',
    })

    /* ═══ وقبل التوقيع يُقرأ البابُ مقفلا — وإلّا فالفحصُ يقيس مفتوحا أصلا ═══ */
    const before = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })
    expect(before.status, 'الإرسالُ ينقل إلى «العقد قيد التوقيع»').toBe('contract_pending')
    expect(canWorkOnMaterials({ status: before.status })).toBe(false)

    await sign(token)

    const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })
    expect(after.status, 'وقّع فلم يتحرّك طلبُه').toBe('onboarding')
    /* والغايةُ لا الوسيلة: البابُ يُسأل بالدالّة التي تسأله في الخادم */
    expect(canWorkOnMaterials({ status: after.status }), 'وقّع والبابُ مقفلٌ دونه').toBe(true)

    /* والعاملُ يجده الآن — وهو الذي كان يتخطّاه */
    const { reminded } = await review.remindConditionDeadlines(new Date())
    expect(reminded, 'انقضت مهلتُه ولا مذكِّر').toBeGreaterThanOrEqual(1)
    const c = await prisma.trainerContract.findFirstOrThrow({
      where: { profileId: (await prisma.trainerProfile.findUniqueOrThrow({
        where: { applicationId: application.id },
      })).id },
    })
    expect(c.conditionRemindedAt, 'ذُكِّر ولم يُؤشَّر — فيُطرَق بابُه كلَّ ساعة').not.toBeNull()
  })

  /* ═══ والرمزُ يموت بالتوقيع — وبهذا الرمزِ بعينه تعرف الشاشةُ ما تقول ═══

     صفحةُ التوقيع تفرّق بين «انتهى هذا الرابط» (لوحُ تنبيهٍ يقول أين نسختُه)
     وبين «تعذّر فتحُ العقد» (لوحٌ أحمر) بـ`code === 'invalid_token'`. فلو
     تبدّل الرمزُ في الخادم لَعاد الموقِّعُ يقرأ الأحمرَ على فعلٍ نجح — وهو
     البلاغُ الأصليّ. فالعقدُ بينهما يُثبَّت هنا لا في الشاشة وحدَها. */
  it('والرمزُ يموت بالتوقيع، ويُردّ بـ`invalid_token` الذي تقرؤه الشاشة', async () => {
    const { token } = await readyToSign({
      gatesActivation: true, appStatus: 'conditionally_approved',
    })
    await sign(token)
    await expect(review.contractByToken(token))
      .rejects.toMatchObject({ code: 'invalid_token', status: 404 })
  })

  it('ولا يُحرّك بندٌ يُوثَّق على مدرّبٍ نشطٍ حالتَه — فلا يُعطَّل من يعمل', async () => {
    const { application, token } = await readyToSign({
      gatesActivation: false, appStatus: 'active',
    })
    const before = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })
    expect(before.status, 'الإرسالُ لا يمسّ حالةَ النشط').toBe('active')

    /* ولا يرمي: نقلٌ غيرُ مشروعٍ يُسأل قبل أن يُطلَب، فلا يسقط توقيعٌ صحيح */
    await expect(sign(token)).resolves.toMatchObject({ ok: true })

    const after = await prisma.trainerApplication.findUniqueOrThrow({ where: { id: application.id } })
    expect(after.status, 'وقّع بندا فعُطّل عن عمله').toBe('active')
  })
})

/* تحديثُ نصِّ العروض المفتوحة في مكانها — بالرابط نفسِه.
 *
 * ═══ ما أمر به صاحبُ المنصّة (٣٠ سبتمبر ٢٠٢٦) ═══
 *
 * «الا يمكن ان لا يصله ايميل ويكون لنا خانه تحديث العقد ويتغير العقد الموجود
 * لكل شخص لم يوقعه بدون ان يصل له رابط جديد؟» — ثمّ: كلاهما (المرسَلُ وما
 * طُلب فيه تعديل)، والرسالةُ تقول ما تغيّر نقاطا.
 *
 * ═══ وما يُقاس، وكلُّه يقع صامتا لو انكسر ═══
 *
 * ① **الرمزُ لا يُمَسّ** — وإلّا مات رابطٌ بيد صاحبه بلا أن يُقال له.
 * ② **والموقَّعُ لا يُمَسّ** — وهو الأخطر: وثيقةٌ وُقّعت يُبدَّل نصُّها فتفترق
 *   عن بصمتها، فلا يُعرَف بعدها ما وُقّع عليه.
 * ③ **ولا يُوقَّع على غير ما قُرئ** — من كانت صفحتُه مفتوحةً على القديم يُردّ.
 * ④ **ويُكتب أنّه حُدّث ومن أيّ إصدار** — سجلًّا يُسأل عنه، لا شريطا على صفحته:
 *   نُزع الشريطُ بقرار صاحب المنصّة (١ أكتوبر ٢٠٢٦)، والحارسُ مقلوبٌ أدناه.
 * ⑤ **ولقطتُه لا تتبدّل** — دوراتُه وأتعابُه ووثائقُه وتاريخُ إصداره كما كانت:
 *   المحدَّثُ نصُّه لا ما اتُّفق عليه.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { CONTRACT_BODY_VERSION, contractAcks } from '../../../src/application/trainer/contract-body'
import { changesBetween } from '../../../src/application/trainer/contract-changelog'
import { fmtDateWith } from '../../../src/application/text/format-ar'

let prisma: PrismaClient
let review: TrainerReviewService
let adminId = ''
let seq = 0

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const ALL_ACKS = contractAcks(true).map((a) => a.key)
/** إصدارٌ قديمٌ مفتعَل — فالتحديثُ لا يقع إلّا على ما يخالف الحاليّ */
const OLD_VERSION = 'v1-قديم-للاختبار'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const auth = new AuthService(prisma)
  review = new TrainerReviewService(prisma)
  const admin = await auth.register('refresh-admin@test.local', 'Admin#12345', 'المدير الأكاديمي')
  adminId = admin.userId
  await auth.setRoles(adminId, ['academic_manager'])
}, 240_000)

/** عقدٌ مؤلَّفٌ بمتنٍ حقيقيّ ثمّ يُرسَل — ويُعاد رمزُه ومتنُه القديم */
async function openContract(
  status: 'sent' | 'amendment_requested' = 'sent',
  /** `body`: نصٌّ مخالفٌ للقالب (عرضٌ قديمٌ حقّا) · `version-only`: الإصدارُ
   *  وحدَه قديمٌ والنصُّ هو ما يخرج من القالب اليومَ. */
  stale: 'body' | 'version-only' = 'body',
) {
  seq += 1
  const app = await prisma.trainerApplication.create({
    data: {
      reference: `TR-RF-${Date.now()}-${seq}`, fullName: `مرشّحٌ ${seq}`,
      email: `refresh-${seq}-${Date.now()}@test.local`,
      status: 'conditionally_approved', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profile = await prisma.trainerProfile.create({ data: { applicationId: app.id } })
  const composed = await review.composeContract(app.id, adminId, {
    title: `اتفاقيّةُ اختبارٍ ${seq}`,
    courseIds: undefined,
    compensation: { type: 'per_seat', rate: 25, currency: 'USD', minSeats: 12, referralRate: 30 },
    rateWaivedReasonAr: null,
    hoursNoteAr: null,
    /* ووثيقةُ هويّةٍ لازمةٌ في التركيب (البند 15) — وتُرفَع في السقالة نفسِها،
       فالمقيسُ هنا النصُّ لا الرفع. */
    requiredDocuments: [{ kind: 'national_id', labelAr: 'الهوية الوطنية', required: true }],
  } as never)
  const contractId = (composed as { contractId?: string; id?: string }).contractId
    ?? (composed as { id: string }).id
  const sent = await review.sendContract(contractId, adminId)
  const token = decodeURIComponent(sent.signingUrl.split('/c/')[1])
  await prisma.trainerContractDocument.create({
    data: {
      contractId, kind: 'national_id', storageKey: `rf-${contractId}`,
      originalName: 'id.pdf', mime: 'application/pdf', sizeBytes: 1024,
    },
  })
  /* ═══ ويُفتعَل القديمُ نصّا لا إصدارا وحدَه ═══

     العقدُ رُكّب بالقالب الحاليّ، فإعادةُ تصييره تُخرج النصَّ نفسَه — ويتخطّاه
     المسلكُ بحقّ («نصُّه هو نفسُه»). فيُبدَّل حرفٌ في المحفوظ ليصير ما يُصيَّر
     مخالفا له، كما يكون العرضُ القديمُ في الواقع. */
  const composedRow = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
  if (stale === 'version-only') {
    await prisma.trainerContract.update({
      where: { id: contractId }, data: { bodyVersion: OLD_VERSION },
    })
  } else {
    const staleBody = `${composedRow.bodyAr}\n\nسطرٌ من إصدارٍ قديمٍ لا يخرج من القالب الحاليّ.`
    await prisma.trainerContract.update({
      where: { id: contractId },
      data: { bodyVersion: OLD_VERSION, bodyAr: staleBody, bodyHash: sha256(staleBody) },
    })
  }
  if (status === 'amendment_requested') {
    await review.requestContractAmendment(token, 'أرجو مراجعةَ البند الرابع فالمهلةُ قصيرة')
  }
  const row = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
  return { app, profile, contractId, token, before: row }
}

describe('النصُّ يُحدَّث والرمزُ لا يُمَسّ', () => {
  it('عرضٌ مرسَلٌ يلحق الإصدارَ الحاليَّ، ورابطُه هو هو', async () => {
    const { contractId, token, before } = await openContract('sent')
    const out = await review.refreshOpenContracts(adminId)
    expect(out.updated, 'لم يُحدَّث شيء').toBeGreaterThanOrEqual(1)

    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.bodyVersion, 'لم يلحق الإصدارَ الحاليّ').toBe(CONTRACT_BODY_VERSION)
    expect(after.bodyAr, 'لم يتبدّل النصّ').not.toBe(before.bodyAr)
    expect(after.bodyHash, 'بُدّل النصُّ ولم تتبدّل بصمتُه').toBe(sha256(after.bodyAr ?? ''))
    /* ① الرمزُ نفسُه — والرابطُ الذي بيده يفتح */
    expect(after.tokenHash, 'مات رمزُ صاحبه بلا أن يُقال له').toBe(before.tokenHash)
    const view = await review.contractByToken(token)
    expect(view.state, 'لم يعد رابطُه يفتح').toBe('open')
  })

  it('وعرضٌ طُلب فيه تعديلٌ يُحدَّث كذلك — بأمرِ صاحب المنصّة «both»', async () => {
    const { contractId } = await openContract('amendment_requested')
    await review.refreshOpenContracts(adminId)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.bodyVersion, 'تُرك طالبُ التعديل على نصٍّ قديم').toBe(CONTRACT_BODY_VERSION)
  })

  it('④ ويُكتب متى حُدّث ومن أيّ إصدار — سجلًّا لا شريطا', async () => {
    const { contractId } = await openContract('sent')
    await review.refreshOpenContracts(adminId)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.bodyUpdatedAt, 'لا تاريخَ تحديثٍ — فلا يُعرَف متى تبدّل نصُّه تحته').toBeTruthy()
    expect(after.bodyPrevVersion, 'لا إصدارَ سابقٌ — فلا يُعرَف ما بينهما').toBe(OLD_VERSION)
  })

  /* ═══ والحارسُ مقلوب — قرارُ صاحب المنصّة (١ أكتوبر ٢٠٢٦) ═══

     كان هنا «والصفحةُ تقرأ خبرَ التحديث ونقاطَه من الرابط». ونزع صاحبُ
     المنصّة الشريط: «no need for the update list on the top of the contract,
     because they have received an email with these changes». فلا يُحذَف
     الحارسُ بحذف ما يحرسه، بل يُقلَب — وإلّا عاد الشريطُ بلا أن ينبّه أحد.

     ويُقاس **بالمحتوى لا بالاسم**: لا تظهر نقطةٌ من نقاط التغيير في شيءٍ ممّا
     يصل الصفحةَ عدا نصِّ العقد نفسِه — فشريطٌ يعود باسمٍ آخرَ يُمسَك كذلك. */
  it('ولا تحمل الصفحةُ قائمةَ ما تغيّر — ولو أُرسل البريد', async () => {
    const { token, before } = await openContract('sent')
    await review.refreshOpenContracts(adminId)
    const view = await review.contractByToken(token)
    if (view.state !== 'open') throw new Error('لم يُفتح الرابط')
    expect(view.bodyAr, 'لم يُحدَّث النصّ — فالفحصُ يقيس صفحةً لم يتبدّل فيها شيء').not.toBe(before.bodyAr)

    const points = changesBetween(OLD_VERSION, CONTRACT_BODY_VERSION)
    expect(points.length, 'لا نقاطَ يُبحَث عنها — فالفحصُ يقيس الفراغ').toBeGreaterThan(0)
    /* ونصُّ العقد نفسُه يُستثنى: هو ما يُقرأ، وليس شريطا فوقه */
    const shown = JSON.stringify({ ...view, bodyAr: null })
    for (const p of points) expect(shown, `عادت قائمةُ التغيير إلى الصفحة: ${p}`).not.toContain(p)
    expect(Object.keys(view), 'عاد حقلُ الشريط').not.toContain('bodyChangesAr')
    expect(Object.keys(view), 'عاد تاريخُ الشريط').not.toContain('bodyUpdatedAt')
  })
})

describe('② والموقَّعُ لا يُمَسّ — وهو أخطرُها', () => {
  it('عقدٌ وُقّع يبقى نصُّه وبصمتُه كما وُقّعا', async () => {
    const { contractId, token } = await openContract('sent')
    await review.signContractByToken(token, {
      addressAr: 'عمّان — الدوّار السابع', phone: '+962790000000',
      legalName: 'سارة عبد الله الحربي', bodyHash: (await prisma.trainerContract
        .findUniqueOrThrow({ where: { id: contractId } })).bodyHash!,
      acks: [...ALL_ACKS],
    })
    const signed = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })

    await review.refreshOpenContracts(adminId)

    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.bodyAr, 'بُدّل نصُّ وثيقةٍ وُقّعت').toBe(signed.bodyAr)
    expect(after.bodyHash, 'بُدّلت بصمةُ وثيقةٍ وُقّعت').toBe(signed.bodyHash)
    expect(after.bodyUpdatedAt, 'كُتب تحديثٌ على موقَّع').toBeNull()
    /* والبصمةُ المحفوظةُ مع التوقيع تبقى مطابِقةً لِما وُقّع عليه */
    expect(after.signedBodyHash, 'افترق الموقَّعُ عن بصمته').toBe(after.bodyHash)
  })
})

describe('② (ب) والحارسُ الثاني يمسك ما يفلت من الحالة', () => {
  /* ═══ ولمَ لا يكفي شرطُ الحالة ═══

     الاستعلامُ يقصر على `sent` و`amendment_requested`، فالموقَّعُ لا يبلغ
     الحلقةَ أصلا — ولذلك لم يسقط شيءٌ حين رُفع `isUntouchableContract` في
     أوّل قياس. لكنّ رأسَ `contract-untouchable.ts` يذكر الصفَّ المرضيّ
     بعينه: حالةٌ لا تقول «وُقّع» وتاريخُ توقيعٍ مكتوب (هجرةٌ قديمةٌ، أو
     كتابةٌ جزئيّةٌ سقطت بينهما). وذلك ما يُفتعَل هنا. */
  it('صفٌّ حالتُه مفتوحةٌ وفيه تاريخُ توقيعٍ لا يُمَسّ نصُّه', async () => {
    const { contractId } = await openContract('sent')
    const before = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    await prisma.trainerContract.update({
      where: { id: contractId }, data: { signedAt: new Date() },
    })

    await review.refreshOpenContracts(adminId)

    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.bodyAr, 'بُدّل نصُّ صفٍّ مسّه توقيعٌ ولو كانت حالتُه مفتوحة').toBe(before.bodyAr)
    expect(after.bodyUpdatedAt, 'كُتب تحديثٌ على صفٍّ مسّه توقيع').toBeNull()
  })
})

describe('⑥ وما وُقّع بين القراءة والكتابة لا يُكتب فوقه', () => {
  /* ═══ ولمَ تُفتعَل المسابقة ═══

     «قارنْ واضبطْ» في شرط الكتابة يحرس ثقبا لا يبلغه قياسٌ متسلسل: تُقرأ
     الصفوفُ وحالتُها مفتوحةٌ، ثمّ يوقّع صاحبُها قبل أن تُكتب. فلا سبيلَ إلى
     إظهاره إلّا بحشر التوقيعةِ في ثنية القراءة نفسِها — وامتدادُ Prisma
     يفعلها: يوقّع بعد أن تعود الصفوفُ وقبل أن يُصيَّر النصُّ ويُكتب.

     ولولاه لَكُتب نصٌّ جديدٌ فوق وثيقةٍ وُقّعت — وهي أخطرُ ما في المسلك. */
  it('عرضٌ وُقّع بعد القراءة يبقى نصُّه، ولا يُعَدّ محدَّثا', async () => {
    const { contractId, before } = await openContract('sent')
    let raced = false
    const racing = prisma.$extends({
      query: {
        trainerContract: {
          async findMany({ args, query }) {
            const rows = await query(args)
            if (!raced && (rows as { id: string }[]).some((r) => r.id === contractId)) {
              raced = true
              await prisma.trainerContract.update({
                where: { id: contractId },
                data: {
                  status: 'signed', signedAt: new Date(),
                  signedBodyHash: before.bodyHash,
                },
              })
            }
            return rows
          },
        },
      },
    }) as unknown as PrismaClient
    const racer = new TrainerReviewService(racing)

    const res = await racer.refreshOpenContracts(adminId)

    expect(raced, 'ما وقعت المسابقةُ أصلا — فالقياسُ لا يقول شيئا').toBe(true)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.bodyAr, 'كُتب نصٌّ جديدٌ فوق وثيقةٍ وُقّعت').toBe(before.bodyAr)
    expect(after.bodyHash, 'تبدّلت بصمةُ ما وُقّع عليه').toBe(before.bodyHash)
    expect(after.bodyUpdatedAt, 'كُتب شريطُ تحديثٍ على عرضٍ وُقّع').toBeNull()
    expect(res.updated, 'عُدّ محدَّثا ما لم يُكتب، فيبلغه بريدٌ بغير ما جرى').toBe(0)
    const ev = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.contract.body_refreshed', entityId: contractId },
    })
    expect(ev, 'كُتب أثرُ تحديثٍ لم يقع').toBeNull()
  })
})

describe('③ ولا يُوقَّع على غير ما قُرئ', () => {
  it('من فتح صفحتَه على القديم ثمّ وقّع يُردّ بـ`body_changed`', async () => {
    const { token, before } = await openContract('sent')
    await review.refreshOpenContracts(adminId)
    await expect(review.signContractByToken(token, {
      addressAr: 'عمّان — الدوّار السابع', phone: '+962790000000',
      legalName: 'سارة عبد الله الحربي',
      /* البصمةُ التي كانت معروضةً عليه قبل التحديث */
      bodyHash: before.bodyHash!,
      acks: [...ALL_ACKS],
    })).rejects.toMatchObject({ code: 'body_changed' })
  })
})

describe('⑤ ولقطتُه لا تتبدّل — المحدَّثُ نصُّه لا ما اتُّفق عليه', () => {
  it('الدوراتُ والأتعابُ والوثائقُ وتاريخُ الإصدار كما كانت', async () => {
    const { contractId } = await openContract('sent')
    /* ═══ ولمَ يُرجَع الميلادُ شهرَين ═══

       العرضُ المفتوحُ في الواقع صدر قبل يومِ التحديث. ولو بقي ميلادُه اليومَ
       لَطابق `c.createdAt` تاريخَ اليوم، فلا يُفرَّق المطبوعُ الصحيحُ من
       الخاطئ — ومرّ القياسُ الأوّلُ خضراءَ لهذا السبب لا لسلامة المسلك. */
    const issuedOn = new Date(Date.now() - 62 * 864e5)
    await prisma.trainerContract.update({ where: { id: contractId }, data: { createdAt: issuedOn } })
    const before = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })

    await review.refreshOpenContracts(adminId)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.qualifiedSnapshot).toEqual(before.qualifiedSnapshot)
    expect(after.requiredDocuments).toEqual(before.requiredDocuments)
    expect(String(after.compensationRate), 'تبدّل أجرُ المقعد').toBe(String(before.compensationRate))
    expect(after.compensationMinSeats).toBe(before.compensationMinSeats)
    expect(after.createdAt.getTime(), 'تبدّل ميلادُ العقد').toBe(before.createdAt.getTime())
    /* ═══ وتاريخُ الإصدار يُقاس في المطبوع لا في العمود ═══

       `createdAt` لا يكتبه التحديثُ أصلا، فثباتُه لا يقول شيئا. والمقيسُ
       ما يقرؤه صاحبُ الوثيقة: «تاريخ الإصدار» مطبوعا في صدرها. ولو كُتب
       تاريخُ اليومَ لَقرأ وثيقةً تقول إنّها صدرت بعد أن قرأها. */
    const issuedLine = (body: string) =>
      body.split('\n').find((l) => l.includes('تاريخ الإصدار')) ?? '«تاريخ الإصدار» غائبٌ عن النصّ'
    const dayOf = (d: Date) => fmtDateWith(d, { year: 'numeric', month: 'long', day: 'numeric' })
    expect(issuedLine(after.bodyAr ?? ''), 'المطبوعُ لا يقول يومَ صدوره')
      .toContain(dayOf(issuedOn))
    expect(issuedLine(after.bodyAr ?? ''), 'كُتب تاريخُ اليومَ في صدر وثيقةٍ صدرت قبلَه')
      .not.toContain(dayOf(new Date()))
    expect(after.title).toBe(before.title)
  })

  /* ═══ وأيُّ حارسٍ يحرس هذا ═══

     شرطُ `bodyVersion: { not: … }` في الاستعلام تخفيفٌ للقراءة لا حارس: لو
     رُفع لَقرأ المسلكُ صفوفا زائدةً ثمّ تخطّاها كلَّها بـ«نصُّه هو نفسُه».
     والحارسُ الحقيقيُّ هو ذاك التخطّي — وهو ما يسقط هذا القياسُ إن رُفع. */
  it('ولا يُحدَّث ما هو على الإصدار الحاليّ — فلا رسالةَ بلا سبب', async () => {
    await openContract('sent')
    await review.refreshOpenContracts(adminId)
    const second = await review.refreshOpenContracts(adminId)
    expect(second.updated, 'حُدّث ما لا جديدَ فيه، فوصلت رسالةٌ بلا سبب').toBe(0)
  })

  /* ═══ وهذا يعزل التخطّي ═══

     الإصدارُ قديمٌ فالاستعلامُ يُمرّر الصفَّ، والنصُّ هو ما يخرج من القالب
     اليومَ فلا جديدَ فيه — فلا يمنعه إلّا «نصُّه هو نفسُه». ولو رُفع لَوصلت
     كلَّ مدرّبٍ رسالةُ «حُدّث عرضُك» على تحديثٍ لا يُرى منه حرف، ولَكُتب
     شريطٌ في صفحته بلا نقطةٍ تُقال. وفيه فوقَ ذلك قياسُ استقرارٍ: ما يصيّره
     `composeContract` وما يصيّره التحديثُ سواءٌ حرفا بحرفٍ لعقدٍ لم يتبدّل. */
  it('إصدارٌ قديمٌ ونصٌّ لا جديدَ فيه يُتخطّى بلا رسالةٍ ولا أثر', async () => {
    const { contractId, before } = await openContract('sent', 'version-only')
    const res = await review.refreshOpenContracts(adminId)

    expect(res.updated, 'حُدّث عقدٌ نصُّه هو نفسُه، فوصلت رسالةٌ بلا جديد').toBe(0)
    const after = await prisma.trainerContract.findUniqueOrThrow({ where: { id: contractId } })
    expect(after.bodyAr, 'بُدّل نصٌّ لا جديدَ فيه').toBe(before.bodyAr)
    expect(after.bodyUpdatedAt, 'كُتب شريطُ تحديثٍ بلا تحديث').toBeNull()
    const ev = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.contract.body_refreshed', entityId: contractId },
    })
    expect(ev, 'كُتب أثرُ تحديثٍ بلا تحديث').toBeNull()
  })

  it('ويُكتب في الأثر من أيّ إصدارٍ إلى أيّ', async () => {
    const { contractId } = await openContract('sent')
    await review.refreshOpenContracts(adminId)
    const ev = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.contract.body_refreshed', entityId: contractId },
    })
    expect(ev, 'حُدّث نصُّ عقدٍ بلا أثر').toBeTruthy()
    expect(JSON.stringify(ev!.meta), 'الأثرُ لا يقول من أيّ إصدارٍ إلى أيّ').toContain(CONTRACT_BODY_VERSION)
  })
})

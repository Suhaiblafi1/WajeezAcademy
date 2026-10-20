/* حزمةُ المدرّبين لكتابة اقتراحاتنا — ما كتبوه وسيرُهم وشهاداتُهم.

   قرارُ صاحب المنصّة (٢٠ أكتوبر ٢٠٢٦): «اكتب للجميع.. اجعلها جاهزةً للجميع»، والحزمةُ «مع السير
   الذاتيّة والشهادات». فيُحرس هنا:
   ١) أنّ فيها من لا مسوّدةَ له ولا اقتراح — ومن اقتُرح عليه لا يعود؛
   ٢) وسيرتَه وشهادتَه كما رفعهما، ولا وثيقةَ من نوعٍ آخر؛
   ٣) ولا بريدَ ولا هاتفَ في نصّها — والسيرةُ وحدَها تحمل ما كتبه صاحبُها؛
   ٤) وما جاوز الحدَّ يُقال ولا يُسكت عنه؛
   ٥) ولكلّ مدرّبٍ فيها أثرُ التنزيل باسم من نزّلها.

   ٦) ولمن له دورةٌ معتمدةٌ واحدةٌ على الأقلّ وحدَه، وأجزاءً لا يُفرَّق فيها مدرّبٌ (٢٠ أكتوبر ٢٠٢٦: «الملفّ
      كبيرٌ جدّا»، و«يُعتمَد دورةٌ واحدةٌ على الأقلّ لكلّ مدرّب»).

   ورُئي ساقطا: أُسقط شرطُ «لم يُقترح عليه» فعاد المقترَحُ عليه، وأُدخلت `reference_letter`
   فدخلت، وأُضيف البريدُ إلى الحقول فظهر، وأُسقط شرطُ الدورة المعتمدة فدخل من لا دورةَ له،
   وجُمع المدرّبون في جزءٍ واحد فجاوز حدَّه. ثمّ أُعيدت. */

import { beforeAll, describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { giveLiveCourse } from '../helpers/live-course'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerSuggestionService } from '../../services/trainer-suggestion.service'
import { DRAFTING_FILE_MAX_BYTES, TrainerDraftingBundleService } from '../../services/trainer-drafting-bundle.service'

const COURSE = 'C-BIZ-101'

let prisma: PrismaClient
let bundles: TrainerDraftingBundleService
const ACTOR = '00000000-0000-0000-0000-000000000009'
const EMAIL = 'drafting-a@test.local'
const PHONE = '791234567'
let mineId = ''
let mineApp = ''
let sentId = ''
let pendingId = ''
let secondId = ''
let built: Awaited<ReturnType<TrainerDraftingBundleService['build']>>
let zip: JSZip

let seq = 0
/* والمفتاحُ مسطّحٌ كمفاتيح المخزن الحقيقيّة — مفتاحٌ بشَرطةٍ مائلةٍ يردّه المخزنُ فيُعدّ غائبا */
const doc = (applicationId: string, kind: string, name: string, body: string, sizeBytes?: number) =>
  prisma.trainerApplicationDocument.create({
    data: {
      applicationId, kind, originalName: name, mime: 'application/pdf',
      storageKey: `draft-${applicationId}-${(seq += 1)}`,
      content: Buffer.from(body), sizeBytes: sizeBytes ?? Buffer.byteLength(body),
    },
  })

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  const review = new TrainerReviewService(prisma)
  bundles = new TrainerDraftingBundleService(prisma)

  const mine = await review.createTrainerDirectly(ACTOR, { fullName: 'سارة الاختبار', email: EMAIL })
  mineId = mine.profileId
  mineApp = mine.applicationId
  await prisma.trainerApplication.update({
    where: { id: mineApp },
    data: {
      phone: PHONE, jobTitle: 'مستشارة موارد بشرية', domainYears: '8-12', bio: 'أدرّب على المقابلات منذ سنوات.',
      hasAccreditation: true, accreditationDetails: 'SHRM-CP',
      previousCourses: [{ title: 'مهارات المقابلة', org: 'وزارة العمل', year: '2025', learnersCount: 40 }],
    },
  })
  await giveLiveCourse(prisma, mineId)
  const qualify = (profileId: string, status = 'qualified') =>
    prisma.trainerCourseQualification.create({ data: { profileId, courseId: COURSE, status } })
  await qualify(mineId)
  await doc(mineApp, 'cv', 'سيرتي.pdf', 'CV-BODY')
  await doc(mineApp, 'certificate', 'shrm.pdf', 'CERT-BODY')
  await doc(mineApp, 'reference_letter', 'letter.pdf', 'LETTER-BODY')
  await doc(mineApp, 'certificate', 'huge.pdf', 'X', DRAFTING_FILE_MAX_BYTES + 1)

  /* ومن اقتُرح عليه شيءٌ لا يعود إلى الحزمة */
  const sent = await review.createTrainerDirectly(ACTOR, { fullName: 'مدرّب وصله اقتراح', email: 'drafting-b@test.local' })
  sentId = sent.profileId
  await qualify(sentId)
  await new TrainerSuggestionService(prisma).propose(sentId, ACTOR, 'pitch', ['سطر وصله منا'])

  /* ومن لا دورةَ معتمدةً له — طلبُ تأهيله معلّق — لا يدخلها */
  pendingId = (await review.createTrainerDirectly(ACTOR, { fullName: 'مدرّب ينتظر اعتماد دورته', email: 'drafting-c@test.local' })).profileId
  await qualify(pendingId, 'pending')

  /* ومدرّبٌ ثانٍ بسيرة — ليُرى التقسيمُ أجزاءً */
  const second = await review.createTrainerDirectly(ACTOR, { fullName: 'مدرّب ثان', email: 'drafting-d@test.local' })
  secondId = second.profileId
  await qualify(secondId)
  await doc(second.applicationId, 'cv', 'cv2.pdf', 'SECOND-CV')

  built = await bundles.build(ACTOR)
  zip = await JSZip.loadAsync(built.zip)
}, 240_000)

describe('من فيها', () => {
  it('⚠️ من لا مسوّدة له ولا اقتراح — ومن اقتُرح عليه لا يعود', () => {
    const ids = built.trainers.map((t) => t.profileId)
    expect(ids).toContain(mineId)
    expect(ids, 'عاد إلى الحزمة من وصله اقتراح').not.toContain(sentId)
  })

  it('⚠️ ولمن له دورة معتمدة وحده — المعلّق تأهيلُه لا يدخل', () => {
    expect(built.trainers.map((t) => t.profileId), 'دخل من لا دورة معتمدة له').not.toContain(pendingId)
  })

  it('وحالُه، وأنّ له دورةً منشورة، وما كتبه في طلبه', () => {
    const t = built.trainers.find((x) => x.profileId === mineId)!
    expect(t.status).toBe('active')
    expect(t.liveCourse).toBe(true)
    expect(t.application.jobTitle).toBe('مستشارة موارد بشرية')
    expect(t.application.accreditation).toBe('SHRM-CP')
    expect(t.application.previousCourses).toEqual([{ title: 'مهارات المقابلة', org: 'وزارة العمل', year: '2025', learners: '40' }])
  })
})

describe('ملفّاتُه', () => {
  it('⚠️ سيرتُه وشهادتُه كما رفعهما — ولا وثيقةَ من نوعٍ آخر', async () => {
    const t = built.trainers.find((x) => x.profileId === mineId)!
    const inZip = t.files.filter((f) => f.path)
    expect(inZip.map((f) => f.kind).sort()).toEqual(['certificate', 'cv'])
    expect(await zip.file(inZip.find((f) => f.kind === 'cv')!.path!)!.async('string')).toBe('CV-BODY')
    expect(t.files.map((f) => f.kind), 'دخلت وثيقةٌ لم تُطلب').not.toContain('reference_letter')
  })

  it('⚠️ وما جاوز الحدّ يُقال ولا يُسكت عنه', async () => {
    const huge = built.trainers.find((x) => x.profileId === mineId)!.files.find((f) => f.originalName === 'huge.pdf')!
    expect(huge.path).toBeNull()
    expect(huge.skippedAr).toMatch(/أكبر من/)
    expect(await zip.file('المدربون.md')!.async('string')).toContain('«huge.pdf» لم يدخل')
  })
})

describe('وما ليس فيها', () => {
  it('⚠️ لا بريد ولا هاتف في نصّها', async () => {
    for (const name of ['trainers.json', 'المدربون.md']) {
      const text = await zip.file(name)!.async('string')
      expect(text, `${name}: فيه البريد`).not.toContain(EMAIL)
      expect(text, `${name}: فيه الهاتف`).not.toContain(PHONE)
    }
  })

  it('ولكلّ مدرّب فيها أثر التنزيل', async () => {
    const n = await prisma.auditEvent.count({ where: { action: 'trainer.drafting_bundle.download', entityId: mineId, actorId: ACTOR } })
    expect(n).toBe(1)
  })
})

describe('أجزاءً تُرفع', () => {
  /* حدٌّ صغيرٌ يُمرَّر — فيُرى التقسيمُ بملفّاتٍ من بايتات */
  const TINY = 12

  it('⚠️ كلُّ مدرّبٍ جاوزت ملفّاتُه الحدَّ في جزءٍ وحدَه — ولا يُفرَّق مدرّب', async () => {
    expect((await bundles.parts(TINY)).parts, 'جُمع المدرّبون في جزءٍ واحد').toBe(2)
    const one = await bundles.build(ACTOR, 1, new Date(), TINY)
    const two = await bundles.build(ACTOR, 2, new Date(), TINY)
    expect(one.trainers.map((t) => t.profileId)).toEqual([mineId])
    expect(two.trainers.map((t) => t.profileId)).toEqual([secondId])
    expect(two.fileName).toMatch(/الجزء-2-من-2\.zip$/)
  })

  it('وما لا يتّسع له الجزء يُقال', async () => {
    const one = await bundles.build(ACTOR, 1, new Date(), TINY)
    const cert = one.trainers[0]!.files.find((f) => f.originalName === 'shrm.pdf')!
    expect(cert.path).toBeNull()
    expect(cert.skippedAr).toMatch(/امتلأ الجزء/)
  })

  it('وجزءٌ لا وجود له يُردّ', async () => {
    await expect(bundles.build(ACTOR, 9, new Date(), TINY)).rejects.toThrow()
  })
})

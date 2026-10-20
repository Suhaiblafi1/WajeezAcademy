/* حزمةُ المدرّبين لكتابة اقتراحاتنا — ما كتبوه وسيرُهم وشهاداتُهم.

   قرارُ صاحب المنصّة (٢٠ أكتوبر ٢٠٢٦): «اكتب للجميع.. اجعلها جاهزةً للجميع»، والحزمةُ «مع السير
   الذاتيّة والشهادات». فيُحرس هنا:
   ١) أنّ فيها من لا مسوّدةَ له ولا اقتراح — ومن اقتُرح عليه لا يعود؛
   ٢) وسيرتَه وشهادتَه كما رفعهما، ولا وثيقةَ من نوعٍ آخر؛
   ٣) ولا بريدَ ولا هاتفَ في نصّها — والسيرةُ وحدَها تحمل ما كتبه صاحبُها؛
   ٤) وما جاوز الحدَّ يُقال ولا يُسكت عنه؛
   ٥) ولكلّ مدرّبٍ فيها أثرُ التنزيل باسم من نزّلها.

   ورُئي ساقطا: أُسقط شرطُ «لم يُقترح عليه» فعاد المقترَحُ عليه، وأُدخلت `reference_letter`
   فدخلت، وأُضيف البريدُ إلى الحقول فظهر. ثمّ أُعيدت. */

import { beforeAll, describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { giveLiveCourse } from '../helpers/live-course'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerSuggestionService } from '../../services/trainer-suggestion.service'
import { DRAFTING_FILE_MAX_BYTES, TrainerDraftingBundleService } from '../../services/trainer-drafting-bundle.service'

let prisma: PrismaClient
let bundles: TrainerDraftingBundleService
const ACTOR = '00000000-0000-0000-0000-000000000009'
const EMAIL = 'drafting-a@test.local'
const PHONE = '791234567'
let mineId = ''
let mineApp = ''
let sentId = ''
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
  await doc(mineApp, 'cv', 'سيرتي.pdf', 'CV-BODY')
  await doc(mineApp, 'certificate', 'shrm.pdf', 'CERT-BODY')
  await doc(mineApp, 'reference_letter', 'letter.pdf', 'LETTER-BODY')
  await doc(mineApp, 'certificate', 'huge.pdf', 'X', DRAFTING_FILE_MAX_BYTES + 1)

  /* ومن اقتُرح عليه شيءٌ لا يعود إلى الحزمة */
  const sent = await review.createTrainerDirectly(ACTOR, { fullName: 'مدرّب وصله اقتراح', email: 'drafting-b@test.local' })
  sentId = sent.profileId
  await new TrainerSuggestionService(prisma).propose(sentId, ACTOR, 'pitch', ['سطر وصله منا'])

  built = await bundles.build(ACTOR)
  zip = await JSZip.loadAsync(built.zip)
}, 240_000)

describe('من فيها', () => {
  it('⚠️ من لا مسوّدة له ولا اقتراح — ومن اقتُرح عليه لا يعود', () => {
    const ids = built.trainers.map((t) => t.profileId)
    expect(ids).toContain(mineId)
    expect(ids, 'عاد إلى الحزمة من وصله اقتراح').not.toContain(sentId)
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

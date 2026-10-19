/* ما نقترحه على بطاقة المدرّب — «لماذا نفتخر به» ونبذتُه بصياغتنا.

   ═══ القرارُ الذي كُتب له ═══

   قرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦): «لماذا نفتخر بك» جديدٌ يُطرح «نريد إضافةَ كذا
   عنك» ويعدّله المدرّبُ ويضيف إليه — وما عدّله يعود إلينا (الخيارُ الأوّل من اثنين)؛
   و«تعديلُ النبذة يكون قبل وبعد».

   ═══ وما يُحرَس ═══

   ١) المقترَحُ لا يبلغ الصفحةَ العامّة — ولو لحظةً — حتّى يُقبل.
   ٢) والقبولُ كما هو ينشر فورا؛ والقبولُ بتعديلٍ **لا ينشر** حتّى نعتمده.
   ٣) والنبذةُ «قبل/بعد»: `before` نبذتُه الآن، والقبولُ يكتب المقترحة، ولا تُعدَّل.
   ٤) والقواعدُ تحكم: ثلاثةُ أسطرٍ واثنتا عشرةَ كلمةً للسطر، والنبذةُ بحدودها.
   ٥) ولا يقرّر مدرّبٌ في اقتراحٍ ليس له.

   ═══ وكيف رُئي ساقطا ═══

   كُتبت سطورُه المعدَّلةُ في `pitchLines` عند القبول بتعديل لا عند اعتمادنا، فظهرت في
   القائمة العامّة وسقط الحارسُ الثاني. ثمّ أُعيدت. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { giveLiveCourse } from '../helpers/live-course'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerSuggestionService } from '../../services/trainer-suggestion.service'

let prisma: PrismaClient
let review: TrainerReviewService
let svc: TrainerSuggestionService
let profileId = ''
let userId = ''
let otherUserId = ''
const ACTOR = '00000000-0000-0000-0000-000000000009'
const FIRST = ['درّب أكثر من 250 متدربا مع اليونيسف', 'يحمل IELTS 7.5']
const SECOND = ['عشر سنوات في العمل الإنساني والتعليم']
const HIS = ['عشر سنوات في العمل الإنساني والتعليم', 'يؤمن بتدريب يترك أثرا بعد القاعة']
const OLD_BIO = 'نبذتي كما كتبتها في طلب الانضمام قبل شهرين، طويلة قليلا وبلا ترتيب.'
const NEW_BIO = 'مدرب عملي بخبرة تزيد على عشر سنوات في العمل الإنساني والتعليم، ودرّب أكثر من 250 متدربا مع اليونيسف.'

const shown = async () => (await review.listPublicTrainers()).find((t) => t.id === profileId)
const pendingId = async (kind: 'pitch' | 'bio') => (await svc.mine(userId))[kind].pending!.id

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  review = new TrainerReviewService(prisma)
  svc = new TrainerSuggestionService(prisma)

  const made = await review.createTrainerDirectly(ACTOR, { fullName: 'نوار الاختبار', email: 'suggest-a@test.local' })
  profileId = made.profileId
  userId = made.userId
  await review.approvePublicVisibility(profileId, ACTOR)
  await giveLiveCourse(prisma, profileId)
  await prisma.trainerProfile.update({ where: { id: profileId }, data: { bioPublic: OLD_BIO } })
  otherUserId = (await review.createTrainerDirectly(ACTOR, { fullName: 'مدرّب آخر', email: 'suggest-b@test.local' })).userId
}, 240_000)

describe('القواعد تحكم الإرسال', () => {
  it('لا فراغ، ولا أكثر من ثلاثة أسطر، ولا سطر فوق اثنتي عشرة كلمة', async () => {
    await expect(svc.propose(profileId, ACTOR, 'pitch', ['  ', ''])).rejects.toThrow()
    await expect(svc.propose(profileId, ACTOR, 'pitch', ['أ', 'ب', 'ج', 'د'])).rejects.toThrow()
    await expect(svc.propose(profileId, ACTOR, 'pitch', [Array(13).fill('كلمة').join(' ')])).rejects.toThrow()
  })

  it('والنبذة بحدود النبذة — لا أقلّ من عشر كلمات ولا فوق ستين', async () => {
    await expect(svc.propose(profileId, ACTOR, 'bio', ['قصيرة جدا'])).rejects.toThrow()
    await expect(svc.propose(profileId, ACTOR, 'bio', [Array(61).fill('كلمة').join(' ')])).rejects.toThrow()
  })
})

describe('«لماذا نفتخر به» — إضافة يقبلها أو يعدّلها', () => {
  it('⚠️ المقترح لا يبلغ الصفحة العامّة قبل قبوله', async () => {
    await svc.propose(profileId, ACTOR, 'pitch', FIRST)
    expect((await shown())?.pitch, 'ظهر ما لم يقبله المدرّب').toEqual([])
    expect((await svc.mine(userId)).pitch.pending?.lines).toEqual(FIRST)
  })

  it('⚠️ ولا يقرّر مدرّب في اقتراح ليس له', async () => {
    await expect(svc.accept(otherUserId, await pendingId('pitch'))).rejects.toThrow()
    expect((await shown())?.pitch).toEqual([])
  })

  it('والقبول كما هو ينشر فورا', async () => {
    await svc.accept(userId, await pendingId('pitch'))
    expect((await shown())?.pitch, 'قبله كما هو ولم يظهر').toEqual(FIRST)
  })

  it('⚠️ والقبول بتعديل لا ينشر — يعود إلينا', async () => {
    await svc.propose(profileId, ACTOR, 'pitch', SECOND)
    const after = await svc.accept(userId, await pendingId('pitch'), HIS)
    expect(after.pitch.pending).toBeNull()
    expect(after.pitch.edited?.editedLines).toEqual(HIS)
    expect((await shown())?.pitch, 'نشر تعديل المدرّب قبل أن نعتمده').toEqual(FIRST)
  })

  it('واعتمادنا ينشره — كما عدّله أو بعد تحرير', async () => {
    const adjusted = [HIS[0], 'يؤمن بتدريب يبقى أثره بعد القاعة']
    await svc.approveEdit(profileId, ACTOR, adjusted)
    expect((await shown())?.pitch).toEqual(adjusted)
    expect((await svc.mine(userId)).pitch.edited).toBeNull()
  })

  it('والرفض يبقيها ويحفظ كلمته', async () => {
    await svc.propose(profileId, ACTOR, 'pitch', FIRST)
    const id = await pendingId('pitch')
    await svc.reject(userId, id, 'أفضّل ذكر الشهادة')
    const row = await prisma.trainerTextSuggestion.findUniqueOrThrow({ where: { id } })
    expect(row.status).toBe('rejected')
    expect(row.noteAr).toBe('أفضّل ذكر الشهادة')
    expect((await shown())?.pitch).toEqual([HIS[0], 'يؤمن بتدريب يبقى أثره بعد القاعة'])
  })
})

describe('النبذة بصياغتنا — قبل وبعد', () => {
  it('«قبل» نبذته الآن، و«بعد» ما نقترح — ولا يتغيّر شيء قبل قراره', async () => {
    await svc.propose(profileId, ACTOR, 'bio', [NEW_BIO])
    const pending = (await svc.mine(userId)).bio.pending
    expect(pending?.before).toEqual([OLD_BIO])
    expect(pending?.lines).toEqual([NEW_BIO])
    expect((await shown())?.bio).toBe(OLD_BIO)
  })

  it('⚠️ والقبول يكتبها — ولا يعدّلها هنا ولو أرسل سطورا', async () => {
    await svc.accept(userId, await pendingId('bio'), ['نصّي أنا بدلا منها'])
    expect((await shown())?.bio, 'قبول النبذة لم يكتب المقترحة أو كتب غيرها').toBe(NEW_BIO)
  })

  it('ولكلّ خطوة أثرها', async () => {
    const actions = new Set((await prisma.auditEvent.findMany({
      where: { entityId: profileId, action: { startsWith: 'trainer.suggestion.' } }, select: { action: true },
    })).map((a) => a.action))
    for (const a of ['propose', 'accept', 'edit', 'approve_edit', 'reject']) expect(actions).toContain(`trainer.suggestion.${a}`)
  })

  it('والسحب لا يجد شيئا حين لا معلّق', async () => {
    await expect(svc.withdraw(profileId, ACTOR, 'bio')).rejects.toThrow()
  })
})

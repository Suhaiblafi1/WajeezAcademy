/* «لماذا اخترناه» — نكتبه نحن، ولا يُنشر إلّا بقبول المدرّب.

   ═══ القرارُ الذي كُتب له ═══

   قرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦): «أضف كلماتٍ تشجّع الناس لهذا المدرّب،
   والمدرّب يوافق أو يرفض التعديل».

   ═══ وما يُحرَس ═══

   ١) المقترَحُ لا يبلغ الصفحةَ العامّة — ولو لحظةً — حتّى يقبله.
   ٢) والقبولُ يكتبه في البطاقة، والرفضُ يُبقيها كما كانت ويحفظ كلمتَه.
   ٣) والبطاقةُ «قبل/بعد» صادقة: `before` ما يُعرض فعلا لحظةَ الاقتراح.
   ٤) ومعلَّقٌ واحدٌ لا اثنان: الاقتراحُ الجديدُ يسحب ما قبله.
   ٥) ولا يقرّر مدرّبٌ في اقتراحٍ ليس له.

   ═══ وكيف رُئي ساقطا ═══

   كُتبت السطورُ في `pitchLines` عند الاقتراح لا عند القبول، فظهرت في القائمة
   العامّة وسقط الحارسُ الأوّل. ثمّ أُعيدت. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { giveLiveCourse } from '../helpers/live-course'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerPitchService } from '../../services/trainer-pitch.service'

let prisma: PrismaClient
let review: TrainerReviewService
let pitch: TrainerPitchService
let profileId = ''
let userId = ''
let otherUserId = ''
const ACTOR = '00000000-0000-0000-0000-000000000009'
const FIRST = ['درّب أكثر من 250 متدربا مع اليونيسف', 'حاصل على IELTS 7.5']
const SECOND = ['أكثر من عشر سنوات في العمل الإنساني والتعليم']

const publicPitch = async () =>
  (await review.listPublicTrainers()).find((t) => t.id === profileId)?.pitch

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  review = new TrainerReviewService(prisma)
  pitch = new TrainerPitchService(prisma)

  const made = await review.createTrainerDirectly(ACTOR, { fullName: 'نوار الاختبار', email: 'pitch-a@test.local' })
  profileId = made.profileId
  userId = made.userId
  await review.approvePublicVisibility(profileId, ACTOR)
  await giveLiveCourse(prisma, profileId)
  otherUserId = (await review.createTrainerDirectly(ACTOR, { fullName: 'مدرّب آخر', email: 'pitch-b@test.local' })).userId
}, 240_000)

describe('القواعد تحكم الإرسال', () => {
  it('لا فراغ، ولا أكثر من ثلاثة أسطر، ولا سطر أطول من حدّه', async () => {
    await expect(pitch.propose(profileId, ACTOR, ['  ', ''])).rejects.toThrow()
    await expect(pitch.propose(profileId, ACTOR, ['أ', 'ب', 'ج', 'د'])).rejects.toThrow()
    await expect(pitch.propose(profileId, ACTOR, ['س'.repeat(121)])).rejects.toThrow()
  })
})

describe('اقتراح ينتظر قبوله', () => {
  it('⚠️ المقترح لا يبلغ الصفحة العامّة قبل قبوله', async () => {
    await pitch.propose(profileId, ACTOR, FIRST)
    expect(await publicPitch(), 'ظهر في الصفحة العامّة ما لم يقبله المدرّب').toEqual([])
  })

  it('ويراه المدرّب بطاقة «قبل/بعد» صادقة', async () => {
    const mine = await pitch.mine(userId)
    expect(mine.lines).toEqual([])
    expect(mine.pending?.before).toEqual([])
    expect(mine.pending?.lines).toEqual(FIRST)
  })

  it('واقتراح جديد يسحب ما قبله — معلّق واحد لا اثنان', async () => {
    await pitch.propose(profileId, ACTOR, [...FIRST].reverse())
    await pitch.propose(profileId, ACTOR, FIRST)
    expect(await prisma.trainerPitchSuggestion.count({ where: { profileId, status: 'pending' } })).toBe(1)
  })

  it('⚠️ ولا يقرّر مدرّب في اقتراح ليس له', async () => {
    const id = (await pitch.mine(userId)).pending!.id
    await expect(pitch.decide(otherUserId, id, true)).rejects.toThrow()
    expect(await publicPitch()).toEqual([])
  })
})

describe('قبوله ورفضه', () => {
  it('⚠️ القبول يكتبه في البطاقة العامّة', async () => {
    const id = (await pitch.mine(userId)).pending!.id
    const after = await pitch.decide(userId, id, true)
    expect(after.pending).toBeNull()
    expect(await publicPitch(), 'قبله المدرّب ولم يظهر').toEqual(FIRST)
  })

  it('والاقتراح التالي «قبله» ما يظهر الآن — والرفض يبقيه ويحفظ كلمته', async () => {
    await pitch.propose(profileId, ACTOR, SECOND)
    const mine = await pitch.mine(userId)
    expect(mine.pending?.before, '«قبل» لا يطابق المعروض').toEqual(FIRST)
    await pitch.decide(userId, mine.pending!.id, false, 'أفضّل ذكر الشهادة')
    expect(await publicPitch(), 'الرفض غيّر البطاقة').toEqual(FIRST)
    const row = await prisma.trainerPitchSuggestion.findUniqueOrThrow({ where: { id: mine.pending!.id } })
    expect(row.status).toBe('rejected')
    expect(row.noteAr).toBe('أفضّل ذكر الشهادة')
  })

  it('ولكلّ خطوة أثرها', async () => {
    const actions = (await prisma.auditEvent.findMany({
      where: { entityId: profileId, action: { startsWith: 'trainer.pitch.' } }, select: { action: true },
    })).map((a) => a.action)
    expect(actions).toEqual(expect.arrayContaining(['trainer.pitch.propose', 'trainer.pitch.accept', 'trainer.pitch.reject']))
  })

  it('والسحب لا يجد شيئا حين لا معلّق', async () => {
    await expect(pitch.withdraw(profileId, ACTOR)).rejects.toThrow()
  })
})

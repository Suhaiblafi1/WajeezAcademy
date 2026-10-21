/* عنوانُ المدرّب ونبذتُه: يكتبهما هو، ويعدّلهما المعتمِدُ إن شاء، ثمّ يعتمد.

   قرارُ صاحب المنصّة (٣ أكتوبر ٢٠٢٦): «B — and update the guide, but let me
   edit it in case I want to before approval».

   ═══ وما يُحرَس ═══

   ١) **المعلَّقُ لا يبلغ العامّة.** ما أرسله لا يُقرأ في `/api/trainers/public`
      — والمعتمَدُ قبله يبقى معروضا.
   ٢) **والاعتمادُ بما في الحقلين** لا بما في القاعدة: من عدّل قبل أن يعتمد
      نُشر تعديلُه — وهو لبُّ القرار.
   ٣) **والردُّ بسببٍ يبقى عنده** حتّى يرسل ثانية، ولا يمسّ المعتمَد.
   ٤) **والحدودُ في الخادم** لا في الشاشة وحدها: نبذةٌ فوق السقف تُردّ.

   ═══ وكيف رُئي ساقطا ═══ في رسالة الالتزام. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { giveLiveCourse } from '../helpers/live-course'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerPublicTextService } from '../../services/trainer-public-text.service'

let prisma: PrismaClient
let review: TrainerReviewService
let svc: TrainerPublicTextService
let profileId = ''
let userId = ''
const ACTOR = '00000000-0000-0000-0000-000000000009'

const OLD_BIO = 'نبذةٌ قديمةٌ معتمَدةٌ كُتبت في نموذج التقديم لمراجعٍ يفحص الطلب لا لمتعلّم'
const NEW_BIO = 'أدرّب فرقَ المبيعات على التفاوض المنهجيّ منذ اثنتي عشرة سنة، وأخرج مع كلّ متدرّبٍ بخطّةِ تفاوضٍ يطبّقها في أسبوعه الأوّل'

const publicRow = async () => {
  const list = await review.listPublicTrainers() as unknown as { id: string; headline: string | null; bio: string | null }[]
  return list.find((t) => t.id === profileId)
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  review = new TrainerReviewService(prisma)
  svc = new TrainerPublicTextService(prisma)
  const made = await review.createTrainerDirectly(ACTOR, {
    fullName: 'مدرّبُ النبذة المعلّقة', email: 'pending-bio@test.local',
  })
  profileId = made.profileId
  userId = made.userId
  await review.approvePublicVisibility(profileId, ACTOR)
  await giveLiveCourse(prisma, profileId)
  await prisma.trainerProfile.update({
    where: { id: profileId }, data: { headline: 'مدير مبيعات', bioPublic: OLD_BIO },
  })
}, 240_000)

describe('المدرّبُ يرسل — والمعلَّقُ لا يبلغ العامّة', () => {
  it('الحدودُ في الخادم: نبذةٌ فوق ستّين كلمة تُردّ', async () => {
    const long = Array.from({ length: 61 }, (_, i) => `كلمة${i}`).join(' ')
    await expect(svc.submit(userId, { headline: 'مدرّب تفاوض', bio: long }))
      .rejects.toMatchObject({ code: 'bad_public_text' })
  })

  it('ما يطابق المعتمَدَ حرفا لا يُرسَل', async () => {
    await expect(svc.submit(userId, { headline: 'مدير مبيعات', bio: OLD_BIO }))
      .rejects.toMatchObject({ code: 'unchanged' })
  })

  it('⚠️ يُرسَل فيُعلَّق — والصفحةُ العامّةُ على المعتمَد', async () => {
    const r = await svc.submit(userId, { headline: 'مدرّبُ تفاوضٍ للمبيعات', bio: NEW_BIO })
    expect(r.pendingAt).not.toBeNull()
    expect(r.bioPending).toBe(NEW_BIO)
    const pub = await publicRow()
    expect(pub?.bio).toBe(OLD_BIO)
    expect(pub?.headline).toBe('مدير مبيعات')
  })
})

describe('والمعتمِدُ يردّ بسبب — أو يعدّل ثمّ يعتمد', () => {
  it('الردُّ يحتاج سببا، ويبقى السببُ عنده، ولا يمسّ المعتمَد', async () => {
    await expect(svc.reject(profileId, ACTOR, '')).rejects.toMatchObject({ code: 'reason_required' })
    await svc.reject(profileId, ACTOR, 'اذكر نتيجةً يخرج بها المتدرّب')
    const mine = await svc.mine(userId)
    expect(mine.pendingAt).toBeNull()
    expect(mine.rejectNoteAr).toBe('اذكر نتيجةً يخرج بها المتدرّب')
    expect((await publicRow())?.bio).toBe(OLD_BIO)
  })

  it('⚠️ يُعتمَد ما في الحقلين — تعديلُ المعتمِد هو ما يُنشَر', async () => {
    await svc.submit(userId, { headline: 'مدرّبُ تفاوضٍ للمبيعات', bio: NEW_BIO })
    expect((await svc.mine(userId)).rejectNoteAr).toBeNull()
    const EDITED = `${NEW_BIO}.`
    const r = await svc.approve(profileId, ACTOR, { headline: 'مدرّبُ التفاوض المنهجيّ', bioPublic: EDITED })
    expect(r.edited).toBe(true)
    const pub = await publicRow()
    expect(pub?.headline).toBe('مدرّبُ التفاوض المنهجيّ')
    expect(pub?.bio).toBe(EDITED)
    const mine = await svc.mine(userId)
    expect(mine.pendingAt).toBeNull()
    expect(mine.bioPending).toBeNull()
  })

  it('ولا اعتمادَ بلا معلَّق — ولا اعتمادَ لفراغ', async () => {
    await expect(svc.approve(profileId, ACTOR, { headline: 'x', bioPublic: 'y' }))
      .rejects.toMatchObject({ code: 'no_pending_text' })
    await svc.submit(userId, { headline: 'عنوانٌ ثالث', bio: NEW_BIO })
    await expect(svc.approve(profileId, ACTOR, { headline: '', bioPublic: '' }))
      .rejects.toMatchObject({ code: 'empty_public_text' })
  })

  it('ويصله خبرُ القرار في جرسه', async () => {
    const keys = (await prisma.notification.findMany({ where: { userId }, select: { templateKey: true } }))
      .map((n) => n.templateKey)
    expect(keys).toContain('trainer.public_text.approved')
    expect(keys).toContain('trainer.public_text.rejected')
  })
})

/* ═══ واسمُه — يرسله معهما، ونعتمده نحن (قرارُ ٢١ أكتوبر ٢٠٢٦، «A») ═══

   ٥) **الاسمُ وحدَه تغييرٌ يُرسَل**، والمعلَّقُ لا يبلغ العامّة.
   ٦) **والاعتمادُ يكتب الاسمَ الواحد** (`application.fullName`) بما في حقله — ولا يمسّ اسمَ الهويّة في العقد.
   ٧) **والردُّ يمحو الاسمَ المعلَّق** ويُبقي المعروض. */
describe('اسمُه المعروض — يرسله فيعلَّق، ونعتمده فيظهر', () => {
  const OLD_NAME = 'مدرّبُ النبذة المعلّقة'
  const shownName = async () => {
    const list = await review.listPublicTrainers() as unknown as { id: string; name: string }[]
    return list.find((t) => t.id === profileId)?.name
  }
  const current = async () => {
    const m = await svc.mine(userId)
    return { headline: m.headline ?? '', bio: m.bioPublic ?? '' }
  }

  it('الحدودُ في الخادم: اسمٌ من حرفٍ واحد يُردّ', async () => {
    const c = await current()
    await expect(svc.submit(userId, { ...c, name: 'م' })).rejects.toMatchObject({ code: 'bad_public_name' })
  })

  it('⚠️ ٥ الاسمُ وحدَه يُرسَل — والصفحةُ على القديم', async () => {
    const c = await current()
    /* ومطابقُ المعروض ليس طلبا */
    await expect(svc.submit(userId, { ...c, name: OLD_NAME })).rejects.toMatchObject({ code: 'unchanged' })
    const r = await svc.submit(userId, { ...c, name: 'أحمد الصيفي' })
    expect(r.namePending).toBe('أحمد الصيفي')
    expect(r.name).toBe(OLD_NAME)
    expect(await shownName()).toBe(OLD_NAME)
  })

  it('⚠️ ٧ الردُّ يمحو الاسمَ المعلَّق ويبقي المعروض', async () => {
    await svc.reject(profileId, ACTOR, 'اكتب اسمك كاملا')
    const m = await svc.mine(userId)
    expect(m.namePending).toBeNull()
    expect(m.name).toBe(OLD_NAME)
  })

  it('⚠️ ٦ الاعتمادُ يكتب ما في حقل الاسم — ولا يمسّ اسمَ الهويّة', async () => {
    const c = await current()
    await svc.submit(userId, { ...c, name: 'احمد الصيفي' })
    const r = await svc.approve(profileId, ACTOR, { headline: c.headline, bioPublic: c.bio, name: 'أحمد الصيفي' })
    expect(r.name).toBe('أحمد الصيفي')
    expect(r.edited).toBe(true)
    expect(await shownName()).toBe('أحمد الصيفي')
    const p = await prisma.trainerProfile.findUniqueOrThrow({ where: { id: profileId }, select: { legalNameAr: true, namePending: true } })
    expect(p.legalNameAr).toBeNull()
    expect(p.namePending).toBeNull()
    const audit = await prisma.auditEvent.findFirst({
      where: { entityId: profileId, action: 'trainer.public_text.approve' }, orderBy: { createdAt: 'desc' },
    })
    expect(audit?.meta).toMatchObject({ nameFrom: OLD_NAME, nameTo: 'أحمد الصيفي' })
  })
})

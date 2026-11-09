/* ما يراه المدرّبُ عن نفسه: المعتمَدُ وحدَه، وبترتيبٍ لا يدلّ على زمن (٩ نوفمبر ٢٠٢٦).

   ① كان يصله كلُّ تعليق — المرفوضُ لإساءته أو لبياناتٍ تدلّ على كاتبه، وما لم يُراجَع بعد. وقرارُ صاحب المنصّة «a»:
      لا يرى إلّا ما اعتُمد.
   ② وكان الأحدثُ أوّلا والشاشةُ تقول «بلا ترتيب زمنيّ» — في العدد القليل يُعرف صاحبُ أعلى تعليق. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { RatingService } from '../../services/rating.service'

let prisma: PrismaClient
let auth: AuthService
let ratings: RatingService
let adminId = ''
const STAMP = Date.now()
let seq = 0

/** مدرّبٌ بشعبةٍ بدأت، وتقييماتٌ عنه بالترتيب المعطى — يعيد معرّفَ ملفّه ومعرّفاتِ التقييمات */
async function ratedTrainer(tag: string, given: { score: number; comment: string }[]) {
  const application = await prisma.trainerApplication.create({
    data: {
      reference: `TR-SEE-${tag}-${STAMP}`, fullName: `مدرب ${tag}`, email: `tr-see-${tag}-${STAMP}@test.local`,
      phone: '0790000003', status: 'active', motivation: 'اختبار', privacyConsentAt: new Date(),
    },
  })
  const profileId = (await prisma.trainerProfile.create({ data: { applicationId: application.id, isVerified: true } })).id
  const cohort = await prisma.cohort.create({
    data: {
      courseId: 'C-BIZ-101', title: `شعبة ${tag}`, status: 'active', registrationOpen: false, financialReady: true,
      price: 10, currency: 'JOD', capacity: 20, startsAt: new Date(Date.now() - 86_400_000),
    },
  })
  await prisma.cohortTrainer.create({ data: { cohortId: cohort.id, profileId, role: 'lead' } })
  const ids: string[] = []
  for (const g of given) {
    const { userId } = await auth.register(`see-${tag}-${++seq}-${STAMP}@test.local`, 'Learner#12345', 'متعلم')
    const e = await prisma.enrollment.create({ data: { userId, cohortId: cohort.id, status: 'enrolled' } })
    ids.push((await ratings.submit(userId, { enrollmentId: e.id, subjectType: 'trainer', subjectId: profileId, score: g.score, commentAr: g.comment })).id)
  }
  return { profileId, ids }
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  ratings = new RatingService(prisma)
  adminId = (await auth.register(`see-admin-${STAMP}@test.local`, 'Admin#12345', 'المراجع')).userId
}, 240_000)

describe('ما يراه المدرب عن نفسه', () => {
  it('⚠️ المعتمد وحده — لا المرفوض ولا ما ينتظر المراجعة', async () => {
    const { profileId, ids } = await ratedTrainer('approved', [
      { score: 2, comment: 'أنا أحمد من الشعبة الصباحية' },
      { score: 4, comment: 'شرح واضح' },
      { score: 5, comment: 'ينتظر المراجعة' },
    ])
    await ratings.moderate(ids[0], adminId, false, 'بيانات تدل على الكاتب')
    await ratings.moderate(ids[1], adminId, true)

    const view = await ratings.forSubject('trainer', profileId)
    expect(view.revealed).toBe(true)
    if (!view.revealed) return
    expect(view.comments.map((c) => c.commentAr), 'وصل المدرب ما رفض أو لم يراجع').toEqual(['شرح واضح'])
    /* والدرجاتُ كلُّها في المعدّل والتوزيع — المراجعةُ على النصّ لا على الرقم */
    expect(view.count).toBe(3)
  })

  it('⚠️ والترتيب بالدرجة لا بالزمن — الأحدث لا يتصدر', async () => {
    const { profileId, ids } = await ratedTrainer('order', [
      { score: 5, comment: 'الأقدم' },
      { score: 4, comment: 'الأوسط' },
      { score: 3, comment: 'الأحدث' },
    ])
    for (const id of ids) await ratings.moderate(id, adminId, true)
    /* الأحدثُ يُكتب أخيرا — فلو رُتّب بالزمن لتصدّر */
    await prisma.rating.update({ where: { id: ids[2] }, data: { createdAt: new Date(Date.now() + 60_000) } })
    await prisma.rating.update({ where: { id: ids[0] }, data: { createdAt: new Date(Date.now() - 60_000) } })

    const view = await ratings.forSubject('trainer', profileId)
    if (!view.revealed) throw new Error('لم تكشف')
    expect(view.comments.map((c) => c.score), 'رتبت التعليقات بالزمن').toEqual([5, 4, 3])
  })
})

/* تحريرُ الأدمن لاقتراحات الدورات، والاتفاقُ الماليُّ في تقييم القارئ.

   ═══ أوّلا: الاقتراحاتُ يحرّرها الأدمن ═══

   الطلباتُ التي سبقت أ-٣ (١٣ سبتمبر) تحمل فقرةً حرّةً واحدة لا صفوفا. وأوّلُ
   مدرّبةٍ حقيقيّةٍ في المنصّة منها: ثماني دوراتٍ في فقرةٍ واحدة، فلا صفَّ
   يُربط بالكتالوج ولا اسمَ يُصحَّح.

   وقرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «أعطني المجال في ملفّها أن أضع اسمَ
   الدورة المقترحة بنفسي… لأنّي كأدمن قد أقوم بتغيير اسم الدورة أو تصحيحٍ
   إملائيّ — فهذا الخيار ليس فقط لحلّ مشكلة اليوم بل تفادٍ مستقبليّ».

   والحارسُ على أنّ ما يكتبه الأدمن **يُكتب في العمود نفسِه** الذي تقرؤه
   الشاشةُ ويُربط منه بالكتالوج — فلا مصدرانِ للحقيقة — وأنّ **الفقرةَ
   القديمةَ لا تُمحى**، وأنّ الأثرَ يقول من غيّر ماذا.

   ═══ وثانيا: الاتفاقُ الماليّ ═══

   قرارُه في اليوم نفسِه: «ضع في التقييم داخل الرابط الاتفاقَ الماليَّ في حال
   تمّ التحدّث عنه: ما هي توقّعاتها، وكم نقترح أن يكون المبلغ — لغايات
   التقديم فقط».

   ⚠️ **ولا مالَ يتحرّك بهما**: نصّانِ يُقرآن عند القرار، لا يمسّان
   `TrainerCompensationRule` ولا معادلةَ المستحقّات ولا دفترَ الأستاذ.
   والمبلغُ لا يُنسَخ في سجلّ التدقيق — يُقال إن ذُكر ويُقرأ من صفّه. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { TrainerReviewService } from '../../services/trainer-review.service'
import { TrainerDossierLinkService } from '../../services/trainer-dossier-link.service'
import { readProposals } from '../../../src/application/trainer/teachable-proposals'

let prisma: PrismaClient
let review: TrainerReviewService
let links: TrainerDossierLinkService
let applicationId = ''
const ACTOR = '00000000-0000-0000-0000-0000000000c1'
const OLD_PARAGRAPH = 'أستطيع تدريس ريادة الأعمال والتسعير العمليّ وإدارة المشاريع.'

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  review = new TrainerReviewService(prisma)
  links = new TrainerDossierLinkService(prisma)

  const app = await prisma.trainerApplication.create({
    data: {
      reference: 'WJ-TR-PROP-1', fullName: 'مقترِحةُ الدورات', email: 'proposals@test.local',
      status: 'submitted', teachableOther: OLD_PARAGRAPH,
    },
  })
  applicationId = app.id
}, 240_000)

describe('الأدمنُ يكتب اسمَ الاقتراح بنفسه', () => {
  it('⚠️ يكتب في العمود نفسِه الذي يُربط منه — لا في عمودٍ ثانٍ', async () => {
    await review.saveTeachableProposals(applicationId, ACTOR, [
      { titleAr: 'أساسيّاتُ ريادة الأعمال', summaryAr: 'الشبابُ المبتدئون' },
      { titleAr: 'التسعيرُ العمليُّ للمشاريع الصغيرة', summaryAr: '' },
    ])
    const app = await prisma.trainerApplication.findUnique({
      where: { id: applicationId }, select: { teachableProposals: true, teachableOther: true },
    })
    const rows = readProposals(app!.teachableProposals)
    expect(rows.map((r) => r.titleAr)).toEqual([
      'أساسيّاتُ ريادة الأعمال',
      'التسعيرُ العمليُّ للمشاريع الصغيرة',
    ])
  })

  it('⚠️ والفقرةُ التي كتبها هو لا تُمحى — تبقى مرجعا يُقارَن به', async () => {
    const app = await prisma.trainerApplication.findUnique({
      where: { id: applicationId }, select: { teachableOther: true },
    })
    expect(app!.teachableOther, 'مُحيت فقرةُ المتقدّم بقلمه').toBe(OLD_PARAGRAPH)
  })

  it('ويصحّح الاسمَ فيحلّ الجديدُ محلَّ القديم — لا يُضاف صفٌّ ثانٍ', async () => {
    await review.saveTeachableProposals(applicationId, ACTOR, [
      { titleAr: 'أساسيات ريادة الأعمال وبناء فكرة المشروع', summaryAr: 'الشبابُ المبتدئون' },
      { titleAr: 'التسعيرُ العمليُّ للمشاريع الصغيرة', summaryAr: '' },
    ])
    const app = await prisma.trainerApplication.findUnique({
      where: { id: applicationId }, select: { teachableProposals: true },
    })
    const rows = readProposals(app!.teachableProposals)
    expect(rows.length).toBe(2)
    expect(rows[0].titleAr).toBe('أساسيات ريادة الأعمال وبناء فكرة المشروع')
  })

  it('والفراغُ يسقط — صفٌّ بلا عنوانٍ ليس اقتراحا', async () => {
    await review.saveTeachableProposals(applicationId, ACTOR, [
      { titleAr: 'دورةٌ باقية', summaryAr: '' },
      { titleAr: '   ', summaryAr: 'نبذةٌ بلا عنوان' },
    ])
    const app = await prisma.trainerApplication.findUnique({
      where: { id: applicationId }, select: { teachableProposals: true },
    })
    expect(readProposals(app!.teachableProposals).length).toBe(1)
  })

  it('والأثرُ يقول من غيّر ماذا — فلا يُقرأ بعد شهرٍ كأنّ المتقدّمَ قاله', async () => {
    const last = await prisma.auditEvent.findFirst({
      where: { action: 'trainer.application.proposals_edit', entityId: applicationId },
      orderBy: { createdAt: 'desc' },
    })
    expect(last, 'لا أثرَ لتحرير الأدمن').not.toBeNull()
    expect(last!.actorId).toBe(ACTOR)
    expect(JSON.stringify(last!.after)).toContain('دورةٌ باقية')
  })

  it('وطلبٌ لا وجودَ له يُردّ', async () => {
    await expect(
      review.saveTeachableProposals('00000000-0000-0000-0000-0000000000ff', ACTOR, []),
    ).rejects.toThrow(/الطلب/)
  })
})

describe('الاتفاقُ الماليُّ في تقييم القارئ', () => {
  it('يُحفظ ويُقرأ في تقييم صاحب الرابط وحدَه', async () => {
    const made = await links.create(applicationId, ACTOR, { reviewerName: 'قارئةُ المال' })
    const token = made.url.split('/r/')[1]

    await links.saveReview(token, {
      scores: { domain_expertise: 4 },
      feeExpectationAr: '٢٥ دينارا للساعة',
      feeProposalAr: '٢٠ دينارا لأوّل شعبة، تُراجَع بعدها',
    })
    const view = await links.view(token)
    expect(view.myReview?.feeExpectationAr).toBe('٢٥ دينارا للساعة')
    expect(view.myReview?.feeProposalAr).toBe('٢٠ دينارا لأوّل شعبة، تُراجَع بعدها')
  })

  it('ويُتركان فارغَين إن لم يُذكر المال — ولا يُخترع لهما نصّ', async () => {
    const made = await links.create(applicationId, ACTOR, { reviewerName: 'قارئٌ بلا مال' })
    const token = made.url.split('/r/')[1]
    await links.saveReview(token, { scores: { values_fit: 5 } })
    const view = await links.view(token)
    expect(view.myReview?.feeExpectationAr).toBeNull()
    expect(view.myReview?.feeProposalAr).toBeNull()
  })

  it('⚠️ والمبلغُ لا يُنسَخ في سجلّ التدقيق — يُقال إن ذُكر فقط', async () => {
    /* ⚠ الصياغةُ الأولى قرأت **آخرَ** أثرٍ وحدَه، وآخرُهم قارئٌ لم يذكر مالا —
       فمرّت خضراءَ وأنا أحقن المبلغَ في `after` عمدا. فالفحصُ على الآثار
       **كلِّها**، وإلّا حرس الحارسُ صفّا لا مالَ فيه أصلا. */
    const all = await prisma.auditEvent.findMany({
      where: { action: { in: ['trainer.review.add', 'trainer.review.update'] }, entityId: applicationId },
    })
    expect(all.length, 'لا أثرَ للتقييم').toBeGreaterThan(0)
    const whole = JSON.stringify(all.map((e) => ({ meta: e.meta, before: e.before, after: e.after })))
    expect(whole, 'المبلغُ مكتوبٌ في الأثر').not.toContain('٢٥ دينارا')
    expect(whole, 'ولا المقترحُ').not.toContain('تُراجَع بعدها')
    expect(whole, 'لا يُقال إنّ المالَ ذُكر').toContain('feeDiscussed')
    /* وواحدٌ منها على الأقلّ يقول إنّه ذُكر فعلا — وإلّا كان الحقلُ زينة */
    expect(whole).toContain('"feeDiscussed":true')
  })

  it('⚠️ ولا يمسّان معادلةَ المستحقّات — لا قاعدةَ تعويضٍ تُكتب', async () => {
    /* العطبُ الذي يُحرَس: حقلٌ اسمُه «كم نقترح» يُغري بأن يصير مصدرا لقاعدة
       تعويضٍ تلقائيّة. وهو نصٌّ قاله إنسانٌ في مكالمة، لا رقمٌ يُحتسب به مال. */
    expect(await prisma.trainerCompensationRule.count()).toBe(0)
  })
})

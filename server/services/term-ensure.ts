/* ═══ فصلُ الشعبة يُنشأ إن لم يكن — لا تبقى شعبةٌ «بلا فصل» لأنّ صفَّه لم يُكتب بعد (١٨ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «لماذا هناك شعبٌ لم يُسمَّ لها فصل، مع أنّ المدرّبَ اختار الفصل — الشتاءَ أو
   أجّلها لاحقا؟». والعلّة: ثلاثةُ أبوابٍ تكتب فصلَ الشعبة — اعتمادُ الخطّة (من تاريخ بدئها)، وتأجيلُها،
   ونقلُ الشعبة — وكلُّها كانت تبحث عن صفّ الفصل في جدول `Term` فإن لم تجده تركت الشعبةَ بلا فصل.
   والفصولُ لا تُنشأ إلّا بيد الإدارة، فما اعتُمد أو أُجّل إلى موسمٍ لم يُنشأ صفُّه بعدُ سقط من كلّ عدّ.

   فالفصلُ يُنشأ هنا «مخطَّطا» بحدوده المحسوبة — كما ينشئه زرُّ الإدارة — ولا يُفتح ولا يُنشر به
   شيء: فتحُه وتقويمُه ونافذتُه قرارٌ يبقى للإدارة. ومن هنا أيضا ما يملأ فصولَ الشعب التي سقطت قبل
   هذا (`assignMissingTerms`). */

import type { Prisma, PrismaClient } from '@prisma/client'
import type { TrainingSeason } from '../../src/application/trainer/application-options'
import { termBounds, termOf, termTitleAr } from '../../src/application/terms/season'
import { planApprovedOnce } from './registration-window'

type Db = PrismaClient | Prisma.TransactionClient

/** صفُّ الفصل — القائمُ، أو الجديدُ «مخطَّطا». و`upsert` لا `create`: بابان قد يطلبانه معا */
export async function ensureTerm(db: Db, t: { year: number; season: TrainingSeason }) {
  const { startsOn, endsOn } = termBounds(t.year, t.season)
  return db.term.upsert({
    where: { year_season: { year: t.year, season: t.season } },
    update: {},
    create: { year: t.year, season: t.season, titleAr: termTitleAr(t.year, t.season), startsOn, endsOn },
    select: { id: true, status: true },
  })
}

/** فصلُ يومٍ بعينه — و`null` إن كان فصلُه أُغلق أو أُلغي: لا تُعاد شعبةٌ إلى موسمٍ انتهى */
export async function ensureTermOf(db: Db, day: Date) {
  const term = await ensureTerm(db, termOf(day))
  return term.status === 'closed' || term.status === 'cancelled' ? null : term
}

/* ─────────── ما سقط قبل هذا ───────────

   شعبٌ بلا فصل، لها خطّةُ مدرّبٍ اعتُمدت أو أُجّلت — فموسمُها معروف: المؤجَّلةُ من يوم تأجيلها،
   والمعتمدةُ من بدئها. وما لا خطّةَ له لم يُحدَّد موسمُه بعد فلا يُخمَّن له. والملغاةُ والمنتهيةُ
   لا تُمسّ. */
export async function assignMissingTerms(prisma: PrismaClient): Promise<number> {
  const orphans = await prisma.cohort.findMany({
    where: { termId: null, status: { notIn: ['cancelled', 'completed'] } },
    select: {
      id: true, startsAt: true,
      plans: { where: { trainerId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { status: true, postponedTo: true } },
    },
  })
  let assigned = 0
  for (const c of orphans) {
    const latest = c.plans[0]
    const day = latest?.postponedTo && latest.status !== 'approved'
      ? latest.postponedTo
      : planApprovedOnce(c.plans) ? c.startsAt : null
    if (!day) continue
    const term = await ensureTermOf(prisma, day)
    if (!term) continue
    await prisma.cohort.update({ where: { id: c.id }, data: { termId: term.id } })
    assigned++
  }
  return assigned
}

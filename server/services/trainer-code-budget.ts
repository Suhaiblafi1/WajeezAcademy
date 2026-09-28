/* رصيدُ أكواد المدرّب — ما له عندنا ناقصا ما التزم به ولم يُحسم (٢٨ سبتمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: كودُ المدرّب يُسقَف بما له عندنا. والقاعدةُ وعلّتُها في
   `src/application/trainer/trainer-code.ts` (قسم «الرصيد»)؛ وهنا جمعُ أرقامها من
   القاعدة. ويسأله موضعان: التسعيرُ (ليُقال للمشتري في مكانه)، ومعاملةُ الطلب
   بقفلٍ لكلّ مدرّب (فلا يمرّ شراءان على آخر ما في الرصيد) — وشاشةُ «دعوتي»
   تعرضه للمدرّب نفسِه.

   ═══ وما لا يُعدّ «له عندنا» ═══

   · المصروفُ: مالٌ خرج إليه ولا يُحسم منه.
   · والشعبةُ المكتملة: أجرُها صار كشفا يُعدّ في «المنتظر» — وعدُّها «متوقَّعا»
     معه كان يعدّ الشيءَ مرّتين (وكان ذلك في رصيد الخصم القديم).
   · والمسودّةُ: شعبةٌ لم تُفتح للبيع قد لا تُقدَّم أصلا. */

import type { Prisma, PrismaClient } from '@prisma/client'
import { EarningsService } from './earnings.service'
import { leadCohortsOf } from './cohort-lead'
import { LEDGER_CURRENCY } from '../../src/application/commerce/presentment'
import { codeBudget, type CodeBudget } from '../../src/application/trainer/trainer-code'

/** شعبٌ يُتوقَّع أجرُها — مفتوحةٌ للبيع أو ممتلئةٌ أو جارية */
const PROJECTED_STATUSES = ['open', 'full', 'active'] as const

/** ما يُسعَّر الآن من دوراته — مقعدٌ في كلّ شعبة، وثمنُ بنده */
export interface PurchaseLine {
  cohortId: string
  /** ثمنُ البند كما يدخل الفاتورة (صفرٌ للهديّة) — ما يعدّه نصيبُ الإيراد إن كانت قاعدتُه نسبةً منه */
  unitPrice: number
}

/** القاعدةُ، أو معاملةُ الطلب بعد قفل المدرّب — فيُقرأ الرصيدُ على اتّصالها */
type Db = PrismaClient | Prisma.TransactionClient

export class TrainerCodeBudgetService {
  private prisma: PrismaClient
  private earnings: EarningsService

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.earnings = new EarningsService(prisma)
  }

  async budgetFor(profileId: string, purchase: readonly PurchaseLine[] = [], db: Db = this.prisma): Promise<CodeBudget> {
    const [payouts, credits, legacy, codes, cohorts] = await Promise.all([
      db.trainerPayout.aggregate({
        where: { profileId, status: { in: ['pending', 'approved'] } },
        _sum: { total: true },
      }),
      db.trainerCodeRedemption.aggregate({
        where: { profileId, pending: { lt: 0 } },
        _sum: { pending: true },
      }),
      /* الخصمُ القديمُ بالمبلغ: الصالحُ قد يُستعمل في أيّ لحظة، والمستعمَلُ ينتظر */
      db.trainerIssuedDiscount.aggregate({
        where: { profileId, status: { in: ['live', 'used'] }, settledItemId: null },
        _sum: { amount: true },
      }),
      db.trainerCodeRedemption.findMany({
        where: { profileId, OR: [{ status: 'held' }, { pending: { gt: 0 } }] },
        select: { status: true, amount: true, pending: true },
      }),
      leadCohortsOf(db, profileId, PROJECTED_STATUSES),
    ])
    const extra = new Map<string, { seats: number; revenue: number }>()
    for (const line of purchase) {
      const e = extra.get(line.cohortId) ?? { seats: 0, revenue: 0 }
      extra.set(line.cohortId, { seats: e.seats + 1, revenue: e.revenue + line.unitPrice })
    }
    const projections = await Promise.all(
      cohorts.map((c) => this.earnings.projectCohort(profileId, c.id, extra.get(c.id), db)),
    )
    const committed = Number(legacy._sum.amount ?? 0)
      + codes.reduce((s, r) => s + (r.status === 'held' ? Number(r.amount) : Math.max(0, Number(r.pending))), 0)
    return codeBudget({
      owed: Number(payouts._sum.total ?? 0),
      credits: -Number(credits._sum.pending ?? 0),
      projected: projections.reduce((s, p) => s + p, 0),
      committed,
      currency: LEDGER_CURRENCY,
    })
  }
}

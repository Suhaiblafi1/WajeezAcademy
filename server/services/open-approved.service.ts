/* ═══ «افتح المعتمدة كلها» — زرٌّ واحدٌ بمعاينةٍ قبله (١٩ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «أريد أن أفتح الشعبَ التي لها مدرّبٌ واعتُمدت موادُّها — كلَّها مرّةً واحدة، عدا ما
   تمّ نقلُه». وكان فتحُها واحدةً واحدة من «معتمدة — تنتظر فتحك»، و«انتقل إلى هذا الموسم» يفتح موسما
   واحدا ويُغلق معه ما قبله — وهو سؤالٌ آخر.

   · **ما يُفتح:** كلُّ مسوّدةٍ لها مدرّبٌ مسنَدٌ واعتُمدت خطّتُه — من بابِ الفتح نفسِه (`CohortService.open`)
     بشروطه كلِّها. وما لا تتمّ شروطُه يُسمّى بسببه ولا يُفتح.
   · **وما لا يُمسّ:** ما نُقل إلى موسمٍ آخر (طلبُ نقلٍ معتمَد) — يُسمّى في المعاينة ويبقى مسوّدة؛ وشعبةُ
     إعدادِ مدرّبٍ في طوره (`prepContext`) — لتأهيله لا للبيع؛ وما لم تُعتمَد خطّةُ مدرّبه.
   · **ولا شيءَ غيرُ الفتح:** لا يُلغي ولا يُغلق موسما — ذاك «انتقل إلى هذا الموسم». */

import type { PrismaClient } from '@prisma/client'
import { recordAudit } from './audit'
import { CohortService } from './cohort.service'
import { planApprovedOnce } from './registration-window'

export interface OpenApprovedPreview {
  toOpen: { id: string; title: string; ready: boolean; missing: string[] }[]
  moved: { id: string; title: string; toYear: number; toSeason: string }[]
}

export class OpenApprovedService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async preview(): Promise<OpenApprovedPreview> {
    const cohorts = new CohortService(this.prisma)
    const { TrainerPrepService } = await import('./trainer-prep.service')
    const prep = new TrainerPrepService(this.prisma)
    const drafts = await this.prisma.cohort.findMany({
      where: { status: 'draft', trainers: { some: {} } },
      orderBy: { title: 'asc' },
      select: {
        id: true, title: true,
        plans: { where: { trainerId: { not: null } }, select: { status: true } },
        moveRequests: { where: { status: 'approved' }, orderBy: { reviewedAt: 'desc' }, take: 1, select: { toYear: true, toSeason: true } },
      },
    })
    const toOpen: OpenApprovedPreview['toOpen'] = []
    const moved: OpenApprovedPreview['moved'] = []
    for (const c of drafts) {
      if (!planApprovedOnce(c.plans)) continue
      if (await prep.prepContext(c.id).catch(() => null)) continue
      const m = c.moveRequests[0]
      if (m) { moved.push({ id: c.id, title: c.title, toYear: m.toYear, toSeason: m.toSeason }); continue }
      const check = await cohorts.openChecklist(c.id)
      toOpen.push({ id: c.id, title: c.title, ready: check.ready, missing: check.missing })
    }
    return { toOpen, moved }
  }

  /** ينفّذ ما عاينه — ويعيد الفحصَ اليوم لا يومَ المعاينة */
  async apply(actorId: string) {
    const p = await this.preview()
    const cohorts = new CohortService(this.prisma)
    const opened: string[] = []
    const failed: { title: string; reason: string }[] = []
    for (const c of p.toOpen) {
      if (!c.ready) { failed.push({ title: c.title, reason: c.missing.join(' — ') }); continue }
      try {
        await cohorts.open(c.id, actorId)
        opened.push(c.id)
      } catch (e) {
        failed.push({ title: c.title, reason: e instanceof Error ? e.message : 'تعذّر الفتح' })
      }
    }
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.open_approved', entityType: 'platform', entityId: 'open_approved',
      meta: { opened: opened.length, failed: failed.length, moved: p.moved.length },
    })
    return { opened: opened.length, failed, moved: p.moved.length }
  }
}

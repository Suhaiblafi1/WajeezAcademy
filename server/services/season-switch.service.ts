/* ═══ «انتقل إلى هذا الموسم» — زرٌّ واحدٌ بمعاينةٍ قبله (١٨ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «لماذا لا تُفتح دوراتُ موسم الشتاء التي لها مدرّبون؟ وكيف نغلق كلَّ الدورات
   التي فتحناها للتجربة، ونجعل الشتاءَ مفتوحا للتسجيل، ونغلق الخريفَ الذي فات؟». وكان الجوابُ نقراتٍ
   كثيرة: فتحُ كلِّ شعبةٍ معتمدةٍ وحدَها، وإغلاقُ كلِّ شعبةِ تجربةٍ وحدَها، ونقلُ حالة كلِّ فصل. فاختار
   زرّا واحدا يُعاين قبل أن يُنفّذ:

   · **يفتح** شعبَ الموسم المختار التي اعتُمدت خطّةُ مدرّبها وما زالت مسوّدة — من بابِ الفتح نفسِه
     (`CohortService.open`) بشروطه كلِّها؛ وما لا تتمّ شروطُه يُسمّى بسببه ولا يُفتح. وشعبُ الإعداد
     (بلا متعلّمين، لتأهيل المدرّب) لا تُفتح.
   · **يُلغي** الشعبَ الحيّةَ من مواسمَ قبله **التي لا متعلّمَ فيها ولا طلبَ تسجيل** — شعبُ التجربة.
     وما فيه متعلّمٌ لا يُمسّ: يُسمّى في المعاينة ليقرّر فيه صاحبُ المنصّة بيده.
   · **يفتح الموسمَ** المختار إن كان «مخطَّطا»، **ويُغلق** المواسمَ الحيّةَ التي قبله.

   ولا يُحذف شيء: الإلغاءُ والإغلاقُ يُبقيان الأثرَ والتاريخ. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { CohortService } from './cohort.service'
import { planApprovedOnce } from './registration-window'

const LIVE_TERM = ['planned', 'open', 'active']
const LIVE_COHORT = ['open', 'full', 'active']

export interface SwitchPreview {
  term: { id: string; titleAr: string; status: string }
  toOpen: { id: string; title: string; ready: boolean; missing: string[] }[]
  toCancel: { id: string; title: string; termAr: string | null }[]
  withLearners: { id: string; title: string; termAr: string | null; learners: number }[]
  termsToClose: { id: string; titleAr: string; status: string }[]
}

export class SeasonSwitchService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async preview(termId: string): Promise<SwitchPreview> {
    const term = await this.prisma.term.findUnique({ where: { id: termId } })
    if (!term) throw new AuthError('term_not_found', 'الموسم غير موجود', 404)
    const cohorts = new CohortService(this.prisma)
    const { TrainerPrepService } = await import('./trainer-prep.service')
    const prep = new TrainerPrepService(this.prisma)

    /* ما يُفتح: مسوّداتُ هذا الموسم التي اعتُمدت خطّةُ مدرّبها — وشعبةُ الإعداد ليست منها */
    const drafts = await this.prisma.cohort.findMany({
      where: { termId, status: 'draft' },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, plans: { where: { trainerId: { not: null } }, select: { status: true } } },
    })
    const toOpen: SwitchPreview['toOpen'] = []
    for (const c of drafts) {
      if (!planApprovedOnce(c.plans)) continue
      if (await prep.prepContext(c.id).catch(() => null)) continue
      const check = await cohorts.openChecklist(c.id)
      toOpen.push({ id: c.id, title: c.title, ready: check.ready, missing: check.missing })
    }

    /* ما يُلغى: الحيّةُ من مواسمَ قبله — بفصلها، أو بأوّل لقاءاتها حين لا فصل */
    const live = await this.prisma.cohort.findMany({
      where: { status: { in: LIVE_COHORT }, NOT: { termId } },
      orderBy: { title: 'asc' },
      select: {
        id: true, title: true, startsAt: true,
        term: { select: { titleAr: true, startsOn: true } },
        _count: {
          select: {
            enrollments: { where: { status: { not: 'dropped' } } },
            enrollmentRequests: { where: { status: 'pending' } },
          },
        },
      },
    })
    const before = (c: (typeof live)[number]) => {
      if (c.term) return c.term.startsOn.getTime() < term.startsOn.getTime()
      return !c.startsAt || c.startsAt.getTime() < term.startsOn.getTime()
    }
    const toCancel: SwitchPreview['toCancel'] = []
    const withLearners: SwitchPreview['withLearners'] = []
    for (const c of live.filter(before)) {
      const learners = c._count.enrollments + c._count.enrollmentRequests
      if (learners === 0) toCancel.push({ id: c.id, title: c.title, termAr: c.term?.titleAr ?? null })
      else withLearners.push({ id: c.id, title: c.title, termAr: c.term?.titleAr ?? null, learners })
    }

    const termsToClose = await this.prisma.term.findMany({
      where: { id: { not: termId }, status: { in: LIVE_TERM }, startsOn: { lt: term.startsOn } },
      orderBy: { startsOn: 'asc' },
      select: { id: true, titleAr: true, status: true },
    })
    return { term: { id: term.id, titleAr: term.titleAr, status: term.status }, toOpen, toCancel, withLearners, termsToClose }
  }

  /** ينفّذ ما عاينه — ويعيد الفحصَ اليوم لا يومَ المعاينة */
  async apply(actorId: string, termId: string) {
    const p = await this.preview(termId)
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
    for (const c of p.toCancel) {
      await cohorts.transition(c.id, 'cancelled', actorId, 'إغلاق شعب التجربة عند الانتقال إلى موسم جديد')
      await this.prisma.cohort.update({ where: { id: c.id }, data: { registrationOpen: false } })
    }
    /* الموسمُ المختار يُفتح إن كان مخطَّطا — وما قبله الحيُّ يُغلق. والإغلاقُ هنا من مخطَّطٍ أيضا:
       موسمٌ مضى لم يُفتح قطّ لا معنى لبقائه «مخطَّطا» */
    if (p.term.status === 'planned') {
      const { TermService } = await import('./term.service')
      await new TermService(this.prisma).setStatus(actorId, termId, 'open')
    }
    for (const t of p.termsToClose) {
      await this.prisma.term.update({ where: { id: t.id }, data: { status: 'closed' } })
      await recordAudit(this.prisma, {
        actorId, action: 'term.status', entityType: 'term', entityId: t.id,
        meta: { from: t.status, to: 'closed', titleAr: t.titleAr, via: 'season_switch' },
      })
    }
    await recordAudit(this.prisma, {
      actorId, action: 'term.season_switch', entityType: 'term', entityId: termId,
      meta: { opened: opened.length, failed: failed.length, cancelled: p.toCancel.length, closedTerms: p.termsToClose.length, untouched: p.withLearners.length },
    })
    return { opened: opened.length, failed, cancelled: p.toCancel.length, closedTerms: p.termsToClose.length, withLearners: p.withLearners }
  }
}

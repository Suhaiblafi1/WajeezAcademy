/* ═══ سجلُّ تواصل الخطّة — متى أُرسلت، ومتى رُدّت، وما قرّر المدرّبُ في كلّ بطاقة (١٧ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «كيف أميّز الخططَ التي أرسلتُ لها تعديلات من الجديدة؟ يجب أن تكون هناك
   خريطةُ تواصل: متى سلّمت ومتى أرسلتُ ملاحظات…». وكانت الخطّةُ تحفظ آخرَ إرسالٍ وآخرَ قرارٍ وحدَهما:
   كلُّ إرسالٍ يمحو تاريخَ ما قبله. فالسجلُّ يُبنى من أثرها (`AuditEvent`) — وهو مكتوبٌ منذ بُنيت،
   فيشمل الخططَ القديمةَ أيضا. وللإدارة وحدَها، باختياره.

   وهنا المحضُ: أحداثٌ بأسمائها تصير أسطرا تُقرأ. وقبولُ البطاقات ورفضُها المتتاليان يُجمعان سطرا
   واحدا («قبل ٥ ورفض ٢») — فخطّةٌ بثلاثين بطاقةً لا تصير ثلاثين سطرا. وحفظُ المسوّدة والتنزيلُ
   ومراجعةُ البطاقة قبل وصولها ليست تواصلا فلا تُعرض. */

import { countAr } from '../text/count-ar'

export interface PlanEvent {
  action: string
  at: Date | string
  /** اسمُ من فعل — أو `null` للنظام */
  by: string | null
  meta?: Record<string, unknown> | null
}

export interface TimelineEntry {
  at: string
  /** من الإدارة أم من المدرّب — لونُ السطر */
  side: 'trainer' | 'admin'
  labelAr: string
  by: string | null
}

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const iso = (d: Date | string) => new Date(d).toISOString()

/** كم مرّةً رُدّت الخطّةُ إلى مدرّبها — بتعديلات أو تأجيل */
export function planReturns(events: readonly Pick<PlanEvent, 'action'>[]): number {
  return events.filter((e) => e.action === 'cohort.plan.changes_requested' || e.action === 'cohort.plan.postpone').length
}

/** وسمُ الخطّة في الطابور: جديدةٌ أم أعادها بعد ردّها — ورقمُ جولتها */
export function roundLabelAr(returns: number): string {
  return returns === 0 ? 'جديدة' : `أعادها بعد التعديلات · الجولة ${returns + 1}`
}

/* ═══ وكم تنتظر قرارك — في الطابور وفي «اليوم» (٢٦ أكتوبر ٢٠٢٦، المرحلة الخامسة) ═══
   «الجولةُ ووقتُ الانتظار في الأعلى، فتظهر المراجعةُ البطيئةُ في «اليوم»» (خطّة لوحة الإدارة، ٣د). والتاريخُ
   المكتوبُ يُطرح بالعين من تاريخ اليوم — فيُقال بالأيّام. والمستقبلُ (ساعةٌ متقدّمة) «اليوم» لا «منذ -١». */
const DAY_FORMS = { one: 'يوم', two: 'يومين', few: 'أيام', many: 'يوما' }

/** ثلاثةُ أيّامٍ فأكثر بلا قرار — بطيئةٌ: تُعلَّم في الطابور، وتعلو في «اليوم» */
export const SLOW_REVIEW_DAYS = 3

/** كم يوما مضى منذ أُرسلت — صفرٌ لليوم */
export function waitingDays(submittedAt: Date | string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(submittedAt).getTime()) / 86_400_000))
}

/** «أرسلت اليوم» · «أرسلت أمس» · «تنتظر منذ يومين» · «تنتظر منذ 4 أيام» */
export function waitingAr(submittedAt: Date | string, now: Date = new Date()): string {
  const d = waitingDays(submittedAt, now)
  if (d === 0) return 'أرسلت اليوم'
  if (d === 1) return 'أرسلت أمس'
  return `تنتظر منذ ${d === 2 ? 'يومين' : countAr(d, DAY_FORMS)}`
}

export function planTimeline(events: readonly PlanEvent[]): TimelineEntry[] {
  const sorted = [...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  const out: TimelineEntry[] = []
  let submits = 0
  /* قبولٌ ورفضٌ متتاليان يُجمعان — ويُغلق الجمعُ أيُّ حدثٍ آخرَ يُعرض */
  let tally: { accepted: number; rejected: number; entry: TimelineEntry } | null = null
  const push = (e: PlanEvent, side: TimelineEntry['side'], labelAr: string) => {
    tally = null
    out.push({ at: iso(e.at), side, labelAr, by: e.by })
  }

  for (const e of sorted) {
    switch (e.action) {
      case 'cohort.plan.submit':
        submits += 1
        push(e, 'trainer', submits === 1 ? 'أرسل الخطة للاعتماد' : 'أعاد إرسال الخطة بعد التعديلات')
        break
      case 'cohort.plan.changes_requested':
        push(e, 'admin', 'ردّت الخطة بتعديلات')
        break
      case 'cohort.plan.postpone':
        push(e, 'admin', 'أجّلت الخطة إلى موسم قادم')
        break
      case 'cohort.plan.approve':
        push(e, 'admin', 'اعتمدت الخطة')
        break
      case 'cohort.plan.edits.propose':
        push(e, 'admin', `أرسلت ${n(e.meta?.count)} بطاقة تعديل`)
        break
      case 'cohort.plan.edits.approve_all':
        push(e, 'admin', `أرسلت للمدرّب ${n(e.meta?.count)} بطاقة بعد مراجعتها`)
        break
      case 'cohort.plan.edits.withdraw':
        push(e, 'admin', `سحبت ${n(e.meta?.count)} بطاقة لم يقرّر فيها`)
        break
      case 'cohort.plan.edits.restore':
        push(e, 'admin', `أعادت ${n(e.meta?.count)} بطاقة سحبت`)
        break
      case 'cohort.plan.edit.accept':
      case 'cohort.plan.edit.reject': {
        const accept = e.action === 'cohort.plan.edit.accept'
        if (!tally) {
          const entry: TimelineEntry = { at: iso(e.at), side: 'trainer', labelAr: '', by: e.by }
          out.push(entry)
          tally = { accepted: 0, rejected: 0, entry }
        }
        const t: { accepted: number; rejected: number; entry: TimelineEntry } = tally
        if (accept) t.accepted += 1
        else t.rejected += 1
        t.entry.at = iso(e.at)
        t.entry.labelAr = [
          t.accepted ? `قبل ${t.accepted} بطاقة` : '',
          t.rejected ? `رفض ${t.rejected} بطاقة` : '',
        ].filter(Boolean).join(' و')
        break
      }
      default:
        /* حفظٌ وتنزيلٌ ومراجعةُ بطاقةٍ قبل وصولها — ليست تواصلا */
        break
    }
  }
  return out
}

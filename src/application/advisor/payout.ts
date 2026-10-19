/* كشفُ عمولة المستشار — ما تقرؤه الشاشةُ والخادمُ معا. والعلّةُ في `server/services/advisor-payout.service.ts`. */

import { fmtDateWith } from '../text/format-ar'

export type AdvisorPayoutStatus = 'pending' | 'approved' | 'paid' | 'cancelled'

export const PAYOUT_STATUS_AR: Record<AdvisorPayoutStatus, string> = {
  pending: 'ينتظر الاعتماد',
  approved: 'معتمد — ينتظر الصرف',
  paid: 'صرف',
  cancelled: 'ألغي',
}

/** «2026-09» → «سبتمبر 2026» — والشهرُ بتوقيت UTC كما يُحسب */
export function periodAr(period: string): string {
  return fmtDateWith(new Date(`${period}-01T00:00:00Z`), { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

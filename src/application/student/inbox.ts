/* صندوق التواصل الموحّد (البند ص-١) — ما يخصّ المتعلم في مكان واحد.
   كان مبثوثا: الإشعارات في شاشة، وتعليقات المدرب داخل الواجب في شاشة أخرى،
   وردود الدعم في ثالثة. فيفوته أنفع ما كُتب له لأنه لا يعرف أين يبحث.

   الاشتقاق نقيّ ومن نقاط نهاية قائمة فقط: /api/learner/notifications و
   /api/learner/support/tickets و/api/learner/enrollments/:id.
   لا نقطة جديدة ولا تغيير في المخطط. */

import { notificationCtaAr, notificationHref } from '@/application/notifications/destinations'

export type InboxKind = 'notification' | 'trainer_feedback' | 'review_note' | 'support_reply'

export interface InboxItem {
  id: string
  kind: InboxKind
  titleAr: string
  bodyAr: string
  /** ISO — الترتيب عليه تنازليا */
  at: string
  /** وجهةٌ داخليّةٌ تفتح السياق — أو `null`: الخبرُ كلُّه في نصّه، ولا صفحةَ تزيد عليه */
  href: string | null
  /** ما يجده إن فتحه — فعلٌ يقول وجهتَه («افتح شهادتك») */
  ctaAr: string | null
  /** غير مقروء — للإشعارات فقط، وغيرها لا حالة قراءة له */
  unread: boolean
}

export const KIND_LABEL_AR: Record<InboxKind, string> = {
  notification: 'إشعار',
  trainer_feedback: 'تعليق مدربك',
  review_note: 'ملاحظة على تسليمك',
  support_reply: 'رد الدعم',
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** وجهةُ الإشعار ونصُّ زرّه — من جدول الوجهات، ثمّ من بياناته إن كانت عن شعبةٍ أو لقاء */
function notificationTarget(r: RawNotification): { href: string | null; ctaAr: string | null } {
  const href = notificationHref(r?.templateKey, 'learner', r?.data)
  if (href) return { href, ctaAr: notificationCtaAr(r?.templateKey, 'learner', r?.data) }
  const d = (r?.data ?? {}) as Record<string, unknown>
  if (str(d.cohortId) || str(d.sessionId)) return { href: '/student/learning', ctaAr: 'افتح رحلتك' }
  return { href: null, ctaAr: null }
}
const isoOf = (v: unknown): string | null => {
  const s = str(v)
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? s : null
}

/* ── أشكال ما نقرأ منه (ما نحتاجه فقط) ── */
export interface RawNotification { id?: string; title?: string; body?: string; status?: string; sentAt?: string | null; queuedAt?: string; templateKey?: string | null; data?: unknown }
export interface RawTicket {
  id?: string
  subject?: string
  status?: string
  messages?: { id?: string; authorId?: string | null; body?: string; createdAt?: string }[] | null
}
export interface RawEnrollmentDetail {
  id?: string
  cohort?: { title?: string } | null
  submissions?: {
    id?: string
    status?: string
    reviewNote?: string | null
    reviewedAt?: string | null
    submittedAt?: string
    assessment?: { title?: string } | null
    feedback?: { id?: string; body?: string; createdAt?: string }[] | null
  }[] | null
}

/**
 * يجمع الصندوق من المصادر الثلاثة ويرتّبه بالأحدث.
 * @param ownerId معرّف المتعلم — رسائل الدعم التي كتبها هو لا تُعدّ «ردا» عليه
 */
export function buildInbox(
  notifications: unknown,
  tickets: unknown,
  enrollments: unknown,
  ownerId: string | null,
): InboxItem[] {
  const out: InboxItem[] = []

  for (const r of Array.isArray(notifications) ? (notifications as RawNotification[]) : []) {
    const at = isoOf(r?.sentAt) ?? isoOf(r?.queuedAt)
    const id = str(r?.id)
    if (!id || !at) continue
    out.push({
      id: `n:${id}`,
      kind: 'notification',
      titleAr: str(r?.title) || 'إشعار',
      bodyAr: str(r?.body),
      at,
      /* والإشعارُ يفتح خبرَه (١٩ أكتوبر ٢٠٢٦): ووجهتُه هي وجهةُ زرّ بريده (`destinations.ts`).
         وما لا وجهةَ له كان يقود إلى «إشعاراتي» — صفحةٌ تعرض البنودَ نفسَها، فيدور المتعلّمُ في حلقة.
         وقد صار الصندوقُ بابا واحدا (٢٠ أكتوبر ٢٠٢٦): رسالةٌ عن شعبته أو لقائها بلا مفتاحٍ (رسالةُ المدرّب،
         ونقلُ جلسة) تفتح «رحلتي» حيث شعبتُه، وما سواها خبرُه كلُّه في نصّه فلا يقود إلى شيء. */
      ...notificationTarget(r),
      unread: r?.status !== 'read',
    })
  }

  for (const t of Array.isArray(tickets) ? (tickets as RawTicket[]) : []) {
    const tid = str(t?.id)
    if (!tid) continue
    for (const m of t?.messages ?? []) {
      const at = isoOf(m?.createdAt)
      const mid = str(m?.id)
      if (!mid || !at) continue
      /* رسائل المتعلم نفسه ليست ردا عليه */
      if (ownerId && str(m?.authorId) === ownerId) continue
      out.push({
        id: `s:${mid}`,
        kind: 'support_reply',
        titleAr: str(t?.subject) || 'تذكرة دعم',
        bodyAr: str(m?.body),
        at,
        href: '/student/support',
        ctaAr: 'افتح التذكرة',
        unread: false,
      })
    }
  }

  for (const e of Array.isArray(enrollments) ? (enrollments as RawEnrollmentDetail[]) : []) {
    const cohort = str(e?.cohort?.title)
    for (const sub of e?.submissions ?? []) {
      const title = str(sub?.assessment?.title) || cohort || 'تسليمك'
      const note = str(sub?.reviewNote)
      const noteAt = isoOf(sub?.reviewedAt) ?? isoOf(sub?.submittedAt)
      if (note && noteAt) {
        out.push({
          id: `r:${str(sub?.id)}`,
          kind: 'review_note',
          titleAr: title,
          bodyAr: note,
          at: noteAt,
          href: '/student/learning',
          ctaAr: 'افتح تسليمك',
          unread: false,
        })
      }
      for (const f of sub?.feedback ?? []) {
        const at = isoOf(f?.createdAt)
        const fid = str(f?.id)
        if (!at || !fid) continue
        out.push({
          id: `f:${fid}`,
          kind: 'trainer_feedback',
          titleAr: title,
          bodyAr: str(f?.body),
          at,
          href: '/student/learning',
          ctaAr: 'افتح تسليمك',
          unread: false,
        })
      }
    }
  }

  /* الأحدث أولا، وعند التساوي بالمعرّف كي يكون الترتيب حتميا */
  return out
    .filter((i) => i.bodyAr.trim() !== '')
    .sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id))
}

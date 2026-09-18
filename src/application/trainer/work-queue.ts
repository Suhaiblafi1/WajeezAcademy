import { fmtDate, fmtSession } from "@/application/text/format-ar";
/* طابور عمل المدرب (البند ف-١) — تحويل صفحة الهبوط من لوحة أرقام إلى طاولة عمل.
   المصدر: /api/trainer/my-cohorts و/api/trainer/grading-queue فقط — بلا نقطة
   نهاية جديدة وبلا تغيير في المخطط: كل ما يلزم موجود في الردّين.

   قاعدة: كل بند في الطابور له إجراء واحد واضح ووجهة واحدة. بند بلا إجراء
   ليس عملا بل خبرا — ومكانه بطاقات الملخص لا الطابور. */

export type QueueKind =
  | 'session_now'          /* جلسة جارية أو تبدأ خلال ساعة */
  | 'session_soon'         /* جلسة خلال ٢٤ ساعة */
  | 'attendance_missing'   /* جلسة انتهت ولم يُسجَّل حضورها */
  | 'grading_pending'      /* تسليمات تنتظر التقييم */
  | 'not_submitted'        /* تقييم استحق ولم يسلّم فيه أحد */
  | 'recording_missing'    /* جلسة انتهت بلا تسجيل مرفوع */
  | 'session_rejected'     /* لقاءٌ ردّته الإدارةُ — ينتظر نقلَ موعده */
  | 'plan_returned'        /* خطّةُ شعبةٍ رُدَّت إليه بملاحظة */
  | 'plan_ready_unsent'    /* تجهيزٌ اكتمل ولم يُرسَل للاعتماد */
  | 'plan_incomplete'      /* تجهيزٌ لم يكتمل — والخطوةُ التالية باسمها */

export interface QueueItem {
  kind: QueueKind
  /** نص البند — يذكر الرقم والسياق */
  titleAr: string
  detailAr: string
  /** نص الزر */
  actionAr: string
  /** وجهة داخلية، أو رابط خارجي عند external */
  href: string
  external: boolean
  /** ترتيب الإلحاح: أصغر = أعجل */
  urgency: number
  /** عدد العناصر التي يجمعها البند — للشارة */
  count: number
}

/* ─── أشكال الردّ التي نقرأ منها (ما نحتاجه فقط) ─── */
export interface TQSession {
  id: string
  title: string
  startsAt: string
  endsAt?: string | null
  status: string
  /* موقفُ الإدارة من اللقاء — والمردودُ يُكتب معه `status: 'cancelled'`،
     فلو قُرئ بعد شرط الملغى لَسقط، وهو أوّلُ ما عليه أن يعرف. */
  approvalState?: string | null
  reviewNote?: string | null
  /* الشكل المكشوف من الخادم: joinUrl للمضيف وlearnerUrl للمتعلم إن اختلف */
  zoom?: { joinUrl?: string; learnerUrl?: string | null } | null
  recordings?: unknown[] | null
}
export interface TQEnrollment {
  id: string
  status: string
  courseProgress?: { percent?: number } | null
  attendance?: { sessionId: string; status: string }[] | null
  user?: { displayName?: string; email?: string } | null
}
export interface TQAssessment {
  id: string
  title: string
  type?: string
  dueAt?: string | null
  status?: string
  submissions?: { enrollmentId: string; status: string }[] | null
}
export interface TQCohort {
  id: string
  title: string
  sessions?: TQSession[] | null
  enrollments?: TQEnrollment[] | null
  assessments?: TQAssessment[] | null
}
/** موجزُ الشعبة كما يعطيه `/api/trainer/cohorts/summary` — `done`/`total` تعدّ
    ما يملك المدرّبُ إنجازَه وحدَه، و`next` أوّلُ ما يمنع الإرسالَ ولو لم يكن بيده. */
export interface TQPlan {
  id: string
  title: string
  courseTitle?: string | null
  planStatus: string
  done: number
  total: number
  next?: { key: string; labelAr: string } | null
}
export interface TQRow {
  role?: string
  cohort?: TQCohort | null
}

const HOUR = 3600_000
/** نافذة «جلسة الآن»: من ساعة قبل البداية إلى ساعتين بعدها */
export const NOW_WINDOW_BEFORE = 1 * HOUR
export const NOW_WINDOW_AFTER = 2 * HOUR
/** نافذة «قريبا» */
export const SOON_WINDOW = 24 * HOUR

function arCount(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`
}

function whenAr(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now
  const mins = Math.round(diff / 60000)
  if (mins < -60) return `بدأت قبل ${Math.round(-mins / 60)} ساعة`
  if (mins < 0) return `بدأت قبل ${-mins} دقيقة`
  if (mins < 60) return `بعد ${mins} دقيقة`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `بعد ${hours} ساعة`
  return fmtSession(new Date(iso))
}

/**
 * يبني طابور العمل من ردّي الخادم.
 * @param rows رد /api/trainer/my-cohorts
 * @param gradingCount عدد التسليمات المعلّقة من /api/trainer/grading-queue
 * @param now الوقت الآن بالمللي — يُمرَّر صراحة كي يكون الاشتقاق نقيا وقابلا للاختبار
 * @param plans رد /api/trainer/cohorts/summary — تجهيزُ كلّ شعبةٍ وما يليه
 */
export function buildWorkQueue(rows: unknown, gradingCount: number, now: number, plans: unknown = []): QueueItem[] {
  const items: QueueItem[] = []
  const cohorts: TQCohort[] = Array.isArray(rows)
    ? (rows as TQRow[]).map((r) => r?.cohort).filter((c): c is TQCohort => Boolean(c && c.id))
    : []

  for (const c of cohorts) {
    const sessions = c.sessions ?? []
    const enrollments = (c.enrollments ?? []).filter((e) => e.status !== 'dropped')
    /* ⚠ رد الخادم لا يحمل الحضور على الجلسة بل داخل كل تسجيل — فنبني الفهرس
       من التسجيلات. قراءة session.attendance كانت ستُبلّغ «حضور لم يُسجَّل»
       عن كل جلسة ماضية حتى المسجَّلة فعلا. */
    const markedSessionIds = new Set<string>()
    for (const e of enrollments) for (const a of e.attendance ?? []) markedSessionIds.add(a.sessionId)

    for (const s of sessions) {
      /* ═══ المردودُ يُقرأ قبل شرط الملغى ═══

         ردُّ الإدارة يكتب `approvalState: 'rejected'` ومعه `status:
         'cancelled'`. فلو قُرئ بعد السطر التالي لَسقط البندُ كلُّه — وهو
         أوّلُ ما على المدرّب أن يعرفه: الإدارةُ قرّرت وتنتظره.

         ولا يُقيَّد بتاريخ: لقاءٌ رُدَّ ومضى موعدُه لم يُعقَد، والدرسُ ما
         زال يحتاج موعدا. وإخفاؤه بمضيّ التاريخ حذفٌ صامتٌ لعملٍ قائم. */
      if ((s.approvalState ?? '') === 'rejected') {
        const note = (s.reviewNote ?? '').trim()
        items.push({
          kind: 'session_rejected',
          titleAr: `لقاءٌ رُدَّ عليك — «${s.title}»`,
          detailAr: note ? `${c.title} · «${note}»` : `${c.title} · بلا ملاحظةٍ من الإدارة`,
          actionAr: 'انقل الموعد',
          href: `/trainer/cohort/${c.id}`,
          external: false,
          urgency: 5,
          count: 1,
        })
        continue
      }
      if (s.status === 'cancelled') continue
      const start = new Date(s.startsAt).getTime()
      if (!Number.isFinite(start)) continue
      const end = s.endsAt ? new Date(s.endsAt).getTime() : start + 2 * HOUR
      const live = now >= start - NOW_WINDOW_BEFORE && now <= end + NOW_WINDOW_AFTER
      const soon = !live && start > now && start - now <= SOON_WINDOW
      const over = now > end

      if (live || soon) {
        const joinUrl = s.zoom?.joinUrl ?? ''
        items.push({
          kind: live ? 'session_now' : 'session_soon',
          titleAr: live ? `جلستك «${s.title}» الآن` : `جلستك «${s.title}» ${whenAr(s.startsAt, now)}`,
          detailAr: c.title,
          actionAr: joinUrl ? 'افتح الجلسة' : 'افتح الشعبة',
          /* بلا رابطٍ للاجتماع: إلى صفحة الشعبة بعينها لا إلى «شعبي» عامّة (٨ سبتمبر ٢٠٢٦) */
          href: joinUrl || `/trainer/cohort/${c.id}`,
          external: Boolean(joinUrl),
          urgency: live ? 0 : 20,
          count: 1,
        })
      }

      /* جلسة انتهت ولم يُسجَّل حضور أحد — أول ما يُنسى بعد الجلسة */
      if (over && !markedSessionIds.has(s.id) && enrollments.length > 0) {
        items.push({
          kind: 'attendance_missing',
          titleAr: `حضور «${s.title}» لم يُسجَّل`,
          detailAr: `${c.title} · ${arCount(enrollments.length, 'متعلم واحد', 'متعلمين')} في انتظار التسجيل`,
          actionAr: 'سجّل الحضور',
          href: `/trainer/cohort/${c.id}`,
          external: false,
          urgency: 10,
          count: enrollments.length,
        })
      }

      if (over && (s.recordings?.length ?? 0) === 0 && s.status === 'done') {
        items.push({
          kind: 'recording_missing',
          titleAr: `تسجيل «${s.title}» لم يُرفع`,
          detailAr: c.title,
          actionAr: 'ارفع التسجيل',
          href: `/trainer/cohort/${c.id}`,
          external: false,
          urgency: 60,
          count: 1,
        })
      }
    }

    /* تقييم استحق ولم يسلّم فيه بعض المتعلمين */
    for (const a of c.assessments ?? []) {
      if (a.status && a.status !== 'published') continue
      if (!a.dueAt) continue
      const due = new Date(a.dueAt).getTime()
      if (!Number.isFinite(due) || due > now) continue
      const submitted = new Set((a.submissions ?? []).map((s) => s.enrollmentId))
      const missing = enrollments.filter((e) => !submitted.has(e.id))
      if (missing.length === 0) continue
      items.push({
        kind: 'not_submitted',
        titleAr: `${arCount(missing.length, 'متعلم واحد لم يسلّم', 'متعلمين لم يسلّموا')} «${a.title}»`,
        detailAr: `${c.title} · استحق ${fmtDate(new Date(a.dueAt))}`,
        actionAr: 'ذكّرهم',
        href: `/trainer/cohort/${c.id}`,
        external: false,
        urgency: 30,
        count: missing.length,
      })
    }
  }

  /* ═══ تجهيزُ الشعبة — ثلاثةُ مواقفَ لا موقفٌ واحد ═══

     كان اللوحُ يقول «شعبتان تنتظران إرسالَك» عددا في حبّةٍ واحدة، فيُقرأ
     الرقمُ ولا يُعرف أيُّ شعبةٍ ولا ما ينقصها إلّا بفتحها واحدةً واحدة.

     و`next` أوّلُ ما **يمنع الإرسال** ولو لم يكن بيده (تسميةُ الفصل بيد
     الإدارة). فإن تمَّ ما يملكه وبقي مانعٌ ليس بيده فلا بندَ له هنا: بندٌ
     بلا إجراءٍ خبرٌ لا عمل — وموضعُه سطرُ التحيّة. */
  const summaries: TQPlan[] = Array.isArray(plans)
    ? (plans as TQPlan[]).filter((p) => Boolean(p && p.id && p.planStatus))
    : []
  for (const p of summaries) {
    const where = `/trainer/cohort/${p.id}`
    const courseAr = (p.courseTitle ?? '').trim()
    if (p.planStatus === 'changes_requested') {
      items.push({
        kind: 'plan_returned',
        titleAr: `شعبةٌ رُدَّت إليك — «${p.title}»`,
        detailAr: courseAr ? `${courseAr} · اقرأ ملاحظةَ الإدارة ثمّ أعِد الإرسال` : 'اقرأ ملاحظةَ الإدارة ثمّ أعِد الإرسال',
        actionAr: 'اقرأ الملاحظة',
        href: where,
        external: false,
        urgency: 5,
        count: 1,
      })
      continue
    }
    if (p.planStatus !== 'draft') continue
    const mine = p.total > 0 && p.done >= p.total
    if (mine && !p.next) {
      items.push({
        kind: 'plan_ready_unsent',
        titleAr: `شعبةٌ جاهزةٌ ولم تُرسَل — «${p.title}»`,
        detailAr: courseAr ? `${courseAr} · تجهيزُها تمَّ، وينقصها إرسالُك` : 'تجهيزُها تمَّ، وينقصها إرسالُك',
        actionAr: 'أرسِلها للاعتماد',
        href: where,
        external: false,
        urgency: 25,
        count: 1,
      })
      continue
    }
    if (!mine) {
      const left = Math.max(0, p.total - p.done)
      items.push({
        kind: 'plan_incomplete',
        titleAr: `تجهيزُ «${p.title}» لم يكتمل`,
        detailAr: p.next
          ? `${p.done} من ${p.total} · التالي: ${p.next.labelAr}`
          : `${p.done} من ${p.total} · ${arCount(left, 'بندٌ واحدٌ باقٍ', 'بنودٍ باقية')}`,
        actionAr: 'أكمِل التجهيز',
        href: where,
        external: false,
        urgency: 45,
        count: left || 1,
      })
    }
  }

  if (gradingCount > 0) {
    items.push({
      kind: 'grading_pending',
      titleAr: `${arCount(gradingCount, 'تسليم واحد ينتظر', 'تسليمات تنتظر')} تقييمك`,
      detailAr: 'من كل شعبك — الأقدم أولا',
      actionAr: 'قيّم الآن',
      href: '/trainer/grading',
      external: false,
      urgency: 15,
      count: gradingCount,
    })
  }

  return items.sort((a, b) => a.urgency - b.urgency || b.count - a.count)
}

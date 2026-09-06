/* الوجه الثاني للمستشار: أين وصل عميلي؟

   دورُه المعلَن استشاريّ لا بائعٌ ينصرف بعد الإغلاق. وكان لا يرى شيئا ممّا
   يجري بعد التسجيل: لا تقدّما ولا جلسةً قادمة ولا خطّة. فمن سأله عميلُه
   «أين وصلت؟» لم يجد جوابا في المنصّة، فبحث عنه في واتساب أو لم يجد.

   وما هنا قراءةٌ فقط: المستشار يرى ولا يكتب في تقدّم أحد. وما يريد تغييره
   في الخطّة يرفعه طلبا تبتّ فيه الإدارة. */

import { useEffect, useState } from 'react'
import { BookOpen, CalendarClock, Compass, GraduationCap, Loader2, Route, Target } from 'lucide-react'
import { apiGet, ApiError } from '@/services/api'
import { courseById } from '@/data/courses'
import { pathwayById } from '@/data/pathways'
import { fmtDateTimeAr } from '@/utils/format'
import { Inset } from '@/components/ui/Surface'

interface Snapshot {
  hasAccount: boolean
  enrollments: {
    id: string
    status: string
    courseProgress: { percent: number } | null
    cohort: { id: string; title: string; status: string; startsAt: string | null; course: { id: string } | null } | null
    moduleProgress: { moduleId: string; status: string }[]
  }[]
  upcomingSessions: {
    id: string
    title: string
    startsAt: string
    endsAt: string | null
    status: string
    cohort: { id: string; title: string }
  }[]
  plan: {
    id: string
    nameAr: string
    hostPathwayId: string | null
    giftCourseId: string | null
    items: { courseId: string; sequence: number }[]
  } | null
  diagnostic: {
    attachedAt: string | null
    topPathwayName: string | null
    confidenceBand: string | null
    needsAdvisor: boolean
    goalAr: string | null
    reasons: string[]
    gaps: { skill: string; current: string; target: string; priority: string }[]
  } | null
}

export default function LearnerPanel({ caseId }: { caseId: string }) {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState('')

  /* لا إعادةَ ضبطٍ هنا: المكوّن يُركَّب بمفتاح الحالة عند نداءِ موضعه،
     فتبديلُ الحالة يعيد تركيبه بحالةٍ نظيفة — أنظفُ من مسحٍ في تأثير. */
  useEffect(() => {
    let on = true
    apiGet<Snapshot>(`/api/advisor/cases/${caseId}/learner`)
      .then((s) => { if (on) setSnap(s) })
      .catch((e) => { if (on) setError(e instanceof ApiError ? e.message : 'تعذّر جلب صورة المتعلّم') })
    return () => { on = false }
  }, [caseId])

  if (error) return <p className="text-micro text-gold-ink">{error}</p>
  if (!snap) return <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" /></div>

  if (!snap.hasAccount) {
    return (
      <p className="rounded-xl border border-dashed border-white/15 px-4 py-5 text-center text-micro leading-6 text-muted-foreground">
        لا حساب لهذا العميل بعد — عميلٌ محتمل لم يسجّل. تظهر هنا دوراتُه وتقدّمُه فور إنشائه حسابه.
      </p>
    )
  }

  const active = snap.enrollments.filter((e) => e.status === 'enrolled')

  return (
    <div className="space-y-5">
      {/* خلاصة تشخيصه — كانت سطورا تُبنى في متصفّح المتعلّم وحده ولا تصل
          المستشار أبدا؛ هذه من نتيجته المرفقة بحسابه فعلا. */}
      {snap.diagnostic && (
        <Inset tone="accent">
          <p className="flex items-center gap-1.5 text-micro font-black text-teal-light-ink">
            <Compass className="h-3.5 w-3.5" /> خلاصة تشخيصه
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-muted-foreground">
            {snap.diagnostic.topPathwayName && <span>المسار المرشَّح: {snap.diagnostic.topPathwayName}</span>}
            {snap.diagnostic.confidenceBand && <span>· ثقة الترشيح: {snap.diagnostic.confidenceBand}</span>}
            {snap.diagnostic.needsAdvisor && <span className="font-bold text-gold-ink">· يحتاج مراجعتك</span>}
          </div>
          {snap.diagnostic.goalAr && (
            <p className="mt-2 text-micro leading-6 text-foreground">
              <span className="font-bold text-muted-foreground">هدفه: </span>{snap.diagnostic.goalAr}
            </p>
          )}
          {snap.diagnostic.reasons.length > 0 && (
            <ul className="mt-2 space-y-1">
              {snap.diagnostic.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-micro leading-6 text-muted-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-ink" />
                  <span className="min-w-0">{r}</span>
                </li>
              ))}
            </ul>
          )}
          {snap.diagnostic.gaps.length > 0 && (
            <div className="mt-3">
              <p className="flex items-center gap-1.5 text-micro font-black text-muted-foreground">
                <Target className="h-3 w-3" /> أوجه النمو
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {snap.diagnostic.gaps.map((g, i) => (
                  <li key={i} className="text-micro leading-6 text-muted-foreground">
                    <span className="font-bold text-foreground">{g.skill}</span>
                    {g.current && g.target && <span className="text-muted-foreground"> — من «{g.current}» إلى «{g.target}»</span>}
                    {g.priority && <span className="ms-2 text-micro text-gold-ink">أولوية {g.priority}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Inset>
      )}

      {/* الخطّة */}
      {snap.plan && (
        <div>
          <p className="flex items-center gap-1.5 text-micro font-black text-muted-foreground">
            <Route className="h-3.5 w-3.5 text-teal-light-ink" /> خطّته
          </p>
          <p className="mt-1.5 text-xs font-bold leading-6">{snap.plan.nameAr}</p>
          {snap.plan.hostPathwayId && (
            <p className="mt-0.5 text-micro text-muted-foreground">
              {pathwayById(snap.plan.hostPathwayId)?.name ?? snap.plan.hostPathwayId}
            </p>
          )}
          <ul className="mt-2 space-y-1">
            {snap.plan.items.map((it) => (
              <li key={it.courseId} className="flex items-start gap-2 text-micro leading-6 text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-ink" />
                <span className="min-w-0">
                  {courseById(it.courseId)?.name ?? it.courseId}
                  {snap.plan!.giftCourseId === it.courseId && <span className="ms-2 text-gold-ink">· هديّة</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* الدورات وتقدّمها */}
      <div>
        <p className="flex items-center gap-1.5 text-micro font-black text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5 text-teal-light-ink" /> دوراته وتقدّمها
        </p>
        {active.length === 0 ? (
          <p className="mt-2 text-micro text-muted-foreground">لا تسجيلَ فعّالا بعد.</p>
        ) : (
          <ul className="mt-2 space-y-2.5">
            {active.map((e) => {
              const pct = e.courseProgress?.percent ?? 0
              const doneModules = e.moduleProgress.filter((m) => m.status === 'completed').length
              return (
                <Inset as="li" key={e.id}>
                  <p className="truncate text-xs font-bold">
                    {e.cohort?.course?.id ? courseById(e.cohort.course.id)?.name ?? e.cohort.title : e.cohort?.title ?? '—'}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-teal" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-micro text-muted-foreground">
                    <span className="tabular-nums">{Math.round(pct)}٪</span>
                    <span>· {doneModules} وحدة مكتملة</span>
                    {e.cohort?.title && <span>· {e.cohort.title}</span>}
                  </p>
                </Inset>
              )
            })}
          </ul>
        )}
      </div>

      {/* الجلسات القادمة */}
      <div>
        <p className="flex items-center gap-1.5 text-micro font-black text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5 text-teal-light-ink" /> جلساته القادمة
        </p>
        {snap.upcomingSessions.length === 0 ? (
          <p className="mt-2 text-micro text-muted-foreground">لا جلسةَ قادمة مجدولة.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {snap.upcomingSessions.map((s) => (
              <Inset as="li" key={s.id} className="flex items-start gap-2 px-3 py-2">
                <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate text-micro font-bold">{s.title}</span>
                  <span className="mt-0.5 block text-micro text-muted-foreground">
                    {fmtDateTimeAr(s.startsAt)} · {s.cohort.title}
                  </span>
                </span>
              </Inset>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

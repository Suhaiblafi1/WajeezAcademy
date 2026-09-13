/* جلساتُ التخطيط — ما بعدَ أفقِ طابور العمل.

   كانت لوحةُ المدرّب تعرض السطرَ نفسَه مرّتين: «ما ينتظرك الآن» يقول
   «جلستك «كذا» بعد ٣ ساعات» ومعه زرُّ الدخول، و«جلساتي القادمة» تحته تقول
   الجلسةَ نفسَها بتاريخها وتذهب إلى صفحة الشعبة. سطران لشيءٍ واحد، وزرّان
   مختلفان لفعلٍ واحد — فالقارئ لا يدري أيَّهما يصدّق.

   والقسمة قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): **الطابورُ للعمل الآن،
   وهذه للتخطيط**. فما دخل نافذةَ الطابور (`SOON_WINDOW`) ليس من شأن هذه
   اللوحة، وما بَعُد عنها ليس من شأن الطابور. والحدُّ يُستورَد من الطابور
   نفسِه لا يُكتب هنا رقما ثانيا: لو وُسّعت نافذتُه يوما ضاقت هذه معه
   تلقائيّا، ولا يسقط أحدٌ في الفجوة ولا يظهر في اللوحتين معا.

   ولا رابطَ اجتماعٍ هنا: لا أحد يدخل جلسةً بعد ثلاثة أيّام. الرابطُ فعلٌ
   عاجل، ومكانُه الطابورُ وحدَه. */

import { SOON_WINDOW } from './work-queue'
import { daysUntil, dueLabelAr } from '@/application/student/deadlines'

/* الشكلُ المقروءُ من `/api/trainer/my-cohorts` — ما نحتاجه فقط */
export interface UPSession {
  id: string
  title: string
  startsAt: string
  status: string
}
export interface UPCohort {
  id: string
  title: string
  sessions?: UPSession[] | null
}
export interface UPRow {
  cohort?: UPCohort | null
}

export interface UpcomingSession {
  id: string
  titleAr: string
  cohortId: string
  cohortTitleAr: string
  startsAt: string
}

export interface UpcomingDay {
  /** فرقُ اليوم التقويميّ عن اليوم — مفتاحٌ للترتيب والتصيير */
  dayOffset: number
  /** «غدا» · «بعد يومين» · «بعد 5 أيّام» — من معجمِ المواعيد لا من نصٍّ جديد */
  labelAr: string
  sessions: UpcomingSession[]
}

/** أقصى ما يُعرض — اللوحةُ نافذةٌ على ما هو آتٍ لا جدولٌ كامل */
export const UPCOMING_LIMIT = 6

/**
 * يبني جلساتِ التخطيط مجموعةً بأيّامها.
 *
 * @param rows رد `/api/trainer/my-cohorts`
 * @param now الوقت الآن بالمللي — صريحٌ كي يكون الاشتقاق نقيّا وقابلا للاختبار
 * @param limit أقصى عددِ جلساتٍ تُعرض
 */
export function buildUpcoming(rows: unknown, now: number, limit: number = UPCOMING_LIMIT): UpcomingDay[] {
  const cohorts: UPCohort[] = Array.isArray(rows)
    ? (rows as UPRow[]).map((r) => r?.cohort).filter((c): c is UPCohort => Boolean(c && c.id))
    : []

  const flat: UpcomingSession[] = []
  for (const c of cohorts) {
    for (const s of c.sessions ?? []) {
      if (s.status === 'cancelled' || s.status === 'done') continue
      const start = new Date(s.startsAt).getTime()
      if (!Number.isFinite(start)) continue
      /* الحدُّ صارم: ما كان عند النافذة تماما فهو للطابور، وهذه تبدأ بعده */
      if (start - now <= SOON_WINDOW) continue
      flat.push({
        id: s.id,
        titleAr: s.title,
        cohortId: c.id,
        cohortTitleAr: c.title,
        startsAt: s.startsAt,
      })
    }
  }

  flat.sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  const nowDate = new Date(now)
  const days: UpcomingDay[] = []
  for (const s of flat.slice(0, Math.max(0, limit))) {
    const dayOffset = daysUntil(s.startsAt, nowDate)
    const last = days[days.length - 1]
    if (last && last.dayOffset === dayOffset) {
      last.sessions.push(s)
      continue
    }
    days.push({
      dayOffset,
      labelAr: dueLabelAr(s.startsAt, nowDate),
      sessions: [s],
    })
  }
  return days
}

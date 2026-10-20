/* ═══ بطاقةُ المدرّب في «المدربون» — شعبُه بحالها، ومن كتب ملفَّه العامّ (١٩ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة وهو ينظر في بطاقة مدرّبةٍ مؤهَّلةٍ لسبع دورات: «لماذا لا تظهر دوراتُها ومواعيدُها وما
   اعتُمد منها وما هو مسوّدة وما أُجّل؟ وكيف أعلم أنّه أرفق صورةً أو لا، أو عدّل الكلامَ أو لا؟».

   · **«مسند إلى: لا إسناد نشط»** كان يقرأ `TrainerCourseAssignment` وحدَه — جدولا لا يكتبه إلّا الإسنادُ الإداريّ
     القديم. وشعبُ الإعداد وشعبُ العروض تُربط بالمدرّب في `CohortTrainer` ولا تمرّ به، فكانت بطاقتُها تقول
     «لا إسناد» ولها شعبٌ قائمة. فصارت الشعبُ تُقرأ من `CohortTrainer`، تحت دورتها: حالُها، وأوّلُ لقاء،
     وعددُ اللقاءات، وحالُ خطّة المدرّب — والمؤجَّلةُ مؤجَّلةٌ لا «مردودة» — والمنقولةُ منقولة.
   · **والملفُّ العامّ** يُقرأ من أثره (`AuditEvent`): من وضع الصورةَ ومتى، ومن كتب النبذةَ ومتى، وما رُدّ بعدها.
     وما لا أثرَ له قبل أن يُسجَّل الأثرُ يُقال كما هو: «الأصلية».

   والدوالُّ هنا نقيّةٌ يستوردها الخادمُ (`listForOps`) والشاشةُ معا. */

import { countAr } from '../text/count-ar'
import { movedLabelAr } from './cohort-move'

type Day = (d: string | Date) => string

/* ─────────── الشعب ─────────── */

export interface CardCohort {
  id: string
  courseId: string
  courseTitle: string
  title: string
  status: string
  /** أوّلُ لقاءٍ غيرِ ملغى — أو بدءُ الشعبة إن لم يُجدوَل لقاء */
  firstAt: string | null
  sessions: number
  /** آخرُ خطّةٍ للمدرّب — `null` = لم يكتب بعد */
  plan: string | null
  postponedTo: string | null
  moved: { toYear: number; toSeason: string } | null
}

export const COHORT_STATUS_AR: Record<string, string> = {
  draft: 'مسودة', open: 'مفتوحة للتسجيل', full: 'ممتلئة', active: 'جارية', completed: 'منتهية', cancelled: 'ملغاة',
}

export type PlanMark = 'none' | 'draft' | 'submitted' | 'returned' | 'postponed' | 'approved'

/** حالُ خطّة المدرّب كما تُقرأ في البطاقة — والمؤجَّلةُ ليست مردودة */
export function planMarkOf(c: Pick<CardCohort, 'plan' | 'postponedTo'>): PlanMark {
  if (!c.plan) return 'none'
  if (c.plan === 'changes_requested') return c.postponedTo ? 'postponed' : 'returned'
  if (c.plan === 'approved' || c.plan === 'published') return 'approved'
  if (c.plan === 'submitted') return 'submitted'
  return 'draft'
}

export const PLAN_MARK: Record<PlanMark, { ar: string; tone: 'positive' | 'accent' | 'warn' | 'info' | 'neutral' }> = {
  none: { ar: 'لم يكتب الخطة بعد', tone: 'neutral' },
  draft: { ar: 'الخطة مسودة عنده', tone: 'info' },
  submitted: { ar: 'الخطة تنتظر اعتمادك', tone: 'accent' },
  returned: { ar: 'الخطة ردت إليه بتعديلات', tone: 'warn' },
  postponed: { ar: 'مؤجلة', tone: 'neutral' },
  approved: { ar: 'الخطة معتمدة', tone: 'positive' },
}

/** وسمُ الخطّة بتاريخ التأجيل إن أُجّلت */
export function planMarkAr(c: Pick<CardCohort, 'plan' | 'postponedTo'>, day: Day): string {
  const m = planMarkOf(c)
  return m === 'postponed' && c.postponedTo ? `مؤجلة إلى ${day(c.postponedTo)}` : PLAN_MARK[m].ar
}

const SESSIONS = { one: 'لقاء', two: 'لقاءان', few: 'لقاءات', many: 'لقاء' }

/** سطرُ الشعبة: «مسودة · أول لقاء 3/11/2026 · 8 لقاءات» — والخطّةُ وسمٌ وحدَها */
export function cohortLineAr(c: CardCohort, day: Day): string {
  const parts = [COHORT_STATUS_AR[c.status] ?? c.status]
  parts.push(c.firstAt ? `أول لقاء ${day(c.firstAt)}` : 'لا موعد بعد')
  if (c.sessions > 0) parts.push(c.sessions === 2 ? 'لقاءان' : countAr(c.sessions, SESSIONS))
  if (c.moved) parts.push(movedLabelAr({ ...c.moved, firstAt: null }, day))
  return parts.join(' · ')
}

/** عدّادُ البطاقة: «7 شعب: 4 معتمدة · 1 تنتظرك · 2 مؤجلة» — ما عددُه صفرٌ لا يُذكر */
export function cohortsTallyAr(cs: Pick<CardCohort, 'plan' | 'postponedTo'>[]): string {
  if (cs.length === 0) return 'لا شعبة له بعد'
  const n: Record<PlanMark, number> = { none: 0, draft: 0, submitted: 0, returned: 0, postponed: 0, approved: 0 }
  for (const c of cs) n[planMarkOf(c)] += 1
  const parts = [
    n.approved && `${n.approved} معتمدة`,
    n.submitted && `${n.submitted} تنتظرك`,
    n.returned && `${n.returned} ردت بتعديلات`,
    n.postponed && `${n.postponed} مؤجلة`,
    n.draft + n.none && `${n.draft + n.none} لم ترسل بعد`,
  ].filter(Boolean)
  const head = countAr(cs.length, { one: 'شعبة', two: 'شعبتان', few: 'شعب', many: 'شعبة' })
  return `${cs.length === 2 ? 'شعبتان' : head}: ${parts.join(' · ')}`
}

/* ═══ له شعبةٌ تُباع واسمُه لا يظهر — أوّلَ القائمة (١٩ أكتوبر ٢٠٢٦) ═══

   قِيس في الإنتاج: ستُّ شعبٍ مفتوحةٌ للتسجيل لا يرى المشتري من يدرّسها، لأنّ أسماءَ مدرّبيها لم يُعتمد
   ظهورُها. واختار صاحبُ المنصّة أن يعتمدها من هنا — ولم يكن في البطاقات ما يدلّه عليهم إلّا قراءتُها كلِّها.

   والشرطُ شرطُ الخادم في اسم الشعبة (`trainerPubliclyVisible`): ظهورٌ معتمَدٌ وتوثيقٌ ولا إيقاف. و«تُباع»
   ما يختاره المشتري في منتقي الشعبة: مفتوحةٌ أو ممتلئة (`JOINABLE` في `cohort-prices.ts`). */
/* ═══ وصار الشرطُ شرطَ صفحة المدرّبين نفسَه (٢٠ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «لماذا حفصة لا تظهر بقائمة المدرّبين؟ لها شعب.. راجع كلَّ المدرّبين بنفس الوضع». وكان
   الوسمُ على «مفتوحةٍ أو ممتلئة» وحدَهما — فمن بدأت شعبتُه (جارية) أو انتهت هذا الفصل غائبٌ عن الصفحة كغيره
   ولا يوسَم. فالشرطُ الآن ما يحكم الصفحةَ بعينه: له دوراتٌ منشورةٌ هذا الفصلَ أو بعده (`hasLiveCourse` —
   `liveTrainerWhere` على الخادم) واسمُه لا يُعرض. فكلُّ موسومٍ غائبٌ عن الصفحة لهذا السبب وحدَه، وكلُّ غائبٍ
   لهذا السبب موسوم. */

/** أله دوراتٌ منشورةٌ واسمُه لا يُعرض — فهو غائبٌ عن صفحة المدرّبين وعن شعبه؟ */
export function hiddenOnSale(t: {
  publiclyVisible: boolean
  isVerified: boolean
  suspended: boolean
  hasLiveCourse: boolean
}): boolean {
  const shown = t.publiclyVisible && t.isVerified && !t.suspended
  return !shown && t.hasLiveCourse
}

/* ─────────── أثرُ الملفّ العامّ ─────────── */

export interface TrailEvent { action: string; at: string | Date; meta?: unknown }

export interface ProfileTrail {
  /** آخرُ من وضع الصورةَ المعروضة: المدرّبُ (رفعها واعتُمدت) أو الإدارةُ رفعا أو رابطا */
  photo: { by: 'trainer' | 'admin_upload' | 'admin_link'; at: string } | null
  /** صورةٌ أحدثُ رُدّت بعد ذلك */
  photoRejectedAt: string | null
  /** آخرُ من كتب العنوانَ والنبذة: المدرّبُ (واعتُمدتا، ومعدَّلتين أو لا) أو الإدارة */
  text: { by: 'trainer' | 'trainer_edited' | 'admin'; at: string } | null
  textRejectedAt: string | null
}

/** أفعالُ الأثر التي يُبنى منها — يقرؤها الخادمُ بها وحدَها */
export const TRAIL_ACTIONS = [
  'trainer.photo.approve', 'trainer.photo.reject', 'trainer.photo.upload',
  'trainer.public_text.approve', 'trainer.public_text.reject', 'trainer.public_profile.save',
] as const

const iso = (d: string | Date) => (typeof d === 'string' ? d : d.toISOString())
const savedFields = (meta: unknown): string[] => {
  const f = (meta as { fields?: unknown } | null | undefined)?.fields
  return Array.isArray(f) ? f.filter((x): x is string => typeof x === 'string') : []
}

/** يقرأ الأثرَ بترتيب وقوعه — والأحدثُ يغلب */
export function profileTrailOf(events: TrailEvent[]): ProfileTrail {
  const t: ProfileTrail = { photo: null, photoRejectedAt: null, text: null, textRejectedAt: null }
  const sorted = [...events].sort((a, b) => iso(a.at).localeCompare(iso(b.at)))
  for (const e of sorted) {
    const at = iso(e.at)
    switch (e.action) {
      case 'trainer.photo.approve': t.photo = { by: 'trainer', at }; t.photoRejectedAt = null; break
      case 'trainer.photo.upload': t.photo = { by: 'admin_upload', at }; t.photoRejectedAt = null; break
      case 'trainer.photo.reject': t.photoRejectedAt = at; break
      case 'trainer.public_text.approve': {
        const edited = Boolean((e.meta as { edited?: unknown } | null | undefined)?.edited)
        t.text = { by: edited ? 'trainer_edited' : 'trainer', at }; t.textRejectedAt = null; break
      }
      case 'trainer.public_text.reject': t.textRejectedAt = at; break
      case 'trainer.public_profile.save': {
        const f = savedFields(e.meta)
        if (f.includes('photoUrl')) { t.photo = { by: 'admin_link', at }; t.photoRejectedAt = null }
        if (f.includes('headline') || f.includes('bioPublic')) { t.text = { by: 'admin', at }; t.textRejectedAt = null }
        break
      }
    }
  }
  return t
}

/** سطرُ الصورة: هل أرفق صورة، ومن وضع المعروضةَ، ومتى */
export function photoTrailAr(s: { hasPhoto: boolean; pending: boolean; trail: ProfileTrail }, day: Day): string {
  if (s.pending) return 'الصورة: رفع المدرب صورة تنتظر اعتمادك'
  const rejected = s.trail.photoRejectedAt
  if (!s.hasPhoto) {
    return rejected ? `الصورة: لا صورة. رفع المدرب صورة ورددتها في ${day(rejected)}` : 'الصورة: لم يرفع المدرب صورة بعد'
  }
  const p = s.trail.photo
  const head = !p ? 'الصورة: موجودة من قبل'
    : p.by === 'trainer' ? `الصورة: رفعها المدرب واعتمدت في ${day(p.at)}`
    : p.by === 'admin_upload' ? `الصورة: رفعتها الإدارة في ${day(p.at)}`
    : `الصورة: رابط وضعته الإدارة في ${day(p.at)}`
  return rejected ? `${head}. ورددت صورة أحدث في ${day(rejected)}` : head
}

/** سطرُ النبذة: هل عدّل المدرّبُ كلامَه، ومن كتب المعروضَ، ومتى */
export function textTrailAr(s: { hasText: boolean; pending: boolean; trail: ProfileTrail }, day: Day): string {
  if (s.pending) return 'النبذة: أرسل المدرب نصا جديدا ينتظر اعتمادك'
  const x = s.trail.text
  const head = !x ? (s.hasText ? 'النبذة: الأصلية، لم يعدلها المدرب' : 'النبذة: لا نبذة بعد')
    : x.by === 'trainer' ? `النبذة: كتبها المدرب واعتمدت في ${day(x.at)}`
    : x.by === 'trainer_edited' ? `النبذة: كتبها المدرب واعتمدت بعد تعديلك في ${day(x.at)}`
    : `النبذة: عدلتها الإدارة في ${day(x.at)}`
  const rejected = s.trail.textRejectedAt
  return rejected ? `${head}. ورددت نصا أحدث في ${day(rejected)}` : head
}

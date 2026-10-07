/* ═══ ما يقوله قرارُ خطّة الشعبة لمن نقره — بما ردّه الخادم لا بما يُظنّ ═══

   كانت هذه في بطاقة الشعبة (`src/pages/admin/CohortOps.tsx`) وحدَها. ثمّ صار
   القرارُ يُتّخذ من موضعين — البطاقةِ، و«خططٌ تنتظر اعتمادك» التي تجمع خططَ
   المدرّبين كلِّهم (٣ أكتوبر ٢٠٢٦) — فخرجت إلى هنا لتُقال فيهما بنصٍّ واحد،
   وتُختبَر بمدخلاتها لا بقراءة شيفرتها. */

import { countAr } from '../text/count-ar'
import { REVIEW_NOTE_MAX } from './review-notes'

/** ما يعود من اعتماد الخطّة — ولقاءاتُها التي اعتُمدت معها أو تعذّرت */
export interface PlanDecision {
  status: string
  meetings?: { approved: number; failed: { id: string; title: string; reason: string }[] }
  /* ومهامُّها المنتظِرةُ التي اعتُمدت معها — وما بقي منها بسببه (٣ج-٣) */
  tasks?: { applied: number; failed: { id: string; title: string; reason: string }[] }
  /* وشعبةُ الإعداد: ما وقع لمدرّبها بالاعتماد (`trainer-prep.service.ts` ← `qualifyOnApproval` ثمّ `activateOnApproval`).
     `null` لشعبةٍ عاديّة، أو لمدرّبٍ نشطٍ أصلا لا يُفعَّل بها */
  prep?: { activated: boolean; waiting?: number; blockedAr?: string } | null
}

/** ما يقوله الاعتمادُ لمن نقره — باللقاءات التي اعتُمدت معه، وبما تعذّر باسمه */
export function approvedMsg(r: PlanDecision): string {
  const m = r.meetings
  const withMeetings = m && m.approved > 0 ? ` ومعها ${m.approved === 1 ? 'لقاؤها' : `لقاءاتُها (${m.approved})`}` : ''
  const t = r.tasks
  const withTasks = t && t.applied > 0 ? ` و${t.applied === 1 ? 'مهمّتُها المنتظِرة' : `مهامُّها المنتظِرة (${t.applied})`}` : ''
  const failed = m?.failed.length
    ? ` — وتعذّر اعتمادُ ${m.failed.map((f) => `«${f.title}»`).join(' و')}: ${m.failed[0].reason}. أعِد المحاولةَ من بطاقته أدناه.`
    : ' — وأُخبر المدرّب'
  const tasksLeft = t?.failed.length
    ? ` وبقي من المهامّ ${t.failed.map((f) => `«${f.title}»`).join(' و')}: ${t.failed[0].reason}`
    : ''
  return `اعتُمدت خطّةُ المدرّب${withMeetings}${withTasks}${failed}${tasksLeft}`
}

/** ما بقي من دوراته بلا اعتماد — بالعدد كما يُقرأ لا «2 دورتان» */
function coursesLeftAr(n: number): string {
  if (n === 1) return 'دورةٌ واحدة'
  if (n === 2) return 'دورتان'
  return countAr(n, { one: 'دورة', two: 'دورتان', few: 'دورات', many: 'دورةً' })
}

/* ═══ وما وقع لمدرّب الإعداد — يُقال ولا يُكتشَف (٣ أكتوبر ٢٠٢٦) ═══

   اعتمادُ خطّة شعبة الإعداد يؤهّله لدورتها، واعتمادُ آخرها يفعّله: يصير نشطا،
   ويُختَم عقدُه المشروطُ إن كان ينتظر ختمَنا، ويصله بريدُ اعتماده. فمن يعتمد
   خططَه واحدةً واحدةً يحتاج أن يعرف عند كلّ نقرةٍ: أهذه الأخيرة؟ وكم بقي؟

   والخادمُ يقول ثلاثةً لا غير، فتُقال بحرفها:
   · `activated` — فُعِّل. ولا يُقال «وخُتم عقدُه» جزما: الخَتمُ للعرض المشروط
     وحدَه (`completeConditionalOffer`)، فيُحال إلى «العقود» حيث يُرى حالُه.
   · `waiting` — دوراتٌ له لم تُعتمَد بعد، ويُفعَّل باعتماد آخرها.
   · `blockedAr` — اعتُمدت كلُّها ومنع التفعيلَ مانع: يُقال بنصّه، وقد بلغ
     الإدارةَ جرسا (`trainer.prep.activation_blocked`). */
export function prepOutcomeAr(prep: PlanDecision['prep']): string {
  if (!prep) return ''
  if (prep.activated) {
    return 'وبها اكتملت دوراتُه كلُّها: فُعِّل مدرّبا نشطا ووصله خبرُ اعتماده جرسا وبريدا — وحالُ عقده في «العقود»، وما بقي عليك أدناه'
  }
  if (prep.blockedAr) {
    return `واعتُمدت دوراتُه كلُّها ولم يُفعَّل: ${prep.blockedAr} — أصلِحْ ذلك ثمّ فعّله من ملفّه`
  }
  if (prep.waiting && prep.waiting > 0) {
    return `وبقيت له ${coursesLeftAr(prep.waiting)} لم تُعتمَد بعد — يُفعَّل باعتماد آخرها`
  }
  return ''
}

/** رسالةُ الاعتماد كاملة: ما اعتُمد معه، ثمّ ما وقع لمدرّب الإعداد جملةً بعده */
export function planApprovedMsg(r: PlanDecision): string {
  const base = approvedMsg(r)
  const prep = prepOutcomeAr(r.prep)
  if (!prep) return base
  return `${base}${base.endsWith('.') ? '' : '.'} ${prep}.`
}

/** شعبةُ إعداد؟ — كما يقولها طابورُ الخطط (`CohortPlanService.pending`):
    `qualifies` تأهيلُه لدورتها معلّقٌ فيقع باعتمادها، و`onboarding` هو في
    الطور فقد يفعّله اعتمادُها إن كانت آخرَ ما ينتظر */
export interface PrepFlags { onboarding: boolean; qualifies: boolean }

/* ═══ ما يُطلقه كلٌّ من الزرّين في شعبة الإعداد — قبل النقر لا بعده ═══

   قاعدةُ «لا إجبار» (CLAUDE.md): الخياراتُ وأثرُ كلٍّ، والقرارُ لصاحب المنصّة.
   والجملةُ بما يحكم به الخادم في `TrainerPrepService` (`qualifyOnApproval` · `activateOnApproval` · `returnOnChanges`) حرفا:
   التأهيلُ إن كان معلّقا، والتفعيلُ حين لا يبقى ما ينتظر، والخَتمُ للعرض
   المشروط وحدَه — وفي الردّ تُستأنف المهلةُ إن كانت موقوفةً لمراجعتنا. */
export function prepNoteAr(p: PrepFlags, many = false): string {
  const approve = p.qualifies
    ? '«اعتمدها» تؤهّل مدرّبَها لدورتها'
    : 'دورتُها معتمَدةٌ لمدرّبها أصلا، و«اعتمدها» تعتمد خطّتَها'
  const last = p.onboarding
    ? '، وإن لم يبقَ من دوراته ما ينتظر فُعِّل — ويُختَم عقدُه المشروطُ إن كان ينتظر ختمَنا'
    : ''
  const back = p.onboarding ? '، ويُستأنف عدُّ مهلته إن كانت موقوفةً لمراجعتنا' : ''
  return `${many ? 'شعبُ الإعداد' : 'شعبةُ إعداد'}: ${approve}${last}. و«اطلب تعديلات» تعيدها إليه بملاحظاتك في رأس كلّ خطوة${back}.`
}

/* ═══ الطابورُ لا يكرّر نفسَه (٤ أكتوبر ٢٠٢٦، ⑨) ═══

   سار صاحبُ المنصّة في «خططٌ تنتظر اعتمادك» فرأى كلَّ بطاقةٍ تقول اسمَ دورتها
   تحت اسمٍ فيه اسمُها — الاسمُ الافتراضيُّ «الدورة — شعبة N» (`cohort-title.ts`)
   — وجملةَ شعبة الإعداد نفسَها في كلّ بطاقةٍ لمدرّبٍ واحد. فاسمُ الدورة يُقال
   حين لا يحمله اسمُ الشعبة وحدَه (شعبةٌ سُمّيت باسمٍ آخر)، والجملةُ مرّةً في
   رأس المدرّب إن قالتها بطاقتان له فأكثر حرفا — وإن اختلفت بقيت كلٌّ في
   بطاقتها، فلا تُنسب جملةٌ إلى شعبةٍ لا تصدق عليها. والبطاقةُ الواحدةُ تبقى
   جملتُها فيها: لا تكرارَ يُرفع، ورأسٌ يجمع بطاقةَ إعدادٍ وأخرى عاديّةً لا
   يُسنَد إليه ما يخصّ إحداهما. */

/** اسمُ الدورة سطرا تحت اسم الشعبة — إلّا إن كان فيه */
export function courseLineNeeded(cohortTitle: string, courseTitle: string): boolean {
  const course = courseTitle.trim()
  return course.length > 0 && !cohortTitle.includes(course)
}

/** جملةُ شعبة الإعداد مرّةً لمجموعة المدرّب إن صدقت حرفا على بطاقتين منتظِرتين فأكثر — وإلّا `null` */
export function sharedPrepNote(rows: readonly { prep: PrepFlags | null; decided: boolean }[]): string | null {
  const waiting = rows.filter((r) => r.prep && !r.decided)
  const notes = new Set(waiting.map((r) => prepNoteAr(r.prep!)))
  return waiting.length > 1 && notes.size === 1 ? prepNoteAr(waiting[0]!.prep!, true) : null
}

/* ═══ وما يقوله الاعتمادُ لمدرّبها — جرسا وبريدا، خبرا واحدا (٣ أكتوبر ٢٠٢٦) ═══

   كان يقول «شعبتك جاهزة — تظهر لك من «شعبي» بمن التحق فيها، واعتُمدت معها
   لقاءاتُك ووصلت المسجَّلين في تقاويمهم» لكلّ شعبة. وشعبةُ الإعداد لا يلتحق بها
   أحد: علمُها منزولٌ حتّى تفتحها الإدارةُ بقرارٍ منفصل — فالخبرُ يعد بما لم يقع.
   وكان يصله معه خبرٌ ثانٍ «أُهِّلتَ لتدريس دورة» عن القرار نفسِه. فصار خبرا
   واحدا يقول ما وقع فعلا: التأهيلَ إن وقع بهذا الاعتماد، وحالَ التسجيل كما
   هو (علمُ الشعبة بعد الاعتماد)، واللقاءاتِ والمهامَّ التي اعتُمدت معه. */
export interface TrainerApprovalFacts {
  cohortTitle: string
  /** علمُ الشعبة بعد الاعتماد — مرفوعٌ فهي تقبل المسجَّلين */
  registrationOpen: boolean
  /** الدورةُ التي صار مؤهَّلا لها بهذا الاعتماد (شعبةُ الإعداد) — وإلّا `null` */
  qualifiedCourseAr: string | null
  meetingsApproved: number
  meetingsFailed: number
  tasksApplied: number
  /** كلمةُ المعتمِد إن كتبها — تُضاف إلى الخبر ولا تحلّ محلَّه */
  noteAr?: string | null
}

export function planApprovedTrainerMsg(f: TrainerApprovalFacts): { title: string; heading: string; body: string } {
  const parts: string[] = []
  if (f.qualifiedCourseAr) parts.push(`أُضيفت «${f.qualifiedCourseAr}» إلى دوراتك.`)
  parts.push(f.registrationOpen
    ? 'شعبتك جاهزة — تظهر لك من «شعبي» بمن التحق فيها.'
    : `${parts.length ? 'والشعبةُ' : 'الشعبةُ'} لم تُفتح للتسجيل بعد — تفتحها الأكاديمية، وتراها مفتوحةً في «شعبي» حين تُفتح.`)
  if (f.meetingsApproved > 0) {
    const what = f.meetingsApproved === 1 ? 'لقاؤك' : `لقاءاتُك (${f.meetingsApproved})`
    const verb = f.meetingsApproved === 1 ? 'اعتُمد' : 'اعتُمدت'
    parts.push(f.registrationOpen
      ? `و${verb} معها ${what} ووصل${f.meetingsApproved === 1 ? '' : 'ت'} المسجَّلين في تقاويمهم.`
      : `و${verb} معها ${what}.`)
  }
  if (f.meetingsFailed === 1) parts.push('وبقي لقاءٌ واحدٌ عند الإدارة تُتمّ اعتمادَه.')
  else if (f.meetingsFailed > 1) parts.push(`وبقيت لقاءاتٌ (${f.meetingsFailed}) عند الإدارة تُتمّ اعتمادَها.`)
  if (f.tasksApplied > 0) parts.push(`واعتُمد معها ما انتظر من مهامّك (${f.tasksApplied}).`)
  const note = f.noteAr?.trim()
  return {
    title: `اعتُمدت خطّةُ «${f.cohortTitle}»`,
    heading: f.registrationOpen ? 'اعتُمدت خطّةُ شعبتك — وهي جاهزةٌ الآن' : 'اعتُمدت خطّةُ شعبتك',
    body: `${parts.join(' ')}${note ? `\n\nوكلمةُ الإدارة: ${note}` : ''}`,
  }
}

/** ما يقوله قرارُ المهمّة الواحدة — بما وقع فعلا */
export function taskDecisionMsg(r: { status?: string; kind?: string } | null): string {
  if (r?.status === 'declined') return 'رُدّ إلى المدرّب بسببه — والمعتمَدُ باقٍ كما هو عند المتعلّمين'
  if (r?.kind === 'remove') return 'اعتُمد الحذف — لم تعد تظهر للمتعلّمين، وأُخبر المدرّب'
  if (r?.kind === 'edit') return 'اعتُمد التعديل — يقرؤه المتعلّمون الآن، وأُخبر المدرّب'
  return 'اعتُمدت المهمّة — صارت في المنهج وتُفتح للمتعلّمين في موعدها، وأُخبر المدرّب'
}

export const PLAN_AR: Record<string, string> = {
  draft: 'مسودّةٌ عند المدرّب', submitted: 'بانتظار اعتمادك', changes_requested: 'رُدّت إليه بتعديلات',
  approved: 'معتمَدة', published: 'منشورة', superseded: 'نسخةٌ قديمة',
}

/* ═══ الاعتمادُ بكلمة (٧ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: الخطّةُ التي ليس عليها إلّا مقترحاتٌ تُعتمَد ولا تُردّ —
   فالردُّ يُغلق التسجيلَ على مقترَحٍ لا يُلزم — وتصل المقترحاتُ معها. والخادمُ
   كان يقبل الكلمةَ مع الاعتماد ويضيفها إلى خبره «وكلمةُ الإدارة: …»
   (`planApprovedTrainerMsg`)، والزرُّ لا يرسلها. فهذا ما يرسله: الاعتمادُ وحدَه،
   أو معه كلمتُه مشذَّبةً بحدّ الملاحظة نفسِه. */
export function approvalBody(note: string): { approve: true; note?: string } {
  const said = note.trim().slice(0, REVIEW_NOTE_MAX).trim()
  return said ? { approve: true, note: said } : { approve: true }
}


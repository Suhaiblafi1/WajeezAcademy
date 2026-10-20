/* ═══ ما يقوله قرارُ خطّة الشعبة لمن نقره — بما ردّه الخادم لا بما يُظنّ ═══

   كانت هذه في بطاقة الشعبة (`src/pages/admin/CohortOps.tsx`) وحدَها. ثمّ صار
   القرارُ يُتّخذ من موضعين — البطاقةِ، و«خططٌ تنتظر اعتمادك» التي تجمع خططَ
   المدرّبين كلِّهم (٣ أكتوبر ٢٠٢٦) — فخرجت إلى هنا لتُقال فيهما بنصٍّ واحد،
   وتُختبَر بمدخلاتها لا بقراءة شيفرتها. */

import { countAr } from '../text/count-ar'
import { REVIEW_NOTE_MAX } from './review-notes'
import { reportTitleAr } from './review-reports-bulk'

/** ما يعود من اعتماد الخطّة — ولقاءاتُها التي اعتُمدت معها أو تعذّرت */
export interface PlanDecision {
  status: string
  meetings?: { approved: number; failed: { id: string; title: string; reason: string }[] }
  /* ومهامُّها المنتظِرةُ التي اعتُمدت معها — وما بقي منها بسببه (٣ج-٣) */
  tasks?: { applied: number; failed: { id: string; title: string; reason: string }[] }
  /* وشعبةُ الإعداد: ما وقع لمدرّبها بالاعتماد (`trainer-prep.service.ts` ← `qualifyOnApproval` ثمّ `activateOnApproval`).
     `null` لشعبةٍ عاديّة، أو لمدرّبٍ نشطٍ أصلا لا يُفعَّل بها */
  prep?: { activated: boolean; blockedAr?: string } | null
}

/** ما يقوله الاعتمادُ لمن نقره — باللقاءات التي اعتُمدت معه، وبما تعذّر باسمه */
export function approvedMsg(r: PlanDecision): string {
  const m = r.meetings
  const withMeetings = m && m.approved > 0 ? ` ومعها ${m.approved === 1 ? 'لقاؤها' : `لقاءاتها (${m.approved})`}` : ''
  const t = r.tasks
  const withTasks = t && t.applied > 0 ? ` و${t.applied === 1 ? 'مهمّتها المنتظرة' : `مهامّها المنتظرة (${t.applied})`}` : ''
  const failed = m?.failed.length
    ? ` — وتعذّر اعتماد ${m.failed.map((f) => `«${f.title}»`).join(' و')}: ${m.failed[0].reason}. أعد المحاولة من بطاقته أدناه.`
    : ' — وأخبر المدرّب'
  const tasksLeft = t?.failed.length
    ? ` وبقي من المهامّ ${t.failed.map((f) => `«${f.title}»`).join(' و')}: ${t.failed[0].reason}`
    : ''
  return `اعتمدت خطّة المدرّب${withMeetings}${withTasks}${failed}${tasksLeft}`
}

/* ═══ وما وقع لمدرّب الإعداد — يُقال ولا يُكتشَف (٣ أكتوبر ٢٠٢٦) ═══

   اعتمادُ خطّة شعبة الإعداد يؤهّله لدورتها ويفعّله: يصير نشطا، ويُختَم عقدُه
   المشروطُ إن كان ينتظر ختمَنا، ويصله بريدُ اعتماده. وكان يُفعَّل باعتماد آخرِ
   دوراته فيُقال عند كلّ نقرةٍ «كم بقي» — ثمّ قرّر صاحبُ المنصّة (٢٠ أكتوبر ٢٠٢٦):
   «one cohort is enough for them to be active». فأوّلُها يفعّله.

   والخادمُ يقول اثنين لا غير، فيُقالان بحرفهما:
   · `activated` — فُعِّل. ولا يُقال «وخُتم عقدُه» جزما: الخَتمُ للعرض المشروط
     وحدَه (`completeConditionalOffer`)، فيُحال إلى «العقود» حيث يُرى حالُه.
   · `blockedAr` — اعتُمدت ومنع التفعيلَ مانع: يُقال بنصّه، وقد بلغ الإدارةَ
     جرسا (`trainer.prep.activation_blocked`). */
export function prepOutcomeAr(prep: PlanDecision['prep']): string {
  if (!prep) return ''
  if (prep.activated) {
    return 'وبها فعّل مدرّبا نشطا ووصله خبر اعتماده جرسا وبريدا — وحال عقده في «العقود»، وما بقي عليك أدناه'
  }
  if (prep.blockedAr) {
    return `واعتمدت له دورة ولم يفعّل: ${prep.blockedAr} — أصلح ذلك ثمّ فعّله من ملفّه`
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
    الطور فيفعّله اعتمادُها */
export interface PrepFlags { onboarding: boolean; qualifies: boolean }

/* ═══ ما يُطلقه كلٌّ من الزرّين في شعبة الإعداد — قبل النقر لا بعده ═══

   قاعدةُ «لا إجبار» (CLAUDE.md): الخياراتُ وأثرُ كلٍّ، والقرارُ لصاحب المنصّة.
   والجملةُ بما يحكم به الخادم في `TrainerPrepService` (`qualifyOnApproval` · `activateOnApproval` · `returnOnChanges`) حرفا:
   التأهيلُ إن كان معلّقا، والتفعيلُ لمن في الطور، والخَتمُ للعرض
   المشروط وحدَه — وفي الردّ تُستأنف المهلةُ إن كانت موقوفةً لمراجعتنا. */
export function prepNoteAr(p: PrepFlags, many = false): string {
  const approve = p.qualifies
    ? '«اعتمدها» تؤهّل مدرّبها لدورتها'
    : 'دورتها معتمدة لمدرّبها أصلا، و«اعتمدها» تعتمد خطّتها'
  const last = p.onboarding
    ? '، وتفعّله مدرّبا نشطا — ويختم عقده المشروط إن كان ينتظر ختمنا'
    : ''
  const back = p.onboarding ? '، ويستأنف عدّ مهلته إن كانت موقوفة لمراجعتنا' : ''
  return `${many ? 'شعب الإعداد' : 'شعبة إعداد'}: ${approve}${last}. و«اطلب تعديلات» تعيدها إليه بملاحظاتك في رأس كلّ خطوة${back}.`
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
  /** بطاقاتٌ اعتمدتها الإدارةُ له وبقيت بعد الاعتماد اقتراحاتٍ اختياريّة (١٧ أكتوبر ٢٠٢٦) */
  suggestions?: number
}

export function planApprovedTrainerMsg(f: TrainerApprovalFacts): { title: string; heading: string; body: string } {
  const parts: string[] = []
  if (f.qualifiedCourseAr) parts.push(`أضيفت «${f.qualifiedCourseAr}» إلى دوراتك.`)
  parts.push(f.registrationOpen
    ? 'شعبتك جاهزة — تظهر لك من «شعبي» بمن التحق فيها.'
    : `${parts.length ? 'والشعبة' : 'الشعبة'} لم تفتح للتسجيل بعد — تفتحها الأكاديمية، وتراها مفتوحة في «شعبي» حين تفتح.`)
  if (f.meetingsApproved > 0) {
    const what = f.meetingsApproved === 1 ? 'لقاؤك' : `لقاءاتك (${f.meetingsApproved})`
    const verb = f.meetingsApproved === 1 ? 'اعتمد' : 'اعتمدت'
    parts.push(f.registrationOpen
      ? `و${verb} معها ${what} ووصل${f.meetingsApproved === 1 ? '' : 'ت'} المسجّلين في تقاويمهم.`
      : `و${verb} معها ${what}.`)
  }
  if (f.meetingsFailed === 1) parts.push('وبقي لقاء واحد عند الإدارة تتمّ اعتماده.')
  else if (f.meetingsFailed > 1) parts.push(`وبقيت لقاءات (${f.meetingsFailed}) عند الإدارة تتمّ اعتمادها.`)
  if (f.tasksApplied > 0) parts.push(`واعتمد معها ما انتظر من مهامّك (${f.tasksApplied}).`)
  /* وما اعتمدته الإدارةُ له من بطاقاتٍ يبقى عنده اقتراحا — ويُقال أنّه اختياريّ وأين يجده */
  const n = f.suggestions ?? 0
  if (n === 1) parts.push('وبقي لك في «المراجعة» اقتراح واحد من الإدارة، اختياري: إن قبلته دخل خطتك المعتمدة مباشرة.')
  else if (n > 1) parts.push(`وبقيت لك في «المراجعة» اقتراحات من الإدارة (${n})، اختيارية: ما تقبله يدخل خطتك المعتمدة مباشرة.`)
  const note = f.noteAr?.trim()
  return {
    title: `اعتمدت خطّة «${f.cohortTitle}»`,
    heading: f.registrationOpen ? 'اعتمدت خطّة شعبتك — وهي جاهزة الآن' : 'اعتمدت خطّة شعبتك',
    body: `${parts.join(' ')}${note ? `\n\nوكلمة الإدارة: ${note}` : ''}`,
  }
}

/** ما يقوله قرارُ المهمّة الواحدة — بما وقع فعلا */
export function taskDecisionMsg(r: { status?: string; kind?: string } | null): string {
  if (r?.status === 'declined') return 'ردّ إلى المدرّب بسببه — والمعتمد باق كما هو عند المتعلّمين'
  if (r?.kind === 'remove') return 'اعتمد الحذف — لم تعد تظهر للمتعلّمين، وأخبر المدرّب'
  if (r?.kind === 'edit') return 'اعتمد التعديل — يقرؤه المتعلّمون الآن، وأخبر المدرّب'
  return 'اعتمدت المهمّة — صارت في المنهج وتفتح للمتعلّمين في موعدها، وأخبر المدرّب'
}

export const PLAN_AR: Record<string, string> = {
  draft: 'مسودّة عند المدرّب', submitted: 'بانتظار اعتمادك', changes_requested: 'ردّت إليه بتعديلات',
  approved: 'معتمدة', published: 'منشورة', superseded: 'نسخة قديمة',
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

/* ═══ وتقريرُ المراجعة في رسالة القرار (٨ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: التقريرُ يُرفع على بطاقة المراجعة ويُحفظ مع الخطّة، ورسالةُ القرار
   — جرسا وبريدا — تقول إنّه هناك وأين يُقرأ. لا يُرفق بالبريد: يبقى في المنصّة يُفتح بعد
   البريد، ولا يُحجب بحجمه عند مزوّدي البريد. */
export function reviewReportLineAr(raw: readonly string[]): string | null {
  if (raw.length === 0) return null
  /* وبأسمائها التي يقرؤها المدرّب — «تقرير المراجعة» لا «فلان — الشعبة (1).pdf» (١١ أكتوبر ٢٠٢٦) */
  const names = raw.map(reportTitleAr)
  const which = names.length === 1 ? `«${names[0]}»` : names.map((n) => `«${n}»`).join(' و')
  return `ومع هذا الردّ ${names.length === 1 ? 'تقرير مراجعة مفصّل' : 'تقارير مراجعة مفصّلة'}: ${which} — `
    + 'تجده في خطوة «المراجعة» من صفحة شعبتك، للقراءة إن شئت.'
}

/* ═══ الجرسُ: عددٌ وموضع، لا نصوص (١١ أكتوبر ٢٠٢٦) ═══

   كان جرسُ الردّ يحمل ملاحظاتِ الخطوات بنصوصها، ثمّ سطرَ التعديلات، ثمّ سطرَ التقرير — فقرةٌ لا
   تنتهي في نافذةٍ صغيرة. وقال صاحبُ المنصّة: «الإشعاراتُ فيها كلامٌ كثيرٌ وغيرُ احترافيّة.. اجعلها
   أكثرَ احترافيّةً وواضحةً، وتقود للصفحة المسؤولة». فالنصوصُ بنودٌ في «المراجعة»، والجرسُ يقول كم
   ينتظره هناك في سطر، وزرُّه يفتحها (`notificationHref`). والبريدُ كما هو: له مساحتُه. */

const NOTES_AR = { one: 'ملاحظة', two: 'ملاحظتان', few: 'ملاحظات', many: 'ملاحظة' }
const EDITS_ADJ = { one: 'مقترح', two: 'مقترحان', few: 'مقترحة', many: 'مقترحا' }

/** «56 تعديلًا مقترحًا (منها اثنان مطلوبان)» — عددُ التعديلات وما يُطلب منها، للجرس */
export function editsCountAr(count: number, required: number): string {
  const form = count === 1 ? 'one' : count === 2 ? 'two' : count <= 10 ? 'few' : 'many'
  const head = count === 1 ? 'تعديل مقترح' : count === 2 ? 'تعديلان مقترحان' : `${count} ${EDITS_AR[form]} ${EDITS_ADJ[form]}`
  const req = required <= 0 ? ''
    : required >= count ? (count === 1 ? ' (مطلوب)' : count === 2 ? ' (كلاهما مطلوب)' : ' (كلّها مطلوبة)')
    : required === 1 ? ' (منها واحد مطلوب)'
    : required === 2 ? ' (منها اثنان مطلوبان)'
    : ` (منها ${required} مطلوبة)`
  return head + req
}

/** جرسُ الردّ: ما ينتظره في «المراجعة» بعدده — سطرٌ واحد، ومهلتُه إن عادت تعدّ */
export function returnBellAr(i: { notes: number; edits: number; required: number; reports: number; resumedAr?: string }): string {
  const parts = [
    i.notes > 0 ? (i.notes === 1 ? 'ملاحظة واحدة' : i.notes === 2 ? 'ملاحظتان' : countAr(i.notes, NOTES_AR)) : null,
    i.edits > 0 ? editsCountAr(i.edits, i.required) : null,
    i.reports > 0 ? 'تقرير المراجعة' : null,
  ].filter((x): x is string => x !== null)
  const what = parts.length
    ? `تنتظرك في «المراجعة» ${parts.join(' و')} — قرّر فيها ثمّ أرسل مراجعتك.`
    : 'افتح «المراجعة» لترى ما طلب، ثمّ أرسلها من جديد.'
  return `${what}${i.resumedAr ?? ''}`
}

/** وذيلُ جرس الاعتماد والتأجيل — ما صحبه من تعديلاتٍ وتقرير، بجملةٍ قصيرةٍ لكلّ */
export function decisionBellTailAr(i: { edits?: { count: number; required: number } | null; reports: number }): string {
  return [
    i.edits && i.edits.count > 0 ? `وتنتظرك في «المراجعة» ${editsCountAr(i.edits.count, i.edits.required)}.` : null,
    i.reports > 0 ? 'وتقرير المراجعة في «المراجعة» للقراءة.' : null,
  ].filter(Boolean).join(' ')
}

/* ═══ بريدُ «اطلب تعديلات» — لطيفٌ عمليّ (١١ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة، لمّا رأى البريدَ الذي يصل المدرّب: «مخيفٌ وغيرُ مرتّب.. يجب أن يكون ملخّصا
   للتعديلات ومديحا له في البداية على إنجازه، وإبلاغَه بالخطوات وآليّةَ قبول التعديلات بسهولة.. كن
   لطيفا إيجابيّا وعمليّا». وكان: «راجعنا خطّةَ شعبتك ونحتاج تعديلا قبل اعتمادها»، ثمّ ملاحظاتُ
   الخطوات بنصوصها، ثمّ أسماءُ ملفّات التقرير كاملةً.

   فصار: شكرٌ أوّلا، ثمّ ما جهّزناه (عددُ التعديلات وخطواتُها، وأسماءُ الخطوات التي فيها ملاحظة،
   والتقرير)، ثمّ ثلاثُ خطواتٍ يفعلها — وأوّلُها «اقبلها كلَّها». ونصوصُ الملاحظات في رأس خطواتها
   عنده، والجرسُ يحملها كما كان. ولا جنسَ في الأفعال: المدرّبُ رجلٌ أو امرأة. */
export interface ReturnMailInput {
  cohortTitle: string
  /** كلمةُ الإدارة العامّة إن كتبتها هي — لا السطرُ الذي يُملأ به الردُّ تلقائيّا */
  generalNote: string | null
  /** أسماءُ الخطوات التي فيها ملاحظة */
  notedSteps: readonly string[]
  /** التعديلاتُ التي اعتُمدت له — كم، وكم منها مطلوب، وفي أيّ خطوة */
  edits: { count: number; required: number; bySteps: readonly { label: string; n: number }[] }
  /** كم ملفَّ تقريرٍ رُفع مع الخطّة */
  reports: number
  /** سطرُ المهلة إن عادت تعدّ (شعبةُ الإعداد) — أو فارغ */
  resumedAr?: string
}

export interface ReturnMail {
  subject: string
  heading: string
  preheader: string
  praise: string
  note: string | null
  summary: string[]
  steps: string[]
  cta: string
}

const EDITS_AR = { one: 'تعديل', two: 'تعديلان', few: 'تعديلات', many: 'تعديلا' }
const REPORT_FILES_AR = { one: 'ملفّ', two: 'ملفّان', few: 'ملفّات', many: 'ملفّا' }

export function returnMailAr(i: ReturnMailInput): ReturnMail {
  const { count, required, bySteps } = i.edits
  const summary: string[] = []
  if (count > 0) {
    const where = bySteps.filter((s) => s.n > 0).map((s) => `«${s.label}» (${s.n})`).join('، ')
    const ready = count === 1 ? 'جاهز' : count === 2 ? 'جاهزان' : count <= 10 ? 'جاهزة' : 'جاهزا'
    const req = required <= 0 ? (count === 1 ? ' — اختياريّ' : ' — كلّها اختياريّة')
      : required === count ? (count === 1 ? ' — مطلوب' : ' — كلّها مطلوبة')
      : ` — منها ${required === 1 ? 'واحد مطلوب' : required === 2 ? 'اثنان مطلوبان' : required <= 10 ? `${required} مطلوبة` : `${required} مطلوبا`}، والباقي اختياريّ`
    summary.push(`${countAr(count, EDITS_AR)} ${ready}${req}${where ? `. في: ${where}` : ''}.`)
  }
  if (i.notedSteps.length > 0) {
    summary.push(`ملاحظات على ${i.notedSteps.map((s) => `«${s}»`).join(' و')} — نقاط في «المراجعة» توافق عليها.`)
  }
  if (i.reports > 0) {
    const files = i.reports === 1 ? 'ملفّ واحد' : i.reports === 2 ? 'ملفّان' : countAr(i.reports, REPORT_FILES_AR)
    summary.push(`تقرير المراجعة (${files}) — في خطوة «المراجعة»، للقراءة إن شئت.`)
  }

  /* والتعديلاتُ في خطوتها السابعة «المراجعة» (١١ أكتوبر ٢٠٢٦): بنودٌ مرقّمة، ومنها يُرسَل —
     فالخطواتُ تدلّ عليها بالاسم الذي يراه في شريط الخطوات */
  /* والملاحظاتُ بنودٌ في «المراجعة» قبل التعديلات (١١ أكتوبر ٢٠٢٦، `note`) — فالخطواتُ بترتيبها هناك */
  const noted = i.notedSteps.length > 0 || Boolean(i.generalNote?.trim())
  const inReview = count > 0 || noted
  const steps = [inReview || i.reports > 0 ? 'افتح صفحة شعبتك من الزرّ أدناه — تفتح على «المراجعة».' : 'افتح صفحة شعبتك من الزرّ أدناه.']
  if (noted) steps.push('في أوّلها ملاحظاتنا نقاطا: وافق عليها أو قل لماذا لا — وما تطلبه تعدّله في خطوته.')
  if (count > 0) {
    steps.push(required > 0
      ? 'اضغط «اقبلها كلّها» — أو قرّر في كلّ بند وحده: نقترح هذا بدل هذا، اقبله أو ارفضه. والمطلوب منها شرط الاعتماد: إن لم تقبله فعدّل موضعه بطريقتك.'
      : 'اضغط «اقبلها كلّها» — أو قرّر في كلّ بند وحده: نقترح هذا بدل هذا، اقبل ما يناسبك.')
  }
  steps.push(inReview
    ? 'ثمّ أرسل مراجعتك من «المراجعة» نفسها — ونراجعها حين تصلنا.'
    : 'أرسل الخطّة من خطوة «الاعتماد» — ونراجعها حين تصلنا.')

  const ready = count > 0 ? 'وجهّزنا لك تعديلات تقبلها بنقرة' : 'وكتبنا لك ملاحظات في خطواتها'
  return {
    subject: `شكرا على خطّتك — «${i.cohortTitle}»`,
    heading: 'شكرا على خطّتك — وهذه خطوتها التالية',
    preheader: `${ready}، ثمّ ترسلها من جديد.`,
    praise: `وصلتنا خطّتك لـ«${i.cohortTitle}» كاملة — شكرا على جهدك فيها. راجعناها، ${ready} لتصير جاهزة للاعتماد.${i.resumedAr ?? ''}`,
    note: i.generalNote?.trim() ? i.generalNote.trim() : null,
    summary,
    steps,
    cta: count > 0 ? 'افتح صفحة شعبتك وراجع التعديلات' : 'افتح صفحة شعبتك',
  }
}

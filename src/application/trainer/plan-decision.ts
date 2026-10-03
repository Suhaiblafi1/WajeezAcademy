/* ═══ ما يقوله قرارُ خطّة الشعبة لمن نقره — بما ردّه الخادم لا بما يُظنّ ═══

   كانت هذه في بطاقة الشعبة (`src/pages/admin/CohortOps.tsx`) وحدَها. ثمّ صار
   القرارُ يُتّخذ من موضعين — البطاقةِ، و«خططٌ تنتظر اعتمادك» التي تجمع خططَ
   المدرّبين كلِّهم (٣ أكتوبر ٢٠٢٦) — فخرجت إلى هنا لتُقال فيهما بنصٍّ واحد،
   وتُختبَر بمدخلاتها لا بقراءة شيفرتها. */

import { countAr } from '../text/count-ar'

/** ما يعود من اعتماد الخطّة — ولقاءاتُها التي اعتُمدت معها أو تعذّرت */
export interface PlanDecision {
  status: string
  meetings?: { approved: number; failed: { id: string; title: string; reason: string }[] }
  /* ومهامُّها المنتظِرةُ التي اعتُمدت معها — وما بقي منها بسببه (٣ج-٣) */
  tasks?: { applied: number; failed: { id: string; title: string; reason: string }[] }
  /* وشعبةُ الإعداد: ما وقع لمدرّبها بالاعتماد (`trainer-prep.service.ts` ← `afterDecision`).
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
    return 'وبها اكتملت دوراتُه كلُّها: فُعِّل مدرّبا نشطا ووصله بريدُ اعتماده — وحالُ عقده في «العقود»'
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
   والجملةُ بما يحكم به الخادم في `TrainerPrepService.afterDecision` حرفا:
   التأهيلُ إن كان معلّقا، والتفعيلُ حين لا يبقى ما ينتظر، والخَتمُ للعرض
   المشروط وحدَه — وفي الردّ تُستأنف المهلةُ إن كانت موقوفةً لمراجعتنا. */
export function prepNoteAr(p: PrepFlags): string {
  const approve = p.qualifies
    ? '«اعتمدها» تؤهّل مدرّبَها لدورتها'
    : 'دورتُها معتمَدةٌ لمدرّبها أصلا، و«اعتمدها» تعتمد خطّتَها'
  const last = p.onboarding
    ? '، وإن لم يبقَ من دوراته ما ينتظر فُعِّل — ويُختَم عقدُه المشروطُ إن كان ينتظر ختمَنا'
    : ''
  const back = p.onboarding ? '، ويُستأنف عدُّ مهلته إن كانت موقوفةً لمراجعتنا' : ''
  return `شعبةُ إعداد: ${approve}${last}. و«اطلب تعديلات» تعيدها إليه بملاحظاتك في رأس كلّ خطوة${back}.`
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

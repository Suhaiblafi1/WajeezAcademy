/* ═══ متى يحقُّ للمدرّب أن يُرسل شعبتَه للاعتماد ═══

   قاعدةٌ واحدةٌ في موضعٍ واحد، يقرؤها الخادمُ (`cohort-plan.service.ts`)
   وشاشةُ المدرّب (`CohortWorkspace.tsx`) معا. وكانت في الشاشة وحدَها سطرا
   عابرا (`remaining > 0`)، والخادمُ يقبل ما تطفئه — فزرٌّ مطفأٌ لا يمنع
   طلبا يُرسَل بيدٍ أخرى، وقاعدتان تقولان الشيءَ نفسَه تفترقان.

   ── ولمَ يُستثنى «الاعتماد» من شروط الاعتماد ──

   صفُّ `approval` في القائمة إلزاميٌّ، و`done` فيه معناه «اعتُمدت الخطّةُ
   فعلا» لا «أتمّ المدرّبُ عملَه». فلو حُسب في الحاجز لحجب نفسَه: لا يتمّ
   حتّى يُرسَل، ولا يُرسَل حتّى يتمّ. وهو ما وقع فعلا — فكان الزرُّ مطفأً
   لكلّ مدرّبٍ في كلّ شعبة، ورسالةُ «بقي ١ من المراحل» تشير إلى الاعتماد
   نفسِه والحلقاتُ قبله خضراءُ كلُّها.

   والصفُّ لا يُحذف ولا يصير اختياريّا: هو مرحلةٌ تُرى على الخطّ وتستقرّ
   «تمّ» حين يصل القرار. المستثنى موضعٌ واحد — الحاجزُ قبل الإرسال. */

import { postponedLineAr } from './plan-postpone'

/** ما يكفي من صفّ القائمة ليُحكَم عليه — لا شكلَ الخادم كلَّه */
export interface GateItem {
  key: string
  done: boolean
  optional?: boolean
}

/** مفتاحُ المرحلة التي لا تكون شرطا لنفسها */
export const APPROVAL_KEY = 'approval'

/** ما بقي على المدرّب قبل أن يُرسل — إلزاميٌّ لم يتمّ، والاعتمادُ ليس منه */
export function blockingBeforeSubmit<T extends GateItem>(checklist: readonly T[]): T[] {
  return checklist.filter((c) => !c.optional && !c.done && c.key !== APPROVAL_KEY)
}

/** أتمّ كلَّ ما يسبق الاعتماد؟ */
export function readyToSubmit(checklist: readonly GateItem[]): boolean {
  return blockingBeforeSubmit(checklist).length === 0
}

/* ═══ وصفوفٌ في القائمة ليست من عمله ═══

   صفُّ `approval` بيدِ المديرِ الأكاديميّ: **يحجب** الإرسالَ في مكانه من
   الخطّ، ولا يُعدُّ على المدرّب.

   وكان معه صفُّ `term` — الإدارةُ تسمّي الفصلَ عند الإسناد (١٧ سبتمبر ٢٠٢٦)
   ومنه حدودُ الشعبة. ثمّ صارت المدّةُ للمدرّب يحدّدها في الخطوة الأولى
   (٢٧ سبتمبر ٢٠٢٦)، والفصلُ يُشتقّ من تاريخ بدئها عند الاعتماد — فسقط الصفُّ
   من القائمة، وصار ما كان يحجبه **عملَه هو** يُعدُّ عليه في صفّ `identity`.

   والفرقُ ليس تجميلا: خطُّ التقدّم والبطاقةُ يقولان «أنجزتَ كذا من كذا»،
   فصفٌّ لا بابَ له في يده يُبقي خطَّه دون التمام أبدا مهما أتمّ — وهو
   عينُ ما مُنع في الاعتماد فبقي «٥ من ٦» لكلّ شعبةٍ تامّة. فما ليس بيده
   يُرى في مكانه (لافتةُ «لم تُفتَح هذه الشعبةُ بعد» في الخطوة الأولى)
   ولا يُحسَب في عدَدِه، ولا يُساق إليه زرُّ «افتح أوّلَها». */
export const ADMIN_OWNED_KEYS: readonly string[] = [APPROVAL_KEY]

/** ما يملك المدرّبُ إنجازَه وحدَه — به يُقاس تقدّمُه لا بغيره */
export function trainerOwned<T extends GateItem>(checklist: readonly T[]): T[] {
  return checklist.filter((c) => !ADMIN_OWNED_KEYS.includes(c.key))
}

/* ═══ «التالي» في بطاقة «شعبي» — يتبع حالَ الخطّة (٣ أكتوبر ٢٠٢٦) ═══

   سار صاحبُ المنصّة في المسار كلِّه فوجد البطاقةَ تقول الشيءَ نفسَه في ثلاث
   لحظاتٍ لا يصدق في واحدةٍ منها: بعد الإرسال «أكّد أنّك توافق… وأرسلها»
   وقد أُرسلت، وبعد الردّ الجملةَ نفسَها وعليها ملاحظةٌ تنتظره، وبعد الاعتماد
   «التجهيزُ مكتمل — الشعبة في التشغيل» ولا يدخلها أحد. فكانت تقرأ قائمةَ
   التجهيز وحدَها — والقائمةُ لا تعرف أنّ الخطّةَ عند الإدارة، ولا أنّ الشعبةَ
   مغلقةٌ للتسجيل.

   فالحكمُ بحال الخطّة أوّلا، ثمّ بالقائمة لما لا يزال في يده. و`waiting`
   انتظارٌ لا فعل: لا يُقدَّم بـ«التالي:» — فلا يُقال للمدرّب «افعل» ما ليس
   بيده. وما يُرجَع `null` له هو شعبةٌ مفتوحةٌ تمّ تجهيزُها. */
export interface BoardNext {
  key: string
  labelAr: string
  /** ما ينتظره لا ما يفعله */
  waiting?: boolean
}

/* ═══ يومُ البدء على بطاقة «شعبي» — والمقترَحُ قبل الاعتماد (٤ أكتوبر ٢٠٢٦، ⑩) ═══

   شعبةُ الإعداد بلا بدءٍ حتّى تُعتمَد خطّتُها، فكانت بطاقتُها تقول «تبدأ —»
   وفي خطّته يومٌ مكتوب. فالمعتمَدُ من الشعبة إن كان، وإلّا يومُ خطّته موسوما
   «مقترحا» — والخادمُ لا يعيد المقترَحَ بعد الاعتماد (`summaries`). */
export function boardStart(c: { startsAt: string | Date | null; proposedStartsOn?: string | null }): {
  at: string | Date | null; proposed: boolean
} {
  if (c.startsAt) return { at: c.startsAt, proposed: false }
  if (c.proposedStartsOn) return { at: c.proposedStartsOn, proposed: true }
  return { at: null, proposed: false }
}

export function boardNextStep<T extends GateItem & { labelAr: string }>(input: {
  planStatus: string
  /** علمُ الشعبة — لا تقبل أحدا وهو منزول (`cohortAcceptsRegistration`) */
  registrationOpen: boolean
  checklist: readonly T[]
  /** أوّلُ يومٍ في الموسم الذي أُجّلت إليه — للمردودة بالتأجيل وحدَها (٨ أكتوبر ٢٠٢٦) */
  postponedTo?: string | null
}): BoardNext | null {
  const { planStatus, registrationOpen, checklist } = input
  if (planStatus === 'submitted') {
    return { key: 'awaiting_decision', labelAr: 'أُرسلت — بانتظار قرار الإدارة، ويصلك هنا وبالبريد', waiting: true }
  }
  /* والمؤجّلةُ ليست ردّا بتعديلاتٍ لهذا الفصل — تُسمّى بموسمها (`plan-postpone.ts`) */
  if (planStatus === 'changes_requested' && input.postponedTo) {
    return { key: 'postponed', labelAr: `${postponedLineAr(input.postponedTo)} — لم تُقبل لهذا الفصل. عدّلها متى شئت، وأرسلها بمواعيدَ من موسمها` }
  }
  if (planStatus === 'changes_requested') {
    return { key: 'address_notes', labelAr: 'اقرأ ملاحظةَ الإدارة في رأس كلّ خطوة، وعدّل، ثمّ أعِد الإرسال' }
  }
  if (planStatus === 'approved' || planStatus === 'published') {
    return registrationOpen
      ? null
      : { key: 'awaiting_open', labelAr: 'اعتُمدت — وتفتحها الأكاديميةُ للتسجيل، فتراها هنا مفتوحة', waiting: true }
  }
  const next = blockingBeforeSubmit(checklist)[0] ?? checklist.find((i) => !i.done) ?? null
  return next ? { key: next.key, labelAr: next.labelAr } : null
}

/* ═══ «أرسِلها» — ما يقفها قبل أن تُرسَل، بترتيبه (٣ أكتوبر ٢٠٢٦) ═══

   الإرسالُ يرسل **المحفوظ**. فمن في يده تعديلٌ لم يُحفظ (أو حفظٌ ردّه الخادم)
   وأرسل، ذهب ما قبل تعديله وطُرح تعديلُه صامتا — رآه صاحبُ المنصّة في المسار
   فردّ الخطّةَ ثانيةً بملاحظته نفسِها. واختار («4a») أن يُسأل بخياراتٍ يُقال
   أثرُ كلٍّ منها (`CohortWorkspace.tsx`).

   والترتيبُ: الموافقةُ أوّلا (المربّعُ في الخطوة نفسِها)، ثمّ التعديلُ الذي لم
   يُحفظ — قبل النواقص، فالنواقصُ تُحسب من المحفوظ، وقد يكون تعديلُه هو ما
   يوفيها. ثمّ النواقص. و`null`: يُرسَل. */
export type SendBlock = 'confirm' | 'unsaved' | 'blocking' | null

export function sendBlock(input: { confirmed: boolean; unsaved: boolean; blocking: number }): SendBlock {
  if (!input.confirmed) return 'confirm'
  if (input.unsaved) return 'unsaved'
  if (input.blocking > 0) return 'blocking'
  return null
}

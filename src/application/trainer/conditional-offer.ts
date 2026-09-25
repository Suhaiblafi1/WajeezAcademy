/* ═══ العرضُ المشروط — مهلتُه، وحسابُها في موضعٍ واحد ═══

   ─────────── العطبُ الذي وُلد منه هذا الملفّ ───────────

   كان الاعتمادُ يصيّر المتقدّمَ «نشطا» في اللحظة نفسِها، ثمّ تُرى موادُّه.
   فإن كانت دون المستوى فلا مخرجَ إلّا فسخُ عقدٍ نافذ. وقرارُ صاحب المنصّة
   (٢٣ سبتمبر ٢٠٢٦) أن يكون القبولُ **مشروطا من أصله**: يوقّع عرضا مشروطا،
   فيرفع موادَّه في مهلةٍ معلومة، فإذا قُبلت صار عقدُه نهائيّا. وبهذا يصير
   «لم نقبل موادَّك» شرطا لم يتحقّق لا عقدا يُفسَخ.

   ─────────── ولمَ تبدأ المهلةُ من الجلسة لا من التوقيع ───────────

   بيانُ صاحب المنصّة: «السبعةُ أيّامٍ تبدأ من الجلسة» — جلسةُ تهيئةٍ جماعيّةٌ
   أسبوعيّةٌ يُعلَّم فيها استخدامُ المنصّة وإضافةُ الموادّ.

   وتبدأ من **تاريخِها المعلَنِ له** لا من حضورِه إيّاها. والفرقُ ليس تفصيلا:
   لو تعلّقت بالحضور لَاحتاجت نقرةَ إنسانٍ يسجّله، ومن نُسي بقي في الطور أبدا
   بلا مهلةٍ ولا تذكير. وبالتاريخ المعلَن يسير العاملُ وحدَه، ومن فاتته
   الجلسةُ فله التمديدُ أو التأجيلُ إلى الموسم القادم.

   ─────────── ولمَ دالّاتٌ خالصةٌ في `src/application` ───────────

   تُقرأ في أربعة مواضع: الخادمُ يكتب بها، وطابورُ الإدارة يعرض ما بقي،
   وبوّابةُ المدرّب تعرض شريطَها، والعاملُ يذكّر ويوسم بها. وأربعُ نسخٍ لحسابٍ
   واحدٍ تفترق يوما — فيُذكَّر من ذُكِّر، أو يُوسَم متأخّرا من في مهلته. وهذا
   عرفُ `readiness.ts` و`approval.ts` في هذا المجلّد نفسِه.

   ولا يقرأ هذا الملفُّ قاعدةً ولا يستدعي شيئا: يأخذ ما قُرئ ويحكم. */

/** المهلةُ سبعةُ أيّامٍ من تاريخ جلسة التهيئة — بيانُ صاحب المنصّة */
export const MATERIALS_WINDOW_DAYS = 7

/** تمديدٌ يُمنح مرّةً واحدةً بطلبه — والثانيةُ تُردّ */
export const EXTENSION_DAYS = 2

/** قبل يومَين يذكّر العاملُ مرّةً واحدة */
export const REMINDER_LEAD_DAYS = 2

const DAY_MS = 86_400_000

export type DateLike = Date | string | null | undefined

const asDate = (v: DateLike): Date | null => {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/* ═══ تاريخُ الانتهاء يُحسب مرّةً ويُخزَّن ═══

   ولمَ يُخزَّن ولا يُحسب عند القراءة: لو حُسب لَتبدّلت مهلةُ عرضٍ **وُقّع**
   بتبدّلِ ثابتٍ في الشيفرة — فمن وقّع على سبعةٍ وجد نفسَه على خمسٍ بنشرةٍ لا
   يعلم بها. والمخزونُ يقول ما وُقّع عليه، والثابتُ يقول ما يُرسَل اليوم. */
export function deadlineFrom(
  orientationAt: DateLike,
  windowDays: number = MATERIALS_WINDOW_DAYS,
): Date | null {
  const at = asDate(orientationAt)
  return at ? new Date(at.getTime() + windowDays * DAY_MS) : null
}

/** ما يكفي من صفّ العقد ليُحكَم على شرطه — لا شكلَ الصفِّ كلَّه */
export interface ConditionFacts {
  /** تاريخُ جلسة التهيئة المعلَنُ له — وبلا هذا لا مهلةَ أصلا */
  orientationAt?: DateLike
  conditionDeadlineAt?: DateLike
  /** يُكتب حين يُعلن الاكتمال؛ ويُمحى عند الردّ بملاحظات */
  conditionPausedAt?: DateLike
  conditionExtendedAt?: DateLike
  conditionRemindedAt?: DateLike
  /** اعتُمدت موادُّه — انتهت المهلة */
  conditionMetAt?: DateLike
  /** يُمرَّر في الاختبار كي لا تتعلّق النتيجةُ بساعة الجهاز */
  now?: Date
}

/* ═══ أطوارُ الشرط الخمسة ═══

   · `none`      — لا مهلةَ له: عرضٌ بلا تاريخِ جلسة، أو مدرّبٌ نُقل بيدٍ إلى
                   التهيئة بلا عرضٍ وقّعه. ولا ساعةٌ صامتةٌ تبدأ على أحد.
   · `running`   — المهلةُ تسير، وأمامه أيّامٌ تُعَدّ.
   · `under_review` — أعلن الاكتمالَ فتجمّدت: فوقتُ مراجعتنا لا يُحسب عليه.
   · `met`       — اعتُمدت موادُّه.
   · `lapsed`    — انقضت ولم يُعلن. وهو **وسمٌ محسوبٌ لا حالةٌ جديدة**: لم
                   ينتقل مكانا، بل تأخّر في مكانه. */
export type ConditionPhase = 'none' | 'running' | 'under_review' | 'met' | 'lapsed'

export function conditionPhase(f: ConditionFacts): ConditionPhase {
  if (asDate(f.conditionMetAt)) return 'met'
  const due = asDate(f.conditionDeadlineAt)
  if (!due) return 'none'
  if (asDate(f.conditionPausedAt)) return 'under_review'
  const now = f.now ?? new Date()
  return now.getTime() > due.getTime() ? 'lapsed' : 'running'
}

/** ما بقي من الأيّام — و`null` لمن لا مهلةَ له أو انتهت */
export function daysLeft(f: ConditionFacts): number | null {
  if (conditionPhase(f) !== 'running') return null
  const due = asDate(f.conditionDeadlineAt)!
  const now = f.now ?? new Date()
  return Math.max(0, Math.ceil((due.getTime() - now.getTime()) / DAY_MS))
}

export function isLapsed(f: ConditionFacts): boolean {
  return conditionPhase(f) === 'lapsed'
}

/* ═══ أيُعرَض شريطُ الشرط أصلا ═══

   والجوابُ هنا هو بعينه شرطُ `openConditionContract` في الخادم: مهلةٌ
   مكتوبةٌ لم يُعتمَد ما بعدها. ولو افترقا لَظهر للمدرّب زرٌّ
   يردُّه الخادمُ بـ«لا مهلةَ قائمةً على حسابك»، أو اختفى زرٌّ يقبله.

   والأهمُّ ما يمنعه: `conditionPhase` يردّ `none` لمن لا مهلةَ له — ومدرّبٌ
   نشطٌ منذ سنةٍ عقدُه الأخيرُ بلا أعمدةِ شرطٍ أصلا طورُه `none`. فلو عُلّق
   الشريطُ على الطورِ وحدَه لَقرأ مدرّبو المنصّة كلُّهم «عرضٌ مشروط — ويصلك
   موعدُ جلسة التهيئة». */
export function hasOpenCondition(f: ConditionFacts): boolean {
  const phase = conditionPhase(f)
  return phase === 'running' || phase === 'under_review' || phase === 'lapsed'
}

/* زرُّ «أعلنتُ اكتمالها» — والمنقضيةُ منها بقصد

   فالخادمُ يقبلها متأخّرةً بنصّه: «من تأخّر يوما ثمّ أتمّ موادَّه أولى
   به أن تُقرأ من أن يُردّ بابُه». والمجمّدةُ وحدَها تُرَدّ (`already_declared`) —
   فزرٌّ يُعرَض لمن أعلن أصلا يعدُ بفعلٍ لا يقع. */
export function canDeclareMaterials(f: ConditionFacts): boolean {
  const phase = conditionPhase(f)
  return phase === 'running' || phase === 'lapsed'
}

/* ═══ التذكيرُ مرّةً واحدة، ولا تذكيرَ بلا مهلة ═══

   والشرطُ الأخيرُ هو ضمانُ الترحيل نفسُه: من في التهيئة اليومَ بلا عرضٍ
   موقَّعٍ مهلتُه `NULL`، فلا يطرق العاملُ بابَه برسالةٍ عن مهلةٍ لم يقبلها. */
export function dueReminder(f: ConditionFacts): boolean {
  if (conditionPhase(f) !== 'running') return false
  if (asDate(f.conditionRemindedAt)) return false
  const left = daysLeft(f)
  return left != null && left <= REMINDER_LEAD_DAYS
}

/* ═══ التجميدُ يزيد المهلةَ بمقدار مدّته بالضبط ═══

   فلو أعلن الاكتمالَ في اليوم السادس وأخذت المراجعةُ يومين لخرج من المهلة بلا
   ذنبٍ منه — وهي الشكوى الوحيدةُ التي تصمد في وجه عقدٍ كُتب للحماية. ولا
   يستطيع المدرّبُ إمساكَ التجميد: هو ينتهي في اللحظة التي تُعاد إليه الكرةُ
   فيها. */
export function deadlineAfterPause(f: ConditionFacts, resumedAt: Date): Date | null {
  const due = asDate(f.conditionDeadlineAt)
  const paused = asDate(f.conditionPausedAt)
  if (!due) return null
  if (!paused) return due
  const frozen = Math.max(0, resumedAt.getTime() - paused.getTime())
  return new Date(due.getTime() + frozen)
}

/* ═══ التمديدُ مرّةً واحدة ═══

   والثانيةُ تُردّ بنصٍّ يُقرأ، لا بصمتٍ ولا بزرٍّ مطفإ: من طلب مرّتين يحتاج
   أن يعرف أنّ الأولى مُنحت وأنّ بابَه الآن التأجيلُ إلى الموسم القادم. */
export function extendProblemAr(f: ConditionFacts): string | null {
  if (asDate(f.conditionExtendedAt)) {
    return `مُنح التمديدَ مرّةً (${EXTENSION_DAYS} يومين) ولا يُمنح ثانية — وبابُه الآن التأجيلُ إلى الموسم القادم.`
  }
  if (!asDate(f.conditionDeadlineAt)) {
    return 'لا مهلةَ لهذا العرض — اكتب تاريخَ جلسة التهيئة أوّلا، فمنه تُحسب.'
  }
  if (asDate(f.conditionMetAt)) return 'اعتُمدت موادُّه — لا مهلةَ تُمدَّد.'
  return null
}

export function extendedDeadline(f: ConditionFacts): Date | null {
  const due = asDate(f.conditionDeadlineAt)
  return due ? new Date(due.getTime() + EXTENSION_DAYS * DAY_MS) : null
}

/* ═══ زرُّ التمديد — أضيقُ من قبول الخادم بقصد ═══

   `extendProblemAr` يأذن للمنقضية: لا تمديدَ سابقا، ومهلةٌ مكتوبةٌ، ولم
   تُعتمَد. لكنّ `extendedDeadline` يزيد يومَين على **تاريخِها هي** لا على
   اليوم — فمن انقضت مهلتُه قبل ثلاثةِ أيّامٍ يخرج من الزرّ إلى مهلةٍ
   انقضت قبل يوم. زرٌّ يعمل ولا ينفع.

   ولا يُحرَم صاحبُها طريقا: بابُه «أعلنتُ اكتمالها» والخادمُ يقبلها
   متأخّرةً بنصّه. والمجمّدةُ مثلُها: مهلةٌ واقفةٌ لا تُمدّد. */
export function canAskExtension(f: ConditionFacts): boolean {
  return conditionPhase(f) === 'running' && extendProblemAr(f) === null
}

/* ═══ ما يُقرأ في الشاشات — موضعٌ واحدٌ لا ثلاثة ═══

   والوسمُ «عرضٌ مشروط — قيد التجهيز» هو المقترَحُ المُقَرُّ: أدقُّ من «نشطٌ
   بشرط» لأنّ الظهورَ العامَّ يحكمه `publishApprovedAt` مستقلّا، فما يميّز
   الطورَ حقّا أنّه **لا تدريبَ فيه ولا أتعاب**. */
export const CONDITION_PHASE_LABELS_AR: Record<ConditionPhase, string> = {
  none: 'عرضٌ مشروط — بلا مهلة',
  running: 'عرضٌ مشروط — قيد التجهيز',
  under_review: 'موادُّه قيد التقييم',
  met: 'اكتمل الشرط',
  lapsed: 'لم يستوفِ الشروط بعد',
}

/** سطرُ الشريط في بوّابة المدرّب وفي صفّ الطابور */
export function conditionLineAr(f: ConditionFacts): string {
  const phase = conditionPhase(f)
  if (phase === 'running') {
    const left = daysLeft(f)!
    const days = left === 1 ? 'يومٌ واحد' : left === 2 ? 'يومان' : `${left} أيّام`
    return `عرضٌ مشروط — أمامك ${days} لرفع موادّك`
  }
  if (phase === 'under_review') return 'موادُّك قيد التقييم — والمهلةُ مجمَّدةٌ حتّى يصلك جوابُنا'
  if (phase === 'lapsed') return 'انقضت مهلتُك ولم تكتمل موادُّك — أجِّلْ إلى الموسم القادم، أو اطلب حذفَ حسابك'
  if (phase === 'met') return 'اعتُمدت موادُّك — واكتمل الشرط'
  return 'عرضٌ مشروط — ويصلك موعدُ جلسة التهيئة ومنها تبدأ مهلتُك'
}

/* ═══ متى يُشترَط العقدُ أصلا — قرارُ ٢٥ سبتمبر ٢٠٢٦ ═══

   ── ما كان، ولمَ سقط ──

   كان المقياسُ `app.status !== 'active'`: يُشترَط عقدُ من لم يُفعَّل حسابُه
   بعد. وهو يسأل سؤالا (**أنشطٌ حسابُه؟**) غيرَ الذي يُراد (**أاعتُمدت
   موادُّه؟**)، ويصدق أن يفترقا.

   ويفترقان في مسارٍ واقع: من قبل الدعوةَ وأنشأ حسابَه **قبل** أن يُركَّب
   عقدُه صار `active`. فيخرج عقدُه **بلا شرطٍ ولا خَتم** — لا بندَ 2-6 في
   متنه، ولا طورَ ثانٍ يُعتمَد فيه بعد رفع موادّه. ويفوته الطورُ كلُّه بلا
   أن يُنبَّه أحد. وهو ما وقع فعلا في عقدٍ رآه صاحبُ المنصّة.

   ── والمقياسُ الصحيح ──

   الشرطُ إنّما وُضع لاعتماد الموادّ، فيُسأل عنه: **أسبق لهذا المدرّب عقدٌ
   تحقّق شرطُه؟** فمن اعتُمدت موادُّه مرّةً لا يُعاد اشتراطُه، ومن لم
   تُعتمَد يُشترَط عقدُه مهما كان حالُ حسابه.

   و`conditionMetAt` هو الأثرُ الذي يكتبه الاعتمادُ نفسُه ساعةَ الخَتم
   («خَتمٌ باعتماد الموادّ وتفعيل الحساب — تحقّق شرطُ البند 2-10»)، فلا
   علامةَ أصدقُ منه: من كتبها هو من اعتمد.

   ولا عقودَ أصلا — مرشّحٌ جديد — فيُشترَط: فالعدمُ ليس اعتمادا. */

/* ═══ وختمان لا واحد ═══

   `conditionMetAt` يكتبه اعتمادُ الموادّ في المسار المشروط. لكنّ الخَتمَ
   المفرد (`countersignContract`) يكتب `countersignedAt` **ولا يكتبه** —
   وبه خُتمت عقودٌ قبل أن يوجد المسارُ المشروط أصلا.

   فلو اقتُصر على الأوّل لَأُعيد اشتراطُ كلّ مدرّبٍ خُتم عقدُه بالباب
   القديم — وهم من يعملون اليوم. وكلاهما ختمُ الأكاديميّة: أنّا نظرنا
   فقبلنا. */
export interface PriorContractSeal {
  /** يُكتب باعتماد الموادّ — المسارُ المشروط */
  conditionMetAt?: Date | string | null
  /** يُكتب بخَتم الأكاديميّة — وبه خُتمت عقودُ الباب القديم */
  countersignedAt?: Date | string | null
}

/** أسبق لهذا المدرّب عقدٌ ختمناه؟ */
export function materialsEverApproved(prior: readonly PriorContractSeal[]): boolean {
  return prior.some((c) => c.conditionMetAt != null || c.countersignedAt != null)
}

/** أيُشترَط عقدُه الجديدُ باعتماد الموادّ؟ */
export function offerGatesActivation(prior: readonly PriorContractSeal[]): boolean {
  return !materialsEverApproved(prior)
}

/* ═══ جاهزيّةُ المدرّب للاعتماد النهائيّ — ثلاثُ خطواتٍ تُقرأ لا تُخمَّن ═══

   ─────────── العطبُ الذي وُلد منه هذا الملفّ ───────────

   كان الاعتمادُ نقرةً واحدةً من أيّ حالةٍ بلا فحصٍ واحد. فيصير المتقدّمُ
   «مدرّبا نشطا» وليس له أجرٌ متّفقٌ عليه، ولا دورةٌ مؤهَّلٌ لها، ولا عقدٌ
   وقّعه. ثمّ يُكتشف النقصُ بعد شهر: «مستحقّاتي» صفرٌ لأنّ `computeCohort`
   ترمي `no_rule`، أو تُسنَد إليه شعبةٌ فلا يُوجد ما يُثبت التزامَه بها.

   قرارُ صاحب المنصّة (٢٠ سبتمبر ٢٠٢٦): «أريد مرحلةً صغيرةً قبل أن أقبله —
   قبولٌ داخليٌّ يعطيني أن أُسنِد دوراتِه وأضبط أتعابَه وأرسل عقدَه. وحين
   يوقّع يصلني خبرُه، فأقبله قبولا كاملا». فالاعتمادُ صار قرارَين بينهما
   عمل، **والعملُ يُفحَص لا يُتذكَّر**.

   ─────────── ولمَ دالّةٌ خالصةٌ في `src/application` ───────────

   تُقرأ في موضعَين: الخادمُ يمنع بها (`decide`)، والشاشةُ تعرض بها ما ينقص
   قبل أن يُضغط زرٌّ يُردّ. ونسختان لشيءٍ واحدٍ تفترقان يوما — فيَظهر زرٌّ
   أخضرُ يرفضه الخادم، أو يُخفى زرٌّ يقبله. وهذا العرفُ نفسُه الذي بُني عليه
   `approval.ts` و`purgeable.ts` في هذا المجلّد.

   ─────────── وما لا يفعله هذا الملفّ ───────────

   لا يقرأ قاعدةً ولا يستدعي شيئا: يأخذ ما قُرئ ويحكم. فيُختبَر بلا قاعدةِ
   بيانات، ويُنادى من الشاشة على ما جاءها في الاستجابة نفسِها. */

/** خطواتُ التجهيز الثلاث — بترتيب عملها لا بترتيب أهمّيّتها */
export const READINESS_STEPS = ['compensation', 'qualifications', 'contract'] as const
export type ReadinessStepKey = (typeof READINESS_STEPS)[number]

/** عنوانُ الخطوة كما يُقرأ في الشاشة وفي رسالة المنع — موضعٌ واحدٌ لا اثنان */
export const READINESS_LABELS_AR: Record<ReadinessStepKey, string> = {
  compensation: 'الاتفاق الماليّ',
  qualifications: 'المؤهّلات والدورات',
  contract: 'العقد الموقَّع',
}

/* ═══ ما تُعدّ به الخطوةُ الأولى تامّة ═══

   قاعدةٌ **عامّةُ النطاق** (لا دورةَ لها ولا شعبة) سارية اليوم. ولمَ العامّةُ
   دون غيرها: `activeRule` تبحث عن قاعدة الشعبة، ثمّ قاعدة الدورة، ثمّ تسقط
   إلى العامّة — فمن له قاعدةُ دورةٍ واحدةٍ فحسب يُحسب أجرُه فيها ويُرمى
   `no_rule` في كلّ ما عداها. والعامّةُ هي بعينها ما يمنع ذلك الخطأ، فهي
   المفحوصة. */
export interface CompensationRuleFact {
  /** per_seat | fixed_per_cohort | revenue_share */
  type: string
  /** الرقمُ نفسُه — وصفرٌ أو سالبٌ ليس اتّفاقا */
  rate: number
  /** نطاقُ الدورة إن كان — والعامّةُ ما لا نطاقَ لها */
  courseId?: string | null
  cohortId?: string | null
  effectiveFrom: Date | string
  effectiveTo?: Date | string | null
}

export interface ContractFact {
  /** draft | sent | declined | revoked | signed | countersigned | expired | terminated */
  status: string
}

export interface ReadinessInput {
  compensationRules: CompensationRuleFact[]
  /** عددُ الدورات التي حالُ تأهيله لها `qualified` */
  qualifiedCourses: number
  /** اقتراحاتُ دوراتٍ من عنده لم تُصنَّف بعد — تُقال ملحوظةً ولا تحبس */
  openProposals: number
  contracts: ContractFact[]
  /** يُمرَّر في الاختبار كي لا تتعلّق النتيجةُ بساعة الجهاز */
  now?: Date
}

export interface ReadinessStep {
  key: ReadinessStepKey
  labelAr: string
  done: boolean
  /** ما ينقص بنصّه — يُعرض تحت الخطوة، ويُقال في رسالة المنع حرفا بحرف */
  blockerAr: string | null
  /* ═══ وما يستحقّ النظرَ ولا يحبس ═══

     أُضيف بعد أن كاد يقع خطأ: جُعلت الاقتراحاتُ غيرُ المصنَّفة **مانعةً**
     للاعتماد. وثلاثةُ أشياءَ تنقض ذلك:

     · المنعُ من صنعنا: `seedProposalsFromApplication` تبذرها عند القبول
       الداخليّ نفسِه — فالنظامُ يصنع مانعَه بيده لحظةَ فتح التجهيز.
     · وتصنيفُ اقتراحٍ قد يعني **إنشاءَ دورةٍ في الكتالوج** بمهاراتها
       وساعاتها ووحداتها — عملُ أيّام. وحبسُ حساب المدرّب عليه غيرُ متناسب،
       والمسارُ نفسُه مقصودٌ بطيئا في تصميمه.
     · وهي ليست ثابتا أصلا: المدرّبُ يضيف اقتراحا من بوّابته في اليوم التالي
       لاعتماده (ح-٢). فشرطٌ ينقضه النظامُ غدا ليس شرطا، بل مظهرُ صرامة.

     فصارت **ملحوظةً تُرى ولا تحبس**: الخطوةُ خضراءُ بدورةٍ مؤهَّلٍ لها،
     ويُقال تحتها كم اقتراحا ينتظر التصنيف. وهذا ما يحتاجه من يجهّز: أن
     يعلم، لا أن يُمنع. */
  noticeAr?: string | null
}

export interface Readiness {
  steps: ReadinessStep[]
  /** لا تكون صحيحةً إلّا والثلاثُ تامّة */
  ready: boolean
  /** نصوصُ ما ينقص وحدَها — للرسالة وللشاشة */
  blockersAr: string[]
}

const ms = (d: Date | string): number => (d instanceof Date ? d.getTime() : new Date(d).getTime())

/** القاعدةُ العامّةُ السارية — وهي الشرطُ، لا أيُّ قاعدةٍ كانت */
function hasLiveBaseRule(rules: CompensationRuleFact[], at: number): boolean {
  return rules.some((r) => (
    !r.courseId && !r.cohortId
    && r.rate > 0
    && ms(r.effectiveFrom) <= at
    && (r.effectiveTo == null || ms(r.effectiveTo) > at)
  ))
}

/* ═══ والعقدُ الموقَّعُ وحدَه يُعدّ ═══

   `signed` إقرارُ طرفٍ واحد، و`countersigned` نفاذُه بالطرفين — وكلاهما
   يُثبت أنّه وقّع، وهو المقصود هنا. وما عداهما لا: `sent` أُرسل ولم يُقرأ،
   و`declined` اعتذر — وهو جوابٌ مشروعٌ لا عطبٌ ولا تمام، و`revoked` أُلغي،
   و`expired` انقضى، و`terminated` فُسخ بعد نفاذه فلم يعد يحكم شيئا. */
const SIGNED_CONTRACT_STATUSES: readonly string[] = ['signed', 'countersigned']

export function computeReadiness(input: ReadinessInput): Readiness {
  const at = (input.now ?? new Date()).getTime()

  const compensationDone = hasLiveBaseRule(input.compensationRules, at)
  const qualificationsDone = input.qualifiedCourses > 0
  const contractDone = input.contracts.some((c) => SIGNED_CONTRACT_STATUSES.includes(c.status))

  const steps: ReadinessStep[] = [
    {
      key: 'compensation',
      labelAr: READINESS_LABELS_AR.compensation,
      done: compensationDone,
      blockerAr: compensationDone
        ? null
        : 'لا اتّفاقَ ماليَّ ساريا — اضبط نموذجَ الأجر (بالمقعد أو بالشعبة أو نسبةً من الإيراد) ومبلغَه.',
      noticeAr: null,
    },
    {
      key: 'qualifications',
      labelAr: READINESS_LABELS_AR.qualifications,
      done: qualificationsDone,
      blockerAr: qualificationsDone
        ? null
        : 'لا دورةَ مؤهَّلا لها — أهِّلْه لما سيدرّسه قبل أن يُعتمَد.',
      noticeAr: input.openProposals > 0
        ? `وله ${input.openProposals} اقتراحَ دورةٍ ينتظر التصنيف — يُصنَّف أو يُردّ، ولا يحبس اعتمادَه.`
        : null,
    },
    {
      key: 'contract',
      labelAr: READINESS_LABELS_AR.contract,
      done: contractDone,
      blockerAr: contractDone
        ? null
        : 'لا عقدَ وقّعه — ركّبِ العقدَ وأرسلْه، ويُعتمَد بعد توقيعه.',
      noticeAr: null,
    },
  ]

  return {
    steps,
    ready: steps.every((s) => s.done),
    blockersAr: steps.filter((s) => !s.done).map((s) => s.blockerAr!),
  }
}

/* ═══ نصُّ المنع — يُبنى هنا كي يُقال الشيءُ نفسُه في الخادم والشاشة ═══

   ولا يُقال «لا يمكن الاعتماد» ويُسكَت: من قرأها وقف ولا يعرف أين يذهب.
   فتُعدَّد الخطواتُ الناقصةُ بنصّها، وهي نفسُها المعروضةُ في «التجهيز». */
export function readinessBlockMessageAr(r: Readiness): string {
  return `لا يُعتمَد قبل أن يتمّ التجهيز — ${r.blockersAr.join(' · ')}`
}

/* ═══ التجاوزُ: بابٌ واحدٌ ضيّقٌ بسببٍ مكتوب ═══

   ولمَ يوجد أصلا: قرارُ صاحب المنصّة (٦ سبتمبر) أنّ الاعتمادَ نقرةٌ واحدة،
   وقرارُه (٢٠ سبتمبر) أنّ الثلاثَ تُفحَص. وهما لا يتناقضان إن بقي للأوّل
   بابٌ **يُسمّى من فتحه ولماذا** — فمن يعرف مدرّبَه ويريده اليومَ يمرّ،
   ولا يمرّ أحدٌ في صمت.

   والحدُّ عشرون حرفا: «استثناء» و«موافق» لا تشرحان شيئا لمن يقرؤها بعد
   شهرٍ حين يُسأل لمَ صار هذا نشطا بلا عقد. */
export const OVERRIDE_MIN_REASON = 20

export function overrideReasonProblemAr(reason: string): string | null {
  const t = (reason ?? '').trim()
  if (t.length === 0) return 'اكتب سببَ التجاوز — لا يُعتمَد ناقصُ التجهيز في صمت.'
  if (t.length < OVERRIDE_MIN_REASON) {
    return `اشرح السببَ في ${OVERRIDE_MIN_REASON} حرفا فأكثر — يُقرأ بعد شهرٍ حين يُسأل عن هذا الاعتماد.`
  }
  return null
}

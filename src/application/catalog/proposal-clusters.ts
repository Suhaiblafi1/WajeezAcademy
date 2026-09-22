/* هل تتجمّع اقتراحاتُ المدرّبين؟ — قواعدُ التجميع، لا قراءتُه.

   ═══ السؤالُ الذي وُضع له هذا الملفّ ═══

   سأل صاحبُ المنصّة (٢١ سبتمبر ٢٠٢٦): «ماذا لو كلّ فترةٍ وفترة جمعنا كلَّ
   الدورات المقترحة الجديدة وأضفناها بمسارات جديدة؟ أليس هذا أسهل من أن
   أضيف دورةً دورة وأربطها بمهاراتٍ لربّما غير موجودة؟»

   والجوابُ لا يُعطى برأي: يُعطى بأن يُقاس **أتتجمّع فعلا**. فإن وقع ستّةُ
   اقتراحاتٍ في مجالَين فالتجميعُ يدفع ثمنَه؛ وإن وقعت في ستّة فالاجتماعُ
   يُخرج ستّةَ قراراتٍ منفردةٍ على كلّ حال، ويكون البابُ الصحيحُ دورةً
   تُرشَّح وحدَها (`recommendableDirectly`).

   ═══ وعلى أيّ محورَين يُجمَّع ═══

   **المجالُ والجمهور** — لأنّهما ما يقوم عليه المسارُ في هذه المنصّة، لا ما
   يخطر بالبال. كلُّ مسارٍ في الكتالوج اليوم أربعُ دوراتٍ لجمهورٍ واحدٍ في
   مجالٍ واحد. فأربعةُ اقتراحاتٍ في مجالٍ واحدٍ **لجمهورين مختلفين** ليست
   مسارا: هي مسارٌ نصفُه لطالبٍ ونصفُه لمديرٍ، وذاك «الجوكر» الذي يحذّر منه
   رأسُ `PathwayWizard` — كيانٌ يُحفَظ ولا يُرشَّح لأحد.

   ═══ وما يقوله التجميعُ ولا يقرّره ═══

   هذا يُخرج **مرشَّحا يُقرأ**، لا قرارا يُنفَّذ. المسارُ عقدٌ على متعلّم:
   له وعدٌ ومخرَجٌ ختاميٌّ وشهادة، ولا يُولَد من أربعة عناوينَ اجتمعت في
   عمود. فالمخرَجُ سطرٌ يقول «هذه الأربعةُ تتقاطع هنا — انظروها»، والباقي
   على من يقرأ.

   ═══ والدَّينُ القائمُ يُقال مع كلّ مرشَّح ═══

   `docs/CATALOG_GAPS_FROM_DIAGNOSTIC_AR.md` يوثّق أنّ اثني عشر مسارا من
   عشرين لم تفز بالمرتبة الأولى في ٥٢٥ جلسة، وسببُه أنّ بنكَ الأسئلة لا
   ينتج الرموزَ التي تنتظرها. فمسارٌ جديدٌ في مجالٍ لا يصله هدفٌ **يُولَد
   ميّتا** كما وُلد قبلَه اثنا عشر.

   ولذلك تحمل كلُّ عنقودٍ رايةَ `domainReachable`: أفي هذا المجال كيانٌ نشطٌ
   يصله هدفٌ فعلا؟ فإن لم يكن، فالمسارُ ليس أوّلَ ما يُبنى — بنكُ الأسئلة هو. */

import { suggestCourses, type MatchableCourse } from '../trainer/proposal-match'

/** دوراتُ المسار الواحد في هذا الكتالوج — ستّةٌ وعشرون مسارا، كلُّها أربع.

    وليس رقما مختارا: هو شكلُ الكتالوج القائم، ويحرسه
    `src/tests/catalog/proposal-clusters.test.ts` على الكتالوج الحيّ. فإن
    تغيّر الشكلُ يوما حمِر الحارسُ بدل أن يمرّ عنقودٌ بمقياسٍ عتيق. */
export const PATH_COURSE_COUNT = 4

/** ما يعرفه العنقودُ عن دورةٍ في الكتالوج — مجالُها وجمهورُها ومن يمثّلها */
export interface CourseAnchor {
  courseId: string
  domains: readonly string[]
  stages: readonly string[]
  /** الكيانات التي تضمّ هذه الدورة — مسارا كانت أو قالبا مركّبا */
  entityIds: readonly string[]
}

/** اقتراحُ مدرّبٍ كما يُقرأ هنا — نصُّه لا صفُّه */
export interface ProposalInput {
  id: string
  titleAr: string
  summaryAr?: string | null
  trainerName?: string
}

/** كيانٌ من فضاء التوصيات، بما يلزم التجميعَ وحدَه */
export interface UniverseEntity {
  entity_id: string
  /** `standard` مسارٌ قائم، و`composite` قالبٌ يجمع من مساراتٍ شتّى */
  entity_type: string
  domains: readonly string[]
  career_stages: readonly string[]
  required_courses: readonly string[]
  reachable_goals: readonly string[]
  status: string
}

/** فهرسُ الدورة إلى مجالها وجمهورها — من **المسارات القياسيّة وحدَها**.

    والقالبُ المركّبُ يُترك هنا بقصد: هو حزمةٌ تجمع من مساراتٍ شتّى، فمجالُه
    مجالاتُها كلُّها. ولو عرّف مقرَّ الدورة لَورثت الدورةُ مجالاتِ كلّ قالبٍ
    مرّت به — وقياسُ الفضاء الحيّ (٢٢ سبتمبر ٢٠٢٦): بالقوالب تبلغ الدورةُ
    **ثمانيةَ مجالات** ولا تنفرد بواحدٍ إلّا سبعٌ وثلاثون من مئةٍ وأربع؛
    وبالمسارات وحدَها تنفرد ستٌّ وتسعون بمجالٍ واحد. فاقتراحٌ يرسو عليها
    كان يُقرأ في ثمانية عناقيد، ويصير كلُّ عنقودٍ أكبرَ ممّا فيه — فيُقال
    «تتجمّع» وما تجمّع شيء. وذاك نقضُ التقرير من داخله.

    ولا تسقط دورةٌ بهذا: كلُّ دورةٍ في قالبٍ هي في مسارٍ قياسيٍّ أيضا، فالفهرسُ
    مئةٌ وأربعُ دورةٍ في الحالين. */
export function buildCourseIndex(entities: readonly UniverseEntity[]): Map<string, CourseAnchor> {
  const out = new Map<string, CourseAnchor>()
  for (const e of entities) {
    if (e.entity_type !== 'standard') continue
    for (const courseId of e.required_courses) {
      const prev = out.get(courseId)
      out.set(courseId, {
        courseId,
        /* دورةٌ في كيانين ترث مجالَيهما: هي جسرٌ بينهما بحقّ، ولا يُختار
           أحدُهما بترتيبِ مرورٍ في حلقة. */
        domains: [...new Set([...(prev?.domains ?? []), ...e.domains])].sort(),
        stages: [...new Set([...(prev?.stages ?? []), ...e.career_stages])].sort(),
        entityIds: [...new Set([...(prev?.entityIds ?? []), e.entity_id])].sort(),
      })
    }
  }
  return out
}

/** المجالاتُ التي يصلها هدفٌ فعلا — من كيانٍ نشطٍ واحدٍ على الأقلّ.

    وهنا تُقرأ القوالبُ المركّبة مع المسارات، بخلافِ الفهرس فوق. والفرقُ
    مقصود: السؤالان اثنان لا واحد. «أين مقرُّ هذه الدورة» يجيب عنه المسارُ
    وحدَه، و«أيصل هذا المجالَ متعلّمٌ اليوم» يجيب عنه كلُّ ما يُرشَّح — والقالبُ
    النشطُ يُرشَّح فيَصِل. فلو أُقصي هنا لَقيل عن مجالٍ يصله متعلّمون إنّه
    مهجور. */
export function reachableDomains(entities: readonly UniverseEntity[]): Set<string> {
  const out = new Set<string>()
  for (const e of entities) {
    if (e.status !== 'approved_active' || e.reachable_goals.length === 0) continue
    for (const d of e.domains) out.add(d)
  }
  return out
}

/** اقتراحٌ وُضع في مجاله — أو لم يُوضَع */
export interface AnchoredProposal extends ProposalInput {
  /** أقربُ رمزٍ في الكتالوج، وسببُ قربه */
  nearestCourseId: string
  nearestTitleAr: string
  sharedAr: readonly string[]
  score: number
  domains: readonly string[]
  stages: readonly string[]
}

export type ClusterVerdict = 'path_candidate' | 'split_by_audience' | 'standalone'

export interface ProposalCluster {
  domain: string
  proposals: readonly AnchoredProposal[]
  /** الجمهورُ المشترَك بين كلّ اقتراحات العنقود — فارغٌ يعني لا جمهورَ يجمعها */
  commonStages: readonly string[]
  /** أفي هذا المجال كيانٌ نشطٌ يصله هدفٌ؟ */
  domainReachable: boolean
  verdict: ClusterVerdict
  verdictAr: string
}

export interface ClusterReport {
  clusters: readonly ProposalCluster[]
  /** ما لم تُصِبه كلمةٌ من عنوانه في الكتالوج — لا يُوضَع، ويُقرأ بعين */
  unanchored: readonly ProposalInput[]
  totalProposals: number
}

/** لمَ هذا العنقودُ مرشَّحُ مسارٍ أو ليس — جملةٌ تُقرأ لا رمز */
function verdictOf(
  size: number,
  commonStages: readonly string[],
  domainReachable: boolean,
): { verdict: ClusterVerdict; verdictAr: string } {
  if (size < PATH_COURSE_COUNT) {
    return {
      verdict: 'standalone',
      verdictAr: `${size} دون ${PATH_COURSE_COUNT} — لا تكفي مسارا. والبابُ الأقربُ دورةٌ `
        + 'تُرشَّح وحدَها: مجالٌ وجمهورٌ ومهاراتُها، بلا مسارٍ ولا رمزِ هدفٍ جديد.',
    }
  }
  if (commonStages.length === 0) {
    return {
      verdict: 'split_by_audience',
      verdictAr: `${size} تكفي عددا، ولا جمهورَ يجمعها — مسارٌ نصفُه لجمهورٍ ونصفُه لآخرَ `
        + 'لا يُرشَّح لأحد. فتُقسَم بالجمهور أوّلا، أو تُفتح دوراتٍ قائمةً بنفسها.',
    }
  }
  if (!domainReachable) {
    return {
      verdict: 'path_candidate',
      verdictAr: `${size} بجمهورٍ واحد — مرشَّحُ مسار. **لكنّ هذا المجالَ لا يصله هدفٌ اليوم**: `
        + 'مسارٌ يُبنى فيه يُولَد كما وُلد اثنا عشرَ قبلَه، فبنكُ الأسئلة أوّلا.',
    }
  }
  return {
    verdict: 'path_candidate',
    verdictAr: `${size} بجمهورٍ واحدٍ في مجالٍ يصله هدف — مرشَّحُ مسارٍ يُقرأ. `
      + 'ويبقى الوعدُ والمخرَجُ الختاميُّ قرارَ إنسان.',
  }
}

/** التقرير: أين تقع الاقتراحاتُ المفتوحة، وماذا يُقترح في كلٍّ منها */
export function clusterProposals(
  proposals: readonly ProposalInput[],
  courses: readonly MatchableCourse[],
  entities: readonly UniverseEntity[],
): ClusterReport {
  const index = buildCourseIndex(entities)
  const reachable = reachableDomains(entities)

  const anchored: AnchoredProposal[] = []
  const unanchored: ProposalInput[] = []

  for (const p of proposals) {
    /* مرساةٌ واحدةٌ لا ثلاث: لو أُخذت ثلاثةُ ترشيحاتٍ لَوقع الاقتراحُ في
       ثلاثة مجالاتٍ فعُدّ ثلاثا، فينتفخ كلُّ عنقودٍ بما ليس فيه. والقرارُ
       يحمله `const [best] =` لا الرقمُ الأخير — والرقمُ ألّا يُطلَب ما
       يُطرَح. فمن وسّعه يوما فليقرأ السطرَ الذي تحته قبلَه. */
    const [best] = suggestCourses({ titleAr: p.titleAr, summaryAr: p.summaryAr }, courses, 1)
    const anchor = best ? index.get(best.courseId) : undefined
    if (!best || !anchor || anchor.domains.length === 0) {
      unanchored.push(p)
      continue
    }
    anchored.push({
      ...p,
      nearestCourseId: best.courseId,
      nearestTitleAr: best.titleAr,
      sharedAr: best.sharedAr,
      score: best.score,
      domains: anchor.domains,
      stages: anchor.stages,
    })
  }

  /* والاقتراحُ يدخل كلَّ مجالٍ ترثه دورتُه: دورةٌ جسرٌ بين مجالَين تجعل
     اقتراحَها يُقرأ في العنقودَين — وقارئٌ يراه مرّتين خيرٌ من عنقودٍ
     ينقص واحدا لأنّ الدورةَ اختِير لها مجالٌ بترتيبِ حلقة. */
  const byDomain = new Map<string, AnchoredProposal[]>()
  for (const a of anchored) {
    for (const d of a.domains) byDomain.set(d, [...(byDomain.get(d) ?? []), a])
  }

  const clusters: ProposalCluster[] = [...byDomain.entries()].map(([domain, rows]) => {
    const commonStages = rows
      .reduce<string[]>(
        (acc, r) => acc.filter((s) => r.stages.includes(s)),
        [...(rows[0]?.stages ?? [])],
      )
      .sort()
    const domainReachable = reachable.has(domain)
    return {
      domain,
      proposals: rows,
      commonStages,
      domainReachable,
      ...verdictOf(rows.length, commonStages, domainReachable),
    }
  })

  /* الأكبرُ أوّلا — فمن يقرأ التقريرَ يقرأ ما يُقرَّر فيه قبل ما يُمرّ عليه.
     وعند التساوي بالمجال، فترتيبٌ ثابتٌ بين تشغيلَين. */
  clusters.sort((a, b) => b.proposals.length - a.proposals.length || a.domain.localeCompare(b.domain))

  return { clusters, unanchored, totalProposals: proposals.length }
}

/** خلاصةٌ بسطرٍ واحد — ما يُقرَّر منه، وما يُقرأ بعين */
export function clusterHeadlineAr(report: ClusterReport): string {
  const paths = report.clusters.filter((c) => c.verdict === 'path_candidate')
  const domains = report.clusters.length
  if (report.totalProposals === 0) return 'لا اقتراحَ مفتوحا — لا شيءَ يُجمَّع.'
  if (paths.length === 0) {
    return `${report.totalProposals} اقتراحا في ${domains} مجالا، ولا عنقودَ يبلغ مسارا. `
      + 'فالتجميعُ اليومَ اجتماعٌ يُخرج قراراتٍ منفردة — والبابُ الأنفعُ دورةٌ تُرشَّح وحدَها.'
  }
  return `${report.totalProposals} اقتراحا في ${domains} مجالا، منها ${paths.length} `
    + `${paths.length === 1 ? 'عنقودٌ يبلغ' : 'عناقيدُ تبلغ'} مرشَّحَ مسار — فالتجميعُ يدفع ثمنَه.`
}

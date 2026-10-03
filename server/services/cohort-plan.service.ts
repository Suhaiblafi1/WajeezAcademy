/* ملكيّةُ الشعبة — المدرّبُ يجهّزها ويقول «أوافق»، والإدارةُ تعتمد.

   ═══ ما كان ═══

   للمدرّب أن **يقترح**: صفٌّ في `TrainerChangeRequest` يقول «غيّروا عنوانَ
   الوحدة الثانية»، ينتظر في طابورٍ عند الإدارة، ثمّ يُنشَر خطّةً. فمن يقف في
   اللقاء ويعرف مادّتَه لا يملك أن يرتّبها — يملك أن يطلب من غيره أن يرتّبها.

   ═══ القرار ═══

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): الشعبةُ ملكُ مدرّبها. يعدّل كلَّ شيء —
   الاسمَ والمواعيدَ والمحاورَ والتطبيقَ العمليَّ والمصادرَ واللقاءاتِ
   والتسجيلات — **عدا السعر**. ثمّ يقول «أوافق على كلّ ما في الشعبة» ويرسلها،
   فيعتمدها المديرُ الأكاديميُّ أو المديرُ الأعلى — أيُّهما سبق. ولا اقتراحَ:
   «ليس اقتراحا بل واجبٌ عليه».

   ═══ أين تسكن ═══

   في `CohortDeliveryPlan` نفسِه — الصفُّ الذي كانت الاقتراحاتُ تُنشَر فيه،
   وشرطُ فتحِ الشعبة الخامس. فخطّةُ المدرّب المعتمَدةُ تُوفي الشرطَ الذي كان لا
   يُوفى إلّا باقتراحٍ يُنشَر. و`content` يحمل ما يعدّله: `{ kind: 'trainer',
   modules, resources, summaryAr, liveNoteAr }` — لا يمسّ الكتالوج، فالمحاورُ
   المعدَّلة تخصّ هذه الشعبةَ وحدَها.

   ═══ والسعرُ ليس «حقلا لا يُعرَض» بل حقلٌ يُردّ ═══

   لو اكتفت الشاشةُ بإخفائه لكتبه من عرف اسمَه في النداء. فالخدمةُ تردّ أيَّ
   مفتاحٍ ماليٍّ صراحةً — `price` و`currency` و`capacity` و`registrationOpen`
   و`financialReady` — والشاشةُ تقول إنّه بيد الإدارة. */

import { Prisma, type PrismaClient } from '@prisma/client'
import { moduleBodyDone } from '../../src/application/trainer/module-body'
import { blockingBeforeSubmit, trainerOwned } from '../../src/application/trainer/plan-gate'
import {
  REVIEW_SECTIONS, composeReviewNote, hasReviewNotes, normalizeReviewNotes, notedSections, readReviewNotes,
  type ReviewNotes,
} from '../../src/application/trainer/review-notes'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { CohortService } from './cohort.service'
import { notifyRole, safeNotify, sendDirectEmail, publicSiteUrl } from './notification.service'
import { fmtDateWith } from '../../src/application/text/format-ar'
import { renderMail } from './mail-template'
import { readableModuleVersion } from '../catalog/module-version-visibility'
import {
  asPeriod, periodBounds, periodProblem, zonedDay, withinPeriod, type CohortPeriod,
} from '../../src/application/trainer/cohort-period'
import {
  cohortWorkbookProblems, joinClosesAt, sessionEnd, sessionProblems, slotProblems, workbookProblems,
  type CohortWorkbook, type PlanSlot,
} from '../../src/application/trainer/axis-timeline'
import { APPROVED_PLAN_STATUSES, PLAN_GATE_SELECT, awaitingTrainerPlan, planApprovedOnce } from './registration-window'
import { AssessmentService } from './assessment.service'
import { PLAN_VISIBLE_STATUSES, resourceCategory } from '../../src/application/trainer/plan-overlay'
import { applyRecordedPlacements, recordedPlacements, samePlanContent } from '../../src/application/trainer/recorded-links'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/* ─────────── ما يعدّله المدرّب في محتوى الشعبة ─────────── */

export interface TrainerPlanModule {
  moduleId: string
  titleAr: string
  outcomeAr?: string | null
  activityAr?: string | null
  artifactAr?: string | null
  bodyAr?: string | null
  /** ع-٢: ملفٌّ يقرؤه المتعلّمُ بدلا من متنٍ مكتوب — «بدلا» لا «مع» */
  bodyFileKey?: string | null
  bodyFileName?: string | null
  bodyFileMime?: string | null
}
/** `kind` من `RESOURCE_KINDS` — وغيابُه يعني «رابط» (ما حُفظ قبل العمود) */
export interface TrainerPlanResource {
  /* والرابطُ اختياريٌّ منذ د-٣: المصدرُ رابطٌ **أو** ملفٌّ مرفوع */
  title: string; url?: string | null; kind?: string | null; noteAr?: string | null
  /** صنفُه الثلاثيّ (١٥ سبتمبر ٢٠٢٦) — ومنه يُشتقّ نوعُه */
  category?: string | null
  /** متى يُفتح للمتعلّم — للمسجَّل وحدَه */
  opensAt?: string | null
  /** د-٣: مصدرٌ مرفوعٌ بدل رابطٍ مُلصَق */
  bodyFileKey?: string | null; bodyFileName?: string | null; bodyFileMime?: string | null
  /** محورُه — ومنه متى يُفتح (٢٧ سبتمبر ٢٠٢٦). وبلا محورٍ فهو للشعبة كلِّها */
  moduleId?: string | null
  /** للقراءة المسبقة: يُفتح مع كرّاسة موعده لا بعد لقائه */
  preReading?: boolean | null
}
export interface TrainerPlanContent {
  kind: 'trainer'
  summaryAr?: string | null
  modules: TrainerPlanModule[]
  resources: TrainerPlanResource[]
  liveNoteAr?: string | null
  /** ═══ مدّةُ الشعبة — من متى إلى متى (٢٧ سبتمبر ٢٠٢٦) ═══

      يحدّدها المدرّبُ في خطوتها الأولى، وتُعتمَد مع الخطّة: قبل الاعتماد لا
      يراها متعلّم، وبه تصير حدودَ الشعبة المعلَنة. ونافذةُ جدولته تتبعها
      لحظةَ الحفظ. والقاعدةُ في `src/application/trainer/cohort-period.ts`. */
  startsOn?: string | null
  endsOn?: string | null
  /** ═══ مواعيدُ المحاور وكرّاساتُها (٢٧ سبتمبر ٢٠٢٦) ═══

      لكلّ موعدٍ من يومٍ إلى يوم، ومحورٌ أو محاورُ متجاورةٌ فيه، وكرّاستُه.
      ومنه يُحكم متى يُفتح كلُّ شيءٍ للمتعلّم. والقاعدةُ كاملةً في
      `src/application/trainer/axis-timeline.ts`. */
  slots?: PlanSlot[] | null
  /** ═══ كرّاسةُ الشعبة — واحدةٌ للمحاور كلِّها (٣٠ سبتمبر ٢٠٢٦) ═══

      حلّت محلَّ كرّاسةٍ لكلّ موعد: ملفٌّ أو رابطٌ واحد، ومعه أين يبدأ كلُّ
      محورٍ فيه — فيتبعها المتعلّمُ محورا محورا. والقاعدةُ في
      `src/application/trainer/axis-timeline.ts` (`cohortWorkbookProblems`). */
  workbook?: CohortWorkbook | null
  /* ── وحُذف `proposals` من هنا (د-٦ · ١٤ سبتمبر ٢٠٢٦) ──

     كان حقلَين — اسمٌ مقترحٌ للدورة وآخرُ للمسار — يركبان مع الخطّة،
     ويكتبهما الاعتمادُ **على النسخة الحاليّة** بـ`updateMany`. فتبديلٌ
     واحدٌ يُعيد تسميةَ كلِّ شهادةٍ صدرت (ك-٢)، بلا سجلِّ من اقترح ولا لِمَ.

     واسمُ الدورة مرّ بقناته حينا: `TrainerChangeService` بنوع
     `course_title_edit` — maker-checker وإصدارٌ جديدٌ لا كتابةٌ فوق القائم
     (ح-٣). ثمّ أُغلق البابُ كلُّه (ق٥ · ١٧ سبتمبر ٢٠٢٦): قناةٌ لا يملكها
     أحدٌ أسوأُ من لا قناة. واسمُ المسار سقط قبلَه ولم يُنقل: المدرّبُ لا
     يعيد تسميةَ مسارٍ مشترك، بل يبني مسارَه هو من دوراته (القسم «ن»).

     والمحفوظُ في القاعدة لا يُمسّ: `content` عمودُ JSON، وما فيه من
     `proposals` يبقى كما كتبه صاحبُه ولا يقرؤه شيء. */
}

/** ما يجوز للمدرّب تعديلُه في صفّ الشعبة نفسِه لحظتَه — والباقي بيد الإدارة */
export const TRAINER_EDITABLE_COHORT_FIELDS = ['title', 'language'] as const

/** ═══ وما يغيّر **متى يحضر المتعلّمُ وأين** لم يعد يُكتب هنا (٢٧ سبتمبر ٢٠٢٦) ═══

    كان المدرّبُ يكتب البدءَ والانتهاءَ والأيّامَ والساعةَ على الشعبة مباشرةً،
    فتصل المسجَّلين لحظتَها **بلا اعتماد** (ي-٤ كان يُبلّغهم بها بعد وقوعها).
    وصارت المدّةُ في الخطّة تُعتمَد معها، والأيّامُ والساعةُ لقاءً لقاءً في
    خطوتها. فهذه المفاتيحُ تُردّ باسمها — لا تُهمَل بصمتٍ فيظنّ مرسلُها أنّها
    حُفظت. */
export const SCHEDULE_FIELDS = [
  'startsAt', 'endsAt', 'daysOfWeek', 'startTime', 'timezone', 'deliveryMode',
] as const
export type TrainerCohortPatch = Partial<{ title: string; language: string }>

/** الحقولُ الماليّةُ التي تُردّ صراحةً لا تُهمَل بصمت */
const ADMIN_ONLY_FIELDS = ['price', 'currency', 'capacity', 'registrationOpen', 'financialReady'] as const

export const PLAN_STATUSES = ['draft', 'submitted', 'changes_requested', 'approved', 'published', 'superseded'] as const
export type PlanStatus = (typeof PLAN_STATUSES)[number]

/* ═══ محاورُ الكتالوج الثابت — حين لا محاورَ للدورة في القاعدة ═══

   ورشةُ الشعبة تبدأ من محاور الدورة في القاعدة. فإن لم تكن الدورةُ قد
   استُوردت بمحاورها (أو أُرشفت) فتح المدرّبُ لسانَ «المحاور» على فراغٍ لا
   يعرف سببَه — وهو ما رآه صاحبُ المنصّة: «أرى فقط عنوانا وغيره»
   (٨ سبتمبر ٢٠٢٦). والكتالوجُ الثابتُ يحمل ٤٠٤ محاور لـ٨١ دورة، فمنه تُقرأ
   البدايةُ حين تخلو القاعدة. ولا يمسّ الكتالوجَ ولا القاعدة: بدايةٌ للمسودّة
   لا غير. */
interface StaticModule {
  module_id: string; course_id: string; sequence: number; title_ar: string
  module_outcome_ar?: string | null; practice_activity_ar?: string | null
  evidence_artifact_ar?: string | null; module_body_ar?: string | null
}
let staticModules: Promise<StaticModule[]> | null = null
function loadStaticModules(): Promise<StaticModule[]> {
  if (!staticModules) {
    staticModules = readFile(join(process.cwd(), 'src/data/catalog/core-catalog.v2.json'), 'utf8')
      .then((raw) => (JSON.parse(raw) as { modules?: StaticModule[] }).modules ?? [])
      .catch(() => [])
  }
  return staticModules
}
/** محاورُ دورةٍ من الكتالوج الثابت بترتيبها — أو لا شيء إن لم تكن فيه */
export async function staticModulesFor(courseId: string): Promise<TrainerPlanModule[]> {
  const all = await loadStaticModules()
  return all
    .filter((m) => m.course_id === courseId)
    .sort((a, b) => a.sequence - b.sequence)
    .map((m) => ({
      moduleId: m.module_id, titleAr: m.title_ar,
      outcomeAr: m.module_outcome_ar ?? null, activityAr: m.practice_activity_ar ?? null,
      artifactAr: m.evidence_artifact_ar ?? null, bodyAr: m.module_body_ar ?? null,
    }))
}

/** محاورُ الدورة الأساسيّة: من القاعدة، وإن خلت فمن الكتالوج الثابت — كما
    تبنيها الورشة. وتقرؤها شعبةُ الإعداد لتنقل إليها ما كتبه المدرّبُ من قبل. */
export async function baseModulesFor(prisma: PrismaClient, courseId: string): Promise<TrainerPlanModule[]> {
  const modules = await prisma.courseModule.findMany({
    where: { courseId, status: { not: 'archived' } },
    orderBy: { createdAt: 'asc' },
    include: { versions: { ...readableModuleVersion(), take: 1 } },
  })
  const fromDb: TrainerPlanModule[] = modules.map((m) => {
    const v = m.versions[0]
    return {
      moduleId: m.id, titleAr: v?.titleAr ?? m.id,
      outcomeAr: v?.outcomeAr ?? null, activityAr: v?.activityAr ?? null,
      artifactAr: v?.artifactAr ?? null, bodyAr: v?.bodyAr ?? null,
    }
  })
  return fromDb.length > 0 ? fromDb : staticModulesFor(courseId)
}

/* ═══ قائمةُ «ماذا أفعل» — تُحسب لا تُكتب ═══

   كلُّ بندٍ حالتُه من الواقع: العنوانُ والمواعيدُ من صفّ الشعبة، والمحاورُ
   والمصادرُ من الخطّة، واللقاءاتُ من الجدول، والتكاليفُ من جدولها. فلا يُقال
   «تمّ» عن شيءٍ لم يقع، ولا يبقى «لم يتمّ» عن شيءٍ وقع. وهي دالّةٌ واحدة
   تقرؤها الورشةُ وبطاقاتُ «شعبي» معا — فلا تفترق النسبةُ التي يراها المدرّب
   على البطاقة عن القائمة التي يراها داخل الشعبة. */
export interface ChecklistItem { key: string; labelAr: string; done: boolean; optional: boolean }
export function buildChecklist(input: {
  cohort: { title: string }
  /** مدّةُ الشعبة كما تُحكَم — من `resolvePeriod` لا من الخطّة خامًا */
  period: CohortPeriod | null
  content: TrainerPlanContent | null
  /** لقاءاتُ المدرّب وحدَها — بلا المبدئيّ ولا الملغى (`countableSessions`) */
  sessions: {
    title?: string | null; startsAt?: Date | string; endsAt?: Date | string | null; recordings: unknown[]
    /** محورا اللقاء (٢٧ سبتمبر ٢٠٢٦) — ومنهما «لكلّ محورٍ لقاءٌ في موعده» */
    moduleIds?: readonly string[] | null
  }[]
  assessmentsCount: number
  /** محورُ كلّ مهمّة — ومنه «كلُّ مهمّةٍ مربوطةٌ بمحور». وغيابُه لا يحكم بشيء */
  assessmentModuleIds?: readonly (string | null)[]
  /** نوعُ كلّ مهمّة — ومنه «مهامُّ عمليّةٌ ومشروعُ تخرّج» (٣٠ سبتمبر ٢٠٢٦). وغيابُه لا يحكم بشيء */
  assessmentTypes?: readonly string[]
  planStatus: PlanStatus
  /** اللحظةُ التي يُحكم بها — وما انعقد قبلها لا يُحاسَب (`sessionProblems`) */
  now?: Date
}): ChecklistItem[] {
  const c = input.cohort
  /* ═══ الهُويّةُ صارت: اسمٌ وفصل ═══

     قرارُ صاحب المنصّة (١٥ سبتمبر ٢٠٢٦): «اشطب كلَّ شيءٍ بالخانة الأولى
     واترك فقط تغييرَ اسم الدورة والنبذةَ عنها — والباقي لا داعيَ له، لأنّ
     الدورةَ ستكون متاحةً للطلاب طيلةَ فصل الشتاء، وله فقط أن يقرّر متى
     الجلساتُ المباشرة في مرحلة تحديد اللقاءات».

     فالبدءُ والانتهاءُ لم يعودا يُكتبان بيدٍ: يشتقّهما `setTerm` من حدود
     الفصل. والأيّامُ والساعةُ سقطتا من الشرط لأنّهما سقطتا من الشاشة —
     ومواعيدُ اللقاءات تُحدَّد لقاءً لقاءً لا بنمطٍ أسبوعيٍّ مفترَض. وشرطٌ
     على حقلٍ لا بابَ إليه يحبس المدرّبَ خارجَ الاعتماد بلا أن يقول لماذا.

     ── ثمّ خرج الفصلُ من هنا إلى صفٍّ باسمه ──

     وصحّح صاحبُ المنصّة (١٧ سبتمبر ٢٠٢٦) أنّ الفصلَ ليس اختيارَ المدرّب:
     «عندما نقوم بإسناد دورةٍ لمدرّب نحدّد لأيّ فصلٍ ستكون». فبقاؤه شرطا
     في صفٍّ عنوانُه «سمِّ الشعبة» يجعل «لم يتمّ» تهمةً على عملٍ أتمّه:
     كتب اسمَها فبقي الصفُّ أحمرَ ولا بابَ في يده يفتحه. فصار له صفٌّ
     يسمّي فاعلَه، والهُويّةُ ترجع إلى ما يملكه: اسمُها. */
  /* ═══ ثمّ عادت الهُويّةُ خطوةً أولى، وفيها المدّة (٢٧ سبتمبر ٢٠٢٦) ═══

     قرارُ صاحب المنصّة: «المرحلةُ الأولى هي تعديلُ المعلومات الأساسيّة
     للشعبة وليس زرَّ القلم… واجعله أن يعتمد متى تبدأ الشعبةُ ومتى تنتهي».
     فالهُويّةُ تتمّ باسمٍ **ومدّةٍ صالحة** — والمدّةُ بيده الآن لا بيد من
     يسمّي الفصل، فلا يُكتب «لم يتمّ» على بابٍ مغلقٍ دونه.

     وسقط صفُّ `term` («تسمّي الإدارةُ فصلَ الشعبة فتُفتح لك الجدولة»):
     الجدولةُ تُفتح بمدّته، والفصلُ يُشتقّ من تاريخ البدء عند الاعتماد. */
  const identityDone = c.title.trim().length >= 3 && periodProblem(input.period) === null
  /* ═══ ولماذا صار المحتوى النظريُّ شرطا للاعتماد ═══

     طلب صاحبُ المنصّة (١٣ سبتمبر ٢٠٢٦) أن يصير «المحتوى النظريّ» إلزاميّا
     لكلّ محور. وقرارُ التنفيذ: **يمنع الاعتمادَ ولا يمنع الحفظ** — فمن
     كتب نصفَ شعبته ثمّ أغلق حاسوبه يجب أن يجد نصفَه حين يعود، ومرحلةٌ لا
     تُحفظ حتّى تكتمل تُخسِر العملَ الذي بُذل.

     وكان الشرطُ «فيها محاورُ» وحدَه — وهو صحيحٌ دائما، لأنّ المحاورَ تُحمَّل
     من الكتالوج بدءا. فمرحلةٌ تُعدّ تامّةً قبل أن يكتب المدرّبُ حرفا.

     والأرضيّةُ أربعون حرفا لا حرفٌ واحد: «x» ليس محتوى نظريّا، وشرطٌ يمرّ
     بحرفٍ شرطٌ صوريٌّ يُتعلَّم الالتفافُ عليه في أوّل شعبة. وأربعون جملةٌ
     قصيرةٌ — أقلُّ ما يُقرأ لا أكثرُ ما يُطلَب. */
  /* ع-٢: تمامُ المحور صار «مكتوبٌ **أو** مرفوع»، وقاعدتُه في موضعٍ واحدٍ
     (`moduleBodyDone`) يقرؤه الخادمُ وشاشةُ المدرّب معا — ورقمان يقولان
     الشيءَ نفسَه يفترقان، فيُقال له «تمّ» ويُردّ إرسالُه. */
  const mods = input.content?.modules ?? []
  const moduleIds = mods.map((m) => m.moduleId)
  /* ═══ والمحاورُ على مواعيدها (٢٧ سبتمبر ٢٠٢٦) ═══

     «وبعدها المحاورُ ومواعيدُها التي يجب أن تكون ضمن كلّ فترة الشعبة».
     فخطوةُ المحاور تتمّ بمتونها **ومواعيدها** معا: أربعةُ مواعيدَ على الأقلّ،
     والجمعُ لمتجاورَين، والتواريخُ داخلَ المدّة (`axis-timeline.ts`).

     ── والخطّةُ التي سبقت المواعيدَ تمضي كما بدأت ──

     ما أُرسل أو اعتُمد قبل أن تولد المواعيد قُرئ واعتُمد بلا مواعيد — ولا
     يُكتب «لم يتمّ» على شعبةٍ جاريةٍ لأنّ حقلا جديدا وُلد بعدها («الشعبُ
     الجاريةُ تنتهي بطريقتها»). ومتى عُدّلت صارت مسودّةً فلزمتها المواعيد. */
  const slots = input.content?.slots ?? []
  const legacy = slots.length === 0 && ['submitted', 'approved', 'published'].includes(input.planStatus)
  const slotIssues = legacy ? [] : slotProblems(slots, moduleIds, input.period)
  const modulesDone = mods.length > 0 && mods.every(moduleBodyDone) && slotIssues.length === 0
  /* ⑦ كرّاسةٌ واحدةٌ للشعبة، وموضعُ كلّ محورٍ فيها (٣٠ سبتمبر ٢٠٢٦).
     وما أُرسل أو اعتُمد بكرّاسةٍ لكلّ موعدٍ قبل ذلك يمضي كما اعتُمد — ومتى
     عُدّل صار مسودّةً فلزمته الكرّاسةُ الواحدة. */
  const sentBefore = ['submitted', 'approved', 'published'].includes(input.planStatus)
  const workbooksDone = legacy
    || cohortWorkbookProblems(input.content?.workbook, moduleIds).length === 0
    || (sentBefore && slots.length > 0 && workbookProblems(slots, moduleIds).length === 0)
  const resources = input.content?.resources ?? []
  /* والمصدرُ المربوطُ بمحورٍ حُذف من الخطّة لا يُفتح أبدا — يُسمّى ليُصلَح */
  const orphanResources = legacy ? 0 : resources.filter((r) => r.moduleId && !moduleIds.includes(r.moduleId)).length
  const resourcesDone = resources.length > 0 && orphanResources === 0
  /* ═══ لقاءٌ لكلّ محورٍ على الأقلّ ═══

     «عددُ الجلسات يجب أن يكون بحدٍّ أدنى لا يقلّ عن عدد المحاور، ويحقّ له
     الزيادةُ كما يشاء موزّعةً على الفصل كاملا» (صاحب المنصّة، ١٥ سبتمبر
     ٢٠٢٦). وكان الشرطُ «لقاءٌ واحدٌ فأكثر» — فثمانيةُ محاورَ تمرّ بلقاءٍ
     واحد، ويجد المتعلّمُ محاورَ لم تُشرَح قطّ.

     ولا سقفَ من هنا: الزيادةُ حقُّه، وهذا حدٌّ أدنى لا نطاق. */
  const sessionsNeeded = mods.length
  /* ═══ واللقاءُ داخلَ مدّة الشعبة (٢٧ سبتمبر ٢٠٢٦) ═══

     «ويجب أن تكون ضمن فترة الشعبة نفسها التي وضعها بنفسه». ومن غيّر
     المدّةَ بعد أن جدول صار في يده لقاءٌ خارجَها — فلا يُمنع الحفظ (المدّةُ
     قرارُه)، وإنّما تعود خطوةُ اللقاءات «لم تتمّ» وتسمّي كم خرج منها. */
  /* وما انعقد قبل اليوم لا يُحاسَب بالمدّة — واقعةٌ لا مسودّة (`sessionProblems`) */
  const now = input.now ?? new Date()
  const upcoming = (x: { startsAt?: Date | string; endsAt?: Date | string | null }) =>
    Boolean(x.startsAt) && sessionEnd({ startsAt: x.startsAt!, endsAt: x.endsAt ?? null }).getTime() >= now.getTime()
  const outside = input.period
    ? input.sessions.filter((x) => upcoming(x) && !withinPeriod({ startsAt: x.startsAt!, endsAt: x.endsAt ?? null }, input.period!)).length
    : 0
  /* ═══ ثمّ صار «لقاءٌ لكلّ محورٍ في موعده» (٢٧ سبتمبر ٢٠٢٦) ═══

     العددُ وحدَه كان يمرّ بثمانية لقاءاتٍ في أسبوعٍ واحدٍ لمحورٍ واحد. وصار
     كلُّ لقاءٍ مربوطا بمحوره أو محوريه، والحكمُ على الربط: لكلّ محورٍ لقاءٌ
     مباشر، واللقاءُ داخلَ موعد محوره (②③). والمسجَّلُ من مصادر الخطّة
     يُحكم معها: بمحوره ولحظةِ فتحه داخلَ موعده. */
  const recorded = resources.filter((r) => resourceCategory(r) === 'recorded')
  const linked = legacy ? null : sessionProblems({
    slots, moduleIds,
    sessions: input.sessions.filter((x) => x.startsAt).map((x) => ({
      title: x.title ?? null, startsAt: x.startsAt!, endsAt: x.endsAt ?? null, moduleIds: x.moduleIds ?? [],
    })),
    recordings: recorded.map((r) => ({ title: r.title, moduleId: r.moduleId ?? null, opensAt: r.opensAt ?? null })),
    now,
  })
  const coveredCount = moduleIds.filter((id) => input.sessions.some((x) => (x.moduleIds ?? []).includes(id))).length
  const sessionsDone = linked
    ? input.sessions.length > 0 && outside === 0 && linked.blocking.length === 0
    : input.sessions.length >= Math.max(1, sessionsNeeded) && outside === 0
  /* ومهمّةٌ بلا محورٍ لا يُعرف متى تُفتح ولا متى تُسلَّم — فتُربط كلُّها */
  const unlinkedTasks = legacy || !input.assessmentModuleIds
    ? 0
    : input.assessmentModuleIds.filter((id) => !id || !moduleIds.includes(id)).length
  /* ═══ ثلاثةُ ألسنةٍ كلُّها إلزاميّة (٣٠ سبتمبر ٢٠٢٦) ═══

     قرارُ صاحب المنصّة: «ثلاثُ تابات: للمهامّ العمليّة، وللمصادر، ولمشروع
     التخرّج — لكي لا ينسى أيّا منها لأنّها كلُّها إجباريّة». فالمهامُّ العمليّةُ
     غيرُ مشروع التخرّج، ولكلٍّ صفُّه. وما أُرسل أو اعتُمد قبل القرار يمضي كما
     اعتُمد — ومتى عُدّل صار مسودّةً فلزمه. */
  const types = input.assessmentTypes
  const practicalCount = types ? types.filter((t) => t !== 'project').length : input.assessmentsCount
  const projectDone = !types || sentBefore || legacy || types.includes('project')
  const approvalDone = input.planStatus === 'approved' || input.planStatus === 'published'
  /* وما ينقص الصفَّين يُقال في سطرهما — بعددِه لا بإشارة */
  const tasksNote = unlinkedTasks > 0
    ? ` · ${unlinkedTasks === 1 ? 'مهمّةٌ غيرُ مربوطةٍ' : `${unlinkedTasks} مهامَّ غيرُ مربوطةٍ`} بمحور` : ''
  const resourcesNote = orphanResources > 0
    ? ` · ${orphanResources === 1 ? 'مصدرٌ مربوطٌ' : `${orphanResources} مصادرُ مربوطةٌ`} بمحورٍ حُذف` : ''
  return [
    { key: 'identity', labelAr: 'سمِّ الشعبةَ وحدّد مدّتها — من متى إلى متى', done: identityDone, optional: false },
    {
      key: 'modules',
      labelAr: legacy ? 'اكتب المحتوى النظريَّ لكلّ محور' : 'وزّع المحاورَ على مواعيدها واكتب محتواها النظريّ',
      done: modulesDone, optional: false,
    },
    { key: 'workbooks', labelAr: 'ضع كرّاسةَ الدورة — واحدةً للمحاور كلِّها، وأين يبدأ كلُّ محورٍ فيها', done: workbooksDone, optional: false },
    {
      key: 'sessions',
      labelAr: (linked
        ? `حدّد لقاءاتك المباشرة — لقاءٌ لكلّ محورٍ في موعده (${coveredCount}/${moduleIds.length})`
        : `حدّد مواعيدَ اللقاءات المباشرة — لقاءٌ لكلّ محورٍ على الأقلّ (${input.sessions.length}/${Math.max(1, sessionsNeeded)})`)
        + (outside > 0 ? ` · ${outside === 1 ? 'لقاءٌ خارجَ' : `${outside} لقاءاتٍ خارجَ`} مدّة الشعبة` : '')
        /* ومحاورُ مغطّاةٌ كلُّها والخطوةُ لم تتمّ: يُسمّى أوّلُ ما يمنعها — وإلّا
           قيل للمدرّب «٤ من ٤» ورُدّ إرسالُه بلا سببٍ يراه */
        + (linked && coveredCount === moduleIds.length && linked.blocking.length > 0 ? ` · ${linked.blocking[0]}` : ''),
      done: sessionsDone, optional: false,
    },
    /* ═══ وسقط صفُّ «ارفع الجلساتِ المسجّلة — إن وُجدت» (٢٧ سبتمبر ٢٠٢٦) ═══

       كان اختياريّا يُقرأ من تسجيلاتٍ تُرفع على لقاءٍ بعد انعقاده. وصار
       المسجَّلُ جلسةً في خطوة اللقاءات بمحوره ولحظةِ فتحه — «لا بأس أن جمعت
       بين اللقاءات المسجّلة واللقاءات المباشرة في واحدة لأنّهم نفسُ الأثر» —
       ويُحكم مع اللقاءات في صفّها. وتسجيلُ Zoom يلحق لقاءه وحدَه بعد انتهائه. */
    /* ═══ تكليفٌ واحدٌ على الأقلّ — وصار شرطا (ق٨ · ١٧ سبتمبر ٢٠٢٦) ═══

       دخلت التكاليفُ التجهيزَ أوّلا لأنّ صاحبَ المنصّة سأل: «أين تفاصيل
       الواجبات؟» (٨ سبتمبر ٢٠٢٦)، وكانت **اختياريّةً** عند الإرسال.

       وذاك يناقض ما تبيعه المنصّة: «كلُّ وحدةٍ تنتهي بمُخرَجٍ يقرؤه إنسانٌ
       مقابلَ مسطرةٍ مكتوبة»، و«لا تكون المحاضرةُ إلزاميّةً والمُخرَجُ
       اختياريّا». فشعبةٌ تُعتمَد بلا تكليفٍ واحدٍ تبيع حضورا لا حُكما،
       وتُصدِر شهادةً لا يقف خلفها عملٌ نظر فيه إنسان.

       ومقابلَه في القرار نفسِه: **المحورُ تامٌّ بمتنٍ من الأكاديميّة أو
       منه** — وهو قائمٌ في `moduleBodyDone`، إذ يُحمَل متنُ الكتالوج في
       `baseModules` فيُقرأ تماما بلا أن يُعيد المدرّبُ كتابتَه. */
    { key: 'assignments', labelAr: 'ألّف مهمّةً عمليّةً واحدةً على الأقلّ — واجبٌ أو اختبارٌ يُسلَّم ويُقيَّم' + tasksNote, done: practicalCount > 0 && unlinkedTasks === 0, optional: false },
    /* والمصادرُ في الخطوة نفسِها بعد المهامّ — «وبعدها المهامُّ والواجباتُ وغيرُها
       والتي تُربط بالمحاور» (٢٧ سبتمبر ٢٠٢٦) */
    { key: 'resources', labelAr: 'أضف المصادرَ التي يحتاجها المتعلّم' + resourcesNote, done: resourcesDone, optional: false },
    { key: 'project', labelAr: 'ضع مشروعَ التخرّج — عملٌ واحدٌ يجمع المحاورَ ويُقيَّم في آخر الشعبة', done: projectDone, optional: false },
    { key: 'approval', labelAr: 'أكّد أنّك توافق على كلّ ما فيها وأرسلها للاعتماد', done: approvalDone, optional: false },
  ]
}

/* ═══ المدّةُ كما تُحكَم ═══

   مدّةُ الخطّة إن كتبها المدرّب. فإن لم يكتبها وكانت خطّتُه **معتمَدةً من
   قبل** — شعبةٌ اعتُمدت يومَ كانت حدودُها حدودَ الفصل — فحدودُها المعلَنةُ هي
   مدّتُها: قُرئت واعتُمدت، ولا يُكتب «لم يتمّ» على شعبةٍ جاريةٍ لأنّ حقلا
   جديدا وُلد بعدها. وما عدا ذلك لا مدّةَ له بعد: المسوّدةُ تنتظر قرارَه. */
export function resolvePeriod(
  content: TrainerPlanContent | null,
  cohort: { startsAt: Date | null; endsAt: Date | null },
  status: PlanStatus,
): CohortPeriod | null {
  const own = asPeriod(content)
  if (own) return own
  if ((status === 'approved' || status === 'published') && cohort.startsAt && cohort.endsAt) {
    return { startsOn: zonedDay(cohort.startsAt), endsOn: zonedDay(cohort.endsAt) }
  }
  return null
}

/** لقاءاتُ المدرّب التي تُعَدّ — لا المبدئيُّ من الإدارة ولا ما أُلغي أو رُدّ */
export function countableSessions<T extends { placeholder?: boolean | null; status?: string | null }>(rows: readonly T[]): T[] {
  return rows.filter((r) => !r.placeholder && r.status !== 'cancelled')
}

/* ═══ ما ينتظر الاعتمادَ حقّا — لا خطّةٌ بلا صاحب (٣ أكتوبر ٢٠٢٦) ═══

   بلاغُ صاحب المنصّة: «حذفتُ مدرّبا نهائيّا ومازالت دورتُه هنا — لماذا لا
   يمكنني حذفها؟». فالحذفُ يمحو ملفَّ المدرّب (أو يفكّ حسابَه)، وتبقى شعبةُ
   إعداده وخطّتُها المرسَلة: `trainerId` يصير فارغا بلا تتالٍ، والطابورُ يعدّ
   كلَّ `submitted` — فخطّةٌ لن يقرأ قرارَها أحدٌ تنتظر قرارا إلى الأبد، ولا
   زرَّ في الطابور يُخرجها.

   فالطابورُ وشارتُه يعدّان ما له صاحبٌ يعمل: مدرّبٌ قائمٌ بحسابٍ موصول، في
   شعبةٍ لم تُلغَ. والحذفُ نفسُه يُلغي شعبَ الإعداد التي خلّفها
   (`retireOrphanPrepCohorts`)، وترحيلٌ ألغى ما خلّفه الحذفُ قبل هذا. */
export const PENDING_PLAN_WHERE = {
  status: 'submitted',
  trainer: { is: { userId: { not: null } } },
  cohort: { status: { not: 'cancelled' } },
} as const

export class CohortPlanService {
  private prisma: PrismaClient
  private cohorts: CohortService
  private assessments: AssessmentService
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.cohorts = new CohortService(prisma)
    this.assessments = new AssessmentService(prisma)
  }

  /* ─────────── الملكيّة ─────────── */

  /** ملفُّ المدرّب النشط، أو ٤٠٣ */
  private async profileOf(userId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId },
      include: { application: { select: { fullName: true, email: true } } },
    })
    if (!profile || profile.suspendedAt) throw new AuthError('not_trainer', 'لا ملف مدرب نشطا لهذا الحساب', 403)
    return profile
  }

  /** الشعبةُ إن كان مُسنَدا إليها — وإلّا ٤٠٣ لا ٤٠٤: وجودُها ليس شأنَه */
  private async ownedCohort(userId: string, cohortId: string) {
    const profile = await this.profileOf(userId)
    const link = await this.prisma.cohortTrainer.findFirst({ where: { cohortId, profileId: profile.id } })
    if (!link) throw new AuthError('not_your_cohort', 'هذه الشعبة ليست مُسنَدةً إليك', 403)
    return { profile, link }
  }

  /** آخرُ خطّةٍ كتبها مدرّبٌ لهذه الشعبة — لا خطّةُ الإدارة الأساسيّة ولا أثرُ اقتراحٍ قديم */
  private latestTrainerPlan(cohortId: string) {
    return this.prisma.cohortDeliveryPlan.findFirst({
      where: { cohortId, trainerId: { not: null } },
      orderBy: { createdAt: 'desc' },
    })
  }

  /* ═══ والمعتمَدةُ خلف المراجعة — ليُقرأ ما تغيّر عنها (٣ج-٤) ═══

     بعد الاعتماد يُنشئ حفظُ المدرّب صفَّ خطّةٍ جديدا (مراجعة)، ويبقى المعتمَدُ
     نافذا حتّى تُعتمَد المراجعة. فإن كانت أحدثُ خطّةٍ مراجعةً أُعيد معها المعتمَدُ
     الذي تراجعه — تقرأ منه الشاشتان «ما تغيّر» (`plan-diff.ts`). وإن كانت أحدثُها
     هي المعتمَدةَ فلا شيءَ خلفها يُقارَن. */
  private async approvedBehind(cohortId: string, latest: { id: string; status: string }) {
    if ((PLAN_VISIBLE_STATUSES as readonly string[]).includes(latest.status)) return null
    return this.prisma.cohortDeliveryPlan.findFirst({
      where: { cohortId, trainerId: { not: null }, id: { not: latest.id }, status: { in: [...PLAN_VISIBLE_STATUSES] } },
      orderBy: { createdAt: 'desc' },
      select: { content: true, reviewedAt: true },
    })
  }

  /* ─────────── الورشة: كلُّ ما يحتاجه ليعرف ماذا يفعل ─────────── */

  async workspace(userId: string, cohortId: string) {
    const { profile, link } = await this.ownedCohort(userId, cohortId)
    const cohort = await this.prisma.cohort.findUniqueOrThrow({
      where: { id: cohortId },
      include: {
        course: {
          include: {
            versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true, version: true } },
            modules: {
              where: { status: { not: 'archived' } },
              orderBy: { createdAt: 'asc' },
              include: { versions: { ...readableModuleVersion(), take: 1 } },
            },
          },
        },
        term: { select: { id: true, titleAr: true, season: true, year: true, startsOn: true, endsOn: true, status: true } },
        sessions: { orderBy: { startsAt: 'asc' }, include: { zoom: { select: { joinUrl: true } }, recordings: { where: { status: 'active' } } } },
        materials: { where: { status: 'active' }, orderBy: { createdAt: 'asc' } },
        enrollments: {
          where: { status: { not: 'dropped' } },
          include: { user: { select: { displayName: true } }, courseProgress: { select: { percent: true } } },
        },
        assessments: {
          where: { status: { not: 'closed' } }, orderBy: { createdAt: 'asc' },
          select: { id: true, title: true, briefAr: true, attachments: true, type: true, maxScore: true, dueAt: true, status: true, moduleId: true, pendingChange: true, reviewerNote: true, _count: { select: { submissions: true } } },
        },
        /* أاعتُمدت له خطّةٌ قطّ — منه ينتظر ما يضيفه ويعدّله في مهامّه قرارَ الإدارة (٣ج-٣) */
        plans: PLAN_GATE_SELECT,
      },
    })
    const plan = await this.latestTrainerPlan(cohortId)
    const content = (plan?.content ?? null) as TrainerPlanContent | null
    const approvedPlan = plan ? await this.approvedBehind(cohortId, plan) : null

    /* المحاورُ الأساسيّة من القاعدة — وإن خلت، من الكتالوج الثابت */
    const dbModules: TrainerPlanModule[] = cohort.course.modules.map((m) => {
      const v = m.versions[0]
      return {
        moduleId: m.id, titleAr: v?.titleAr ?? m.id,
        outcomeAr: v?.outcomeAr ?? null, activityAr: v?.activityAr ?? null,
        artifactAr: v?.artifactAr ?? null, bodyAr: v?.bodyAr ?? null,
      }
    })
    const baseModules = dbModules.length > 0 ? dbModules : await staticModulesFor(cohort.course.id)

    const status = (plan?.status ?? 'draft') as PlanStatus
    const period = resolvePeriod(content, cohort, status)
    const checklist = buildChecklist({
      cohort, period, content, sessions: countableSessions(cohort.sessions),
      assessmentsCount: cohort.assessments.length,
      assessmentModuleIds: cohort.assessments.map((a) => a.moduleId),
      assessmentTypes: cohort.assessments.map((a) => a.type),
      planStatus: status,
    })
    /* الحدودُ المعلَنةُ للمسجَّلين الآن — تُقال بجانب مدّته إن افترقتا */
    const publicPeriod = cohort.startsAt && cohort.endsAt
      ? { startsOn: zonedDay(cohort.startsAt), endsOn: zonedDay(cohort.endsAt) }
      : null

    return {
      role: link.role,
      trainer: { name: profile.application.fullName },
      cohort: {
        id: cohort.id, title: cohort.title, status: cohort.status,
        startsAt: cohort.startsAt, endsAt: cohort.endsAt, daysOfWeek: cohort.daysOfWeek, startTime: cohort.startTime,
        timezone: cohort.timezone, language: cohort.language, deliveryMode: cohort.deliveryMode,
        /* الفصلُ يحكم مدى الشعبة: منه بدؤها وانتهاؤها، وفيه وحدَه تُجدوَل
           لقاءاتُها. ويُرسَل كاملا لا معرّفا — الشاشةُ تعرض اسمَه وحدودَه. */
        termId: cohort.termId, term: cohort.term,
        /* مدّتُه كما تُحكَم، والمعلَنةُ للمسجَّلين — والشاشةُ تقول إن افترقتا */
        period, publicPeriod,
        /* يُقرأ ولا يُكتب — ويُقال ذلك في الشاشة */
        readOnly: { price: cohort.price === null ? null : Number(cohort.price), currency: cohort.currency, capacity: cohort.capacity },
      },
      course: { id: cohort.course.id, titleAr: cohort.course.versions[0]?.titleAr ?? cohort.course.id, baseModules },
      plan: plan
        ? {
            id: plan.id, status, content, reviewerNote: plan.reviewerNote,
            /* لكلّ خطوةٍ ملاحظتُها — تُقرأ في رأس الخطوة نفسِها (٣ب) */
            reviewerNotes: readReviewNotes(plan),
            submittedAt: plan.submittedAt, trainerConfirmedAt: plan.trainerConfirmedAt, reviewedAt: plan.reviewedAt,
          }
        : null,
      sessions: cohort.sessions.map((s) => ({
        id: s.id, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt, status: s.status, moduleId: s.moduleId,
        moduleIds: s.moduleIds, approvalState: s.approvalState,
        placeholder: s.placeholder,
        joinUrl: s.zoom?.joinUrl ?? null,
        recordings: s.recordings.map((r) => ({
          id: r.id, title: r.title, externalUrl: r.externalUrl,
          readUrl: r.storageKey ? this.cohorts.signedReadUrl(r.storageKey) : null,
        })),
      })),
      materials: cohort.materials.map((m) => ({
        id: m.id, title: m.title, kind: m.kind, externalUrl: m.externalUrl,
        readUrl: m.storageKey ? this.cohorts.signedReadUrl(m.storageKey) : null,
      })),
      /* الاسمُ والتقدّم — لا بريدَ ولا رقما: المنصّةُ هي القناة */
      learners: cohort.enrollments.map((e) => ({
        enrollmentId: e.id, name: e.user.displayName, status: e.status, progress: e.courseProgress?.percent ?? 0,
        /* العلامةُ لا المعرّف: من جاء عبر رابط هذا المدرّب */
        referredByMe: e.referralProfileId === profile.id,
      })),
      /* التكاليفُ مع عدد ما سُلّم — لمرحلة «التكاليف» في التجهيز */
      assessments: cohort.assessments.map((a) => ({
        id: a.id, title: a.title, briefAr: a.briefAr, attachments: a.attachments, type: a.type, maxScore: a.maxScore, dueAt: a.dueAt, status: a.status,
        moduleId: a.moduleId,
        submissions: a._count.submissions,
        /* طلبُه على المنشورة وسببُ ردّها — لا يصلان المتعلّم (٣ج-٣) */
        pendingChange: a.pendingChange, reviewerNote: a.reviewerNote,
      })),
      approvedOnce: planApprovedOnce(cohort.plans),
      /* والمعتمَدةُ التي يراجعها — ليقرأ ما غيّره عنها قبل أن يرسل (٣ج-٤) */
      approvedPlan,
      checklist,
    }
  }

  /* ─────────── بطاقاتُ «شعبي» — كلُّ شعبةٍ بحلقة تقدّمها ─────────── */

  /** موجزُ كلّ شعبةٍ مُسنَدةٍ للمدرّب: حالتُها وما أُنجز من تجهيزها وما يليه */
  async summaries(userId: string) {
    const profile = await this.profileOf(userId)
    const links = await this.prisma.cohortTrainer.findMany({
      where: { profileId: profile.id },
      include: {
        cohort: {
          include: {
            course: { include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
            sessions: {
              select: {
                id: true, title: true, startsAt: true, endsAt: true, status: true, placeholder: true, moduleIds: true,
                recordings: { where: { status: 'active' }, select: { id: true } },
              },
            },
            assessments: { where: { status: { not: 'closed' } }, select: { moduleId: true, type: true } },
            plans: { where: { trainerId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1 },
            _count: {
              select: {
                enrollments: { where: { status: { not: 'dropped' } } },
                assessments: { where: { status: { not: 'closed' } } },
              },
            },
          },
        },
      },
      orderBy: { cohort: { startsAt: 'asc' } },
    })
    return links.map((l) => {
      const c = l.cohort
      const plan = c.plans[0] ?? null
      const planStatus = (plan?.status ?? 'draft') as PlanStatus
      const planContent = (plan?.content ?? null) as TrainerPlanContent | null
      const checklist = buildChecklist({
        cohort: c, period: resolvePeriod(planContent, c, planStatus), content: planContent,
        sessions: countableSessions(c.sessions), assessmentsCount: c._count.assessments,
        assessmentModuleIds: c.assessments.map((a) => a.moduleId),
        assessmentTypes: c.assessments.map((a) => a.type), planStatus,
      })
      /* والبطاقةُ تعدّ ما يملك المدرّبُ إنجازَه — لا «الاعتمادَ» ولا «الفصلَ»
         اللذين ليسا بيده. وكانت تعدّ الاعتمادَ، فبطاقةُ شعبةٍ تامّةٍ تقول
         «٥ من ٦» أبدا. والقاعدةُ من `plan-gate` لا تُكتب بيدٍ هنا. */
      const required = trainerOwned(checklist).filter((i) => !i.optional)
      const done = required.filter((i) => i.done).length
      const next = blockingBeforeSubmit(checklist)[0] ?? checklist.find((i) => !i.done) ?? null
      return {
        id: c.id, title: c.title, courseTitle: c.course.versions[0]?.titleAr ?? c.course.id, role: l.role,
        status: c.status, startsAt: c.startsAt, endsAt: c.endsAt,
        learners: c._count.enrollments, sessions: countableSessions(c.sessions).length,
        planStatus, done, total: required.length,
        next: next ? { key: next.key, labelAr: next.labelAr } : null,
      }
    })
  }

  /* ─────────── الكتابة ─────────── */

  /** حفظُ المحتوى مسودّةً — ولا يُكتب فوق ما يُنتظر اعتمادُه */
  async savePlan(userId: string, cohortId: string, content: TrainerPlanContent) {
    const { profile } = await this.ownedCohort(userId, cohortId)
    const latest = await this.latestTrainerPlan(cohortId)
    if (latest?.status === 'submitted') {
      throw new AuthError('plan_submitted', 'خطّتك بانتظار الاعتماد — انتظر القرار، أو اطلب من الإدارة ردَّها إليك لتعديلها', 409)
    }
    /* ═══ المدّةُ تُفحص عند الحفظ — والناقصُ لا يُحفظ نصفا ═══

       من كتب طرفا واحدا لم يحدّد مدّة، ومن كتب نهايةً قبل البداية لم يحدّد
       شيئا. فالطرفان معا أو لا شيء — والخطّةُ بلا مدّةٍ تُحفظ مسودّةً كما
       كانت (بقيّةُ الخطوات لا تنتظر المدّة كي تُحفظ). */
    const hasPeriod = Boolean(content.startsOn || content.endsOn)
    const period = asPeriod(content)
    if (hasPeriod) {
      const cohortRow = await this.prisma.cohort.findUniqueOrThrow({ where: { id: cohortId }, select: { startsAt: true } })
      const problem = periodProblem(content, {
        today: zonedDay(new Date()),
        approvedStart: cohortRow.startsAt ? zonedDay(cohortRow.startsAt) : null,
      })
      if (problem) throw new AuthError('bad_period', problem, 400)
    }
    /* ═══ وموضعُ الجلسة المسجّلة — محورُها ويومُ فتحها — يسري بلا اعتماد (٢٨ سبتمبر ٢٠٢٦) ═══

       يُكتب في الخطّة التي يراها المتعلّمون لحظةَ الحفظ، وما سواه في الحفظ نفسِه
       مراجعةٌ كما كان — والقاعدةُ وعلّتُها في `recorded-links.ts`. وحفظٌ ليس فيه
       غيرُه لا يفتح مراجعةً: لا شيءَ فيها يُقرأ. */
    const visible = await this.prisma.cohortDeliveryPlan.findFirst({
      where: { cohortId, trainerId: { not: null }, status: { in: [...PLAN_VISIBLE_STATUSES] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, content: true },
    })
    if (visible) {
      const approved = visible.content as unknown as TrainerPlanContent
      const placements = recordedPlacements(approved, content)
      if (placements.length > 0) {
        const placed = applyRecordedPlacements(approved, placements)
        const row = await this.prisma.cohortDeliveryPlan.update({
          where: { id: visible.id },
          data: { content: placed as unknown as Prisma.InputJsonValue },
        })
        await recordAudit(this.prisma, {
          actorId: userId, action: 'cohort.plan.recorded_placement', entityType: 'cohort', entityId: cohortId,
          meta: { planId: visible.id, placements },
        })
        if (latest?.id === visible.id && samePlanContent(placed, content)) return row
      }
    }
    const data = { content: content as unknown as Prisma.InputJsonValue }
    const plan = latest && (latest.status === 'draft' || latest.status === 'changes_requested')
      ? await this.prisma.cohortDeliveryPlan.update({ where: { id: latest.id }, data })
      : await this.prisma.cohortDeliveryPlan.create({
          data: { cohortId, trainerId: profile.id, status: 'draft', createdBy: userId, ...data },
        })
    /* ═══ ونافذةُ جدولته تتبع مدّتَه لحظةَ الحفظ ═══

       النافذةُ إذنُ المدرّب أن يجدول، لا موعدٌ يُعلَن لمتعلّم — فلا يلزمها
       اعتماد. ولو انتظرت اعتمادَ الخطّة لَما استطاع أن يجدول لقاءً واحدا
       قبل أن يُرسل خطّةً تشترط لقاءاتِه: الحلقةُ نفسُها التي حبسته وراء
       تسمية الفصل. والحدودُ المعلَنةُ (`startsAt` و`endsAt`) لا تُمَسّ هنا —
       يكتبها الاعتمادُ وحدَه.

       ═══ إلّا المراجعة — «وبعد الاعتماد كلُّ تغييرٍ باعتماد» (٣ج) ═══

       شعبةٌ اعتُمدت لها خطّةٌ قبلُ نافذتُها نافذةُ ما اعتُمد. ومراجعةٌ تمدّ المدّةَ
       أو تنقلها كانت تنقل النافذةَ لحظةَ حفظها — فيجدول المدرّبُ لقاءاتٍ في مدّةٍ
       لم يقرأها أحد. فتبقى النافذةُ كما اعتُمدت، ويكتبها اعتمادُ المراجعة
       (`applyPeriod`). */
    const approvedBefore = await this.prisma.cohortDeliveryPlan.count({
      where: { cohortId, trainerId: { not: null }, status: { in: [...APPROVED_PLAN_STATUSES] } },
    })
    if (period && approvedBefore === 0) {
      const { from, to } = periodBounds(period)
      await this.prisma.cohort.update({
        where: { id: cohortId },
        data: { scheduleWindowStart: from, scheduleWindowEnd: to },
      })
    }
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.plan.save', entityType: 'cohort', entityId: cohortId,
      meta: {
        planId: plan.id, modules: content.modules.length, resources: content.resources.length,
        ...(period ? { period } : {}),
      },
    })
    return plan
  }

  /** تعديلُ صفّ الشعبة — بالمسموح وحدَه، والماليُّ والمواعيدُ تُردّ باسمها */
  async updateCohort(userId: string, cohortId: string, patch: Record<string, unknown>) {
    await this.ownedCohort(userId, cohortId)
    const forbidden = Object.keys(patch).filter((k) => (ADMIN_ONLY_FIELDS as readonly string[]).includes(k))
    if (forbidden.length) {
      throw new AuthError('admin_only_field', `السعرُ والسعةُ والإعدادُ الماليُّ بيد الإدارة — لا يعدّلها المدرّب (${forbidden.join('، ')})`, 403)
    }
    /* والمواعيدُ تمرّ بالخطّة لا من هنا — والعلّةُ عند `SCHEDULE_FIELDS` */
    const scheduled = Object.keys(patch).filter((k) => (SCHEDULE_FIELDS as readonly string[]).includes(k))
    if (scheduled.length) {
      throw new AuthError(
        'period_in_plan',
        'مدّةُ الشعبة تُحفظ مع خطّتها وتُعتمَد معها — من خطوة «المعلومات الأساسيّة». ومواعيدُ اللقاءات لقاءً لقاءً في خطوتها.',
        409,
      )
    }
    const allowed: Record<string, unknown> = {}
    for (const k of TRAINER_EDITABLE_COHORT_FIELDS) if (k in patch) allowed[k] = patch[k]
    if (Object.keys(allowed).length === 0) throw new AuthError('nothing_to_update', 'لا حقلَ يُعدَّل', 400)
    const row = await this.cohorts.update(userId, cohortId, allowed as TrainerCohortPatch)
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.trainer_update', entityType: 'cohort', entityId: cohortId,
      meta: { fields: Object.keys(allowed) },
    })
    return row
  }

  /* ═══ وفصلُ الشعبة لم يعد من شأن المدرّب (١٧ سبتمبر ٢٠٢٦) ═══

     كان هنا `setTerm` و`selectableTerms`. وصحّح صاحبُ المنصّة: الفصلُ حقيقةٌ
     إداريّةٌ تُسمَّى عند إسناد الدورة إلى مدرّبها، لا سؤالٌ يُسأل عنه.

     فانتقل المنطقُ كاملا إلى `CohortService.setTerm` و`openForTrainer` —
     وفي رأسهما العلّةُ والقرارُ بنصّهما. والخطّةُ هنا تقرأ الفصلَ ولا تكتبه. */


  /** «أوافق على كلّ ما في الشعبة» — ثمّ تُرسَل */
  async submit(userId: string, cohortId: string, confirm: boolean) {
    const { profile } = await this.ownedCohort(userId, cohortId)
    if (!confirm) throw new AuthError('confirm_required', 'أكّد أنّك توافق على كلّ ما في الشعبة قبل إرسالها', 400)
    const latest = await this.latestTrainerPlan(cohortId)
    if (!latest) throw new AuthError('no_plan', 'لا محتوى بعد — رتّب المحاورَ والمصادرَ أوّلا', 409)
    if (latest.status === 'submitted') throw new AuthError('already_submitted', 'أُرسلت من قبل وهي بانتظار الاعتماد', 409)
    if (latest.status === 'approved' || latest.status === 'published') {
      throw new AuthError('already_approved', 'هذه الخطّة معتمَدة — عدّلها لتُنشأ نسخةٌ جديدة ثمّ أرسلها', 409)
    }
    const content = latest.content as unknown as TrainerPlanContent
    if (!content?.modules?.length) throw new AuthError('no_modules', 'لا محاورَ في الخطّة — رتّبها أوّلا', 409)

    /* الحاجزُ هنا لا في الزرّ وحدَه: زرٌّ مطفأٌ لا يمنع طلبا يُرسَل بيدٍ
       أخرى. والقاعدةُ من `plan-gate` نفسِها التي تُطفئ الزرَّ — فلا يفترق
       ما تراه الشاشةُ عمّا يقبله الخادم. */
    const gateCohort = await this.prisma.cohort.findUniqueOrThrow({
      where: { id: cohortId },
      select: {
        title: true, startsAt: true, endsAt: true,
        sessions: {
          select: {
            title: true, startsAt: true, endsAt: true, status: true, placeholder: true, moduleIds: true,
            recordings: { select: { id: true } },
          },
        },
        assessments: { where: { status: { not: 'closed' } }, select: { moduleId: true, type: true } },
        _count: { select: { assessments: true } },
      },
    })
    const blocking = blockingBeforeSubmit(buildChecklist({
      cohort: gateCohort,
      period: resolvePeriod(content, gateCohort, latest.status as PlanStatus),
      content,
      sessions: countableSessions(gateCohort.sessions),
      assessmentsCount: gateCohort._count.assessments,
      assessmentModuleIds: gateCohort.assessments.map((a) => a.moduleId),
      assessmentTypes: gateCohort.assessments.map((a) => a.type),
      planStatus: latest.status as PlanStatus,
    }))
    if (blocking.length) {
      throw new AuthError('stages_incomplete', `بقي قبل الإرسال: ${blocking.map((b) => b.labelAr).join(' · ')}`, 409)
    }

    /* ═══ وملاحظاتُ الردّ الأخير تبقى مع الإرسال (٣ب) ═══

       كانت تُمحى هنا، فيفتح المعتمِدُ الخطّةَ المعادةَ ولا يدري ما طلبه منها —
       يقرأ المنهجَ كلَّه ثانيةً ليتذكّر. فتبقى، ويقرؤها في بطاقته «ما طلبتَه
       في الردّ السابق» فيقابلها بما عُدّل. والمدرّبُ لا يراها بعد الإرسال: شاشتُه
       تعرضها ما دامت الخطّةُ مردودةً إليه وحدَه. والاعتمادُ يرفعها. */
    const now = new Date()
    const plan = await this.prisma.cohortDeliveryPlan.update({
      where: { id: latest.id },
      data: { status: 'submitted', submittedAt: now, trainerConfirmedAt: now },
    })
    const cohort = await this.prisma.cohort.findUniqueOrThrow({ where: { id: cohortId }, select: { title: true } })
    await recordAudit(this.prisma, {
      actorId: userId, action: 'cohort.plan.submit', entityType: 'cohort', entityId: cohortId, meta: { planId: plan.id },
    })
    /* من يملك الاعتمادَ يُخبَر — الأكاديميُّ والأعلى معا، وأيُّهما سبق قرّر */
    await notifyRole(this.prisma, ['academic_manager', 'super_admin'], {
      channel: 'in_app',
      title: 'خطّةُ شعبةٍ بانتظار اعتمادك',
      body: `${profile.application.fullName} أرسل خطّةَ «${cohort.title}» وأكّد موافقتَه على كلّ ما فيها — راجعها من بطاقة الشعبة.`,
      templateKey: 'cohort.plan.submitted',
      data: { cohortId, planId: plan.id },
    })
    /* وشعبةُ الإعداد: إرسالُ آخرِ دوراته يُعلن اكتمالَ موادّه (`trainer-prep.service.ts`) */
    const { TrainerPrepService } = await import('./trainer-prep.service')
    await new TrainerPrepService(this.prisma).afterSubmit(cohortId).catch(() => undefined)
    return plan
  }

  /* ─────────── الاعتماد ─────────── */

  /* ═══ «خططٌ تنتظر اعتمادك» — الطابورُ كلُّه في شاشةٍ واحدة (٣ أكتوبر ٢٠٢٦) ═══

     سأل صاحبُ المنصّة: كيف أعتمد كلَّ شعبةٍ أنهى مدرّبُها موادَّها؟ وكان
     الجوابُ أن يفتح شعبةً شعبة. فصار لهذه القائمة شاشتُها
     (`src/pages/admin/PendingPlans.tsx`) — ولها يُقال مع كلّ خطّةٍ اسمُ
     دورتها، ومن مدرّبُها (`trainerProfileId` يجمع خططَه معا)، وأهي **شعبةُ
     إعداد**: اعتمادُها يؤهّله لدورتها، وآخرُها يفعّله ويوقّع عقدَه
     (`trainer-prep.service.ts`). يُقال قبل النقر لا بعده — والحكمُ نفسُه
     الذي يحكم به القرار (`prepContext`)، لا نسخةٌ منه تفترق عنه. */
  async pending() {
    const rows = await this.prisma.cohortDeliveryPlan.findMany({
      where: PENDING_PLAN_WHERE,
      orderBy: { submittedAt: 'asc' },
      include: {
        cohort: {
          select: {
            id: true, title: true, courseId: true,
            course: { select: { versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } } },
          },
        },
        trainer: { select: { id: true, application: { select: { fullName: true } } } },
      },
    })
    const { TrainerPrepService } = await import('./trainer-prep.service')
    const prep = new TrainerPrepService(this.prisma)
    const contexts = await Promise.all(rows.map((p) => prep.prepContext(p.cohort.id).catch(() => null)))
    return rows.map((p, i) => ({
      id: p.id,
      cohort: { id: p.cohort.id, title: p.cohort.title, courseId: p.cohort.courseId },
      courseTitle: p.cohort.course.versions[0]?.titleAr ?? p.cohort.courseId,
      trainerName: p.trainer?.application.fullName ?? '—',
      trainerProfileId: p.trainer?.id ?? null,
      submittedAt: p.submittedAt, trainerConfirmedAt: p.trainerConfirmedAt,
      /* شعبةُ إعداد؟ و`qualifies`: تأهيلُه لدورتها معلّقٌ فيقع باعتمادها،
         و`onboarding`: مدرّبُها في الطور — فقد يفعّله اعتمادُها إن كانت آخرَ ما ينتظر */
      prep: contexts[i] ? { onboarding: contexts[i]!.onboarding, qualifies: contexts[i]!.pending } : null,
    }))
  }

  /** كم خطّةً تنتظر الاعتماد — لشارة القائمة الجانبيّة، بلا جلب الخطط نفسِها */
  async pendingCount() {
    return this.prisma.cohortDeliveryPlan.count({ where: PENDING_PLAN_WHERE })
  }

  /** آخرُ خطّةِ مدرّبٍ لشعبةٍ — لبطاقة الشعبة عند الإدارة */
  async latestForCohort(cohortId: string) {
    const plan = await this.latestTrainerPlan(cohortId)
    if (!plan) return null
    const [trainer, cohort, approvedPlan] = await Promise.all([
      plan.trainerId
        ? this.prisma.trainerProfile.findUnique({ where: { id: plan.trainerId }, select: { application: { select: { fullName: true } } } })
        : null,
      /* ═══ والمنهجُ كاملا للمعتمِد (المرحلة ٣) ═══

         «وهو ما سنقرؤه عند الموافقة» — فالمعتمِدُ يقرأ ما قرأه المدرّبُ قبل
         الإرسال: الخطّةَ ومعها لقاءاتُ الشعبة ومهامُّها، بالصفحة نفسِها
         (`CurriculumReview`). وكانت بطاقتُه تعدّ المصادرَ عدّا، ولا ترى مهمّةً
         ولا لقاءً — فيعتمد منهجا لم يقرأ نصفَه. */
      this.prisma.cohort.findUnique({
        where: { id: cohortId },
        select: {
          title: true, startsAt: true, endsAt: true, joinClosesAt: true,
          /* أاعتُمدت للمدرّب خطّةٌ قطّ — منه يُقال للمعتمِد متى يُفتح التسجيل (٣ج) */
          plans: { where: { trainerId: { not: null } }, select: { status: true } },
          sessions: {
            orderBy: { startsAt: 'asc' },
            select: { id: true, title: true, startsAt: true, endsAt: true, moduleId: true, moduleIds: true, approvalState: true, status: true, placeholder: true },
          },
          assessments: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true, title: true, type: true, dueAt: true, moduleId: true, briefAr: true, attachments: true, status: true,
              maxScore: true, pendingChange: true, reviewerNote: true,
            },
          },
        },
      }),
      /* والمعتمَدةُ التي تراجعها هذه — ليقرأ المعتمِدُ ما تغيّر عنها (٣ج-٤) */
      this.approvedBehind(cohortId, plan),
    ])
    const content = plan.content as TrainerPlanContent | null
    return {
      id: plan.id, status: plan.status, content: plan.content, reviewerNote: plan.reviewerNote,
      reviewerNotes: readReviewNotes(plan),
      submittedAt: plan.submittedAt, trainerConfirmedAt: plan.trainerConfirmedAt, reviewedAt: plan.reviewedAt,
      trainerName: trainer?.application.fullName ?? null,
      cohortTitle: cohort?.title ?? '',
      period: cohort ? resolvePeriod(content, cohort, plan.status as PlanStatus) : null,
      sessions: cohort?.sessions ?? [],
      assessments: cohort?.assessments ?? [],
      /* اعتُمدت له خطّةٌ قطّ — فما يضيفه ويعدّله في مهامّه ينتظر قرارَك (٣ج-٣) */
      approvedOnce: cohort ? planApprovedOnce(cohort.plans) : false,
      /* والمعتمَدةُ التي تراجعها هذه إن كانت مراجعة — منها «ما تغيّر» (٣ج-٤) */
      approvedPlan,
      /* التسجيلُ كما يُحكَم لا كما يقول علمُه: شعبةٌ خطّتُها لم تُعتمَد لا تقبل
         أحدا وإن رُفع العلم، والالتحاقُ يُغلق ببدء الموعد الثاني (٣ج) */
      registration: {
        awaitingPlan: cohort ? awaitingTrainerPlan(cohort.plans) : false,
        joinClosesAt: cohort?.joinClosesAt ?? null,
      },
    }
  }

  /* ═══ القرار — اعتمادٌ واحدٌ للخطّة ولقاءاتها، أو ردٌّ بملاحظةٍ لكلّ خطوة (٣ب) ═══

     `note` نصٌّ واحدٌ كما كان (ويُقرأ ملاحظةً عامّة)، أو ملاحظاتٌ لكلّ خطوةٍ
     في خطوتها. والردُّ يحتاج واحدةً منها على الأقلّ. */
  async decide(actorId: string, planId: string, approve: boolean, note?: string | ReviewNotes) {
    const plan = await this.prisma.cohortDeliveryPlan.findUnique({
      where: { id: planId },
      include: {
        cohort: { select: { id: true, title: true } },
        trainer: { include: { application: { select: { fullName: true, email: true } } } },
      },
    })
    if (!plan) throw new AuthError('not_found', 'الخطّة غير موجودة', 404)
    if (plan.status !== 'submitted') throw new AuthError('not_submitted', 'هذه الخطّة ليست بانتظار قرار', 409)
    const now = new Date()
    /* وكلمةُ الاعتماد — إن كُتبت — نصٌّ واحد */
    const said = (typeof note === 'string' ? note : note?.general)?.trim() || null

    if (!approve) {
      const asked = normalizeReviewNotes(typeof note === 'string' ? { general: note } : note)
      if (!hasReviewNotes(asked)) {
        throw new AuthError('reason_required', 'قل له ما الذي يُعدَّل — في خطوته أو عامّةً. الردُّ بلا سببٍ يترك المدرّبَ يخمّن', 400)
      }
      const composed = composeReviewNote(asked)!
      await this.prisma.cohortDeliveryPlan.update({
        where: { id: planId },
        data: {
          status: 'changes_requested', reviewedBy: actorId, reviewedAt: now,
          reviewerNote: composed, reviewerNotes: asked as Prisma.InputJsonValue,
        },
      })
      await recordAudit(this.prisma, {
        actorId, action: 'cohort.plan.changes_requested', entityType: 'cohort', entityId: plan.cohort.id,
        meta: { planId, note: composed, sections: notedSections(asked) },
      })
      /* والبريدُ يقول الخطواتِ بأسمائها — ما يبحث عنه في شريطه */
      const bySection = REVIEW_SECTIONS.filter((s) => asked[s.key]).map((s) => ({ label: s.label, text: asked[s.key]! }))
      await this.tellTrainer(plan.trainer, plan.cohort, {
        title: `طُلبت تعديلاتٌ على «${plan.cohort.title}»`,
        body: asked.general ?? 'كتبنا ملاحظاتِنا في الخطوات التي تحتاج تعديلا — تجد كلَّ ملاحظةٍ في رأس خطوتها.',
        heading: 'راجعنا خطّةَ شعبتك ونحتاج تعديلا قبل اعتمادها',
        cta: 'عدّل الخطّة وأعد إرسالها',
        sections: bySection,
      }, composed)
      /* وشعبةُ الإعداد: الردُّ يُعيد موادَّه إليه وتُستأنف مهلتُه */
      const { TrainerPrepService } = await import('./trainer-prep.service')
      await new TrainerPrepService(this.prisma).afterDecision(plan.cohort.id, false, actorId, composed).catch(() => undefined)
      return { status: 'changes_requested' as const }
    }

    await this.prisma.$transaction(async (tx) => {
      /* المعتمَدُ الجديدُ يُنزل ما قبله — لا تُقرأ خطّتان معا */
      await tx.cohortDeliveryPlan.updateMany({
        where: { cohortId: plan.cohort.id, id: { not: planId }, status: { in: ['approved', 'published'] } },
        data: { status: 'superseded' },
      })
      await tx.cohortDeliveryPlan.update({
        where: { id: planId },
        data: {
          status: 'approved', reviewedBy: actorId, reviewedAt: now, reviewerNote: said,
          /* ما طُلب قبلُ قد عُدّل واعتُمد — فلا يبقى في شاشةٍ «ملاحظةً» */
          reviewerNotes: Prisma.DbNull,
        },
      })
    })
    const applied = await this.applyPeriod(plan.cohort.id, plan.content as unknown as TrainerPlanContent | null)

    /* ═══ والاعتمادُ واحدٌ: الخطّةُ ولقاءاتُها معا (٣ب) ═══

       كان المعتمِدُ يعتمد الخطّةَ ثمّ يعتمد لقاءاتِها بطاقةً بطاقة — وقد قرأها
       كلَّها في المنهج قبل أن يعتمد. فصار اعتمادُ الخطّة يعتمد كلَّ لقاءٍ
       منتظِرٍ في الشعبة، بالمسلك نفسِه الذي تمرّ به البطاقةُ الواحدة
       (`decideSession`): يُنشأ اجتماعُه، ويُنشَر للمسجَّلين بتاريخه.

       وإنشاءُ الاجتماع قد يسقط (Zoom لا يستجيب). فلا يُسقط اعتمادَ الخطّة:
       يبقى ذلك اللقاءُ منتظِرا في بطاقته تُعاد محاولتُه منها، ويُقال للمعتمِد
       باسمه. والمدرّبُ يصله خبرٌ واحدٌ عن الخطّة ولقاءاتها — لا خبرٌ لكلّ لقاء. */
    const waiting = await this.prisma.cohortSession.findMany({
      where: { cohortId: plan.cohort.id, approvalState: 'pending', placeholder: false, status: { not: 'cancelled' } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, title: true },
    })
    const meetings = { approved: 0, failed: [] as { id: string; title: string; reason: string }[] }
    for (const s of waiting) {
      try {
        await this.cohorts.decideSession(actorId, s.id, true, undefined, { quiet: true })
        meetings.approved += 1
      } catch (e) {
        meetings.failed.push({ id: s.id, title: s.title, reason: e instanceof AuthError ? e.message : 'خطأ غير متوقّع' })
      }
    }

    /* ═══ ومهامُّها كذلك (٣ج-٣) ═══

       بعد أوّل اعتمادٍ ينتظر ما يضيفه المدرّبُ ويعدّله ويحذفه من مهامّه قرارا —
       ومراجعةُ الخطّة تحمله في منهجها. فاعتمادُها يعتمده معها، بالمسلك نفسِه
       الذي تمرّ به المهمّةُ وحدَها. وما يمنعه مانعٌ يبقى منتظِرا ويُسمّى. */
    const tasks = await this.assessments.applyPendingForPlan(actorId, plan.cohort.id, planId)

    await recordAudit(this.prisma, {
      actorId, action: 'cohort.plan.approve', entityType: 'cohort', entityId: plan.cohort.id,
      meta: {
        planId,
        ...(applied ? { period: applied.period, termId: applied.termId, moved: applied.moved } : {}),
        meetingsApproved: meetings.approved,
        ...(meetings.failed.length ? { meetingsFailed: meetings.failed.map((f) => f.id) } : {}),
        ...(tasks.applied ? { tasksApplied: tasks.applied } : {}),
        ...(tasks.failed.length ? { tasksFailed: tasks.failed.map((f) => f.id) } : {}),
      },
    })

    const withMeetings = meetings.approved > 0
      ? ` واعتُمدت معها لقاءاتُك (${meetings.approved}) ووصلت المسجَّلين في تقاويمهم.`
      : ''
    /* والعددُ بين قوسين كعدد المعتمَد — فلا يُكتب «٢ لقاءات» */
    const stillWaiting = meetings.failed.length === 0
      ? ''
      : meetings.failed.length === 1
        ? ' وبقي لقاءٌ واحدٌ عند الإدارة تُتمّ اعتمادَه.'
        : ` وبقيت لقاءاتٌ (${meetings.failed.length}) عند الإدارة تُتمّ اعتمادَها.`
    const withTasks = tasks.applied > 0 ? ` واعتُمد معها ما انتظر من مهامّك (${tasks.applied}).` : ''
    await this.tellTrainer(plan.trainer, plan.cohort, {
      title: `اعتُمدت خطّةُ «${plan.cohort.title}»`,
      body: said || `شعبتك جاهزة — تظهر لك من «شعبي» بمن التحق فيها.${withMeetings}${stillWaiting}${withTasks}`,
      heading: 'اعتُمدت خطّةُ شعبتك — وهي جاهزةٌ الآن',
      cta: 'افتح شعبتك',
    })
    /* ═══ وشعبةُ الإعداد: اعتمادُ خطّتها يعتمد الدورة، ويُفعّل حين تكتمل دوراتُه ═══
       والعلّةُ في `trainer-prep.service.ts`. وما يمنع التفعيلَ يُقال ولا يُسقط
       اعتمادَ الخطّة الذي وقع. */
    const { TrainerPrepService } = await import('./trainer-prep.service')
    const prep: { activated: boolean; waiting?: number; blockedAr?: string } | null =
      await new TrainerPrepService(this.prisma).afterDecision(plan.cohort.id, true, actorId, said)
        .catch((e: unknown) => ({ activated: false, blockedAr: e instanceof AuthError ? e.message : 'تعذّر اعتمادُ الدورة' }))
    return { status: 'approved' as const, meetings, tasks, prep }
  }

  /* ═══ الاعتمادُ يكتب المدّة — والفصلُ يُشتقّ منها ═══

     قبل الاعتماد كانت المدّةُ في الخطّة وحدَها: نافذةُ جدولته تتبعها،
     والمسجَّلون لا يرونها. وبالاعتماد تصير حدودَ الشعبة المعلَنة — وهي ما
     يقرؤه الكتالوجُ وصفحةُ التسجيل و«رحلتي».

     والفصلُ لا يُسأل عنه المدرّب (قرارُ صاحب المنصّة، ٢٧ سبتمبر ٢٠٢٦): هو
     الفصلُ الذي يقع فيه تاريخُ البدء، إن كان فصلٌ حيٌّ يغطّيه. فإن لم يكن
     بقي ما كان — لا تُفرَّغ الشعبةُ من فصلٍ سمّته الإدارةُ لأنّ المدرّبَ
     اختار تاريخا خارجَه؛ وتسميتُه عندها لا عنده.

     ومن حضر الشعبةَ يعلم أنّ حدودَها تحرّكت — إن تحرّكت. */
  private async applyPeriod(cohortId: string, content: TrainerPlanContent | null) {
    const period = asPeriod(content)
    if (!period || periodProblem(period) !== null) return null
    const { from, to } = periodBounds(period)
    const before = await this.prisma.cohort.findUniqueOrThrow({
      where: { id: cohortId }, select: { title: true, startsAt: true, endsAt: true, termId: true },
    })
    const day = new Date(`${period.startsOn}T00:00:00.000Z`)
    const term = await this.prisma.term.findFirst({
      where: { startsOn: { lte: day }, endsOn: { gte: day }, status: { notIn: ['closed', 'cancelled'] } },
      orderBy: { startsOn: 'asc' },
      select: { id: true },
    })
    await this.prisma.cohort.update({
      where: { id: cohortId },
      data: {
        startsAt: from, endsAt: to, scheduleWindowStart: from, scheduleWindowEnd: to,
        /* وآخرُ الالتحاق من مواعيدها — بدءُ الموعد الثاني (٣ج)، يُقرأ في
           `registration-window.ts`. ويُعاد حسابُه مع كلّ مراجعةٍ تُعتمَد */
        joinClosesAt: joinClosesAt(period, (content as { slots?: PlanSlot[] | null } | null)?.slots),
        ...(term ? { termId: term.id } : {}),
      },
    })
    const moved = before.startsAt?.getTime() !== from.getTime() || before.endsAt?.getTime() !== to.getTime()
    if (moved) {
      const learners = await this.prisma.enrollment.findMany({
        where: { cohortId, status: { not: 'dropped' } },
        select: { userId: true },
      })
      const when = fmtDateWith(from, { weekday: 'long', day: 'numeric', month: 'long' })
      const until = fmtDateWith(to, { day: 'numeric', month: 'long' })
      for (const l of learners) {
        await safeNotify(this.prisma, {
          userId: l.userId, channel: 'in_app', audience: 'learner',
          templateKey: 'cohort.schedule_changed',
          title: `تحدّدت مدّةُ «${before.title}»`,
          body: `تبدأ ${when} وتنتهي ${until}. راجِع مواعيدَ لقاءاتها في صفحة رحلتك.`,
          data: { cohortId, fields: ['startsAt', 'endsAt'] },
        })
      }
    }
    return { period, termId: term?.id ?? before.termId, moved }
  }

  /** تذكيرُ المدرّب بأن يُكمل تجهيزَ شعبته — إشعارٌ وبريدٌ معا */
  async remindTrainer(actorId: string, cohortId: string, note?: string) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      include: { trainers: { where: { role: 'lead' }, include: { profile: { include: { application: { select: { fullName: true, email: true } } } } } } },
    })
    if (!cohort) throw new AuthError('not_found', 'الشعبة غير موجودة', 404)
    const lead = cohort.trainers[0]?.profile
    if (!lead) throw new AuthError('no_trainer', 'لا مدرّبَ رئيسا لهذه الشعبة بعد', 409)
    await this.tellTrainer(lead, cohort, {
      title: `تذكير: أكمل تجهيزَ «${cohort.title}»`,
      body: note?.trim() || 'رتّب المحاورَ والمصادرَ ومواعيدَ اللقاءات، ثمّ أكّد موافقتَك وأرسلها للاعتماد.',
      heading: 'شعبتك تنتظر تجهيزَك',
      cta: 'افتح ورشة الشعبة',
    })
    await recordAudit(this.prisma, {
      actorId, action: 'cohort.remind_trainer', entityType: 'cohort', entityId: cohortId, meta: { note: note?.trim() || null },
    })
    return { ok: true }
  }

  /** تسجيلُ جلسةٍ من رابط — لا ملفَّ يُرفع */
  /* ─────────── إخبارُ المدرّب — جرسٌ وبريد ─────────── */

  /* و`sections` ملاحظاتُ الخطوات بأسمائها — قائمةً في البريد تحت التنبيه،
     و`bellBody` نصُّ الجرس إن اختلف عن التنبيه (الردُّ بأقسامه نصٌّ واحد). */
  private async tellTrainer(
    trainer: { userId: string | null; application: { fullName: string; email: string } } | null,
    cohort: { id: string; title: string },
    msg: { title: string; body: string; heading: string; cta: string; sections?: readonly { label: string; text: string }[] },
    bellBody?: string,
  ) {
    if (!trainer) return
    const url = `${publicSiteUrl()}/trainer/cohort/${cohort.id}`
    if (trainer.userId) {
      await safeNotify(this.prisma, {
        audience: 'trainer', userId: trainer.userId, channel: 'in_app',
        title: msg.title, body: bellBody ?? msg.body, templateKey: 'cohort.plan.decision', data: { cohortId: cohort.id },
      })
    }
    await sendDirectEmail(this.prisma, {
      to: trainer.application.email,
      subject: `${msg.title} — أكاديمية وجيز`,
      ...renderMail({
        greetingName: trainer.application.fullName,
        heading: msg.heading,
        blocks: [
          { kind: 'facts', rows: [{ label: 'الشعبة', value: cohort.title }] },
          { kind: 'callout', text: msg.body },
          ...(msg.sections?.length
            ? [{ kind: 'list' as const, items: msg.sections.map((x) => `«${x.label}»: ${x.text}`) }]
            : []),
          { kind: 'cta', label: msg.cta, href: url },
        ],
      }),
    })
  }
}

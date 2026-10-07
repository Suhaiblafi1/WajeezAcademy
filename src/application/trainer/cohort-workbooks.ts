/* الكرّاسة: واحدةٌ للدورة أو لكلّ محورٍ كرّاستُه — والمدرّبُ يختار.

   ═══ القرار (٦ أكتوبر ٢٠٢٦) ═══

   كانت واحدةً للدورة بقرار ٣٠ سبتمبر («اجعل الكرّاسةَ واحدةً فقط وليس لكلّ
   محور»). ثمّ طلب صاحبُ المنصّة أن يُعطى المدرّبُ **خيارين**: كرّاسةً للدورة
   كلِّها — ملفّا واحدا — أو كرّاسةً لكلّ محور، يختار المحورَ ويرفع ملفَّه. وأجاب
   عن ستّة أسئلة:

     ١ — **وله أن يجمع محاورَ في كرّاسةٍ واحدة إن أراد.** فالكرّاسةُ لمحورٍ أو
         لمحاورَ **متجاورة** — كرّاسةٌ للأوّل والثالث بلا الثاني لا تُتّبع محورا محورا.
     ٢ — **وتُفتح كلٌّ بموعد محورها، وللمجموعة أوّلُ يومٍ في أسبق محاورها**
         (`workbookOpensOn`) — كما تُفتح للمتعلّم كرّاسةُ الدورة أوّلَ يومٍ فيها.
     ٣ — **وموضعُ كلّ محورٍ في كرّاسة الدورة اختياريٌّ** («إن أراد») — وكان
         إلزاميّا منذ ٣٠ سبتمبر. فيُكتب ويصل المتعلّمَ إن كُتب، ولا يمنع إن لم يُكتب.
     ٥ — **وما يُرفع PDF وحدَه، والقالبُ Word.** فالمتعلّمُ يقرؤها في الصفحة على
         أيّ جهاز. **والرابطُ يبقى بابا ثانيا** — سُئل فاختار «Keep links allowed
         too». وما رُفع Word قبل القرار يبقى ويُعدّ (لا يُجبَر أحدٌ على إعادة ما تمّ).
     ٦ — **وقالبُ وجيز إلزاميٌّ للجدد، ومستحسَنٌ لمن رفع كرّاسةً من قبل.** والمنصّةُ
         لا تقرأ ملفّا لتعرف أعلى القالب هو — فالإلزامُ **إقرارٌ** يقرّ به المدرّبُ
         لكلّ كرّاسة (`onTemplate`) ويراه المعتمِد. ومن «رفع من قبل» يُعرف بالخادم
         (`TrainerProfile.workbookBeforeTemplate`) لا هنا.

   ═══ ومادّتُه الجاهزة بابٌ ثانٍ (٧ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «ومن عنده PDF جاهز — أنُبقي له أن يرفعه بلا القالب؟». وكان
   الإقرارُ صندوقا واحدا («كتبتُها على قالب وجيز»): فمن عنده مادّةٌ جاهزةٌ إمّا أعاد
   صفَّها على القالب، وإمّا أقرّ بما لم يكن. فعُرضت أربعُ طرقٍ بفروقها، فاختار:
   **«Allow it, reviewer decides»**.

     فصار الإقرارُ **اختيارا** تحت كلّ كرّاسة: «على قالب وجيز» (`onTemplate`) أو
     «مادّتي الجاهزة» (`ownMaterial`) — وأيُّهما تتمّ به الخطوة. والمعتمِدُ يرى
     «مادّةُ المدرّب الجاهزة — ليست على القالب» فيقبلها أو يعيدها بملاحظة: التناسقُ
     يُحكم في المراجعة، لا بسدّ الباب. والإلزامُ (`templateRequired`) صار إلزاما
     **بأن يقول** أيّهما — لا بالقالب نفسِه. ويُقرأ الاختيارُ بـ`workbookMaterialOf`
     ويُكتب بـ`MATERIAL_PATCH` وحدَهما، فلا يجتمع الاثنان في كرّاسة.

     **ومعه قال: «اوضح للمدرب بانه اذا استخدم التمبلت لا يعني نقل الحقوق لنا».**
     فيُقال بجانب القالب، وفي صفحة المدرّب داخلَه، وفي الدليل (`WORKBOOK_RIGHTS_AR`):
     ما يكتبه ملكُه، والقالبُ شكلٌ للتناسق — ولا يُقال أكثرَ ممّا في الاتفاقيّة:
     يبقى ترخيصُ البند 10-3 كما هو، وشكلُ القالب وشعارُه لوجيز (10-1).

   ═══ والشكلُ كما يُحفظ ═══

     `workbookMode`: `course` أو `modules` — وغيابُه `course`، فالخططُ القائمةُ
                     كما هي.
     `workbook`:     كرّاسةُ الدورة كما كانت، وزيد فيها `onTemplate` و`ownMaterial`.
     `workbooks`:    كرّاساتُ المحاور — لكلٍّ `moduleIds` متجاورة.

   والطريقتان تُحفظان معا: من بدّل لا يخسر ما رفعه في الأخرى، وإنّما يُعدّ
   ويصل المتعلّمَ ما في الطريقة المختارة وحدَها. */

import { workbookDone, type CohortWorkbook, type PlanSlot, type SlotWorkbook } from './axis-timeline'
import { levelRequired } from './cohort-level'

export const WORKBOOK_MODES = ['course', 'modules'] as const
export type WorkbookMode = (typeof WORKBOOK_MODES)[number]

/** كرّاسةُ محورٍ أو محاورَ متجاورة */
export interface ModuleWorkbook extends SlotWorkbook {
  moduleIds: string[]
  onTemplate?: boolean | null
  ownMaterial?: boolean | null
}

export interface WorkbookContent {
  workbookMode?: string | null
  workbook?: CohortWorkbook | null
  workbooks?: ModuleWorkbook[] | null
}

export const workbookModeOf = (c: { workbookMode?: string | null } | null | undefined): WorkbookMode =>
  c?.workbookMode === 'modules' ? 'modules' : 'course'

/* ═══ القالب — ملفّاه في `public/templates/` يبنيهما `scripts/workbook-template` ═══ */
export const WORKBOOK_TEMPLATES = {
  course: { href: '/templates/wajeez-workbook-course.docx', download: 'قالب كرّاسة الدورة — وجيز.docx', labelAr: 'قالبُ كرّاسة الدورة' },
  modules: { href: '/templates/wajeez-workbook-module.docx', download: 'قالب كرّاسة المحور — وجيز.docx', labelAr: 'قالبُ كرّاسة المحور' },
} as const

/** قالبُ الكرّاسة مملوءا بخطّة الشعبة (٧ أكتوبر ٢٠٢٦) — للدورة، أو لمحاورَ بعينها.
    يُنزَّل من الخادم بما حُفظ من الخطّة (`workbook-docx.ts`)، والفارغُ يبقى في
    `WORKBOOK_TEMPLATES`. */
export function workbookTemplateHref(cohortId: string, moduleIds?: readonly string[]): string {
  const base = `/api/trainer/cohorts/${encodeURIComponent(cohortId)}/workbook-template`
  return moduleIds?.length ? `${base}?modules=${moduleIds.map(encodeURIComponent).join(',')}` : base
}

/** يُلزَم بأن يقول أعلى القالب كرّاستُه أم مادّتُه الجاهزة؟ ما دامت الخطّةُ في يده — ومن رفع
    كرّاسةً قبل القرار يُستحسَن له (٦ أكتوبر ٢٠٢٦؛ والمادّةُ الجاهزةُ تكفي منذ ٧ أكتوبر) */
export const templateRequired = (planStatus: string, workbookBeforeTemplate: boolean): boolean =>
  levelRequired(planStatus) && !workbookBeforeTemplate

/* ═══ على القالب، أو مادّتُه الجاهزة (٧ أكتوبر ٢٠٢٦) ═══ */
export const WORKBOOK_MATERIALS = ['template', 'own'] as const
export type WorkbookMaterial = (typeof WORKBOOK_MATERIALS)[number]

/** ما قاله المدرّبُ في الكرّاسة — أو `null` إن لم يقل. والقالبُ أوّلا إن اجتمعا في خطّةٍ قديمة */
export const workbookMaterialOf = (w: { onTemplate?: boolean | null; ownMaterial?: boolean | null } | null | undefined): WorkbookMaterial | null =>
  w?.onTemplate === true ? 'template' : w?.ownMaterial === true ? 'own' : null

/** ما يُكتب في الكرّاسة حين يختار — كلٌّ يُطفئ الآخر */
export const MATERIAL_PATCH: Record<WorkbookMaterial, { onTemplate: boolean; ownMaterial: boolean }> = {
  template: { onTemplate: true, ownMaterial: false },
  own: { onTemplate: false, ownMaterial: true },
}

/** ما يُقال للمدرّب عن حقّه فيما يكتبه على القالب — بجانب القالب، وفي صفحة المدرّب داخلَه، وفي
    الدليل. ولا يزيد على الاتفاقيّة: الملكيّةُ له (10-2 و10-3)، وترخيصُ 10-3 كما هو، والقالبُ لوجيز (10-1) */
export const WORKBOOK_RIGHTS_AR = {
  title: 'كرّاستُك ملكُك',
  body: 'ما تكتبه فيها لك، ولك أن تستعمله كما تشاء. واستعمالُ القالب لا ينقل ملكيّتَه إلى وجيز، ولا يغيّر شيئا في الاتفاقيّة: '
    + 'ما فيها عن مادّتك (البند 10) يبقى كما هو — ومنه ترخيصٌ غيرُ حصريٍّ ودائمٌ لوجيز باستعمال ما تعدّه للشعبة وتعديلِه داخل المنصّة '
    + 'لأغراضها التعليميّة (10-3). والقالبُ شكلٌ يجعل كرّاساتِ الدورات متّسقةً للمتعلّم؛ وشكلُه وشعارُه لوجيز.',
} as const

/* ═══ مجموعاتُ المحاور ═══

   كلُّ محورٍ في مجموعةٍ واحدة، بترتيب المحاور، والمجموعةُ متجاورة. وما حُفظ
   يُقرأ بالمحاور كما هي **الآن**: محورٌ حُذف يسقط، ومحورٌ جديدٌ يأخذ كرّاستَه
   فارغة، ومجموعةٌ فرّقها ترتيبٌ جديدٌ تبقى بأوّل ما تجاور منها — وملفُّها معه —
   وما انفصل عنها يأخذ كرّاستَه فارغة. فلا يُحفظ شكلٌ لا يُعرض. */
export function workbookGroups(list: readonly ModuleWorkbook[] | null | undefined, moduleIds: readonly string[]): ModuleWorkbook[] {
  const pos = new Map(moduleIds.map((id, i) => [id, i]))
  const saved = (list ?? [])
    .map((g) => ({ ...g, moduleIds: [...new Set((g.moduleIds ?? []).filter((id) => pos.has(id)))].sort((a, b) => pos.get(a)! - pos.get(b)!) }))
    .filter((g) => g.moduleIds.length > 0)
  const used = new Set<number>()
  const taken = new Set<string>()
  const out: ModuleWorkbook[] = []
  for (let i = 0; i < moduleIds.length; i++) {
    const id = moduleIds[i]
    if (taken.has(id)) continue
    const at = saved.findIndex((g, k) => !used.has(k) && g.moduleIds.includes(id))
    if (at < 0) { out.push({ moduleIds: [id] }); taken.add(id); continue }
    used.add(at)
    const g = saved[at]
    const run: string[] = []
    for (let j = i; j < moduleIds.length && g.moduleIds.includes(moduleIds[j]) && !taken.has(moduleIds[j]); j++) {
      run.push(moduleIds[j])
      taken.add(moduleIds[j])
    }
    out.push({ ...g, moduleIds: run })
  }
  return out
}

/** اجمع المجموعةَ `i` والتي تليها في كرّاسةٍ واحدة — ويبقى ملفُّ الأسبق إن كان، وإلّا ملفُّ التالية */
export function mergeWithNext(groups: readonly ModuleWorkbook[], i: number): ModuleWorkbook[] {
  const a = groups[i]
  const b = groups[i + 1]
  if (!a || !b) return [...groups]
  const keep = workbookDone(a) || !workbookDone(b) ? a : b
  return [...groups.slice(0, i), { ...keep, title: keep.title ?? (keep === a ? b.title : a.title) ?? null, moduleIds: [...a.moduleIds, ...b.moduleIds] }, ...groups.slice(i + 2)]
}

/** افصل المجموعةَ `i` كرّاسةً لكلّ محور — وملفُّها يبقى مع أوّلها */
export function splitGroup(groups: readonly ModuleWorkbook[], i: number): ModuleWorkbook[] {
  const g = groups[i]
  if (!g || g.moduleIds.length < 2) return [...groups]
  const [first, ...rest] = g.moduleIds
  return [...groups.slice(0, i), { ...g, moduleIds: [first] }, ...rest.map((id) => ({ moduleIds: [id] })), ...groups.slice(i + 1)]
}

/** أوّلُ يومٍ تُفتح فيه للمتعلّم — أوّلُ يومٍ في موعد أسبق محاورها، أو `null` إن لم تُوزَّع */
export function workbookOpensOn(g: Pick<ModuleWorkbook, 'moduleIds'>, slots: readonly PlanSlot[] | null | undefined): string | null {
  const days = (slots ?? []).filter((s) => s.moduleIds.some((id) => g.moduleIds.includes(id))).map((s) => s.startsOn).sort()
  return days[0] ?? null
}

/** ما بعد «كرّاسةُ»: «المحور 2» أو «المحورين 2 و3» أو «المحاور 2–4» — مجرورا، والمجموعةُ
    متجاورةٌ فتُقال مدًى. وبأرقام المحاور كما في بقيّة الشاشة. */
export function groupLabelAr(g: Pick<ModuleWorkbook, 'moduleIds'>, moduleIds: readonly string[]): string {
  const nums = g.moduleIds.map((id) => moduleIds.indexOf(id) + 1).filter((n) => n > 0)
  if (nums.length === 0) return 'بلا محور'
  if (nums.length === 1) return `المحور ${nums[0]}`
  if (nums.length === 2) return `المحورين ${nums[0]} و${nums[1]}`
  return `المحاور ${nums[0]}–${nums[nums.length - 1]}`
}

/** لم يقل أعلى القالب هي أم مادّتُه الجاهزة؟ — ويُعدّ لما رُفع، فلا يُسأل عن كرّاسةٍ لم تُرفع */
const materialUnsaid = (w: { onTemplate?: boolean | null; ownMaterial?: boolean | null } | null | undefined) => workbookMaterialOf(w) === null

/** كرّاساتُ الطريقة المختارة التي رُفعت بمادّة المدرّب الجاهزة — يُسمّيها رأسُ المراجعة للمعتمِد
    ليقبلها أو يعيدها بملاحظة (٧ أكتوبر ٢٠٢٦). وما في الطريقة الأخرى محفوظٌ لا يصل، فلا يُسمّى */
export function ownMaterialLabels(content: WorkbookContent | null | undefined, moduleIds: readonly string[]): string[] {
  if (workbookModeOf(content) === 'course') {
    const wb = content?.workbook ?? null
    return workbookDone(wb) && workbookMaterialOf(wb) === 'own' ? ['كرّاسةُ الدورة'] : []
  }
  return workbookGroups(content?.workbooks, moduleIds)
    .filter((g) => workbookDone(g) && workbookMaterialOf(g) === 'own')
    .map((g) => `كرّاسةُ ${groupLabelAr(g, moduleIds)}`)
}

/* ═══ ما ينقص الخطوة — يقرؤه الخادمُ (قائمةُ التجهيز) والشاشةُ معا ═══ */
export function workbooksProblems(
  content: WorkbookContent | null | undefined,
  moduleIds: readonly string[],
  opts: { templateRequired: boolean },
): string[] {
  const out: string[] = []
  if (workbookModeOf(content) === 'course') {
    const wb = content?.workbook ?? null
    if (!workbookDone(wb)) out.push('ضع كرّاسةَ الدورة — ملفَّ PDF أو رابطا يضمّ المحاورَ كلَّها')
    else if (opts.templateRequired && materialUnsaid(wb)) out.push('قل في كرّاسة الدورة: على قالب وجيز، أم مادّتُك الجاهزة')
    return out
  }
  if (moduleIds.length === 0) return ['اكتب محاورك في «المحاور ومواعيدها» أوّلا — فلكلّ محورٍ كرّاستُه']
  const groups = workbookGroups(content?.workbooks, moduleIds)
  const empty = groups.filter((g) => !workbookDone(g))
  if (empty.length > 0) out.push(`ضع كرّاسةَ ${empty.map((g) => groupLabelAr(g, moduleIds)).join('، و')} — ملفَّ PDF أو رابطا`)
  const unsure = groups.filter((g) => workbookDone(g) && materialUnsaid(g))
  if (opts.templateRequired && unsure.length > 0) {
    out.push(`قل في كرّاسة ${unsure.map((g) => groupLabelAr(g, moduleIds)).join('، و')}: على قالب وجيز، أم مادّتُك الجاهزة`)
  }
  return out
}

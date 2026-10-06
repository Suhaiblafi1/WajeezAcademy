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

   ═══ والشكلُ كما يُحفظ ═══

     `workbookMode`: `course` أو `modules` — وغيابُه `course`، فالخططُ القائمةُ
                     كما هي.
     `workbook`:     كرّاسةُ الدورة كما كانت، وزيد فيها `onTemplate`.
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

/** يُلزَم بإقرار القالب؟ ما دامت الخطّةُ في يده — ومن رفع كرّاسةً قبل القرار يُستحسَن له */
export const templateRequired = (planStatus: string, workbookBeforeTemplate: boolean): boolean =>
  levelRequired(planStatus) && !workbookBeforeTemplate

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

/** أعلى قالب وجيز؟ — ويُعدّ لما رُفع، فلا إقرارَ على كرّاسةٍ لم تُرفع */
const templateMissing = (w: { onTemplate?: boolean | null } | null | undefined) => w?.onTemplate !== true

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
    else if (opts.templateRequired && templateMissing(wb)) out.push('أقِرّ بأنّ كرّاسةَ الدورة على قالب وجيز')
    return out
  }
  if (moduleIds.length === 0) return ['اكتب محاورك في «المحاور ومواعيدها» أوّلا — فلكلّ محورٍ كرّاستُه']
  const groups = workbookGroups(content?.workbooks, moduleIds)
  const empty = groups.filter((g) => !workbookDone(g))
  if (empty.length > 0) out.push(`ضع كرّاسةَ ${empty.map((g) => groupLabelAr(g, moduleIds)).join('، و')} — ملفَّ PDF أو رابطا`)
  const unsure = groups.filter((g) => workbookDone(g) && templateMissing(g))
  if (opts.templateRequired && unsure.length > 0) {
    out.push(`أقِرّ بأنّ كرّاسةَ ${unsure.map((g) => groupLabelAr(g, moduleIds)).join('، و')} على قالب وجيز`)
  }
  return out
}

/* ═══ خطّةُ الشعبة حزمةً تُنزَّل للمراجعة (٧ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: زرُّ تنزيلٍ في شاشة الإدارة، تُنزَّل به خطّةُ المدرّب
   كاملةً لتُراجَع خارجَ المنصّة — المحاورُ ومواعيدُها، واللقاءاتُ وتوقيتُها،
   والمصادرُ، والكرّاسة، والمهامُّ ومشروعُ التخرّج — ثمّ يُكتب للمدرّب ما يُعدَّل
   وما يُقترح. واختاره على بديلَين عُرضا معه: طباعةُ الشاشة خطّةً خطّة (يدويٌّ ولا
   يحمل الملفّات)، ونصٌّ يُشغَّل على الخادم (يحتاج من يدخله).

   فالحزمةُ ثلاثة:
   · `خطة-الشعبة.md` — يقرؤها إنسانٌ أو مساعدٌ بالترتيب الذي تُقرأ به الشاشة
     (`curriculumView` نفسُه — لا ترتيبٌ ثانٍ يفترق عنها)؛
   · `plan.json` — ما أعاده الخادمُ بلا تأويل، لمن أراد الأصل؛
   · `files/` — كلُّ ملفٍّ رفعه المدرّبُ في الخطّة باسمٍ يُقرأ («المحور ٢ — …»)
     لا بمفتاح تخزين.

   وفي رأس الملفّ «حقائقُ المراجعة»: ما تُبنى عليه قواعدُ الموسم ولا يُرى في
   الشاشة إلّا متفرّقا — يومُ انتهاء الشعبة، وآخرُ لقاءٍ مباشر، وموعدُ مشروع
   التخرّج، وإلى متى يبقى للمتعلّم أن يقرأ. تُقال حقائقَ لا أحكاما: الحكمُ لمن
   يراجع، والقاعدةُ قرارُ صاحب المنصّة لا هذا الملفّ.

   والبناءُ هنا محضٌ بلا قرصٍ ولا قاعدة فيُختبر وحدَه (`plan-review-bundle.test.ts`)،
   والخادمُ يجمع مدخلَه ويقرأ الملفّاتِ ويضغطها (`plan-review-bundle.service.ts`). */

import { periodDays, zonedClock, type CohortPeriod } from './cohort-period'
import { curriculumView, type CurriculumInput, type CurriculumResource, type CurriculumTask, type CurriculumView } from './curriculum-view'
import { cohortDayAr, cohortWindow, whenAr } from '../learning/cohort-gate'
import { sessionMinutes, slotLabelAr } from './session-length'
import { proposedTask, readTaskChange, taskValues, type TaskAttachment } from './task-approval'
import { PLAN_AR } from './plan-decision'
import { REVIEW_SECTIONS, type ReviewNotes } from './review-notes'
import { resourceKind, type ResourceKind } from './plan-overlay'
import type { CohortWorkbook, PlanSlot } from './axis-timeline'
import { groupLabelAr, workbookGroups, workbookModeOf, type ModuleWorkbook, type WorkbookMaterial } from './cohort-workbooks'

export type ReviewSession = CurriculumInput['sessions'][number] & {
  noteAr?: string | null
  attachmentKey?: string | null
  attachmentName?: string | null
}

export interface ReviewBundleInput {
  /** اسمُ الدورة في الكتالوج — والشعبةُ قد تحمل اسما غيرَه */
  courseTitle: string | null
  cohortTitle: string
  trainerName: string | null
  status: string
  submittedAt: string | Date | null
  period: CohortPeriod | null
  content: unknown
  sessions: readonly ReviewSession[]
  assessments: CurriculumInput['assessments']
  approvedOnce?: boolean
  /** ملاحظاتُ آخر ردٍّ إن كان — ليُقابَل بها ما عُدّل */
  reviewerNotes?: ReviewNotes
  /** لحظةُ التنزيل — تُمرَّر فيُختبر بلا ساعة */
  now?: Date
}

/** ملفٌّ في الحزمة — مفتاحُه في المخزن ومسارُه المقروء فيها */
export interface BundleFile {
  key: string
  path: string
}

/** ما لم يدخل الحزمةَ وسببُه — يُقال في الملفّ لا يُسكت عنه */
export type SkippedFiles = ReadonlyMap<string, string>

const KIND_AR: Record<ResourceKind, string> = {
  link: 'رابط', video: 'فيديو', book: 'كتاب', audiobook: 'كتاب صوتيّ', social: 'منشور', file: 'ملفّ',
}
const TASK_TYPE_AR: Record<string, string> = { assignment: 'واجب', quiz: 'اختبار', project: 'مشروع' }
/** ما قاله المدرّبُ في كرّاسته (`cohort-workbooks.ts`) — بكلمات «المراجعة» نفسِها */
const MATERIAL_AR: Record<WorkbookMaterial, string> = {
  template: 'على قالب وجيز',
  own: 'مادّةُ المدرّب الجاهزة — ليست على القالب',
}
const materialAr = (m: WorkbookMaterial | null) => (m ? MATERIAL_AR[m] : 'لم يقل أعلى القالب هي')

const text = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s : null
}

/* ═══ اسمٌ يقبله كلُّ نظام ملفّات ═══
   ما يأتي من المدرّب نصٌّ حرّ: فيه `/` يصنع مجلّدا لم يُقصد، و`..` يُقرأ صعودا،
   و`:` و`?` يرفضها ويندوز. فيُستبدل بها فراغ، ويُقصّ الطولُ بالحروف لا بالبايتات كي لا
   يُشطر حرفٌ عربيٌّ أو رمزٌ في منتصفه. */
export function safeName(s: string, max = 80): string {
  /* ومحارفُ التحكّم (سطرٌ جديد، جدولة…) تُستبدل حرفا حرفا — لا نمطٌ يحملها */
  const visible = Array.from(s, (ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch)).join('')
  const clean = visible
    .replace(/[/\\:*?"<>|]+/g, ' ')
    .replace(/\.{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .trim()
  const cut = Array.from(clean).slice(0, max).join('').trim()
  return cut || 'ملف'
}

/** «المحور ٢ — هدر.pdf»: الوصفُ ثمّ اسمُ الملفّ الأصليّ، والامتدادُ لا يُقصّ */
function fileName(label: string, original: string | null | undefined): string {
  const name = text(original) ?? 'ملف'
  const ext = /\.[A-Za-z0-9]{1,8}$/.exec(name)?.[0] ?? ''
  const base = ext ? name.slice(0, -ext.length) : name
  return `${safeName(`${label} — ${base}`, 100)}${ext}`
}

/* ═══ ملفّاتُ الخطّة كلُّها — بترتيب المنهج ═══
   الكرّاسة، ثمّ لكلّ محورٍ ملفُّه، ثمّ المصادرُ المرفوعة، ثمّ مرفقاتُ اللقاءات
   والمهامّ. والمفتاحُ الواحدُ يدخل مرّةً واحدة، والمساران المتطابقان يُفرَّقان
   برقم — فلا يكتب ملفٌّ فوق آخر داخل الحزمة. */
export function bundleFiles(input: ReviewBundleInput): BundleFile[] {
  const c = (input.content ?? {}) as {
    modules?: { moduleId: string; titleAr?: string | null; bodyFileKey?: string | null; bodyFileName?: string | null }[]
    resources?: { title?: string | null; moduleId?: string | null; bodyFileKey?: string | null; bodyFileName?: string | null }[]
    workbook?: CohortWorkbook | null
    workbookMode?: string | null
    workbooks?: ModuleWorkbook[] | null
    slots?: PlanSlot[] | null
  }
  const modules = Array.isArray(c.modules) ? c.modules : []
  const pos = new Map(modules.map((m, i) => [m.moduleId, i + 1]))
  const axisLabel = (id: string | null | undefined) => (id && pos.has(id) ? `المحور ${pos.get(id)}` : 'للشعبة كلها')

  const out: BundleFile[] = []
  const seenKeys = new Set<string>()
  const seenPaths = new Set<string>()
  const add = (key: string | null | undefined, folder: string, label: string, original: string | null | undefined) => {
    const k = text(key)
    if (!k || seenKeys.has(k)) return
    seenKeys.add(k)
    const name = fileName(label, original)
    let path = `files/${folder ? `${folder}/` : ''}${name}`
    for (let n = 2; seenPaths.has(path); n += 1) {
      const ext = /\.[A-Za-z0-9]{1,8}$/.exec(name)?.[0] ?? ''
      path = `files/${folder ? `${folder}/` : ''}${name.slice(0, name.length - ext.length)} (${n})${ext}`
    }
    seenPaths.add(path)
    out.push({ key: k, path })
  }

  /* الكرّاسةُ بالطريقة التي اختارها — واحدةٌ للدورة أو لكلّ محور (٦ أكتوبر ٢٠٢٦). وما في
     الطريقة الأخرى محفوظٌ لا يصل المتعلّم ولا يُعتمَد، فلا يدخل الحزمة */
  if (workbookModeOf(c) === 'modules') {
    const ids = modules.map((m) => m.moduleId)
    for (const g of workbookGroups(c.workbooks, ids)) add(g.bodyFileKey, 'كراسات', `كراسة ${groupLabelAr(g, ids)}`, g.bodyFileName)
  } else {
    add(c.workbook?.bodyFileKey, '', 'الكراسة', c.workbook?.bodyFileName)
  }
  ;(Array.isArray(c.slots) ? c.slots : []).forEach((s, i) => add(s.workbook?.bodyFileKey, '', `كراسة الموعد ${i + 1}`, s.workbook?.bodyFileName))
  for (const m of modules) add(m.bodyFileKey, 'محاور', `المحور ${pos.get(m.moduleId)} — ${text(m.titleAr) ?? ''}`, m.bodyFileName)
  for (const r of Array.isArray(c.resources) ? c.resources : []) {
    add(r.bodyFileKey, 'مصادر', `${axisLabel(r.moduleId)} — ${text(r.title) ?? 'مصدر'}`, r.bodyFileName)
  }
  for (const s of input.sessions) add(s.attachmentKey, 'لقاءات', text(s.title) ?? 'لقاء', s.attachmentName)
  for (const a of input.assessments) {
    for (const att of effectiveTask(a).attachments) add(att.bodyFileKey, 'مهام', `${a.title} — ${att.title}`, att.bodyFileName)
  }
  return out
}

/** المهمّةُ كما تُعتمَد — بما طُلب فيها بعد الاعتماد إن كان، كما يقرؤها `curriculumView` */
function effectiveTask(a: CurriculumInput['assessments'][number]) {
  return proposedTask(taskValues({ ...a, maxScore: a.maxScore ?? 0 }), readTaskChange(a.pendingChange))
}

/* ═══ النصُّ — Markdown يُقرأ بالعين وبالآلة ═══ */

/** متنٌ حرٌّ اقتباسا — فسطرٌ يبدأ بـ`#` في كلام المدرّب لا يصير عنوانا في الملفّ */
function quote(s: string): string {
  return s.split(/\r?\n/).map((l) => `> ${l}`).join('\n')
}

const weeksAr = (w: number) => (w === 1 ? 'أسبوع' : w === 2 ? 'أسبوعين' : w <= 10 ? `${w} أسابيع` : `${w} أسبوعا`)
/** «ساعتان» · «٣ ساعات» · «٢.٥ ساعة» — والكسرُ يُقرأ بالمفرد */
const hoursAr = (mins: number) => {
  const h = Math.round((mins / 60) * 10) / 10
  if (h === 1) return 'ساعة واحدة'
  if (h === 2) return 'ساعتان'
  return Number.isInteger(h) && h >= 3 && h <= 10 ? `${h} ساعات` : `${h} ساعة`
}

/** «الثلاثاء ١٤ يناير، ٦:٠٠ مساءً — إلى ٨:٠٠ مساءً (ساعتان)» بتوقيت عمّان */
function meetingWhen(startsAt: string, endsAt: string | null): string {
  if (!endsAt) return whenAr(startsAt)
  const mins = sessionMinutes(startsAt, endsAt)
  return `${whenAr(startsAt)} — إلى ${slotLabelAr(zonedClock(endsAt))}${mins !== null && mins > 0 ? ` (${hoursAr(mins)})` : ''}`
}

export function reviewMarkdown(input: ReviewBundleInput, files: readonly BundleFile[], skipped: SkippedFiles = new Map()): string {
  const now = input.now ?? new Date()
  const view = curriculumView({
    title: input.cohortTitle, period: input.period, content: input.content,
    sessions: input.sessions, assessments: input.assessments, approvedOnce: input.approvedOnce, now,
  })
  const pathOf = new Map(files.map((f) => [f.key, f.path]))
  /** أين الملفُّ في الحزمة — أو لماذا ليس فيها */
  const fileRef = (key: string | null | undefined): string => {
    const k = text(key)
    if (!k) return ''
    const why = skipped.get(k)
    if (why) return `ملفٌّ مرفوع لم يدخل الحزمة (${why})`
    const p = pathOf.get(k)
    return p ? `ملفٌّ مرفوع: \`${p}\`` : 'ملفٌّ مرفوع'
  }
  const sessionById = new Map(input.sessions.map((s) => [s.id, s]))
  const taskById = new Map(input.assessments.map((a) => [a.id, a]))

  const L: string[] = []
  const line = (s = '') => L.push(s)

  line(`# خطة شعبة: ${input.cohortTitle}`)
  line()
  if (input.courseTitle && input.courseTitle !== input.cohortTitle) line(`- **الدورة في الكتالوج:** ${input.courseTitle}`)
  line(`- **المدرّب:** ${input.trainerName ?? '—'}`)
  line(`- **حالة الخطة:** ${PLAN_AR[input.status] ?? input.status}`)
  if (input.submittedAt) line(`- **أُرسلت للاعتماد:** ${whenAr(input.submittedAt)}`)
  line(`- **نُزّلت للمراجعة:** ${whenAr(now)}`)
  line('- الأوقاتُ كلُّها بتوقيت عمّان.')
  line()

  /* ═══ حقائقُ المراجعة ═══ */
  line('## حقائق المراجعة')
  line()
  facts(view, input).forEach((f) => line(`- ${f}`))
  line()

  if (view.summaryAr) {
    line('## نبذة الشعبة')
    line()
    line(quote(view.summaryAr))
    line()
  }

  /* ═══ الكرّاسة ═══ */
  line('## الكراسة')
  line()
  if (view.workbookMode === 'modules') {
    line('- **الطريقة:** كرّاسةٌ لكلّ محورٍ أو لمحاورَ متجاورة')
    for (const w of view.moduleWorkbooks) {
      const parts = w.done
        ? [w.title, w.fileKey ? fileRef(w.fileKey) : null, w.url, materialAr(w.material)].filter(Boolean)
        : ['لم تُوضع بعد']
      line(`- **${w.label}:** ${parts.join(' · ')}`)
    }
  } else if (view.workbook) {
    line('- **الطريقة:** كرّاسةٌ واحدةٌ للدورة')
    if (view.workbook.title) line(`- **اسمها:** ${view.workbook.title}`)
    if (view.workbook.fileKey) line(`- ${fileRef(view.workbook.fileKey)}`)
    if (view.workbook.url) line(`- **رابطها:** ${view.workbook.url}`)
    line(`- **شكلها:** ${materialAr(view.workbook.material)}`)
    const where = view.groups.flatMap((g) => g.axes).filter((a) => a.workbookWhere)
    if (where.length) line(`- **أين يبدأ كلُّ محور فيها:** ${where.map((a) => `المحور ${a.n}: ${a.workbookWhere}`).join(' · ')}`)
  } else if (view.groups.some((g) => g.workbook)) {
    line('- كرّاسةٌ لكلّ موعد (خطّةٌ أُرسلت قبل الكرّاسة الواحدة) — مذكورةٌ في مواعيدها أدناه.')
  } else {
    line('- لم تُوضع بعد.')
  }
  line()

  /* ═══ المحاورُ بمواعيدها ═══ */
  line('## المحاور ومواعيدها')
  line()
  view.groups.forEach((g, i) => {
    const when = g.startsOn && g.endsOn ? ` · من ${cohortDayAr(g.startsOn)} إلى ${cohortDayAr(g.endsOn)}` : ''
    line(`### ${view.bySlot && g.startsOn ? `الموعد ${i + 1} — ` : ''}${g.label}${when}`)
    line()
    for (const a of g.axes) {
      line(`#### المحور ${a.n}: ${a.title}`)
      line()
      line(`- **مخرَج المحور:** ${a.outcome ?? '—'}`)
      line(`- **التطبيق العملي:** ${a.activity ?? '—'}`)
      line(`- **ما يسلّمه المتعلّم:** ${a.artifact ?? '—'}`)
      if (a.workbookWhere) line(`- **موضعه في الكراسة:** ${a.workbookWhere}`)
      if (a.bodyFile) line(`- **المحتوى النظري:** ${fileRef(a.bodyFile.key)}`)
      if (a.body) {
        line(`- **المحتوى النظري (${a.bodyWords} كلمة):**`)
        line()
        line(quote(a.body))
      }
      if (!a.body && !a.bodyFile) line('- **المحتوى النظري:** —')
      line()
    }
    if (g.workbook) {
      line(`- **كراسة هذا الموعد:** ${[g.workbook.title, g.workbook.url, g.workbook.fileKey ? fileRef(g.workbook.fileKey) : null].filter(Boolean).join(' · ')}`)
      line()
    }
    meetingsBlock(g.meetings, g.recordings)
    tasksBlock(g.tasks)
    resourcesBlock(g.resources)
  })

  if (view.general.meetings.length || view.general.tasks.length || view.general.resources.length) {
    line('## للشعبة كلها — ما لا محور له')
    line()
    meetingsBlock(view.general.meetings, [])
    tasksBlock(view.general.tasks)
    resourcesBlock(view.general.resources)
  }

  /* وما طُلب في الردّ السابق — يُقابَل بما عُدّل */
  const notes = input.reviewerNotes ?? {}
  const noted = [{ key: 'general' as const, label: 'ملاحظة عامة' }, ...REVIEW_SECTIONS].filter((s) => text(notes[s.key]))
  if (noted.length) {
    line('## ملاحظات الإدارة في الرد السابق')
    line()
    for (const s of noted) {
      line(`**${s.label}:**`)
      line()
      line(quote(notes[s.key]!.trim()))
      line()
    }
  }

  line('## ملفات هذه الحزمة')
  line()
  if (files.length === 0) line('- لم يرفع المدرّبُ ملفّا في هذه الخطة — ما فيها روابطُ ونصوص.')
  for (const f of files) {
    const why = skipped.get(f.key)
    line(why ? `- ~~${f.path}~~ — لم يدخل: ${why}` : `- \`${f.path}\``)
  }
  line()
  return L.join('\n')

  function meetingsBlock(list: CurriculumView['groups'][number]['meetings'], recordings: CurriculumView['groups'][number]['recordings']) {
    if (list.length) {
      line('**اللقاءات المباشرة:**')
      line()
      for (const m of list) {
        const s = sessionById.get(m.id)
        const state = m.state === 'approved' ? 'معتمَد' : m.state === 'held' ? 'انعقد' : 'بانتظار الاعتماد'
        const parts = [
          `**${m.title}**`,
          meetingWhen(m.startsAt, m.endsAt),
          m.axes.length > 1 ? `للمحاور ${m.axes.join(' و')}` : m.axes.length ? `للمحور ${m.axes[0]}` : null,
          state,
        ].filter(Boolean)
        line(`- ${parts.join(' · ')}`)
        if (text(s?.noteAr)) line(`  - ملاحظته: ${text(s?.noteAr)!.replace(/\s*\n\s*/g, ' ')}`)
        if (text(s?.attachmentKey)) line(`  - مرفقه: ${fileRef(s?.attachmentKey)}`)
      }
      line()
    }
    if (recordings.length) {
      line('**الجلسات المسجّلة:**')
      line()
      for (const r of recordings) {
        line(`- **${r.title}**${r.url ? ` · ${r.url}` : ''}${r.opensAt ? ` · تُفتح ${whenAr(r.opensAt)}` : ' · تُفتح مع أول يوم'}`)
      }
      line()
    }
  }

  function tasksBlock(list: readonly CurriculumTask[]) {
    if (!list.length) return
    line('**المهام:**')
    line()
    for (const t of list) {
      const a = taskById.get(t.id)
      const v = a ? effectiveTask(a) : null
      const head = [
        `**[${TASK_TYPE_AR[t.type] ?? t.type}] ${t.title}**`,
        t.dueAt ? `آخر موعدها ${whenAr(t.dueAt)}` : 'بلا آخر موعد',
        v && v.maxScore > 0 ? `الدرجة العظمى ${v.maxScore}` : null,
        t.review === 'new' ? 'جديدة — تنتظر الاعتماد' : t.review === 'edit' ? 'معدَّلة — تنتظر الاعتماد' : t.review === 'remove' ? 'تُحذف باعتمادها' : null,
      ].filter(Boolean)
      line(`- ${head.join(' · ')}`)
      if (t.briefAr) {
        line('  - التعليمات:')
        line()
        line(quote(t.briefAr).split('\n').map((l) => `    ${l}`).join('\n'))
        line()
      }
      for (const att of v?.attachments ?? []) line(`  - مرفق: ${attachmentRef(att)}`)
    }
    line()
  }

  function attachmentRef(att: TaskAttachment): string {
    return att.bodyFileKey ? `${att.title} — ${fileRef(att.bodyFileKey)}` : `${att.title} — ${att.url}`
  }

  function resourcesBlock(list: readonly CurriculumResource[]) {
    if (!list.length) return
    line('**المصادر:**')
    line()
    for (const r of list) {
      const parts = [
        `**[${KIND_AR[resourceKind(r.kind)]}] ${r.title}**`,
        r.url,
        r.fileKey ? fileRef(r.fileKey) : null,
        r.preReading ? 'قراءةٌ مسبقة' : null,
      ].filter(Boolean)
      line(`- ${parts.join(' · ')}`)
      if (r.noteAr) line(`  - ملاحظة: ${r.noteAr.replace(/\s*\n\s*/g, ' ')}`)
    }
    line()
  }
}

/* ═══ حقائقُ المراجعة — أرقامٌ وأيّامٌ تُحسب ولا تُحكم ═══ */
function facts(view: CurriculumView, input: ReviewBundleInput): string[] {
  const out: string[] = []
  const p = input.period
  if (p) {
    const days = periodDays(p)
    const weeks = Math.round(days / 7)
    out.push(`**مدة الشعبة:** من ${cohortDayAr(p.startsOn)} إلى ${cohortDayAr(p.endsOn)} — ${days} يوما${weeks >= 1 ? ` (نحو ${weeksAr(weeks)})` : ''}`)
  } else {
    out.push('**مدة الشعبة:** لم تُحدَّد بعد')
  }
  if (view.levelAr) out.push(`**المستوى:** ${view.levelAr}`)
  if (view.audienceAr.stages) out.push(`**لمن:** ${view.audienceAr.stages}`)
  if (view.audienceAr.goals) out.push(`**الهدف:** ${view.audienceAr.goals}`)
  out.push(`**المحاور:** ${view.counts.axes}${view.bySlot ? ` في ${view.groups.filter((g) => g.startsOn).length} مواعيد` : ''}`)

  const meetings = [...view.groups.flatMap((g) => g.meetings), ...view.general.meetings]
    .slice()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  if (meetings.length) {
    const minutes = meetings.reduce((sum, m) => sum + Math.max(0, (m.endsAt ? sessionMinutes(m.startsAt, m.endsAt) : 0) ?? 0), 0)
    const last = meetings[meetings.length - 1]!
    out.push(`**اللقاءات المباشرة:** ${meetings.length}${minutes > 0 ? ` — مجموعها ${hoursAr(minutes)}` : ''}`)
    out.push(`**أول لقاء مباشر:** ${whenAr(meetings[0]!.startsAt)}`)
    out.push(`**آخر لقاء مباشر:** ${whenAr(last.startsAt)}`)
  } else {
    out.push('**اللقاءات المباشرة:** لا لقاءَ مجدولا بعد')
  }
  if (view.counts.recordings) out.push(`**الجلسات المسجّلة:** ${view.counts.recordings}`)

  const tasks = [...view.groups.flatMap((g) => g.tasks), ...view.general.tasks].filter((t) => t.review !== 'remove')
  const projects = tasks.filter((t) => t.type === 'project')
  out.push(`**المهام:** ${tasks.length}${projects.length ? ` — منها مشروع التخرج` : ' — بلا مشروع تخرج'}`)
  for (const t of projects) out.push(`**موعد مشروع التخرج (${t.title}):** ${t.dueAt ? whenAr(t.dueAt) : 'بلا آخر موعد'}`)
  const dues = tasks.map((t) => t.dueAt).filter((d): d is string => !!d).sort()
  if (dues.length) out.push(`**آخر موعد تسليم في الشعبة:** ${whenAr(dues[dues.length - 1]!)}`)

  const resources = [...view.groups.flatMap((g) => g.resources), ...view.general.resources]
  const unlinked = view.general.resources.length
  out.push(`**المصادر:** ${resources.length}${unlinked ? ` — منها ${unlinked} للشعبة كلها بلا محور` : ''}`)
  const axesWithout = view.groups.flatMap((g) => (g.resources.length === 0 ? g.axes.map((a) => a.n) : []))
  if (resources.length && axesWithout.length) out.push(`**محاورُ بلا مصدر:** ${axesWithout.map((n) => `المحور ${n}`).join('، ')}`)
  if (view.workbookMode === 'modules') {
    const done = view.moduleWorkbooks.filter((w) => w.done)
    const own = done.filter((w) => w.material === 'own').length
    const unsaid = done.filter((w) => w.material === null).length
    out.push(`**الكراسة:** لكلّ محور — ${done.length} من ${view.moduleWorkbooks.length} موضوعة`
      + `${own ? ` · ${own} مادّةُ المدرّب الجاهزة لا على القالب` : ''}${unsaid ? ` · ${unsaid} لم يقل أعلى القالب هي` : ''}`)
  } else {
    out.push(`**الكراسة:** ${view.workbook
      ? `واحدةٌ للدورة — ${view.workbook.fileKey ? 'ملفٌّ مرفوع' : 'رابط'} · ${materialAr(view.workbook.material)}`
      : 'لم تُوضع'}`)
  }

  const w = cohortWindow(p)
  if (w) out.push(`**يبقى للمتعلّم أن يقرأ موادَّها حتى:** ${cohortDayAr(w.accessEndsAt)} (ستة أشهر بعد انتهائها — ولا تسليمَ بعد انتهائها)`)
  return out
}

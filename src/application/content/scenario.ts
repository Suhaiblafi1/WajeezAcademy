/* سيناريو القرار المتفرّع (البند ح-٥) — موقف مهني ← قرار ← نتيجة ← تأمل.
   هذه الصيغة أقرب ما يكون إلى روح وجيز: منصة تبدأ بقرار مهني وتقيس بالأدلة.
   والمتعلم هنا لا يقرأ عن القرار بل يتخذه ويرى أثره.

   الصيغة نصّية بقصد — تُخزَّن على إصدار الوحدة كما يُخزَّن المتن والتمرين
   والفيديو، فتمرّ بنفس حاكمية النسخ والاعتماد والنشر وتُقارَن نصّا في السجل:

     موقف: أنت مسؤول عمليات في شركة توزيع، ومديرك يطلب أتمتة الفواتير في أسبوعين.

     عقدة: الطلب على مكتبك
     نص: ما أول ما تفعله؟
     > خيار: أشتري أداة أتمتة فواتير اليوم
       أثر: وفّرت أسبوعا في الاختيار وخسرت ثلاثة في التطبيق.
       إلى: أداة قبل عملية
     > خيار: أرسم العملية الحالية خطوة خطوة
       أثر: ظهر أن ٤٠٪ من الفواتير تحتاج قرارا تقديريا.
       إلى: العملية مرسومة

   القواعد التي يفرضها المدقّق — كل واحدة تمنع سيناريو يبدو صحيحا وهو معطوب:
   - قرار بخيار واحد ليس قرارا: كل عقدة غير نهائية تحتاج خيارين على الأقل.
   - «إلى:» لا تشير إلا إلى عقدة موجودة — وإلا انقطع المسار بالمتعلم.
   - لا عقدة غير قابلة للوصول: نصٌّ لا يُقرأ أبدا خطأ تأليف لا ميزة.
   - لا مصيدة: من كل عقدة يُبلَغ نهايةٌ ما. سيناريو يدور بلا مخرج يحبس المتعلم.
   - العقدة النهائية تحتاج «تأمل:» — النتيجة بلا تأمل تجربة بلا تعلّم. */

export interface ScenarioOption {
  labelAr: string
  /** أثر القرار — يُعرض بعد الاختيار لا قبله */
  effectAr: string | null
  /** عنوان العقدة التالية */
  toNode: string
}

export interface ScenarioNode {
  titleAr: string
  bodyAr: string
  options: ScenarioOption[]
  /** سؤال التأمل — للعقد النهائية فقط */
  reflectAr: string | null
}

export interface Scenario {
  situationAr: string
  nodes: ScenarioNode[]
}

export interface ScenarioParseResult {
  scenario: Scenario | null
  /** أخطاء مقروءة للمؤلّف — تُعرض عند الحفظ لا عند العرض */
  errorsAr: string[]
}

export const MAX_NODES = 12
export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 4

/** يحلّل الصيغة النصّية — يعيد أخطاء مقروءة بدل الرمي */
export function parseScenario(raw: string | null | undefined): ScenarioParseResult {
  const errorsAr: string[] = []
  if (!raw || !raw.trim()) return { scenario: null, errorsAr }

  let situationAr = ''
  const nodes: ScenarioNode[] = []
  let node: ScenarioNode | null = null
  let option: ScenarioOption | null = null

  const closeOption = () => {
    if (!option) return
    if (!option.toNode) errorsAr.push(`الخيار «${option.labelAr.slice(0, 30)}» بلا «إلى:» — فإلى أين يمضي المتعلم؟`)
    else node?.options.push(option)
    option = null
  }
  const closeNode = () => {
    closeOption()
    if (node) nodes.push(node)
    node = null
  }

  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    const t = line.trim()
    if (t === '') continue

    const situation = /^موقف\s*[:：]\s*(.+)$/.exec(t)
    if (situation) {
      closeNode()
      /* أكثر من «موقف:» يجمع سطوره — الموقف قد يطول */
      situationAr = situationAr ? `${situationAr}\n${situation[1].trim()}` : situation[1].trim()
      continue
    }

    const head = /^عقدة\s*[:：]\s*(.+)$/.exec(t)
    if (head) {
      closeNode()
      node = { titleAr: head[1].trim(), bodyAr: '', options: [], reflectAr: null }
      continue
    }

    const body = /^نص\s*[:：]\s*(.+)$/.exec(t)
    if (body) {
      closeOption()
      if (!node) errorsAr.push('«نص:» قبل أي عقدة — ابدأ بـ«عقدة: العنوان»')
      else node.bodyAr = node.bodyAr ? `${node.bodyAr}\n${body[1].trim()}` : body[1].trim()
      continue
    }

    const opt = /^[>»]\s*خيار\s*[:：]\s*(.+)$/.exec(t)
    if (opt) {
      closeOption()
      if (!node) { errorsAr.push('خيار قبل أي عقدة — ابدأ بـ«عقدة: العنوان»'); continue }
      option = { labelAr: opt[1].trim(), effectAr: null, toNode: '' }
      continue
    }

    const effect = /^أثر\s*[:：]\s*(.+)$/.exec(t)
    if (effect) {
      if (!option) errorsAr.push('«أثر:» بلا خيار قبله — كل أثر يتبع «> خيار:»')
      else option.effectAr = effect[1].trim()
      continue
    }

    const to = /^إلى\s*[:：]\s*(.+)$/.exec(t)
    if (to) {
      if (!option) errorsAr.push('«إلى:» بلا خيار قبله — كل مسار يتبع «> خيار:»')
      else option.toNode = to[1].trim()
      continue
    }

    const reflect = /^تأمل\s*[:：]\s*(.+)$/.exec(t)
    if (reflect) {
      closeOption()
      if (!node) errorsAr.push('«تأمل:» قبل أي عقدة — ابدأ بـ«عقدة: العنوان»')
      else node.reflectAr = reflect[1].trim()
      continue
    }

    errorsAr.push(`سطر غير مفهوم: «${t.slice(0, 40)}» — الأسطر: موقف · عقدة · نص · > خيار · أثر · إلى · تأمل`)
  }
  closeNode()

  return { scenario: { situationAr, nodes }, errorsAr }
}

/** العقدة بعنوانها — null إن لم توجد */
export function nodeOf(s: Scenario, title: string): ScenarioNode | null {
  return s.nodes.find((n) => n.titleAr === title) ?? null
}

/** أول عقدة هي المدخل — الترتيب في النصّ هو الترتيب */
export function entryOf(s: Scenario): ScenarioNode | null {
  return s.nodes[0] ?? null
}

export function isTerminal(n: ScenarioNode): boolean {
  return n.options.length === 0
}

/** العقد التي تُبلَغ من المدخل */
export function reachableNodes(s: Scenario): Set<string> {
  const seen = new Set<string>()
  const entry = entryOf(s)
  if (!entry) return seen
  const stack = [entry.titleAr]
  while (stack.length > 0) {
    const title = stack.pop()!
    if (seen.has(title)) continue
    seen.add(title)
    const n = nodeOf(s, title)
    if (!n) continue
    for (const o of n.options) if (!seen.has(o.toNode)) stack.push(o.toNode)
  }
  return seen
}

/** العقد التي تبلغ نهايةً ما — من ليس فيها فهو مصيدة */
export function nodesReachingEnd(s: Scenario): Set<string> {
  const ok = new Set<string>(s.nodes.filter(isTerminal).map((n) => n.titleAr))
  /* تكرار حتى الاستقرار: العقدة تبلغ نهاية إن بلغها أحد خياراتها */
  let grew = true
  while (grew) {
    grew = false
    for (const n of s.nodes) {
      if (ok.has(n.titleAr)) continue
      if (n.options.some((o) => ok.has(o.toNode))) { ok.add(n.titleAr); grew = true }
    }
  }
  return ok
}

/** صيغة صالحة للحفظ — كل خطأ برسالة تقول للمؤلّف ما يصلحه */
export function validateScenario(raw: string | null | undefined): { ok: true } | { ok: false; errorsAr: string[] } {
  const { scenario, errorsAr } = parseScenario(raw)
  const errors = [...errorsAr]
  if (!scenario) return { ok: false, errorsAr: ['لا سيناريو — ابدأ بـ«موقف:» ثم «عقدة:»'] }

  if (!scenario.situationAr) errors.push('لا «موقف:» — السيناريو يبدأ بموقف مهني يضع المتعلم في مكانه')
  if (scenario.nodes.length < 2) errors.push('عقدة واحدة لا تصنع قرارا — أضف عقدة نتيجة على الأقل')
  if (scenario.nodes.length > MAX_NODES) errors.push(`عدد العقد ${scenario.nodes.length} — الحدّ ${MAX_NODES}`)

  const titles = new Set<string>()
  for (const n of scenario.nodes) {
    if (!n.titleAr) errors.push('عقدة بلا عنوان')
    if (titles.has(n.titleAr)) errors.push(`عنوان عقدة مكرَّر: «${n.titleAr}» — العناوين مفاتيح المسار`)
    titles.add(n.titleAr)
    if (!n.bodyAr) errors.push(`العقدة «${n.titleAr}»: بلا «نص:»`)
    if (n.options.length === 1) errors.push(`العقدة «${n.titleAr}»: خيار واحد ليس قرارا — أضف خيارا ثانيا`)
    if (n.options.length > MAX_OPTIONS) errors.push(`العقدة «${n.titleAr}»: ${n.options.length} خيارات — الحدّ ${MAX_OPTIONS}`)
    if (isTerminal(n) && !n.reflectAr) errors.push(`العقدة النهائية «${n.titleAr}»: بلا «تأمل:» — النتيجة بلا تأمل تجربة بلا تعلّم`)
    if (!isTerminal(n) && n.reflectAr) errors.push(`العقدة «${n.titleAr}»: «تأمل:» للعقد النهائية فقط`)
    const seenLabels = new Set<string>()
    for (const o of n.options) {
      if (!titles.has(o.toNode) && !scenario.nodes.some((x) => x.titleAr === o.toNode)) {
        errors.push(`العقدة «${n.titleAr}»: «إلى: ${o.toNode}» لا تطابق أي عقدة`)
      }
      if (seenLabels.has(o.labelAr)) errors.push(`العقدة «${n.titleAr}»: خيار مكرَّر «${o.labelAr}»`)
      seenLabels.add(o.labelAr)
    }
  }

  if (scenario.nodes.length >= 2) {
    const reachable = reachableNodes(scenario)
    for (const n of scenario.nodes) {
      if (!reachable.has(n.titleAr)) errors.push(`العقدة «${n.titleAr}» لا تُبلَغ من البداية — نصٌّ لا يُقرأ أبدا`)
    }
    const ends = nodesReachingEnd(scenario)
    if (ends.size === 0) errors.push('لا عقدة نهائية — لا بد من نهاية بلا خيارات ومعها «تأمل:»')
    for (const title of reachable) {
      if (!ends.has(title)) errors.push(`العقدة «${title}» لا تبلغ نهاية — مصيدة تحبس المتعلم`)
    }
  }

  /* إزالة التكرار: الخطأ نفسه لا يُقال مرتين للمؤلّف */
  const unique = [...new Set(errors)]
  return unique.length > 0 ? { ok: false, errorsAr: unique } : { ok: true }
}

/* ══════════ مسار المتعلم ══════════ */

export interface ScenarioStep {
  /** عنوان العقدة التي كان فيها */
  node: string
  /** ترتيب الخيار الذي اختاره في تلك العقدة */
  optionIndex: number
}

/** يعيد بناء مسار من خطوات محفوظة — يتوقف عند أول خطوة غير صالحة بلا رمي */
export function replayPath(s: Scenario, steps: ScenarioStep[]): { nodes: ScenarioNode[]; valid: boolean } {
  const entry = entryOf(s)
  if (!entry) return { nodes: [], valid: false }
  const visited: ScenarioNode[] = [entry]
  let cur = entry
  for (const step of steps) {
    if (cur.titleAr !== step.node) return { nodes: visited, valid: false }
    const opt = cur.options[step.optionIndex]
    if (!opt) return { nodes: visited, valid: false }
    const next = nodeOf(s, opt.toNode)
    if (!next) return { nodes: visited, valid: false }
    visited.push(next)
    cur = next
  }
  return { nodes: visited, valid: true }
}

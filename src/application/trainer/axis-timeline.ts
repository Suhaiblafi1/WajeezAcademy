/* ═══ خطُّ المحاور — لكلّ محورٍ موعدُه، ولكلّ شيءٍ فيه وقتُه ═══

   قرارُ صاحب المنصّة (٢٧ سبتمبر ٢٠٢٦): «إذا حدّد المحورَ الأوّل للأسبوع
   الأوّل فتظهر الكرّاسةُ لهذا المحور، ويجب أن يكون موعدُ اللقاء المباشر في
   بداية أسبوع المحور، وبعد اللقاء تظهر واجباتُ المحور ومصادرُه… وهكذا للمحور
   الثاني والثالث والرابع». ثمّ: «يحقّ للمدرّب أن يجمع محورين أو أكثر في
   أسبوعٍ واحد… والقاعدةُ تقول إنّ الدورةَ أقلُّ شيءٍ أربعةُ محاور، فلا يجمع
   محورين معا إلّا إذا كانت أكثرَ من أربعة محاور».

   وحُسمت تفاصيلُه بكلمة «go» على عشرة قرارات (٢٧ سبتمبر ٢٠٢٦)، ومنها هنا:
   ① أربعةُ مواعيدَ على الأقلّ دائما، والجمعُ لمتجاورَين وحدَهما.
   ② لكلّ محورٍ لقاءٌ مباشرٌ واحدٌ على الأقلّ — والمسجَّلُ لا يُغني عنه.
     واللقاءُ لمحورٍ أو محورين («ولكلّ لقاءٍ محورٌ أو محوران»).
   ③ اللقاءُ داخلَ موعد محوره، وتنبيهٌ — لا منعٌ — إن جاء بعد يومه الثالث.
   ⑤ مهامُّ المحور ومصادرُه تُفتح حين ينتهي أوّلُ لقاءٍ له، مباشرٍ أو مسجَّل —
     والمسجَّلُ «ينتهي» لحظةَ يُفتح.
   ⑥ آخرُ موعدٍ للتسليم هو آخرُ الموعد ما لم يُحدَّد غيرُه.
   ⑦ لكلّ موعدٍ كرّاسةٌ واحدة — ملفٌّ أو رابط، إلزاميّة — والمجموعان يتقاسمانها.

   ── ولمَ ملفٌّ واحدٌ محض ──

   يقرأ القاعدةَ ثلاثة: شاشةُ المدرّب وهو يرتّب، والخادمُ حين يحكم على
   الإرسال، والخادمُ حين يقرّر ما يصل المتعلّمَ الآن. وثلاثُ نسخٍ من «متى
   يُفتح» تفترق — فيُقال للمدرّب «تُفتح الثلاثاء» ويفتحها الخادمُ الأحد.
   ولا ساعةَ تُقرأ هنا: اللحظةُ تُمرَّر، فتُختبَر البوّابةُ بلا انتظار. */

import { periodBounds, periodDays, realDate, zonedDay, type CohortPeriod } from './cohort-period'
import { MIN_SESSION_MS } from './session-length'
import { fmtDateWith } from '../text/format-ar'

/* ─────────── الشكلُ كما يُحفظ في الخطّة ─────────── */

/** كرّاسةُ الموعد — ملفٌّ مرفوعٌ **أو** رابط، كالمصدر */
export interface SlotWorkbook {
  title?: string | null
  url?: string | null
  bodyFileKey?: string | null
  bodyFileName?: string | null
  bodyFileMime?: string | null
}

/** موعدٌ على خطّ الشعبة: من يومٍ إلى يوم، وفيه محورٌ أو محاورُ متجاورة */
export interface PlanSlot {
  startsOn: string
  endsOn: string
  moduleIds: string[]
  workbook?: SlotWorkbook | null
}

/** أقلُّ ما تُقسَم عليه الدورة — «الدورةُ أقلُّ شيءٍ أربعةُ محاور» */
export const MIN_SLOTS = 4
/** «ولكلّ لقاءٍ محورٌ أو محوران» */
export const MAX_AXES_PER_SESSION = 2
/** بعد هذا اليوم من الموعد يُنبَّه المدرّب — «في بداية أسبوع المحور» */
export const EARLY_DAYS = 3

/** أقلُّ عددٍ من المواعيد: أربعة — أو عددُ المحاور إن قلّت عنها، فلا يُجمع شيء */
export function minSlots(moduleCount: number): number {
  return Math.min(MIN_SLOTS, Math.max(0, moduleCount))
}

/** اليومُ بعد `n` أيّام — حسابٌ على التقويم لا على الساعة */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** «٤ أكتوبر» — والظهيرةُ بغرينتش كي لا يقفز اليومُ في منطقةٍ ما */
export function dayLabelAr(date: string): string {
  return fmtDateWith(`${date}T12:00:00Z`, { day: 'numeric', month: 'long', timeZone: 'UTC' })
}

/* ═══ التوزيعُ الأوّل — مواعيدُ أسبوعيّةٌ من يوم البدء ═══

   «الخطوةُ الثانية تُفتح على مواعيدَ أسبوعيّةٍ مرتّبةٍ من تاريخ البدء،
   والمدرّبُ يعدّلها» — كما عُرض على صاحب المنصّة. فعددُ المواعيد عددُ
   الأسابيع الكاملة، لا يقلّ عن الحدّ ولا يزيد على المحاور. وحين يطابق
   الأسابيعَ تبدأ كلُّها في يوم البدء نفسِه من الأسبوع، ويأخذ آخرُها الباقي.
   وإلّا قُسمت المدّةُ بالتساوي.

   والمحاورُ تُوزَّع بالتقريب — ثمانيةٌ على خمسة: ١+٢ · ٣ · ٤+٥ · ٦ · ٧+٨،
   وهو المثالُ الذي عُرض بنصّه. */
export function defaultSlots(moduleIds: readonly string[], period: CohortPeriod): PlanSlot[] {
  const n = moduleIds.length
  const days = periodDays(period)
  if (n === 0 || !(days >= 1)) return []
  const weeks = Math.max(1, Math.floor(days / 7))
  const k = Math.min(n, Math.max(minSlots(n), weeks), days)
  const weekly = k === weeks
  const out: PlanSlot[] = []
  for (let i = 0; i < k; i++) {
    const from = weekly ? i * 7 : Math.round((i * days) / k)
    const to = weekly ? (i === k - 1 ? days - 1 : i * 7 + 6) : Math.round(((i + 1) * days) / k) - 1
    out.push({
      startsOn: addDays(period.startsOn, from),
      endsOn: addDays(period.startsOn, to),
      moduleIds: moduleIds.slice(Math.round((i * n) / k), Math.round(((i + 1) * n) / k)),
      workbook: null,
    })
  }
  return out
}

/* ═══ ما يمنع المواعيد — بلغة من يصحّحها ═══

   يمنع الإرسالَ ولا يمنع الحفظ — كسائر شروط التجهيز: من رتّب نصفَ مواعيده
   ثمّ أغلق حاسوبه يجد نصفَه حين يعود. */
export function slotProblems(
  slots: readonly PlanSlot[] | null | undefined,
  moduleIds: readonly string[],
  period: CohortPeriod | null,
): string[] {
  const n = moduleIds.length
  if (n === 0) return []
  const list = slots ?? []
  if (list.length === 0) return ['وزّع المحاورَ على مواعيدها — من متى إلى متى يكون كلُّ محور']
  const out: string[] = []
  if (!period) out.push('حدّد مدّةَ الشعبة أوّلا — المواعيدُ داخلها')

  const need = minSlots(n)
  if (list.length < need) {
    out.push(n > MIN_SLOTS
      ? `أقلُّ ما تُقسَم عليه الدورةُ ${MIN_SLOTS} مواعيد — افصِل بعضَ المحاور المجموعة`
      : `لكلّ محورٍ موعدُه — الدورةُ في ${n} محاور فلا يُجمع منها شيء`)
  }

  /* التغطيةُ والترتيب: كلُّ محورٍ في موعدٍ واحد، والمواعيدُ تأخذها بترتيب
     الخطّة — فلا يُجمع إلّا متجاوران («١+٢ لا ١+٣»). */
  const pos = new Map(moduleIds.map((id, i) => [id, i]))
  const seen = new Set<string>()
  let last = -1
  let ordered = true
  for (const id of list.flatMap((s) => s.moduleIds)) {
    const p = pos.get(id)
    if (p === undefined) { out.push('في المواعيد محورٌ حُذف من الخطّة — أعِد توزيعها'); continue }
    if (seen.has(id)) { out.push(`المحور ${p + 1} في موعدين — لكلّ محورٍ موعدٌ واحد`); continue }
    seen.add(id)
    if (p !== last + 1) ordered = false
    last = p
  }
  const missing = moduleIds.map((id, i) => ({ id, i })).filter(({ id }) => !seen.has(id))
  if (missing.length) {
    out.push(`${missing.length === 1 ? 'محورٌ' : 'محاورُ'} بلا موعد: ${missing.map(({ i }) => `المحور ${i + 1}`).join('، ')}`)
  } else if (!ordered) {
    out.push('المحاورُ على المواعيد بترتيبها، ولا يُجمع إلّا متجاوران — ١+٢ لا ١+٣')
  }
  if (list.some((s) => s.moduleIds.length === 0)) out.push('موعدٌ بلا محور — احذفه أو اجمعه مع جاره')

  /* والتواريخ: داخلَ المدّة، ومتتابعةٌ لا متداخلة — والفجوةُ بينها جائزة
     (عيدٌ أو عطلة)، فلا يُشترط أن يلتصق موعدٌ بما قبله. */
  list.forEach((s, i) => {
    const label = `الموعد ${i + 1}`
    if (!realDate(s.startsOn) || !realDate(s.endsOn)) { out.push(`${label}: تاريخٌ غيرُ صالح`); return }
    if (s.endsOn < s.startsOn) { out.push(`${label} ينتهي قبل أن يبدأ`); return }
    if (period && (s.startsOn < period.startsOn || s.endsOn > period.endsOn)) {
      out.push(`${label} خارجَ مدّة الشعبة (${dayLabelAr(period.startsOn)} – ${dayLabelAr(period.endsOn)})`)
    }
    const prev = list[i - 1]
    if (prev && realDate(prev.endsOn) && s.startsOn <= prev.endsOn) {
      out.push(`${label} يبدأ قبل أن ينتهي الموعدُ ${i} — المواعيدُ متتابعةٌ لا متداخلة`)
    }
  })
  return out
}

/* ─────────── الجمعُ والفصل — حدٌّ بين محورين يُرفع أو يُوضع ─────────── */

/** أيُجمع الموعدُ `i` مع الذي يليه؟ — ما بقي العددُ فوق الحدّ */
export function canMerge(slots: readonly PlanSlot[], i: number, moduleCount: number): boolean {
  return i >= 0 && i < slots.length - 1 && slots.length - 1 >= minSlots(moduleCount)
}

/** يجمع الموعدَ `i` مع الذي يليه: من أوّل الأوّل إلى آخر الثاني، والكرّاسةُ الأولى */
export function mergeSlots(slots: readonly PlanSlot[], i: number): PlanSlot[] {
  const a = slots[i]
  const b = slots[i + 1]
  if (!a || !b) return [...slots]
  const merged: PlanSlot = {
    startsOn: a.startsOn,
    endsOn: b.endsOn,
    moduleIds: [...a.moduleIds, ...b.moduleIds],
    workbook: a.workbook ?? b.workbook ?? null,
  }
  return [...slots.slice(0, i), merged, ...slots.slice(i + 2)]
}

/** يفصل الموعدَ `i` بعد محوره رقم `at` (من ١): الأيّامُ بقدر المحاور، ويومٌ لكلٍّ على الأقلّ */
export function splitSlot(slots: readonly PlanSlot[], i: number, at: number): PlanSlot[] {
  const s = slots[i]
  if (!s || at < 1 || at >= s.moduleIds.length) return [...slots]
  const days = realDate(s.startsOn) && realDate(s.endsOn) ? periodDays(s) : 1
  const firstDays = Math.min(Math.max(1, Math.round((days * at) / s.moduleIds.length)), Math.max(1, days - 1))
  const first: PlanSlot = {
    startsOn: s.startsOn,
    endsOn: addDays(s.startsOn, firstDays - 1),
    moduleIds: s.moduleIds.slice(0, at),
    workbook: s.workbook ?? null,
  }
  const second: PlanSlot = {
    startsOn: addDays(s.startsOn, firstDays),
    endsOn: days > 1 ? s.endsOn : addDays(s.startsOn, firstDays),
    moduleIds: s.moduleIds.slice(at),
    workbook: null,
  }
  return [...slots.slice(0, i), first, second, ...slots.slice(i + 1)]
}

/* ═══ والمحاورُ تتغيّر بعد التوزيع — فالمواعيدُ تتبعها ولا تنكسر ═══

   · **نقلُ محور** يُبقي أحجامَ المواعيد وتواريخَها، ويعيد صبَّ المحاور فيها
     بترتيبها الجديد — فمن نقل المحورَ الثالث قبل الثاني بقي «١+٢ · ٣» شكلا.
   · **محورٌ جديد** يلحق آخرَ موعد، وللمدرّب أن يفصله.
   · **ومحورٌ محذوف** يخرج من موعده، ويسقط الموعدُ إن فرغ — فلا تتحرّك
     تواريخُ غيره. */
export function reflowSlots(slots: readonly PlanSlot[], moduleIds: readonly string[]): PlanSlot[] {
  const out: PlanSlot[] = []
  let at = 0
  for (const s of slots) {
    if (at >= moduleIds.length) break
    const take = s.moduleIds.length
    out.push({ ...s, moduleIds: moduleIds.slice(at, at + take) })
    at += take
  }
  if (at < moduleIds.length && out.length) {
    const tail = out[out.length - 1]
    out[out.length - 1] = { ...tail, moduleIds: [...tail.moduleIds, ...moduleIds.slice(at)] }
  }
  return out.filter((s) => s.moduleIds.length > 0)
}

/** يرفع محورا من مواعيده — ويسقط الموعدُ إن فرغ */
export function dropFromSlots(slots: readonly PlanSlot[], moduleId: string): PlanSlot[] {
  return slots
    .map((s) => ({ ...s, moduleIds: s.moduleIds.filter((id) => id !== moduleId) }))
    .filter((s) => s.moduleIds.length > 0)
}

/** يُلحق محورا جديدا بآخر موعد */
export function appendToSlots(slots: readonly PlanSlot[], moduleId: string): PlanSlot[] {
  if (slots.length === 0) return []
  const last = slots[slots.length - 1]
  return [...slots.slice(0, -1), { ...last, moduleIds: [...last.moduleIds, moduleId] }]
}

/* ─────────── الكرّاسة ─────────── */

/** للموعد كرّاستُه: ملفٌّ مرفوعٌ أو رابطٌ يبدأ بـ`https://` */
export function workbookDone(w: SlotWorkbook | null | undefined): boolean {
  if (!w) return false
  return Boolean((w.bodyFileKey ?? '').trim()) || /^https?:\/\/\S+/.test((w.url ?? '').trim())
}

/** المواعيدُ التي تنقصها كرّاستُها — بأرقامها ومحاورها */
export function workbookProblems(slots: readonly PlanSlot[] | null | undefined, moduleIds: readonly string[]): string[] {
  const list = slots ?? []
  if (list.length === 0) return ['وزّع المحاورَ على مواعيدها أوّلا — فلكلّ موعدٍ كرّاستُه']
  const pos = new Map(moduleIds.map((id, i) => [id, i + 1]))
  return list
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !workbookDone(s.workbook))
    .map(({ s, i }) => `الموعد ${i + 1} (${axesLabelAr(s.moduleIds, pos)}) بلا كرّاسة — ارفع ملفّا أو ألصِق رابطا`)
}

/** «المحور ٣» أو «المحوران ١+٢» أو «المحاور ٤+٥+٦» */
export function axesLabelAr(ids: readonly string[], pos: ReadonlyMap<string, number>): string {
  const nums = ids.map((id) => pos.get(id)).filter((x): x is number => typeof x === 'number')
  if (nums.length === 0) return 'بلا محور'
  if (nums.length === 1) return `المحور ${nums[0]}`
  return `${nums.length === 2 ? 'المحوران' : 'المحاور'} ${nums.join('+')}`
}

/* ─────────── اللقاءاتُ على المواعيد ─────────── */

/** لقاءٌ كما يحكم عليه الخطّ — بدايتُه ونهايتُه ومحاورُه */
export interface TimelineSession {
  title?: string | null
  startsAt: Date | string
  endsAt?: Date | string | null
  moduleIds: readonly string[]
}

/** جلسةٌ مسجّلةٌ في الخطّة — مصدرٌ صنفُه «مسجَّل» بمحوره ولحظةِ فتحه */
export interface TimelineRecording {
  title?: string | null
  moduleId?: string | null
  opensAt?: string | Date | null
}

/** نهايةُ لقاء — المكتوبةُ، أو ساعتان بعد بدايته (أقلُّ لقاءٍ يُقبل) */
export function sessionEnd(s: { startsAt: Date | string; endsAt?: Date | string | null }): Date {
  if (s.endsAt) {
    const e = new Date(s.endsAt)
    if (!Number.isNaN(e.getTime())) return e
  }
  return new Date(new Date(s.startsAt).getTime() + MIN_SESSION_MS)
}

/** رقمُ يومِ اللحظة في الموعد — الأوّلُ واحد، بتوقيت عمّان */
export function dayInSlot(at: Date | string, slot: { startsOn: string }): number {
  return periodDays({ startsOn: slot.startsOn, endsOn: zonedDay(at) })
}

/** موضعُ الموعد الذي فيه المحور — أو `-1` */
export function slotIndexOf(slots: readonly PlanSlot[], moduleId: string): number {
  return slots.findIndex((s) => s.moduleIds.includes(moduleId))
}

/* ═══ ما يمنع خطوةَ اللقاءات — وما يُنبَّه إليه ولا يمنع ═══

   المانعُ: محورٌ بلا لقاءٍ مباشر (②)، ولقاءٌ بلا محورٍ أو بأكثرَ من محورين،
   ولقاءٌ محوراه في موعدين، ولقاءٌ خارجَ موعد محوره (③)، وجلسةٌ مسجّلةٌ بلا
   محورٍ أو بلا لحظةِ فتحٍ أو خارجَ موعد محورها.

   والمنبَّهُ إليه: لقاءٌ بعد اليوم الثالث من موعده — «في بداية أسبوع
   المحور»، فبعده تُفتح المهامّ. قرارُ المدرّب، والمنصّةُ تنصح (③). */
export function sessionProblems(input: {
  slots: readonly PlanSlot[] | null | undefined
  moduleIds: readonly string[]
  sessions: readonly TimelineSession[]
  recordings?: readonly TimelineRecording[]
  /** اللحظةُ التي يُحكم بها — وما انتهى قبلها واقعةٌ لا مسودّة */
  now?: Date | null
}): { blocking: string[]; warnings: string[] } {
  const blocking: string[] = []
  const warnings: string[] = []
  const slots = input.slots ?? []
  const pos = new Map(input.moduleIds.map((id, i) => [id, i + 1]))
  const name = (t: string | null | undefined, fallback: string) => (t ?? '').trim() || fallback

  /* ② لكلّ محورٍ لقاءٌ مباشر — والمسجَّلُ لا يُحسب هنا */
  const covered = new Set(input.sessions.flatMap((s) => s.moduleIds))
  const bare = input.moduleIds.filter((id) => !covered.has(id))
  if (bare.length) {
    blocking.push(`${bare.length === 1 ? 'محورٌ' : 'محاورُ'} بلا لقاءٍ مباشر: ${bare.map((id) => `المحور ${pos.get(id)}`).join('، ')}`)
  }

  input.sessions.forEach((s, i) => {
    /* ═══ وما انعقد واقعةٌ لا مسودّة ═══

       لقاءٌ انتهى لا يُنقل ولا يُحذف (`trainerDeleteSession` يردّه إن حضره
       أحد) — فلو حُكم عليه بالربط والموعد لبقيت شعبةٌ جاريةٌ حبيسةً خطوتَها
       إلى الأبد: لا تستطيع إصلاحَه ولا التخلّصَ منه. فيُحسب لمحوره إن رُبط
       (التغطيةُ أعلاه تقرؤه)، ولا يُحاسَب على ما لم يعد بيد أحد. */
    if (input.now && sessionEnd(s).getTime() < input.now.getTime()) return
    const label = `لقاء «${name(s.title, `رقم ${i + 1}`)}»`
    const ids = s.moduleIds.filter((id) => pos.has(id))
    if (ids.length === 0) { blocking.push(`${label} غيرُ مربوطٍ بمحور — اختر محورَه`); return }
    if (ids.length > MAX_AXES_PER_SESSION) { blocking.push(`${label} مربوطٌ بأكثرَ من محورين — اللقاءُ لمحورٍ أو محورين`); return }
    const at = new Set(ids.map((id) => slotIndexOf(slots, id)))
    if (at.has(-1)) return /* محورٌ بلا موعد — تقوله خطوةُ المحاور، لا تُكرَّر هنا */
    if (at.size > 1) { blocking.push(`${label} يجمع محورين من موعدين — اللقاءُ لمحاورِ موعدٍ واحد`); return }
    const slot = slots[[...at][0]]
    const { from, to } = periodBounds(slot)
    const start = new Date(s.startsAt).getTime()
    if (start < from.getTime() || sessionEnd(s).getTime() > to.getTime()) {
      blocking.push(`${label} خارجَ موعد ${axesLabelAr(ids, pos)} (${dayLabelAr(slot.startsOn)} – ${dayLabelAr(slot.endsOn)})`)
      return
    }
    const day = dayInSlot(s.startsAt, slot)
    if (day > EARLY_DAYS) {
      warnings.push(`${label} في اليوم ${day} من موعده — والأصلُ في أوّل ${EARLY_DAYS} أيّام، فبعده تُفتح المهامّ`)
    }
  })

  ;(input.recordings ?? []).forEach((r, i) => {
    const label = `الجلسةُ المسجّلة «${name(r.title, `رقم ${i + 1}`)}»`
    if (!r.moduleId || !pos.has(r.moduleId)) { blocking.push(`${label} بلا محور — اختر محورَها`); return }
    const idx = slotIndexOf(slots, r.moduleId)
    if (idx === -1) return
    if (!r.opensAt || Number.isNaN(new Date(r.opensAt).getTime())) { blocking.push(`${label} بلا موعدِ فتح`); return }
    const slot = slots[idx]
    const { from, to } = periodBounds(slot)
    const t = new Date(r.opensAt).getTime()
    if (t < from.getTime() || t > to.getTime()) {
      blocking.push(`${label} تُفتح خارجَ موعد ${axesLabelAr([r.moduleId], pos)} (${dayLabelAr(slot.startsOn)} – ${dayLabelAr(slot.endsOn)})`)
    }
  })
  return { blocking, warnings }
}

/* ═══ متى يُفتح كلُّ شيء — الخطُّ نفسُه ═══

   · **المتنُ النظريُّ والكرّاسة**: أوّلَ يوم الموعد، منذ منتصف ليله في عمّان —
     «الكرّاسةُ والمادّةُ النظريّةُ تُفتح مباشرةً قبل اللقاء».
   · **المهامُّ والمصادرُ**: حين ينتهي أوّلُ لقاءٍ للمحور — مباشرٍ بنهايته،
     أو مسجَّلٍ بلحظة فتحه (⑤). ولا قبل أوّل الموعد أبدا: لقاءٌ نُقل قبل
     موعده لا يفتح محورَه قبل أوانه.
   · **فإن لم يكن للمحور لقاءٌ** — أُلغي أو رُدّ بعد الاعتماد — فُتحت مع
     أوّل الموعد: خيرٌ من مهامَّ تُحبس إلى الأبد خلف لقاءٍ لن ينعقد.
   · **ومصدرٌ للقراءة المسبقة** (`preReading`) يُفتح مع الكرّاسة.
   · **ومصدرٌ بلا محور** للشعبة كلِّها: مع أوّل يومٍ فيها.

   وخطّةٌ بلا مواعيد — اعتُمدت قبل هذا كلِّه — لا خطَّ لها (`null`): تمضي
   كما بدأت، وكلُّ شيءٍ فيها مفتوحٌ كما كان («الشعبُ الجاريةُ تنتهي بطريقتها»). */
export interface TimelineResource {
  category?: string | null
  kind?: string | null
  moduleId?: string | null
  preReading?: boolean | null
  opensAt?: string | Date | null
}

export interface TimelineSlot extends PlanSlot {
  index: number
  /** أوّلُ لحظةٍ في الموعد — منتصفُ ليل يومه الأوّل في عمّان */
  opensAt: Date
  /** آخرُ لحظةٍ فيه — آخرُ ثانيةٍ من يومه الأخير */
  closesAt: Date
}

export interface AxisTimeline {
  slots: TimelineSlot[]
  slotOf(moduleId: string): TimelineSlot | null
  /** المتنُ النظريُّ وكرّاسةُ الموعد */
  theoryOpensAt(moduleId: string): Date | null
  /** مهامُّ المحور ومصادرُه بعد لقائه */
  workOpensAt(moduleId: string): Date | null
  /** آخرُ موعدٍ افتراضيٌّ للتسليم — آخرُ لحظةٍ في الموعد (⑥) */
  defaultDueAt(moduleId: string): Date | null
  resourceOpensAt(r: TimelineResource): Date | null
}

const isRecorded = (r: { category?: string | null }) => r.category === 'recorded'
const validDate = (v: string | Date | null | undefined): Date | null => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}
const later = (a: Date, b: Date) => (a.getTime() >= b.getTime() ? a : b)

export function buildTimeline(input: {
  slots?: readonly PlanSlot[] | null
  /** اللقاءاتُ التي تُعدّ — للمدرّب لا المبدئيّ، ولا الملغى ولا المردود */
  sessions: readonly TimelineSession[]
  /** مصادرُ الخطّة كلُّها — والمسجَّلُ منها لقاءٌ «ينتهي» لحظةَ فتحه */
  resources?: readonly TimelineResource[] | null
  /** مدّةُ الشعبة — منها أوّلُ يومٍ لما لا محورَ له */
  period?: CohortPeriod | null
}): AxisTimeline | null {
  const raw = input.slots ?? []
  if (raw.length === 0) return null
  const slots: TimelineSlot[] = raw
    .filter((s) => realDate(s.startsOn) && realDate(s.endsOn))
    .map((s, index) => {
      const { from, to } = periodBounds(s)
      return { ...s, index, opensAt: from, closesAt: to }
    })
  if (slots.length === 0) return null
  const bySlot = new Map<string, TimelineSlot>()
  for (const s of slots) for (const id of s.moduleIds) if (!bySlot.has(id)) bySlot.set(id, s)
  const cohortStart = input.period ? periodBounds(input.period).from : slots[0].opensAt

  /* أوّلُ «انتهاءٍ» لكلّ محور: لقاءٌ مباشرٌ بنهايته، ومسجَّلٌ بلحظة فتحه */
  const firstEnd = new Map<string, Date>()
  const note = (id: string, at: Date) => {
    const prev = firstEnd.get(id)
    if (!prev || at.getTime() < prev.getTime()) firstEnd.set(id, at)
  }
  for (const s of input.sessions) for (const id of s.moduleIds) note(id, sessionEnd(s))
  for (const r of input.resources ?? []) {
    const at = validDate(r.opensAt)
    if (isRecorded(r) && r.moduleId && at) note(r.moduleId, at)
  }

  const slotOf = (id: string) => bySlot.get(id) ?? null
  const theoryOpensAt = (id: string) => slotOf(id)?.opensAt ?? null
  const workOpensAt = (id: string) => {
    const slot = slotOf(id)
    if (!slot) return null
    const end = firstEnd.get(id)
    return end ? later(end, slot.opensAt) : slot.opensAt
  }
  return {
    slots,
    slotOf,
    theoryOpensAt,
    workOpensAt,
    defaultDueAt: (id) => slotOf(id)?.closesAt ?? null,
    resourceOpensAt: (r) => {
      const slot = r.moduleId ? slotOf(r.moduleId) : null
      if (isRecorded(r)) {
        const at = validDate(r.opensAt)
        if (slot) return at ? later(at, slot.opensAt) : slot.opensAt
        return at ?? cohortStart
      }
      if (!r.moduleId || !slot) return cohortStart
      return r.preReading ? slot.opensAt : workOpensAt(r.moduleId)
    },
  }
}

/** أمفتوحٌ الآن؟ — `null` تعني «لا بوّابة» فهو مفتوح */
export function openNow(at: Date | null, now: Date = new Date()): boolean {
  return at === null || at.getTime() <= now.getTime()
}

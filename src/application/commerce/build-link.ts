/* رابطُ الشراء الجاهز — `/build/<دورة>?cohort=<شعبة>&add=<دورة>:<شعبة>,…&code=<كود>` (٤ نوفمبر ٢٠٢٦).

   كانت الصفحةُ تقبل دورةً واحدةً وشعبتَها (`?cohort=`)، وما يُضاف إليها يُضاف بالنقر ولا يظهر في الرابط. فمن أراد
   أن يرسل لمتعلّمٍ مسارا جاهزا بأربع دوراتٍ وكودِ منحته لم يجد رابطا يقوله. فصار للرابط بابان اختياريّان:
     · `add` — دوراتٌ إضافيّةٌ بصيغة `دورة:شعبة`، والشعبةُ اختياريّة (بلاها أقربُ شعبةٍ كما تختار الصفحةُ اليوم).
     · `code` — الكودُ مكتوبا في خانته.
   والرابطُ القديمُ (`/build/<دورة>` مع `cohort` أو دونه) يعمل كما هو.

   وهنا **القراءةُ وحدَها**: ما في الرابط يُنظَّف شكلا (معرّفٌ بحروفه، ومكرّرٌ يُعدّ مرّة، والعددُ بحدّ المسار) ولا
   يُصدَّق — أوجودُ الدورة والشعبة ومقاعدُها وصلاحُ الكود يحكم فيه الخادم (`CommerceService.preview` ثمّ `checkout`).
   والحارس: `src/tests/commerce/build-link.test.ts`. */

import { MAX_BUILT_COURSES } from './discount-policy'

const COURSE_RE = /^[A-Za-z0-9_-]{1,80}$/
const COHORT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CODE_RE = /^[A-Z0-9-]{2,40}$/

export interface BuildLinkAdd {
  courseId: string
  /** الشعبةُ المطلوبة — أو `null` فتختار الصفحةُ أقربَ شعبة */
  cohortId: string | null
}

export interface BuildLink {
  /** الدوراتُ الإضافيّة بترتيبها في الرابط — بلا الدورة الأولى، وبلا مكرّر، وبحدّ المسار مع الأولى */
  adds: BuildLinkAdd[]
  /** ما سقط من `add` شكلا (معرّفٌ مشوّه) أو بالحدّ — يُقال للمتعلّم بعددٍ لا يُسقَط صامتا */
  dropped: number
  /** الكودُ بحروفٍ كبيرة — أو `null` */
  code: string | null
}

/** يقرأ `add` و`code` من رابط `/build/<anchor>` */
export function parseBuildLink(search: string, anchorId: string): BuildLink {
  const q = new URLSearchParams(search)
  const seen = new Set<string>([anchorId])
  const adds: BuildLinkAdd[] = []
  let dropped = 0
  const raw = q.getAll('add').flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean)
  for (const item of raw) {
    const [courseId, cohortId, ...rest] = item.split(':').map((x) => x.trim())
    if (rest.length > 0 || !courseId || !COURSE_RE.test(courseId)) { dropped++; continue }
    /* المكرّرُ يُعدّ مرّةً — وإن ذُكرت شعبتُه في الثاني وحدَه أُخذت */
    if (seen.has(courseId)) {
      const had = adds.find((a) => a.courseId === courseId)
      if (had && !had.cohortId && cohortId && COHORT_RE.test(cohortId)) had.cohortId = cohortId
      continue
    }
    if (adds.length + 1 >= MAX_BUILT_COURSES) { dropped++; continue }
    seen.add(courseId)
    adds.push({ courseId, cohortId: cohortId && COHORT_RE.test(cohortId) ? cohortId : null })
  }
  const code = (q.get('code') ?? '').trim().toUpperCase()
  return { adds, dropped, code: CODE_RE.test(code) ? code : null }
}

/** يبني رابطَ الشراء — الصفحةُ والتتبّعُ كما هما، و`add` و`code` إن وُجدا */
export function buildLinkPath(input: {
  courseId: string
  cohortId?: string | null
  adds?: readonly BuildLinkAdd[]
  code?: string | null
  /** معاملاتُ التتبّع — `utm_source` و`utm_campaign` وأمثالُها، تُنقل كما هي */
  tracking?: Readonly<Record<string, string>>
}): string {
  const q = new URLSearchParams()
  if (input.cohortId) q.set('cohort', input.cohortId)
  const adds = (input.adds ?? []).filter((a) => a.courseId !== input.courseId)
  if (adds.length > 0) q.set('add', adds.map((a) => (a.cohortId ? `${a.courseId}:${a.cohortId}` : a.courseId)).join(','))
  if (input.code) q.set('code', input.code.trim().toUpperCase())
  for (const [k, v] of Object.entries(input.tracking ?? {})) if (v) q.set(k, v)
  const s = q.toString().replace(/%3A/gi, ':').replace(/%2C/gi, ',')
  return `/build/${encodeURIComponent(input.courseId)}${s ? `?${s}` : ''}`
}

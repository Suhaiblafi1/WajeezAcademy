/* رابطٌ إلى قسمٍ من الدليل يهبط عليه — لا على أوّل الدليل (٥ أكتوبر ٢٠٢٦).

   طلب صاحبُ المنصّة أن تقود روابطُ «التدريبُ معنا» إلى الدليل («مهلةُ الإعداد
   في الدليل · ما يجعل الموادَّ جيّدة») إلى القسم بعينه، أو أن تسمّيه على الأقلّ.
   وكان `/trainer/guide#standard` يفتح الدليلَ من أوّله — وعلى الهاتف قسمُ
   «معيارُ الموادّ» بعد ثمانيةٍ وعشرين ألفَ بكسل. ولذلك سببان يجتمعان:

   · `ScrollToTop` في `App.tsx` يرفع كلَّ تنقّلٍ إلى الأعلى، ويُلغي استعادةَ
     المتصفّح للموضع — عمدا، ولعلّةٍ مكتوبةٍ هناك فلا تُمسّ.
   · والمتصفّحُ يبحث عن `#standard` حين يُحمَّل المستند، والدليلُ محمّلٌ كسولا
     فلا يكون القسمُ قد وُجد بعد — فلا يجد شيئا، ولا يعيد البحث.

   فالدليلُ يهبط بنفسه حين يُركَّب: في الإطار التالي — بعد أن يمضي رفعُ الأعلى
   أيّا كان ترتيبُ الآثار — ثمّ مرّةً حين تصل الخطوط، فهي تغيّر أطوالَ ما فوق
   القسم. والصورُ لا تغيّرها: أبعادُها مكتوبةٌ على وسمها (`GUIDE_SHOTS`).

   ولا يُنازَع القارئ: إن مرّر أو لمس أو ضغط مفتاحا قبل الهبوط الثاني فقد اختار
   موضعَه، ولا يُشدّ منه.

   وبلا React ولا DOM — ليُختبر بنافذةٍ مصنوعة في
   `src/tests/trainer/guide-land-on-hash.test.ts`. */

/** ما يلزم من القسم */
export interface LandTarget {
  getBoundingClientRect(): { top: number }
}

/** ما يلزم من النافذة — وتوافقه `window` نفسُها */
export interface LandWindow {
  location: { hash: string }
  scrollY: number
  scrollTo(opts: ScrollToOptions): void
  getComputedStyle(el: LandTarget): { scrollMarginTop: string }
  addEventListener(type: string, fn: () => void, opts?: AddEventListenerOptions): void
  removeEventListener(type: string, fn: () => void): void
  requestAnimationFrame(fn: () => void): number
  cancelAnimationFrame(id: number): void
}

/** وما يلزم من المستند */
export interface LandDocument {
  getElementById(id: string): LandTarget | null
  fonts?: { ready: Promise<unknown> }
}

/** ما يقول إنّ القارئَ بدأ يتحرّك بنفسه */
export const READER_MOVES = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const

/** القسمُ الذي يقصده الرابط — إن كان من أقسام الصفحة، وإلّا فلا شيء */
export function hashTarget(hash: string, ids: readonly string[]): string | null {
  let id: string
  try {
    id = decodeURIComponent(hash.replace(/^#/, ''))
  } catch {
    return null
  }
  return ids.includes(id) ? id : null
}

/** يهبط على القسم، ويعيد تنظيفَه — فيُمرَّر إلى `useEffect` كما هو */
export function landOnHash(win: LandWindow, doc: LandDocument, ids: readonly string[]): () => void {
  const id = hashTarget(win.location.hash, ids)
  if (!id) return () => {}

  let done = false
  const stop = () => { done = true }
  /* عموديّا وحدَه — لا `scrollIntoView`: تلك تحرّك الأفقَ أيضا لتُظهر حافّةَ القسم،
     فإن زاد عرضُ شيءٍ في الصفحة على الشاشة انزاحت الصفحةُ جانبا وقُصّ نصُّها.
     والهامشُ فوق القسم هامشُه (`scroll-mt`) — فلا يختفي عنوانُه تحت الشريط. */
  const land = () => {
    const el = done ? null : doc.getElementById(id)
    if (!el) return
    const margin = parseFloat(win.getComputedStyle(el).scrollMarginTop) || 0
    win.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + win.scrollY - margin) })
  }

  READER_MOVES.forEach((t) => win.addEventListener(t, stop, { passive: true, once: true }))
  const frame = win.requestAnimationFrame(land)
  doc.fonts?.ready.then(land, () => {})

  return () => {
    stop()
    win.cancelAnimationFrame(frame)
    READER_MOVES.forEach((t) => win.removeEventListener(t, stop))
  }
}

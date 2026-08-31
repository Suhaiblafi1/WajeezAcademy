/* تخزينٌ محليّ لا يُسقط الصفحة — لأنّ سفاري يرمي حيث يصمت غيرُه.

   `localStorage` ليس دائما متاحا. وفي سفاري — وهو المتصفّح الذي يستعمل
   أهلُه إعداداتِ الخصوصية أكثر من غيرهم — **قراءةُ الكائن نفسِه ترمي
   `SecurityError`** حين يفعّل المستخدم «حظر كل ملفات تعريف الارتباط»
   (الإعدادات ← سفاري ← متقدّم)، وفي وضع القفل، وتاريخيّا في التصفّح الخاصّ
   عند الكتابة (`QuotaExceededError`).

   وخطورةُ ذلك ليست في فقدان تفضيلٍ صغير. كان في `Diagnostic.tsx` سطرٌ
   داخل `useState(() => ...)` — أي يعمل **أثناء التصيير**:

       useState(() => Boolean(localStorage.getItem("wajeez_user")))

   ورميُه يُسقط شجرة React كلَّها: صفحةٌ بيضاء بلا رسالةٍ ولا أثر. فمن يفتح
   الموقع بذلك الإعداد لا يرى شيئا أبدا، بينما يعمل عند الجميع — وهو أسوأ
   أنواع العطب: لا يظهر لمن يطوّر، ولا يُشتكى منه لأنّ صاحبه لا يرى ما
   يشتكي منه.

   والقاعدة: **التخزين رفاهيةٌ لا شرط.** من تعذّر عليه عمل الموقعُ عنده بلا
   ذاكرةٍ محليّة — يُطلب منه الدخول مرّة أخرى، ولا تنكسر صفحةٌ واحدة. */

type Store = 'local' | 'session'

/** يُقاس مرّةً ويُحفظ: الفحص نفسُه له كلفة، والحال لا تتغيّر في الجلسة */
let cache: Partial<Record<Store, Storage | null>> = {}

function probe(kind: Store): Storage | null {
  try {
    /* الوصول إلى الكائن قد يرمي — فلا يُفصل الفحص عن الاستعمال */
    const s = kind === 'local' ? window.localStorage : window.sessionStorage
    if (!s) return null
    /* وقد يوجد ويرمي عند الكتابة — فيُجرَّب بمفتاحٍ يُمحى فورا */
    const key = '__wajeez_probe__'
    s.setItem(key, '1')
    s.removeItem(key)
    return s
  } catch {
    return null
  }
}

function store(kind: Store): Storage | null {
  if (typeof window === 'undefined') return null
  if (!(kind in cache)) cache[kind] = probe(kind)
  return cache[kind] ?? null
}

/** للاختبار وحده — يُعيد قياس الإتاحة */
export function resetStorageProbeForTests(): void {
  cache = {}
}

export function safeGet(key: string, kind: Store = 'local'): string | null {
  try {
    return store(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

/** يعيد هل نجحت الكتابة — فمن يحتاج أن يعرف يعرف، ومن لا يحتاج يتجاهل */
export function safeSet(key: string, value: string, kind: Store = 'local'): boolean {
  try {
    const s = store(kind)
    if (!s) return false
    s.setItem(key, value)
    return true
  } catch {
    /* امتلأت الحصّة أو مُنع الموقع — والقيمةُ تفضيلٌ لا التزام */
    return false
  }
}

export function safeRemove(key: string, kind: Store = 'local'): void {
  try {
    store(kind)?.removeItem(key)
  } catch { /* الغرضُ أن يختفي — وقد اختفى أو لم يكن */ }
}

/** هل يستطيع هذا المتصفّح أن يتذكّر شيئا؟ — لرسالةٍ صادقة عند الحاجة */
export function storageAvailable(kind: Store = 'local'): boolean {
  return store(kind) !== null
}

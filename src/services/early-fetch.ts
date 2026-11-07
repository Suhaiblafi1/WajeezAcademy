/* طلباتٌ تبدأ مع الصفحة قبل أن تصل الحزمة (٥ نوفمبر ٢٠٢٦).

   قيس على الإنتاج: صفحةُ «ابنِ مسارك» لا تطلب الشعبَ ولا الكتالوجَ إلّا بعد أن تصل شيفرتُها كلُّها وتُرسَم — عند الثانية
   الخامسة على ٤ ميغابت، والطلبان نفسُهما ثانيةٌ أخرى. فسكربتٌ صغيرٌ في `index.html` يبدأهما مع فتح الصفحة، ويضع وعدَ
   كلٍّ في `window.__wajeezEarly`، ويأخذه أوّلُ من يطلبه هنا بدل أن يبدأ طلبا ثانيا.

   والوعدُ يُؤخذ مرّةً واحدة: جسمُ الردّ لا يُقرأ مرّتين، فمن جاء بعده يطلب كما كان. وإن خاب الطلبُ المبكر فالمعيدُ
   (`withRetry`) يعيد بطلبٍ عاديّ. والحارس: `src/tests/services/early-fetch.test.ts`. */

declare global {
  interface Window {
    __wajeezEarly?: Record<string, Promise<Response> | undefined>
  }
}

/** طلبٌ بدأ مع الصفحة لهذا المسار — يُعطى مرّةً ثمّ يُنسى. أو `null` فيطلب صاحبُه بنفسه */
export function takeEarly(path: string): Promise<Response> | null {
  if (typeof window === 'undefined') return null
  const box = window.__wajeezEarly
  const p = box?.[path]
  if (!box || !p) return null
  delete box[path]
  return p
}

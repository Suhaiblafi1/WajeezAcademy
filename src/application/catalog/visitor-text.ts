/* نصُّ الكتالوج كما يقرؤه زائر — لا كما كُتب للمؤلِّفين.

   حقلُ «ليس لك إن…» (`not_for`) أصدقُ سطرٍ في الكتالوج، وفيه من عشرين مسارا
   **اثنان يحيلان بمعرِّفٍ داخليّ**: «يُوجّه إلى PW-STU-002» و«يبدأ بـPW-STU-003».
   وهذه لغةُ من يقرأ الجدول لا من يقرأ الصفحة — الزائرُ يرى رمزا لا يعني له
   شيئا، في الموضع الذي يُفترض أن يوجّهه.

   فيُستبدَل المعرِّفُ باسمِ ما يشير إليه. وما لا يُعرَف اسمُه تُحذف إحالتُه مع
   جملتها: **إحالةٌ إلى رمزٍ أسوأُ من لا إحالة**. */

const REF = /\b(?:PW|C)-[A-Z]{2,4}-\d{2,3}\b/g

/** يستبدل المعرِّفاتِ الداخليّةَ بأسمائها — وما لم يُعرَف تُحذف جملتُه */
export function resolveCatalogRefsAr(
  text: string, nameOf: (id: string) => string | undefined,
): string {
  if (!text || !REF.test(text)) {
    REF.lastIndex = 0
    return text
  }
  REF.lastIndex = 0
  /* الجملُ تُفصَل بـ«؛» و«.» — فحذفُ إحالةٍ مجهولةٍ لا يُشوّه ما حولها */
  const sentences = text.split(/(?<=[.؛])\s*/)
  const kept: string[] = []
  for (const sentence of sentences) {
    REF.lastIndex = 0
    if (!REF.test(sentence)) {
      kept.push(sentence)
      continue
    }
    REF.lastIndex = 0
    let unknown = false
    const replaced = sentence.replace(REF, (id) => {
      const name = nameOf(id)
      if (!name) { unknown = true; return id }
      return `«${name}»`
    })
    if (!unknown) kept.push(replaced)
  }
  return kept.join(' ').replace(/\s+/g, ' ').trim()
}

/* ما يُحفَظ في المفضّلة — قسمةٌ واحدةٌ يقرؤها الخادمُ والشاشة (ع-٨).

   ═══ لمَ نوعان لا نوعٌ واحد ═══

   كانت المفضّلةُ **مساراتٍ وحدَها**: `toggleFavorite(pathwayId)`، وزرُّها
   لا يُركَّب إلّا على بطاقة مسار. وع-٨ يقول «المسارات والدورات» — ومن رأى
   دورةً تناسبه فلم يجد قلبا عليها، لم يجد بابا يحفظها به أصلا.

   ═══ ولمَ رمزٌ نصّيٌّ لا مفتاحٌ أجنبيّ ═══

   الكتالوجُ مصدرُه ملفّاتٌ تُبنى (`src/data/`)، لا صفوفٌ في القاعدة. فلا
   مفتاحَ أجنبيّا يُشير إليه، والرمزُ (`P-…` · `C-…`) هو هويّتُه الثابتة.

   وتبعةُ ذلك مقبولةٌ ومقصودة: صفٌّ محفوظٌ لرمزٍ حُذف من الكتالوج يبقى في
   القاعدة ولا يُعرض — لأنّ العرضَ يقابل المحفوظَ بالكتالوج الحيّ. وحذفُه
   من القاعدة يحتاج مسحا دوريّا لا يستحقّه صفٌّ بحجم سطر. */

/** ما يُحفَظ. والترتيبُ مقصود: المسارُ أوّلا فهو وحدةُ القرار في وجيز */
export const FAVORITE_KINDS = ['pathway', 'course'] as const
export type FavoriteKind = (typeof FAVORITE_KINDS)[number]

/** أطولُ رمزٍ يُقبل — حاجزٌ على المدخَل لا وصفٌ للكتالوج */
export const MAX_REF_LEN = 64

export function isFavoriteKind(kind: string): kind is FavoriteKind {
  return (FAVORITE_KINDS as readonly string[]).includes(kind)
}

export interface FavoriteRef {
  kind: FavoriteKind
  refId: string
}

/** لماذا يُردّ هذا المحفوظُ — أو `null` فيُقبل */
export function favoriteBlockerAr(kind: string, refId: string): string | null {
  if (!isFavoriteKind(kind)) return 'لا يُحفَظ إلّا مسارٌ أو دورة'
  const id = refId.trim()
  if (!id) return 'لا رمزَ لما يُحفَظ'
  if (id.length > MAX_REF_LEN) return 'رمزٌ أطولُ ممّا يكون'
  return null
}

/** مفتاحٌ واحدٌ للنوع والرمز — تُقارَن به الحالةُ في الشاشة بلا بحثٍ في مصفوفة */
export function favoriteKey(kind: string, refId: string): string {
  return `${kind}:${refId}`
}

/** مجموعةُ مفاتيحَ من صفوفٍ محفوظة */
export function favoriteKeySet(rows: readonly FavoriteRef[]): Set<string> {
  return new Set(rows.map((r) => favoriteKey(r.kind, r.refId)))
}

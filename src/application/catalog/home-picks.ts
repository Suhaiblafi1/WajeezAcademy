/* مختاراتُ الرئيسة — كم يُعرض تحت كلّ رقاقةٍ، ومن أين يُؤتى بالنقص.

   ═══ العطبُ الذي يزيله ═══

   شريطا الرئيسة يُصيَّران من قائمتَي انتقاءٍ تحريريّ (`bestsellers` في
   `data/pathways.ts` و`bestsellerCourses` في `data/courses.ts`)، ثمّ يُصفَّيان
   بالمجال. والانتقاءُ التحريريُّ لا يوزَّع بالتساوي على المجالات — فكان
   الزائرُ يضغط رقاقةً فيرى **بطاقةً واحدة** في شريطٍ عرضُه ثلاثُ بطاقات:
   «إدارة المشاريع والعمليات ١» و«القطاع الحكومي ١». ورقاقةٌ تفتح على بطاقةٍ
   واحدةٍ تُقرأ عطبا لا تصفية.

   ═══ والقاعدةُ التي قرّرها صاحب المنصّة (١٥ سبتمبر ٢٠٢٦) ═══

   «اجعل الدورات والمسارات المختارة على الأقلّ ثلاثا لكلّ فلتر إن وُجد، أو
   اقترح مساراتٍ أخرى إن كان النظام يقول إنّ هذا الفلتر له أقلّ من ثلاثة
   مسارات. والحدّ الأعلى أربعة لكلّ فلتر، في المسارات والدورات.»

   فحدّان لا واحد:

   • **أرضيّةٌ ثلاثة** — إن قصُر الانتقاءُ التحريريُّ عن ثلاثةٍ في مجالٍ ما،
     أُتِمَّ من كتالوج المجال نفسِه؛ فإن كان **المجالُ كلُّه** أقلَّ من ثلاثةٍ
     («القطاع الحكومي» مسارٌ واحدٌ في الكتالوج، و«التسويق والمبيعات» مساران)
     أُتِمَّ من خارجه — وهو نصُّ الطلب: «أو اقترح مساراتٍ أخرى». والبطاقةُ
     الآتيةُ من خارج المجال **تحمل اسمَ مجالها** فلا تدّعي الرقاقةُ أنّها منها.

   • **سقفٌ أربعة** — على كلّ رقاقةٍ بما فيها «الكل». الشريطُ دليلٌ لا كتالوجٌ
     ثانٍ، وتحته بابٌ إلى الكتالوج كاملا.

   ═══ ولمَ يبقى المقترَحُ مُميَّزا عن المختار ═══

   الوسمُ الذهبيُّ على البطاقة يقول «هذه من اختيارنا» — وهو ادّعاءٌ تحريريّ
   يملكه مؤلِّفُ القائمة وحدَه. فما جاء لإتمام العدد يُعاد بـ`note: null`،
   وللشاشة أن تسمّيه اقتراحا؛ ولا يلبس وسمَ من اختير.

   ═══ ولمَ عدُّ الرقاقة يُشتقّ من المعروض ═══

   كان العدُّ يُحسب على حدةٍ (`countBy`) والمعروضُ يُقتطع على حدة، فيفترقان
   بلا أن يقول أحدُهما شيئا: الرقاقةُ تَعِد بستٍّ والشريطُ يعطي ثلاثا. فـ
   `filterRows` تُخرج **نفسَ** ما يُعرَض، ويُقرأ العدُّ من طوله. */

/** رقاقةُ «الكل» — ليست مجالا بل غيابُ تصفية */
export const ALL_AR = 'الكل'

/** أرضيّةُ الرقاقة: ما دون الثلاثة يُتَمّ من الكتالوج */
export const MIN_PER_FILTER = 3

/** وسقفُها: ما فوق الأربعة يُقتطع */
export const MAX_PER_FILTER = 4

/** انتقاءٌ تحريريّ: معرِّفٌ ووسمُه المكتوب */
export interface EditorialPick {
  id: string
  note: string
}

/** من أين جاء العنصر إلى الرقاقة:

    • `editorial` — من الانتقاء التحريريّ، وله وسمُه المكتوب.
    • `domain`    — من كتالوج المجال نفسِه، جاء لإتمام الثلاثة.
    • `other`     — من خارج المجال، حين لا يبلغ المجالُ كلُّه ثلاثةً. */
export type PickKind = 'editorial' | 'domain' | 'other'

/** عنصرٌ كما يُعرض — ووسمُه `null` إن جاء لإتمام العدد لا اختيارا */
export interface ShownPick<T> {
  item: T
  note: string | null
  kind: PickKind
}

export interface PickSource<T> {
  /** الانتقاءُ التحريريُّ بترتيبه — وهو المقدَّم دائما */
  editorial: readonly EditorialPick[]
  /** كتالوجُ المجال كلُّه — منه يُؤخذ ما يُتِمّ الثلاثة */
  pool: readonly T[]
  idOf: (item: T) => string
  domainOf: (item: T) => string
  /** ما يُعرض في مكانٍ آخر من القسم فلا يتكرّر هنا — البطاقةُ المميّزة */
  exclude?: readonly string[]
}

/** ما يُعرض تحت رقاقةٍ بعينها: المختارُ أوّلا، ثمّ اقتراحاتٌ حتّى الثلاثة، وسقفُه أربعة.

    والإتمامُ على ثلاث درجاتٍ تُستنفَد بترتيبها — وكلُّ درجةٍ أبعدُ ممّا قبلها:

      ١) المختارُ من هذا المجال — إلى السقف.
      ٢) فبقيّةُ هذا المجال من الكتالوج — إلى الأرضيّة.
      ٣) فمن خارجِه — وهذه لا تقع إلّا حين **المجالُ نفسُه** أقلُّ من ثلاثة في
         الكتالوج كلِّه («القطاع الحكومي» مسارٌ واحد، و«التسويق والمبيعات»
         مساران). فلا رقاقةَ تُفتح على بطاقةٍ واحدةٍ في شريطٍ عرضُه ثلاث.

    والمقترَحُ من خارج المجال **يُعلن مجالَه** على البطاقة (`kind: 'other'`)،
    فالرقاقةُ لا تدّعي أنّه منها. */
export function shownFor<T>(source: PickSource<T>, domain: string): ShownPick<T>[] {
  const { editorial, pool, idOf, domainOf, exclude = [] } = source
  const byId = new Map(pool.map((x) => [idOf(x), x]))
  const taken = new Set<string>(exclude)
  const inDomain = (item: T) => domain === ALL_AR || domainOf(item) === domain

  const shown: ShownPick<T>[] = []
  for (const pick of editorial) {
    if (shown.length >= MAX_PER_FILTER) return shown
    const item = byId.get(pick.id)
    if (!item || taken.has(pick.id) || !inDomain(item)) continue
    taken.add(pick.id)
    shown.push({ item, note: pick.note, kind: 'editorial' })
  }
  /* والإتمامُ إلى الأرضيّة لا إلى السقف: الاقتراحُ يسدّ نقصا ولا يزاحم
     المختارَ بمقعدٍ رابع. */
  const fill = (kind: PickKind, candidates: readonly T[]) => {
    for (const item of candidates) {
      if (shown.length >= MIN_PER_FILTER) return
      const id = idOf(item)
      if (taken.has(id)) continue
      taken.add(id)
      shown.push({ item, note: null, kind })
    }
  }
  fill('domain', pool.filter(inDomain))
  /* ومن خارج المجال: المختارُ أوّلا — فأقربُ ما يُقترح على من ضاق مجالُه هو
     ما اختاره المؤلِّفُ لغيره، لا أوّلُ ما يقع عليه ترتيبُ الكتالوج. */
  if (domain !== ALL_AR) {
    const editorialItems = editorial.flatMap((pick) => {
      const item = byId.get(pick.id)
      return item ? [item] : []
    })
    fill('other', editorialItems)
    fill('other', pool)
  }
  return shown
}

/** الرقاقاتُ ومحتوى كلٍّ منها — مجالاتُ الانتقاء التحريريّ وحدَها.

    ولمَ لا كلُّ مجالٍ في الكتالوج: عنوانُ الشريط «من اختيارنا». فمجالٌ لم
    يُختر منه شيءٌ قطّ لا تُفتح له رقاقةٌ تعرض اقتراحاتٍ خالصةً تحت هذا
    العنوان — الكتالوجُ كاملا خلف البابِ تحته. */
export function filterRows<T>(source: PickSource<T>): { domain: string; shown: ShownPick<T>[] }[] {
  const { editorial, pool, idOf, domainOf, exclude = [] } = source
  const skip = new Set(exclude)
  const byId = new Map(pool.map((x) => [idOf(x), x]))
  const domains: string[] = []
  for (const pick of editorial) {
    const item = byId.get(pick.id)
    if (!item || skip.has(pick.id)) continue
    const d = domainOf(item)
    if (!domains.includes(d)) domains.push(d)
  }
  return domains.map((domain) => ({ domain, shown: shownFor(source, domain) }))
}

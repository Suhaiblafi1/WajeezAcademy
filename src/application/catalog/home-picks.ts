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

   • **سقفٌ أربعة** — على كلّ رقاقةِ **مجال**. الشريطُ دليلٌ لا كتالوجٌ ثانٍ،
     وتحته بابٌ إلى الكتالوج كاملا.

   ═══ و«الكل» ليست رقاقةً من هذه الرقاقات (١٨ سبتمبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة: «فلتر الكل للمسارات والدورات يجب أن يضمّ الكل ولا
   يُعامَل معاملةَ بقيّة الفلاتر».

   والعطبُ الذي رآه مقيس: كلُّ رقاقةِ مجالٍ تقول «٣» وسبعُ رقاقاتٍ تعرض
   **ثمانيَ عشرةَ** بطاقةً متمايزةً في المسارات (وإحدى وعشرين في الدورات)،
   و«الكل» فوقهنّ تقول «٤». فالرقاقةُ التي معناها **غيابُ التصفية** كانت
   أضيقَ من كلِّ رقاقةٍ تحتها — والزائرُ الذي يضغطها ليرى كلَّ شيءٍ يرى أقلَّ
   ممّا كان يراه.

   وعلّتُه أنّ `MAX_PER_FILTER` كان يُطبَّق عليها كما يُطبَّق على المجالات.
   والحدُّ نصُّه «لكلّ فلتر» — و«الكل» ليست فلترا بل رفعُه.

   فصارت «الكل» **اتّحادَ ما تعرضه الرقاقات**: كلُّ مختارٍ أوّلا بترتيبه، ثمّ
   كلُّ ما أتمّت به رقاقةٌ نقصَها. فلا بطاقةَ تُرى تحت رقاقةٍ ولا تُرى تحت
   «الكل» — وهو معنى أن تضمّ الكل.

   ولمَ ليست الكتالوجَ كلَّه: عنوانُ القسم «من اختيارنا»، والـ١١٣ دورةً خلف
   البابِ تحته. فـ«الكل» ترفع التصفيةَ عن **هذا** الشريط، ولا تستبدل به
   الكتالوج.

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

/** أرضيّةُ رقاقةِ المجال: ما دون الثلاثة يُتَمّ من الكتالوج */
export const MIN_PER_FILTER = 3

/** وسقفُها: ما فوق الأربعة يُقتطع. و«الكل» خارجَ الحدّين — انظر رأسَ الملفّ */
export const MAX_PER_FILTER = 4

/** انتقاءٌ تحريريّ: معرِّفٌ ووسمُه المكتوب */
export interface EditorialPick {
  id: string
  note: string
}

/** من أين جاء العنصر إلى الرقاقة:

    • `editorial` — من الانتقاء التحريريّ، وله وسمُه المكتوب.
    • `domain`    — من كتالوج المجال نفسِه، جاء لإتمام الثلاثة.
    • `other`     — من خارج المجال، حين لا يبلغ المجالُ كلُّه ثلاثةً.

    وتحت «الكل» لا مجالَ يُنسَب إليه شيء، فكلُّ ما لم يُختر تحريريّا يُعاد
    `other`: البطاقةُ تُعلن مجالَها على وجهها بدل أن تُحيل إلى رقاقةٍ لا
    وجودَ لها («مقترحٌ في هذا المجال» — أيُّ مجال؟). */
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

/** ما يُعرض تحت رقاقةٍ بعينها — و«الكل» بابُها غيرُ باب المجالات.

    • رقاقةُ مجالٍ: مختارُه أوّلا إلى السقف، ثمّ إتمامٌ إلى الأرضيّة
      (`shownInDomain`).
    • «الكل»: اتّحادُ ما تعرضه الرقاقاتُ كلُّها، بلا سقف (`shownForAll`). */
export function shownFor<T>(source: PickSource<T>, domain: string): ShownPick<T>[] {
  return domain === ALL_AR ? shownForAll(source) : shownInDomain(source, domain)
}

/** ما يُعرض تحت رقاقةِ مجال: المختارُ أوّلا، ثمّ اقتراحاتٌ حتّى الثلاثة، وسقفُه أربعة.

    والإتمامُ على ثلاث درجاتٍ تُستنفَد بترتيبها — وكلُّ درجةٍ أبعدُ ممّا قبلها:

      ١) المختارُ من هذا المجال — إلى السقف.
      ٢) فبقيّةُ هذا المجال من الكتالوج — إلى الأرضيّة.
      ٣) فمن خارجِه — وهذه لا تقع إلّا حين **المجالُ نفسُه** أقلُّ من ثلاثة في
         الكتالوج كلِّه («القطاع الحكومي» مسارٌ واحد، و«التسويق والمبيعات»
         مساران). فلا رقاقةَ تُفتح على بطاقةٍ واحدةٍ في شريطٍ عرضُه ثلاث.

    والمقترَحُ من خارج المجال **يُعلن مجالَه** على البطاقة (`kind: 'other'`)،
    فالرقاقةُ لا تدّعي أنّه منها. */
function shownInDomain<T>(source: PickSource<T>, domain: string): ShownPick<T>[] {
  const { editorial, pool, idOf, domainOf, exclude = [] } = source
  const byId = new Map(pool.map((x) => [idOf(x), x]))
  const taken = new Set<string>(exclude)
  const inDomain = (item: T) => domainOf(item) === domain

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
  const editorialItems = editorial.flatMap((pick) => {
    const item = byId.get(pick.id)
    return item ? [item] : []
  })
  fill('other', editorialItems)
  fill('other', pool)
  return shown
}

/** «الكل»: كلُّ ما تعرضه الرقاقاتُ مجموعا بلا تكرارٍ ولا سقف.

    المختارُ كلُّه أوّلا بترتيب المؤلِّف — فلا يُدفن اختيارُه تحت إتمامِ عدد —
    ثمّ ما أتمّت به كلُّ رقاقةٍ نقصَها بترتيب الرقاقات. فما رآه الزائرُ تحت
    رقاقةٍ يراه هنا، وهو ما يعنيه أن «تضمّ الكل».

    ولمَ لا يُستدعى `shownInDomain` بـ«الكل» نفسِها: تلك تُصفّي ثمّ تُقتطع —
    وهذان بالضبط ما لا تفعله رقاقةٌ معناها رفعُ التصفية. */
function shownForAll<T>(source: PickSource<T>): ShownPick<T>[] {
  const { editorial, pool, idOf, exclude = [] } = source
  const byId = new Map(pool.map((x) => [idOf(x), x]))
  const taken = new Set<string>(exclude)
  const shown: ShownPick<T>[] = []
  const put = (item: T, note: string | null, kind: PickKind) => {
    const id = idOf(item)
    if (taken.has(id)) return
    taken.add(id)
    shown.push({ item, note, kind })
  }

  for (const pick of editorial) {
    const item = byId.get(pick.id)
    if (item) put(item, pick.note, 'editorial')
  }
  /* وما أتمّت به الرقاقاتُ نقصَها يُعاد `other` لا `domain`: لا مجالَ نشطا
     هنا يُشار إليه بـ«هذا المجال»، فالبطاقةُ تسمّي مجالَها. */
  for (const domain of chipDomains(source)) {
    for (const s of shownInDomain(source, domain)) put(s.item, null, 'other')
  }
  return shown
}

/** مجالاتُ الرقاقات بترتيب أوّلِ ظهورٍ في الانتقاء التحريريّ.

    ولمَ لا كلُّ مجالٍ في الكتالوج: عنوانُ الشريط «من اختيارنا». فمجالٌ لم
    يُختر منه شيءٌ قطّ لا تُفتح له رقاقةٌ تعرض اقتراحاتٍ خالصةً تحت هذا
    العنوان — الكتالوجُ كاملا خلف البابِ تحته. */
function chipDomains<T>(source: PickSource<T>): string[] {
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
  return domains
}

/** الرقاقاتُ ومحتوى كلٍّ منها — مجالاتُ الانتقاء التحريريّ وحدَها.
    و«الكل» ليست منها: الشاشةُ تصدّرها بنفسها، ومحتواها اتّحادُ هذه. */
export function filterRows<T>(source: PickSource<T>): { domain: string; shown: ShownPick<T>[] }[] {
  return chipDomains(source).map((domain) => ({ domain, shown: shownInDomain(source, domain) }))
}

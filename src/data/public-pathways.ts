/* المساراتُ العامّة — ما يراه الزائرُ في قسم المسارات، مبنيّةً من الدورات المفتوحة وحدَها.

   ═══ القرار (٢١ أكتوبر ٢٠٢٦) ═══

   صاحبُ المنصّة: «نبني مساراتٍ من هذه الدورات فقط لتكون معروضةً للعوامّ بمسمّياتٍ جديدةٍ وأهدافٍ
   جديدة، ونخفي ما لدينا حاليّا، ويظهر تلقائيّا إذا كانت كلُّ دوراته تفعّلت لدينا كشُعَب». ثمّ اعتمد
   تجميعَ الدورات الثلاثين المفتوحة في ثمانيةِ مسارات كما هو، واختار اسمَ كلٍّ وهدفَه واحدا واحدا.
   والنصوصُ في `catalog/public-pathways.json`.

   ═══ ولمَ قائمةٌ ثانيةٌ لا مساراتٌ تُضاف إلى `launch_pathways` ═══

   تلك يقرؤها محرّكُ التشخيص كلَّها: يرتّبها بفجوة المهارات (`pathway-score.ts`) ويبني منها خطّته.
   فمسارٌ جديدٌ فيها يغيّر نتيجةَ كلّ متعلّمٍ ويُسقط إعادةَ التشغيل الذهبيّة — لأجل عرضٍ في قائمة.
   فتبقى هي للتشخيص كما هي، وصفحاتُها مفتوحةٌ لمن يملك رابطَها (والتشخيصُ يحيل إليها)، وتُرفع من
   القوائم العامّة وحدَها. وهذه للقوائم: لا يقرؤها التشخيص، ولا تُكتب في قاعدة البيانات.

   ═══ ومتى يُعرض المسار ═══

   حين تكون لكلّ دوراته شعبةٌ معروضة — `listedWhole` في `application/catalog/listed-courses.ts`،
   بالجواب نفسِه الذي يرشّح قسمَ الدورات. فإن انتهت شعبةُ دورةٍ منه غاب، وإن فُتحت عاد.

   ═══ ومساراتُ الشتاء الشخصيّة (٢٨ أكتوبر ٢٠٢٦) ═══

   صاحبُ المنصّة: «المساراتُ فيها دوراتٌ خارج فصل الشتاء. اصنع مساراتٍ جديدةً تكون مكسا بين الدورات بحسب فئةٍ
   معيّنةٍ وأهدافٍ معيّنة، وكأنّها تجاربُ لأشخاصٍ كثرٍ قاموا بالتشخيص ونتج مسارٌ شخصيٌّ خليطٌ بين دورات فصل
   الشتاء.. كرّر الدورةَ في أكثرَ من مسارٍ لا يهمّ.. وأعطِ مسمّياتٍ قويّةً تعكس هدفَ الشخص.. وأبقِ المساراتِ
   الحاليّةَ التي فيها دوراتٌ مستقبليّةٌ خارج فصل الشتاء مخفيّةً مع ما أخفينا قبل».

   · **المساراتُ كلُّها لفصلٍ واحد** (`season` في الملفّ): تُعرض حين تكون لكلّ دوراتها شعبةٌ **تبدأ فيه**. فخفيت
     بذلك «من الفكرة إلى خطة عمل» و«الخطابة» و«التفاوض» و«الأمن والسحابة» — في كلٍّ دورةٌ شعبتُها في الربيع أو
     بعده — وتعود وحدَها إن فُتحت لها شعبةٌ في الشتاء. وما أُخفي قبلُ (مساراتُ الكتالوج) باقٍ على حاله.
   · **والجديدةُ عشرة**، لكلٍّ شخصٌ وهدف، من الدورات التي لها شعبةٌ في الشتاء وفي الكتالوج. واختيرت دوراتُ كلٍّ
     بلا تداخلٍ في لقاءات شعبها يومَ بُنيت — فمن أخذ المسارَ كلَّه حضره كلَّه. وما يتداخل بعدُ يحلّه مجدولُ
     الفصل: دورتان في مسارٍ عامٍّ واحدٍ لا تتعارضان (`application/terms/schedule-clash.ts`). */

import data from './catalog/public-pathways.json'
import { getCoreCatalogRaw, onCoreCatalogInstalled, type CoreCatalogRaw } from './core-catalog-source'
import type { Pathway } from './pathways'

export interface PublicPathway extends Pathway {
  /** دوراتُه بترتيب دراستها — وهي ما يُشترط أن تكون لكلٍّ منها شعبة */
  courseIds: string[]
  /** مجالُه في رقاقات التصفية (`pathwayDomains`) — مكتوبٌ لا مشتقّ: لا مجالَ تشخيصٍ له */
  domain: string
  /** وفئتُه المستهدفة (`pathwayCategory`) */
  category: string
  delivery: string
  /** فصلُه — «2026-nov_jan»: لا يُعرض إلّا ولكلّ دورةٍ منه شعبةٌ تبدأ فيه */
  season: string
}

interface PublicPathwaySource {
  id: string
  title: string
  short_title: string
  domain: string
  category: string
  level: string
  audience: string
  not_for: string
  after: string
  capstone: string
  course_ids: string[]
}

const SOURCE = data.pathways as PublicPathwaySource[]

function buildOne(raw: CoreCatalogRaw, p: PublicPathwaySource): PublicPathway {
  const found = p.course_ids
    .map((id) => raw.courses.find((c) => c.course_id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
  const totalHours = found.reduce((s, c) => s + c.total_hours, 0)
  /* أسابيعُ الدورة كما في `data/courses.ts` — والمسارُ دوراتُه متتالية */
  const durationWeeks = found.reduce((s, c) => s + Math.max(1, Math.ceil(c.total_hours / 7)), 0)
  const skills: string[] = []
  for (const c of found) for (const n of c.skill_names_ar) if (!skills.includes(n)) skills.push(n)
  return {
    id: p.id,
    name: p.title,
    shortName: p.short_title,
    audience: p.audience,
    notFor: p.not_for,
    sector: 'B2C',
    level: p.level as Pathway['level'],
    durationWeeks,
    weeklyHours: `${durationWeeks > 0 ? Math.round(totalHours / durationWeeks) : 0} ساعات`,
    coreSkills: skills.slice(0, 5),
    transformation: p.after,
    output: p.capstone,
    courseCount: p.course_ids.length,
    totalHours,
    /* مجموعُ أسعار القائمة — والحقلُ لا تقرؤه شاشة: السعرُ المعروضُ من `pathway-offer.ts` */
    price: found.reduce((s, c) => s + (c.list_price ?? 0), 0),
    courseIds: [...p.course_ids],
    domain: p.domain,
    category: p.category,
    delivery: data.delivery,
    season: data.season,
  }
}

const build = (raw: CoreCatalogRaw) => SOURCE.map((p) => buildOne(raw, p))

export const publicPathways: PublicPathway[] = build(getCoreCatalogRaw())

/* الساعاتُ والمهاراتُ من الكتالوج، وهو يصل لاحقا — فتُعاد التعبئةُ في المكان كأخواتها */
onCoreCatalogInstalled(() => {
  publicPathways.splice(0, publicPathways.length, ...build(getCoreCatalogRaw()))
})

export const publicPathwayById = (id: string): PublicPathway | undefined =>
  publicPathways.find((p) => p.id === id)

/** مختاراتُ الرئيسة من المسارات العامّة — انتقاءٌ تحريريٌّ بوسمه، وأوّلُه البطاقةُ المميّزة */
export const publicBestsellers: { id: string; note: string }[] = data.picks

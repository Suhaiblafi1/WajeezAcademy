/* صناديقُ الدورات في صفحة «منحة مؤثرين وجيز» — أخفُّ، وقائمةٌ واحدةٌ أرخصُها أوّلا (٢٢ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «اجعل صناديقَ الدورات أخفّ: اسمُ المدرّب تحت الصورة بكلمتين فقط، واحذف النصوصَ تحت اسم الدورة،
   واجعل الصندوقَ أصغر، واعرض كلَّ الدورات بطريقةٍ واحدة (قائمةٌ واحدة) لا بالأقسام. والتغييرُ لحملات المؤثّرين وحدَها.
   وابدأ الدوراتِ بالأرخص — وابدأ بالثلاث التي استعملناها قبل».

   فالثلاثُ أوّلا بترتيبها (ما كان منها في قائمة الصفحة)، ثمّ الباقي بالسعر الذي يراه الزائرُ صعودا، وما تساوى سعرُه
   فالأقربُ بدءا. والصفحةُ تبني صفوفَها منه (`MemberGrantPage.tsx`، `variant="influencer"`)، وصفحاتُ الأعضاء والعامّة
   وبلاك فرايدي والشركاء على حالها. والحارس: `src/tests/commerce/influencer-light-cards.test.ts`. */

/** الدوراتُ الثلاثُ التي «استعملناها قبل» — دوراتُ مسار بلاك فرايدي العامّ `/go/BF80` (`PUBLIC_PATHS.BF80`) بترتيبها:
    مهارات المقابلات الوظيفية، ثمّ أساسيات التخطيط الاستراتيجي، ثمّ الاستدامة ومتطلبات ESG. تُعرض أوّلا في صفحة المؤثّر */
export const INFLUENCER_FEATURED_COURSES: readonly string[] = ['C-JOB-104', 'C-MGR-107', 'C-BIZ-107']

/** ما يلزم الترتيبَ من الدورة */
export interface OrderableCourse {
  courseId: string
  price: number
  startsAt: string | Date | null
}

/** ترتيبُ صفحة المؤثّر: المميّزةُ أوّلا بترتيبها — وما غاب منها عن القائمة يُتخطّى — ثمّ الباقي بالسعر الذي يراه الزائرُ
    صعودا (`priceOf`)، والتساوي بالأقرب بدءا، ثمّ بموضعها في القائمة. لا يغيّر القائمةَ التي أُعطيها */
export function influencerCourseOrder<T extends OrderableCourse>(
  courses: readonly T[],
  priceOf: (x: T) => number = (x) => x.price,
  featured: readonly string[] = INFLUENCER_FEATURED_COURSES,
): T[] {
  const first = featured.map((id) => courses.find((x) => x.courseId === id)).filter((x): x is T => !!x)
  const at = (x: T) => (x.startsAt ? new Date(x.startsAt).getTime() : Number.POSITIVE_INFINITY)
  const rest = courses
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => !featured.includes(x.courseId))
    .sort((a, b) => priceOf(a.x) - priceOf(b.x) || at(a.x) - at(b.x) || a.i - b.i)
    .map(({ x }) => x)
  return [...first, ...rest]
}

/* ما يُلصق بما بعده فيصيران كلمةً واحدة («عبد الله»، «أبو زيد») — وما يُلصق بما قبله («نور الدين»، «فتح الله»).
   و«بن» لا تُلصق: «محمد بن سلمان» يُقال «محمد سلمان» */
const JOINS_NEXT = new Set(['عبد', 'ابو', 'أبو', 'آل'])
const JOINS_PREV = new Set(['الدين', 'الله'])

/** اسمُ المدرّب تحت صورته بكلمتين على الأكثر: أوّلُ اسمه وآخرُه. واسمٌ من كلمةٍ أو كلمتين يبقى كما هو، والمركّبُ
    («عبد الله»، «نور الدين») كلمةٌ واحدة فلا يُقطع نصفُه */
export function trainerShortNameAr(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const parts: string[] = []
  for (const w of words) {
    const prev = parts[parts.length - 1]
    if (prev !== undefined && (JOINS_NEXT.has(prev.split(' ').pop()!) || JOINS_PREV.has(w))) parts[parts.length - 1] = `${prev} ${w}`
    else parts.push(w)
  }
  return parts.length <= 2 ? parts.join(' ') : `${parts[0]} ${parts[parts.length - 1]}`
}

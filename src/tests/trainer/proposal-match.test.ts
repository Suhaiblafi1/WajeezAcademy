/* ترشيحُ أقربِ رمزٍ لاقتراحِ مدرّب — وما يَعِد به وما لا يَعِد.

   الترشيحُ يُعرض للأدمن قبل أن يقرّر، فخطؤه يقع في اتّجاهَين:

   · **يرشّح ما لا يشبه** — فيُربط اقتراحٌ برمزٍ ليس منه، وتضيع دورةٌ كان
     يجب أن تُنشأ.
   · **أو يرشّح كلَّ شيء** — وقائمةٌ ترشّح واحدا وثمانين رمزا لم ترشّح شيئا،
     فيتجاوزها الأدمن ويعود إلى ما كان.

   والثاني هو الذي يمرّ صامتا: لا خطأ، ولا شكوى، ولا يُقاس إلّا بحارسٍ يعدّ
   ما خرج. ولذلك يُفحص هنا الطرفان معا. */

import { describe, expect, it } from 'vitest'
import { suggestCourses, tokensAr, trainerFamilies } from '@/application/trainer/proposal-match'

/** كتالوجٌ مصغَّرٌ يشبه الحقيقيَّ في تنوّعه */
const CATALOG = [
  { id: 'C-COM-101', titleAr: 'الخطابة وفنّ الإلقاء', extraAr: ['إلقاء أمام جمهور'] },
  { id: 'C-COM-102', titleAr: 'مهارات العرض والتقديم', extraAr: ['بناء الشرائح'] },
  { id: 'C-FIN-101', titleAr: 'الماليّة لغير الماليّين', extraAr: ['قراءة القوائم الماليّة'] },
  { id: 'C-BIZ-101', titleAr: 'إدارة المشاريع الصغيرة', extraAr: ['التسعير', 'التدفّق النقديّ'] },
]

describe('تقطيع النصّ — ما يعتدّ به كلمة', () => {
  it('⚠️ ألفاظ الجنس تسقط — وإلّا طابقت «دورة» الكتالوج كلّه', () => {
    /* وهذا هو العطبُ الصامت: ترشيحٌ لكلّ شيءٍ يُقرأ ترشيحا لا شيء. */
    expect([...tokensAr('دورة مهارات أساسيات')], 'لفظ جنس نجا من التصفية').toEqual([])
  })

  it('وأدوات اللغة تسقط معها، ويبقى ما يميّز', () => {
    expect([...tokensAr('الخطابة في العمل')]).toEqual(['الخطابه', 'العمل'])
  })

  it('⚠️ والكلمة تبقى كما كتبت — فلا يعرض للأدمن سبب لا وجود له في لغة', () => {
    /* «التزام» ليست «ال» + «تزام». ونزعُها عن الكلمة نفسِها كان يُخرج
       «تشترك في: تزام» — ومن قرأ سببا لا يفهمه لم يعد يقرأ الأسبابَ أصلا. */
    expect([...tokensAr('التزام')]).toEqual(['التزام'])
    expect([...tokensAr('الخطابة')]).toEqual(['الخطابه'])
  })

  it('⚠️ ومع ذلك تلتقي «الخطابة» بـ«خطابة» في الترشيح — المطابقة على مفتاحها', () => {
    const withAl = suggestCourses({ titleAr: 'الخطابة' }, CATALOG)
    const without = suggestCourses({ titleAr: 'خطابة' }, CATALOG)
    expect(withAl[0]?.courseId, 'سقط الترشيح على ألف ولام').toBe('C-COM-101')
    expect(without[0]?.courseId).toBe('C-COM-101')
  })

  it('والتطبيع يلحق الهمزة والتاء المربوطة — فلا يفترق ما كتبه اثنان', () => {
    expect([...tokensAr('إلقاء')]).toEqual([...tokensAr('القاء')])
    expect([...tokensAr('خطابة')]).toEqual([...tokensAr('خطابه')])
  })
})

describe('الترشيح نفسه', () => {
  it('⚠️ يجد الرمز القريب وإن كتب المدرّب بلا همز ولا تاء مربوطة', () => {
    /* وهذه صورةُ ما يقع فعلا: «دوره خطابه عامه» في الطابور، وعندنا
       «الخطابةُ وفنُّ الإلقاء» — ومن لم يُرشَّح له أنشأ ثانيةً لما هو موجود. */
    const out = suggestCourses({ titleAr: 'دوره خطابه عامه' }, CATALOG)
    expect(out[0]?.courseId, 'لم يرشّح أقرب رمز إليها').toBe('C-COM-101')
  })

  it('ويقول لماذا رشّح — وترشيح بلا سبب يقبل بلا قراءة أو يهمل كلّه', () => {
    const [first] = suggestCourses({ titleAr: 'دوره خطابه عامه' }, CATALOG)
    expect(first.sharedAr, 'رشّح بلا كلمة مشتركة تعرض').toContain('خطابه')
  })

  it('⚠️ ولا يرشّح ما لا يشترك في كلمة من العنوان — فالصمت أصدق من ترشيح كاذب', () => {
    expect(suggestCourses({ titleAr: 'تربية النحل' }, CATALOG)).toEqual([])
  })

  it('⚠️ ولا يرشّح كلّ شيء — والسقف ثلاثة مهما كثر المشترك', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: `C-X-${i}`, titleAr: 'الخطابة للجميع',
    }))
    expect(suggestCourses({ titleAr: 'الخطابة' }, many).length).toBe(3)
  })

  it('والنبذة تقرأ مساندة لا عنوانا — فلا تطفو دورة لا يجمعها بالعنوان شيء', () => {
    /* نبذةٌ تذكر «الماليّة» لا تكفي وحدَها لترشيح دورةِ الماليّة: الاشتراكُ
       في النبذة يقع بين دورتَين لا تجمعهما إلّا صناعةٌ واحدة. */
    const out = suggestCourses(
      { titleAr: 'تربية النحل', summaryAr: 'وفيها القوائم الماليّة للمنحل' },
      CATALOG,
    )
    expect(out, 'رشّحت دورة لا يجمعها بالعنوان كلمة').toEqual([])
  })

  it('لكنّها ترفع درجة من اشترك في العنوان أصلا', () => {
    const bare = suggestCourses({ titleAr: 'الماليّة' }, CATALOG)[0]
    const withSummary = suggestCourses(
      { titleAr: 'الماليّة', summaryAr: 'قراءة القوائم' },
      CATALOG,
    )[0]
    expect(withSummary.score).toBeGreaterThan(bare.score)
  })

  it('⚠️ والترتيب ثابت بين نداءين — وشاشة تبدّل نفسها بلا سبب لا تقرأ', () => {
    const once = suggestCourses({ titleAr: 'الخطابة والعرض' }, CATALOG)
    const twice = suggestCourses({ titleAr: 'الخطابة والعرض' }, CATALOG)
    expect(once.map((r) => r.courseId)).toEqual(twice.map((r) => r.courseId))
  })

  it('وعنوان لا كلمة مميّزة فيه لا يرشّح له شيء — لا الكتالوج كلّه', () => {
    expect(suggestCourses({ titleAr: 'دورة مهارات' }, CATALOG)).toEqual([])
  })
})

/* ═══ حسب إجابات كلّ مدرّب (٢١ أكتوبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة بعد أن راجع ثلاثةً وخمسين اقتراحا بندا بندا: «اقترح تلقائيّا لكلّ
   واحدٍ حسب إجاباته، فهي تختلف من شخصٍ لآخر». والقياسُ وأوزانُه في رأس `suggestCourses`.
   وكلُّ حارسٍ هنا سقط على المرشِّح القديم (كلماتُ العنوان وحدَها) قبل أن يخضرّ. */
describe('الترشيح يقرأ الدورة كلّها والمدرّب معها', () => {
  it('⚠️ العنوان الإنجليزيّ يلقى المصطلح الإنجليزيّ — لا يسكت', () => {
    const out = suggestCourses({ titleAr: 'Design thinking in the customer journey' }, [
      { id: 'C-SVC-101', titleAr: 'تجربة المستفيد', termEn: 'Customer Journey' },
      { id: 'C-COM-101', titleAr: 'الخطابة وفنّ الإلقاء' },
    ])
    expect(out[0]?.courseId, 'سكت عن عنوانٍ إنجليزيّ له مقابلٌ في الكتالوج').toBe('C-SVC-101')
  })

  it('⚠️ والجمع والنسبة كلمة واحدة — «المستودعات» تلقى «المستودع»', () => {
    const out = suggestCourses({ titleAr: 'إدارة المستودعات' }, [
      { id: 'C-SCM-103', titleAr: 'إدارة المخزون والمستودع' },
    ])
    expect(out[0]?.courseId, 'فرّقت لاحقةُ الجمع بين كلمةٍ واحدة').toBe('C-SCM-103')
  })

  it('⚠️ والكلمة النادرة أثقل من الشائعة — فلا تطفو الدورة لأنّها قالت «تطوير»', () => {
    const common = Array.from({ length: 8 }, (_, i) => ({ id: `C-GEN-${i}`, titleAr: `تطوير الأداء ${i}` }))
    const out = suggestCourses({ titleAr: 'تطوير المستودعات' }, [
      ...common,
      { id: 'C-SCM-103', titleAr: 'المخزون', skillsAr: ['تشغيل المستودعات'] },
    ])
    expect(out[0]?.courseId, 'غلبت كلمةٌ في كلّ دورةٍ كلمةً في دورةٍ واحدة').toBe('C-SCM-103')
  })

  it('⚠️ ومجال المدرّب يرجّح بين متقاربتين — رائد الأعمال يرى دورة الريادة أوّلا', () => {
    const twins = [
      { id: 'C-MKT-101', titleAr: 'تحليل السوق والمنافسين' },
      { id: 'C-BIZ-101', titleAr: 'تحليل السوق والمنافسين' },
    ]
    const bare = suggestCourses({ titleAr: 'تحليل السوق' }, twins)
    const asFounder = suggestCourses({ titleAr: 'تحليل السوق' }, twins, 3, { families: new Set(['BIZ']) })
    expect(bare[0]?.courseId).toBe('C-BIZ-101')
    const asMarketer = suggestCourses({ titleAr: 'تحليل السوق' }, twins, 3, { families: new Set(['MKT']) })
    expect(asMarketer[0]?.courseId, 'لم يرجّح مجالُ المدرّب').toBe('C-MKT-101')
    expect(asFounder[0]?.courseId).toBe('C-BIZ-101')
  })

  it('⚠️ والترجيح لا يحصر — اقتراح خارج مجاله يجد دورته إن قالها لفظه', () => {
    const out = suggestCourses({ titleAr: 'الخطابة' }, [
      ...CATALOG,
      { id: 'C-SCM-101', titleAr: 'أساسيات سلسلة الإمداد' },
    ], 3, { families: new Set(['SCM']) })
    expect(out[0]?.courseId).toBe('C-COM-101')
  })
})

describe('مجال المدرّب من إجاباته', () => {
  const courses = [
    { id: 'C-BIZ-101', titleAr: 'اكتشاف العملاء وعرض القيمة' },
    { id: 'C-BIZ-103', titleAr: 'نماذج الأعمال واقتصاديات الوحدة' },
    { id: 'C-MKT-101', titleAr: 'استراتيجية التسويق' },
  ]

  it('⚠️ ما اختاره من الكتالوج أو أُهِّل له مجالٌ له', () => {
    expect([...trainerFamilies({ courseIds: ['C-SCM-103', null], proposals: [] }, courses)]).toEqual(['SCM'])
  })

  it('⚠️ وأغلب اقتراحاته مجالٌ له — وإن لم يختر من الكتالوج شيئا', () => {
    const f = trainerFamilies({
      courseIds: [],
      proposals: [
        { titleAr: 'اكتشاف العملاء' }, { titleAr: 'عرض القيمة' }, { titleAr: 'نموذج الأعمال' },
        { titleAr: 'استراتيجية التسويق' },
      ],
    }, courses)
    expect([...f], 'لم يقرأ مجالَه من أغلب اقتراحاته').toContain('BIZ')
    expect([...f], 'رجّح بمجالٍ وقع فيه اقتراحٌ واحدٌ من أربعة').not.toContain('MKT')
  })

  it('واقتراحان لا يصنعان مجالا', () => {
    const f = trainerFamilies({ courseIds: [], proposals: [{ titleAr: 'اكتشاف العملاء' }, { titleAr: 'عرض القيمة' }] }, courses)
    expect([...f]).toEqual([])
  })
})

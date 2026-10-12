/* اختيارُ تاريخٍ وصندوقُ الحجز — حارسا شكويَين حقيقيّتَين (١٣ سبتمبر ٢٠٢٦).

   الأولى: «تعذّبت وأنا أعود إلى ١٩٨٥ لعيد الميلاد». والثانية: «حجزُ المواعيد
   يكون في بوكس ثابتٍ وليس متحرّكا داخليّا».

   وكلتاهما عطبٌ لا يُسقِط شيئا: النموذجُ يُرسَل، والإطارُ يُعرض — والمستخدمُ
   وحدَه يدفع الثمن. فالحارسُ هنا على **المنطق** الذي يُنتج السلوك، لا على
   ورودِ حرفٍ في ملفّ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  dateStateFromIso, daysInMonth, joinIsoDay, MONTHS_AR, pickDatePart, splitIsoDay,
  syncDateState, typeDateText, yearChoices,
} from '@/application/text/date-parts'
import { nextFrameHeight, parseFrameHeight } from '@/lib/calendly-embed'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/** الشيفرةُ بلا تعليقاتها — فلا يمرّ حارسٌ لأنّ تعليقا ذكر ما يحرسه */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('أجزاء التاريخ — الحالات الحدّيّة التي تكسر اختيارا بالقوائم', () => {
  it('يقرأ ويكتب بالصيغة نفسها التي يخزّنها الخادم', () => {
    expect(splitIsoDay('1985-07-09')).toEqual({ year: '1985', month: '7', day: '9' })
    expect(joinIsoDay({ year: '1985', month: '7', day: '9' })).toBe('1985-07-09')
  })

  it('وما ليس تاريخا لا يخمّن — فارغ يبقى فارغا', () => {
    for (const bad of ['', '  ', '1985', '1985-07', 'اليوم', '1985/07/09']) {
      expect(splitIsoDay(bad), bad).toEqual({ year: '', month: '', day: '' })
    }
    expect(splitIsoDay(null)).toEqual({ year: '', month: '', day: '' })
  })

  it('⚠️ ونصف تاريخ لا يرسل: من اختار السنة وحدها لم يختر تاريخا', () => {
    /* لولا هذا لذهب إلى الخادم `1985-00-00` — تاريخٌ لا وجودَ له يُقبل صامتا */
    expect(joinIsoDay({ year: '1985', month: '', day: '' })).toBe('')
    expect(joinIsoDay({ year: '1985', month: '7', day: '' })).toBe('')
    expect(joinIsoDay({ year: '', month: '7', day: '9' })).toBe('')
  })

  it('⚠️ ويوم ٣١ يقصّ حين يبدّل الشهر إلى ما لا يسعه — ولا يمحى الاختيار', () => {
    expect(joinIsoDay({ year: '2026', month: '2', day: '31' })).toBe('2026-02-28')
    expect(joinIsoDay({ year: '2026', month: '4', day: '31' })).toBe('2026-04-30')
  })

  it('وفبراير يعرف الكبيسة — ٢٩ في ٢٠٢٤ و٢٨ في ٢٠٢٥', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2025, 2)).toBe(28)
    expect(joinIsoDay({ year: '2024', month: '2', day: '29' })).toBe('2024-02-29')
    expect(joinIsoDay({ year: '2025', month: '2', day: '29' })).toBe('2025-02-28')
  })

  it('وقبل اختيار الشهر تعرض الأيّام كلّها — فلا يحجب يوم بلا سبب', () => {
    expect(daysInMonth(NaN, NaN)).toBe(31)
    expect(daysInMonth(1985, 0)).toBe(31)
  })

  it('والشهور اثنا عشر بأسمائها العربيّة — لا أرقام تعدّ باليد', () => {
    expect(MONTHS_AR).toHaveLength(12)
    expect(new Set(MONTHS_AR).size, 'اسم مكرّر — منسّق لا يعطي الشهور').toBe(12)
    for (const name of MONTHS_AR) expect(name).toMatch(/\p{Script=Arabic}/u)
  })

  it('⚠️ وسنة الميلاد تبلغ في ضغطتين: القائمة تسع ١٩٨٥ والأحدث أوّلا', () => {
    /* الشكوى بعينها. ولو انقلب الترتيبُ لصار على المتعلّم أن يمرّ على تسعين
       سنةً قبل أن يبلغ سنواتِ الميلاد الشائعة. */
    const years = yearChoices(1930, 2026, 'desc')
    expect(years[0]).toBe(2026)
    expect(years.at(-1)).toBe(1930)
    expect(years).toContain(1985)
    expect(years).toHaveLength(97)
  })

  it('وموعد قادم يرتّب بالعكس — الأقرب أوّلا', () => {
    expect(yearChoices(2026, 2028, 'asc')).toEqual([2026, 2027, 2028])
  })
})

/* ═══ الشكوى الثالثة (١٥ سبتمبر ٢٠٢٦) — «ولا يتأثّر ما يختاره من الخيارات» ═══

   القوائمُ كانت تقرأ أجزاءَها من القيمة المرسَلة، والقيمةُ لا تُكتب إلّا
   لتاريخٍ مكتمل. فمن اختار السنةَ وحدَها: `joinIsoDay` يردّ `''`، فتبقى
   القيمةُ فارغةً، فترتدّ القائمةُ إلى «السنة» — **فلا تفعل القوائمُ شيئا
   أبدا إلّا لمن كتب التاريخَ كاملا قبلها**، وهي وُضعت لمن لا يكتب.

   والفحصُ على الانتقالات: اختيارٌ ناقصٌ يبقى، ومكتملٌ يُرسَل. */
describe('القوائم تبنى جزءا جزءا — والناقص لا يرتدّ', () => {
  it('⚠️ سنة وحدها تبقى مختارة ولا ترسل', () => {
    const after = pickDatePart(dateStateFromIso(''), { year: '2026' })
    expect(after.parts.year, 'ارتدّت السنة إلى الفراغ أمام عين مختارها').toBe('2026')
    expect(after.iso, 'نصف تاريخ ذهب إلى الخادم').toBe('')
  })

  it('⚠️ وتبنى عليها الأجزاء الباقية واحدا واحدا حتّى تكتمل', () => {
    let st = dateStateFromIso('')
    st = pickDatePart(st, { year: '2026' })
    st = pickDatePart(st, { month: '10' })
    expect(st.parts, 'ضاع ما اختير قبل الشهر').toEqual({ year: '2026', month: '10', day: '' })
    expect(st.iso, 'أرسل تاريخ بلا يوم').toBe('')
    st = pickDatePart(st, { day: '15' })
    expect(st.iso, 'اكتملت الثلاثة ولم يرسل شيء').toBe('2026-10-15')
    expect(st.text, 'الحقل لا يري ما اختير من القوائم').toBe('15/10/2026')
  })

  it('⚠️ واليوم المقصوص يرى مقصوصا في قائمته — لا رقم يخالف ما سيرسل', () => {
    let st = dateStateFromIso('2026-01-31')
    st = pickDatePart(st, { month: '2' })
    expect(st.iso).toBe('2026-02-28')
    expect(st.parts.day, 'القائمة تقول ٣١ والمرسل ٢٨').toBe('28')
  })

  it('والمكتوب يحرّك القوائم متى اكتمل — فلا يفترق البابان', () => {
    const st = typeDateText(dateStateFromIso(''), '09/07/1985')
    expect(st.iso).toBe('1985-07-09')
    expect(st.parts).toEqual({ year: '1985', month: '7', day: '9' })
  })

  it('وما زال يكتب لا يمحو ما اختير — ومحو الحقل يمحوه', () => {
    const picked = pickDatePart(dateStateFromIso(''), { year: '2026' })
    expect(typeDateText(picked, '13/0').parts.year, 'انتزع اختياره وهو يكتب').toBe('2026')
    expect(typeDateText(picked, '').parts, 'محا الحقل وبقي اختياره').toEqual({ year: '', month: '', day: '' })
  })

  it('⚠️ وقيمة عادت كما أرسلناها لا تعيد بناء نصّه — فلا يقفز مؤشّره', () => {
    /* من كتب «5/1/2026» أنتج `2026-01-05`. ولو أُعيد بناءُ نصِّه منها لصار
       «05/01/2026» تحت إصبعه وقفز المؤشّرُ إلى آخره. */
    const typed = typeDateText(dateStateFromIso(''), '5/1/2026')
    expect(syncDateState(typed, '2026-01-05')).toBe(typed)
    /* وقيمةٌ جاءت من غيرِنا (مسودّةٌ حُمّلت) تُتبَع */
    expect(syncDateState(typed, '2026-03-01').text).toBe('01/03/2026')
  })
})

describe('أين رحّل اختيار التاريخ', () => {
  it('⚠️ تاريخ الميلاد قوائم لا منتقي متصفّح — وسنته تبلغ ١٩٨٥ وما قبلها', () => {
    const account = code('src/pages/student/Account.tsx')
    expect(account, 'عاد منتقي المتصفّح إلى تاريخ الميلاد').not.toMatch(/type="date"/)
    expect(account).toMatch(/<DateField/)
    const floor = /const BIRTH_YEAR_FLOOR = (\d{4})/.exec(account)
    expect(floor, 'لا أرضيّة معلنة لسنوات الميلاد').not.toBeNull()
    expect(Number(floor![1])).toBeLessThanOrEqual(1985)
  })

  it('⚠️ و«يمكنك البدء من» في طلب الانضمام كذلك', () => {
    const join = code('src/pages/JoinTrainer.tsx')
    expect(join).toMatch(/<DateField[^>]*id="jt-start"/)
    expect(join, 'عاد منتقي المتصفّح إلى حقل البدء').not.toMatch(/id="jt-start"[^>]*type="date"/)
  })

  it('والقوائم الثلاث تسمّى لقارئ الشاشة — «تاريخ» وحدها لا تقول أيّها السنة', () => {
    const field = code('src/components/ui/DateField.tsx')
    for (const label of ['اليوم', 'الشهر', 'السنة']) {
      expect(field, `قائمة بلا اسم: ${label}`).toContain(`aria-label="${label}"`)
    }
  })

  /* ═══ أ-٢: والشكوى الثانية — «كتابةُ التاريخ أرقاما ما زالت صعبة» ═══

     القوائمُ حلّت القفزَ إلى ١٩٨٥، ولم تحلّ الكتابة: ثلاثُ قوائمَ لتاريخٍ
     يعرفه صاحبُه عن ظهر قلب أبطأُ من كتابته. فصار الحقلُ يُكتب أوّلا،
     والقوائمُ بابا ثانيا يُفتح بزرّ.

     والفحصُ على **البنية**: حقلُ كتابةٍ مصيَّرٌ يُنادي القسمةَ، وقوائمُ
     مشروطةٌ بحالةٍ لا مفتوحةٌ دائما. */
  it('⚠️ والتاريخ يكتب أرقاما لا ينتقى وحده', () => {
    const field = code('src/components/ui/DateField.tsx')
    expect(field, 'لا حقل كتابة في الحقل أصلا').toMatch(/<input\b/)
    expect(field, 'المكتوب لا يقرأ بالقسمة المفحوصة').toContain('typeDateText')
    /* `dateStateFromIso` هي التي تبني النصَّ من المحفوظ — و`formatTypedDate`
       تحتها. والحارسُ على من يُنادى هنا لا على من يُنادى في الطبقة الأدنى. */
    expect(field, 'المحفوظ لا يعرض مكتوبا').toContain('dateStateFromIso')
    /* والنمطُ يُرى قبل الكتابة — «13/09/2026» لا «yyyy-mm-dd» */
    expect(field, 'لا نمط معروض يحتذى').toMatch(/placeholder="\d{2}\/\d{2}\/\d{4}"/)
  })

  it('والقوائم باب ثان يفتح — لا تعرض مع الحقل دائما', () => {
    const field = code('src/components/ui/DateField.tsx')
    /* لو بقيت مفتوحةً لبقيت الشكوى: حقلٌ وثلاثُ قوائمَ أكثفُ من ثلاث */
    expect(field, 'القوائم معروضة دائما — فالشاشة ازدادت لا خفّت').toMatch(
      /\{picking && \(/,
    )
    expect(field, 'لا زرّ يفتحها').toMatch(/aria-expanded=\{picking\}/)
  })
})

describe('صندوق الحجز — يكبر ولا يصغر', () => {
  it('⚠️ ارتفاع أقصر من المسجّل لا ينقصه — وإلّا قفزت الصفحة تحت الإصبع', () => {
    /* رحلةُ الحجز كما تصل من Calendly: تقويمٌ طويل، ثمّ أوقاتٌ أقصر، ثمّ
       نموذجٌ أطول. والصندوقُ يبقى عند أطولها. */
    let h = nextFrameHeight(null, '1180px')
    expect(h).toBe(1180)
    h = nextFrameHeight(h, '820px')
    expect(h, 'صغر الصندوق فقفزت الصفحة').toBe(1180)
    h = nextFrameHeight(h, '1320px')
    expect(h, 'لم يتّسع لأطول خطوة فولد تمرير داخليّ').toBe(1320)
  })

  it('ويقبل الرقم والنصّ معا، ويردّ ما لا يصدّق', () => {
    expect(parseFrameHeight(1024)).toBe(1024)
    expect(parseFrameHeight('1024px')).toBe(1024)
    for (const bad of [null, undefined, 'abc', '', 12, 99999, '4000px']) {
      expect(parseFrameHeight(bad), String(bad)).toBeNull()
    }
  })

  it('ورسالة مشوّهة لا تمحو ما قيس', () => {
    expect(nextFrameHeight(1180, 'abc')).toBe(1180)
    expect(nextFrameHeight(null, 'abc')).toBeNull()
  })

  /* ═══ الشكوى الرابعة (١٧ سبتمبر ٢٠٢٦) — «طويل جدا للأسفل» ═══

     الأرضيّةُ السخيّةُ (١١٨٠ بكسلا) حلّت التمريرَ المتداخل وأورثت عطبا
     آخر: بطاقةٌ تمتدّ شاشةً ونصفا في الصفحة. وقرارُ صاحب المنصّة: «اجعله
     قصيرا، وللشخص أن ينزل سكرولا إن احتاج، ولا يتحرّك ما بداخله يمينا
     ويسارا».

     فصار الصندوقُ المرئيُّ مقطوعا قصيرا، والإطارُ داخله بطول محتواه —
     فالمُمرَّرُ صندوقُنا لا صفحةُ Calendly، ولا شريطَ تمريرٍ ثانٍ داخلها.
     والفحصُ على القسمة نفسِها: مَن يحمل السقفَ، ومن يحمل الطولَ المقيس. */

  /** الوسمُ المفتوحُ الذي فيه هذه الكلمة — لتُفحص خصائصُه هو لا الملفُّ كلُّه */
  const tagWith = (src: string, needle: string): string | null => {
    for (const m of src.matchAll(/<div[^>]*>/g)) if (m[0].includes(needle)) return m[0]
    return null
  }

  it('⚠️ والصندوق المرئيّ قصير مقطوع — لا يتبع طول تقويم Calendly', () => {
    const card = code('src/components/BookInterview.tsx')
    const cap = /h-\[min\((\d{2,3})vh,(\d{3,4})px\)\]/.exec(card)
    expect(cap, 'لا سقف معلن لارتفاع الصندوق — فطوله طول التقويم').not.toBeNull()
    expect(Number(cap![2]), 'سقف يتجاوز شاشة حاسوب — وهي الشكوى بعينها').toBeLessThanOrEqual(640)
    expect(Number(cap![1]), 'سقف يبتلع شاشة الهاتف').toBeLessThanOrEqual(80)
    /* ولا تعود الأرضيّةُ بالألف من الباب الخلفيّ */
    expect(card, 'عادت أرضيّة الألف بكسل فطال الصندوق ثانية').not.toMatch(/min-h-\[\d{4}px\]/)
    expect(card, 'رقم ارتفاع مفروض باليد عاد إلى الصندوق').not.toMatch(/className="[^"]*\sh-\[\d{3,4}px\]/)
  })

  it('⚠️ ويمرّر رأسيّا وحده — فلا يزحف ما بداخله يمينا ويسارا', () => {
    const card = code('src/components/BookInterview.tsx')
    const scroller = tagWith(card, 'overflow-y-auto')
    expect(scroller, 'لا صندوق يمرّر — فأين ينزل من لم يسعه السقف؟').toBeTruthy()
    expect(scroller, 'المحور الأفقيّ مفتوح — وهو ما شكي منه').toContain('overflow-x-hidden')
    expect(card, '`overflow-auto` تفتح المحورين معا').not.toMatch(/\boverflow-auto\b/)
  })

  it('⚠️ والطول المقيس للإطار لا للصندوق — وإلّا عاد تمرير داخل تمرير', () => {
    /* لو حمل الصندوقُ الطولَ المقيسَ لطال معه فعادت الشكوى الأولى. ولو
       قصُر الإطارُ عن محتواه لوُلد شريطُ تمريرٍ داخلَ صفحة Calendly نفسِها
       — وهي الشكوى الثالثة. فالقسمةُ شرطُ الاثنتين معا. */
    const card = code('src/components/BookInterview.tsx')
    const scroller = tagWith(card, 'overflow-y-auto')
    expect(scroller, 'الصندوق يحمل ارتفاعا محسوبا فيطول بطول التقويم').not.toMatch(/style=/)
    const holder = tagWith(card, 'style={{ height: frameHeight')
    expect(holder, 'لا عنصر يحمل الطول المقيس — فالإطار يقصّ داخل نفسه').toBeTruthy()
    expect(holder, 'حامل الطول هو الصندوق الممرّر نفسه').not.toMatch(/overflow-y-auto/)
    expect(holder, 'لا يملأ الصندوق قبل أن يصل قياس').toContain('min-h-full')
    expect(card, 'قرار الارتفاع رجع إلى داخل المكوّن فلا يفحص').toContain('nextFrameHeight')
  })

  /* ═══ ولماذا يُفحص الأثرُ بمصفوفةِ اعتماده ═══

     المردُّ إلى البطاقة بعد الحجز صحيحٌ في أثرٍ معلَّقٍ بـ`done`، وعطبٌ داخلَ
     مستمعِ الرسائل: ذاك يُنادى مرارا بـ`page_height` ما دام المتقدّم يقلّب
     المواعيد. فالحارسُ على **موضع** النداء لا على وروده. */
  const effectsByDeps = (src: string) => {
    const out = new Map<string, string>()
    for (const m of src.matchAll(/useEffect\(\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\}, \[([^\]]*)\]\)/g)) {
      out.set(m[2].trim(), m[1])
    }
    return out
  }

  it('⚠️ وبعد الحجز تردّ الصفحة إلى البطاقة — وإلّا بقي المتقدّم في أسفلها', () => {
    /* الإطارُ يملأ الشاشةَ ثمّ يختفي، فيهبط ما تحته ألفَ بكسل ويبقى الناظرُ
       حيث كان: أمام تذييل الصفحة، والتأكيدُ فوقه لا يراه. */
    const effects = effectsByDeps(code('src/components/BookInterview.tsx'))
    const onDone = effects.get('done')
    expect(onDone, 'لا أثر معلّق بـ`done` — فلا شيء يحدث حين يحجز الموعد').toBeTruthy()
    expect(onDone, 'الأثر لا يردّ الصفحة إلى موضع').toMatch(/scrollIntoView/)
  })

  it('⚠️ والمردّ إلى البطاقة لا إلى رأس الصفحة — فهي تركّب داخل نموذج طويل', () => {
    /* `window.scrollTo(0,0)` يسلب المتقدّمَ موضعَه من نموذج الانضمام كلِّه */
    const onDone = effectsByDeps(code('src/components/BookInterview.tsx')).get('done') ?? ''
    expect(onDone, 'ردّ إلى رأس الصفحة فضاع موضعه من النموذج').not.toMatch(/window\.scrollTo/)
    expect(onDone, 'ردّ إلى غير البطاقة').toMatch(/cardRef\.current\?\.scrollIntoView/)
  })

  it('⚠️ ولا يردّ من مستمع الرسائل — فينتزع التقويم من تحت من يقلّب مواعيده', () => {
    /* `page_height` يُبثّ مع كلِّ خطوةٍ في التقويم: مردٌّ هناك يعني صفحةً
       ترتجّ تحت إصبعِ من لم يحجز بعد. */
    const listener = effectsByDeps(code('src/components/BookInterview.tsx')).get('') ?? ''
    expect(listener, 'مستمع الرسائل غير موجود — تغيّرت بنية المكوّن').toMatch(/addEventListener\('message'/)
    expect(listener, 'المردّ انتقل إلى مستمع الرسائل').not.toMatch(/scrollIntoView/)
  })
})

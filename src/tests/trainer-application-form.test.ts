/* أول خطوة في رحلة المدرب: نموذج الانضمام.

   وهو أول احتكاكٍ للمدرب بوجيز كلها — قبل بوابته وقبل شعبه. وما يُحرس هنا
   أربعةُ أشياء ينكسر كلٌّ منها صامتا:

   ١) حدّ الدافع مكتوبٌ في ثلاثة مواضع — الواجهة والمخطط والخدمة. ولو انفرد
      أحدها فالعدّاد يقول «اكتب ٧٥» ثم يردّ الخادمُ الطلبَ بـ«١٥٠»، والمتقدّم
      يقف أمام رفضٍ لا يفهمه بعد أن استوفى ما طُلب منه.
   ٢) موضع سؤال الاعتماد: مؤهَّلٌ رسميّ يُقرأ مع سنوات الخبرة، لا رابطٌ يُلصق
      بين لينكدإن وإنستغرام.
   ٣) جهات الاعتماد قائمةٌ تُختار — ومعها «أخرى» تبقى مفتوحة، وإلّا انسدّ الباب
      على من اعتمادُه دوليّ.
   ٤) الزرّ المطفأ يقول سببه: كلُّ شرطٍ في «التالي» له اسمٌ في قائمة النقص، فلا
      شرط يُطفئ الزرّ بلا أن يُسمّى. */

import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const PAGE = 'src/pages/JoinTrainer.tsx'
/* القوائمُ الثابتة انتقلت إلى ملفٍّ بجانب الصفحة (الصفحةُ كانت ألفا وثلاثَ
   مئةِ سطر). والضمانُ لم يتغيّر — تغيّر بيتُه؛ فيُقرأ الاثنان معا كي لا
   يفلت شيءٌ بحجّة أنّه هناك لا هنا. */
const OPTIONS = 'src/pages/join-trainer/options.ts'
/* وأوصافُ الخبرة والعمل والنمط ووقتِ اليوم انتقلت إلى الوحدة المشتركة يومَ
   صار ملفُّ المتقدّم يُبنى في الخادم (فلا يقرأ ملفَّ صفحة). فتُقرأ الثلاثةُ
   معا — الضمانُ لم يتغيّر، تغيّر بيتُه. */
const SHARED = 'src/application/trainer/application-options.ts'
const FORM = () => read(PAGE) + read(OPTIONS) + read(SHARED)
const ROUTES = 'server/http/routes/trainer-applications.routes.ts'
const SERVICE = 'server/services/trainer-application.service.ts'

describe('نموذج انضمام المدرب', () => {
  it('حدّ الدافع رقمٌ واحد في الواجهة والمخطط والخدمة', () => {
    const ui = /export const MOTIVATION_MIN = (\d+);/.exec(FORM())?.[1]
    const schema = /motivation: z\.string\(\)\.trim\(\)\.min\((\d+)\)/.exec(read(ROUTES))?.[1]
    const service = /motivation\.length < (\d+)\)/.exec(read(SERVICE))?.[1]
    expect(ui, 'حدّ الواجهة مفقود').toBeTruthy()
    expect(schema, 'حدّ المخطط مفقود').toBeTruthy()
    expect(service, 'حدّ الخدمة مفقود').toBeTruthy()
    expect([schema, service], 'الخادم يخالف العدّاد الذي يراه المتقدّم').toEqual([ui, ui])
    expect(Number(ui)).toBe(75)
  })

  it('سؤال الاعتماد مع الخبرة لا بين الروابط', () => {
    const src = FORM()
    const years = src.indexOf('id="jt-training"')       // خبرة التدريب
    const accred = src.indexOf('id="jt-accred-body"')   // جهة الاعتماد
    const links = src.indexOf('id="jt-links"')          // لينكدإن — أوّل الروابط
    expect(years, 'حقل خبرة التدريب مفقود').toBeGreaterThan(0)
    expect(accred, 'قائمة جهة الاعتماد مفقودة').toBeGreaterThan(0)
    expect(links, 'حقل لينكدإن مفقود').toBeGreaterThan(0)
    expect(accred, 'الاعتماد قبل الخبرة').toBeGreaterThan(years)
    expect(accred, 'الاعتماد عاد بين الروابط').toBeLessThan(links)
  })

  it('جهات الاعتماد قائمةٌ عربية واسعة ومعها باب مفتوح', () => {
    const src = FORM()
    const block = /const ACCREDITATION_BODIES[\s\S]*?\n\];/.exec(src)?.[0] ?? ''
    const countries = block.match(/\{ country: "/g) ?? []
    expect(countries.length, 'القائمة أضيق من أن تُغطّي الوطن العربي').toBeGreaterThanOrEqual(12)
    for (const must of ['السعودية', 'الأردن', 'الإمارات', 'مصر', 'المغرب']) {
      expect(block, `${must} خارج القائمة`).toContain(`{ country: "${must}"`)
    }
    /* «أخرى» ليست خيارا في القائمة فحسب — بل تفتح حقلا يُكتب فيه */
    expect(src).toMatch(/const ACCREDITATION_OTHER = "أخرى/)
    expect(src, 'خيار «أخرى» لا يُعرض').toContain('<option value={ACCREDITATION_OTHER}>')
    expect(src, '«أخرى» بلا حقل كتابة').toContain('form.accreditationBody === ACCREDITATION_OTHER && (')
  })

  it('كلّ شرطٍ يُطفئ «التالي» له اسمٌ يُقرأ', () => {
    const src = FORM()
    const block = /const stepValid = useMemo\(\(\) => \(\{[\s\S]*?\}\), \[[^\]]*\]\);/.exec(src)?.[0] ?? ''
    expect(block, 'كتلة stepValid مفقودة').toBeTruthy()
    /* كلّ خطوة تُقاس بقائمة نقصها وحدها — والسقف وحده يُستثنى لأن العدّاد
       يعرضه في موضعه. وأيّ حدٍّ آخر يُضاف هنا يُطفئ الزرّ بلا سبب معروض،
       فيُفكَّك التعبير إلى حدوده ويُرفض ما ليس منهما. */
    const ALLOWED = (n: 1 | 2) => [`missing[${n}].length === 0`, 'motivationLen <= MOTIVATION_MAX']
    for (const n of [1, 2] as const) {
      const expr = new RegExp(`\\n\\s*${n}: ([^\\n]*?),\\s*\\n`).exec(block)?.[1]
      expect(expr, `شرط الخطوة ${n} مفقود`).toBeTruthy()
      const terms = expr!.split('&&').map((t) => t.trim())
      expect(terms, `الخطوة ${n} لا تُقاس بقائمة نقصها`).toContain(`missing[${n}].length === 0`)
      const stray = terms.filter((t) => !ALLOWED(n).includes(t))
      expect(stray, `شرطٌ يُطفئ «التالي» في الخطوة ${n} بلا اسم في قائمة النقص`).toEqual([])
    }
    /* وبما أنّ الزرّ صار يقرأ من القائمة، فإسقاط بندٍ منها يفتح البابَ لا
       يُبقيه مغلقا بلا سبب — فكلُّ إلزامٍ في النموذج له سطرُه هنا. */
    const list = /const missing = useMemo\(\(\) => \{[\s\S]*?\n {2}\}, \[[^\]]*\]\);/.exec(src)?.[0] ?? ''
    expect(list, 'كتلة قائمة النقص مفقودة').toBeTruthy()
    for (const [subject, guard] of [
      ['الاسم', 'form.fullName'], ['البريد', 'form.email'], ['الحالة المهنية', 'form.employmentStatus'],
      ['التخصصات', 'specialties.length'], ['سنوات المجال', 'form.domainYears'], ['خبرة التدريب', 'form.trainingYears'],
      ['جهة الاعتماد', 'accreditationReady'], ['اللغات', 'languages.length'], ['نمط التدريب', 'form.deliveryMode'],
      ['الدافع', 'motivationLen'], ['الخصوصية', 'form.privacyConsent'],
      ['السيرة الذاتية', 'uploads.cv'], ['ما يستطيع تقديمه', 'teachable.length === 0'], ['الدرس التجريبي', 'demoConsent'],
    ] as const) {
      expect(list, `${subject}: إلزامٌ بلا سطرٍ في قائمة النقص — والزرّ يقرأ منها`).toContain(guard)
    }

    /* والقائمة تُعرض فعلا وتُنطق لقارئ الشاشة */
    expect(src, 'قائمة النقص لا تُعرض').toContain('aria-live="polite"')
  })

  it('السؤال عن القادم لا عن الماضي: مجالٌ يقصّ الكتالوج، ونصٌّ حرّ بجانبه', () => {
    const src = FORM()
    /* «أبرز ثلاث دورات قدّمتها» سقط: ماضٍ يُروى نصّا حرّا لا يُربط بمقرر.
       والتعليق يذكره شرحا — فيُقرأ الوسمُ المعروض لا الشرحُ عنه. */
    const shown = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    expect(shown, 'سؤال الدورات السابقة عاد').not.toContain('أبرز ثلاث دورات')
    expect(src, 'الصفحة ما زالت ترسل الدورات السابقة').not.toContain('previousCourses:')

    expect(src, 'سؤال ما يستطيع تقديمه مفقود').toContain('ما الدورات التي تستطيع تقديمها؟')
    expect(src, 'المعرّفات لا تُرسَل — فلا يُربط بمقرر عند التعيين').toContain('teachableCourseIds: teachable')
    expect(src, 'النصّ الحرّ لا يُرسَل').toContain('teachableOther: teachableOther.trim()')

    /* المجال أوّلا: الكتالوج مئةُ عنوان، وعرضُها دفعةً واحدة مسحٌ لا اختيار */
    const picker = read('src/components/TeachableCoursePicker.tsx')
    const domainIdx = picker.indexOf("id=\"tc-domain\"")
    const listIdx = picker.indexOf('inDomain.map')
    expect(domainIdx, 'قائمة المجال مفقودة').toBeGreaterThan(0)
    expect(listIdx, 'قائمة دورات المجال مفقودة').toBeGreaterThan(0)
    expect(domainIdx, 'الدورات تُعرض قبل المجال').toBeLessThan(listIdx)
    /* والمجالُ معرفيّ لا جمهور: كان يُقصّ بـ`pathwayCategory` وهي تُعيد
       «موظفون» و«طلاب ومهنة» — فيُسأل المدرّب عن مجاله فيُعرض عليه جمهور،
       ومن يُتقن الأمن السيبرانيّ لا يجده في القائمة أصلا. */
    expect(picker, 'الدورات لا تُقصّ بالمجال المعرفيّ').toContain('courseDomain(c.id) === domain')
    expect(picker, 'عاد التصنيف بالفئة المستهدفة').not.toContain('pathwayCategory')
    /* والكتالوج لا يصل مع الحزمة: بلا جلبه تبقى القائمة فارغة أبدا */
    expect(picker, 'الكتالوج لا يُجلب — فالقائمة تبقى فارغة').toContain('usePublishedContent()')

    /* الخطوات ثلاث، والمنتقي داخل خطوة الأدلة لا خطوةً مستقلّة */
    const steps = (/const STEPS = \[[\s\S]*?\] as const;/.exec(src)?.[0].match(/\{ n: \d+,/g) ?? []).length
    expect(steps, 'عدد الخطوات تغيّر').toBe(3)
  })

  it('«التالي» لا يُرسل الطلب — وشاشة الحساب لا تُقفَز', () => {
    const src = FORM()
    /* زرٌّ واحد يتبدّل نوعه من button إلى submit على العنصر نفسه: فعلُ النقرة
       الافتراضيّ يقع بعد إعادة الرسم فيُرسَل الطلب فورا وتُقفز الخطوة الثالثة.
       مفتاحان مختلفان يجعلان العنصرين اثنين لا واحدا. */
    const nav = src.slice(src.lastIndexOf('{step < 3 ? ('))
    expect(nav, 'زرّ «التالي» بلا مفتاح مميّز').toContain('key="next"')
    expect(nav, 'زرّ الإرسال بلا مفتاح مميّز').toContain('key="send"')

    /* وحزامٌ ثانٍ في المعالج نفسه — النموذج يلتقط Enter من أيّ حقل */
    const handler = /const submit = async \(e: React\.FormEvent\) => \{[\s\S]*?\n {4}if \(!valid/.exec(src)?.[0] ?? ''
    expect(handler, 'الإرسال يقع من أي خطوة').toContain('if (step !== 3) return;')
  })

  it('التوفّر يقول متى من اليوم لا اليوم وحده', () => {
    const src = FORM()
    expect(src).toMatch(/const PERIODS = \[[\s\S]*?value: 'morning'[\s\S]*?value: 'evening'[\s\S]*?\] as const/)
    expect(src, 'الفترات لا تُرسَل مع التوفّر').toContain('periods: periods.length ? periods : undefined')
    /* والخادم يقبلها — وإلّا سقط الطلب كلّه عند الإرسال */
    expect(read(ROUTES), 'المخطط لا يعرف الفترات').toContain("periods: z.array(z.enum(['morning', 'evening'])).optional()")
  })

  it('المسودّة تُحفظ وتُستأنف، ولا تحفظ سرّا', () => {
    const src = FORM()
    expect(src, 'لا حفظ للمسودّة').toContain('saveDraft({')
    expect(src, 'لا استئناف').toContain('loadDraft()')
    /* المسح عند نجاح الإرسال بعينه — لا في مكانٍ آخر يجعل الفحص يمرّ به */
    expect(src, 'المسودّة تبقى بعد وصول الطلب').toMatch(/setPhase2Done\(true\);\s*\n\s*clearDraft\(\);/)
    expect(src, 'الاستئناف يقع صامتا بلا أن يُقال').toContain('أكملنا من حيث توقّفت')

    /* كلمة المرور ورمز التحقق أسرارٌ عابرة: تُستثنى في الوحدة نفسها لا بالنسيان */
    const draft = read('src/application/trainer/application-draft.ts')
    expect(draft).toMatch(/NEVER_PERSISTED = \['accountPassword', 'verifyTokenInput', 'password', 'passwordConfirm'\]/)
    expect(draft, 'الاستثناء معلَنٌ ولا يُطبَّق').toContain('if ((NEVER_PERSISTED as readonly string[]).includes(k)) continue')
  })

  /* ── الهيئة: سؤالٌ له حدّ، وحقلٌ بقياسٍ واحد، وخياراتٌ متساوية ──

     وصف صاحب المنصّة النموذجَ قبل هذا التعديل: «مبعثرة وغير واضحة — لا أعرف
     ما هو السؤال وأين ينتهي ومتى يبدأ»، و«مربعات لبعض الإجابات تأخذ مساحة
     أكبر من الأخرى». وسببُ الأوّل أنّ عشرين حقلا كانت في شريطٍ واحد يفصلها
     خطُّ شعرة، وسببُ الثاني أنّ أوسمة الاختيار تُرصَف بعرض نصّها.

     والإصلاحُ بنيويّ لا تجميليّ، فيُحرَس بنيويّا: بطاقةُ سؤالٍ مرقّمة لكلّ
     مجموعة، وشبكةٌ متساوية الخلايا للخيارات — ولا عودةَ للرصف الحرّ. */
  it('الهيئة: كلّ سؤالٍ في بطاقةٍ مرقّمة، والخيارات في شبكةٍ متساوية', () => {
    const src = FORM()

    /* البطاقات: ثمانٍ في الخطوة الأولى وثلاثٌ في الثانية — لا شريطٌ واحد */
    const cards = src.match(/<Question\b/g) ?? []
    expect(cards.length, 'اختفت بطاقات الأسئلة فعاد الشريط الواحد').toBeGreaterThanOrEqual(10)

    /* الخيارات في شبكة — و`Chips` (الرصف بعرض النصّ) لا يعود */
    expect(src, 'الخيارات لا تُرصَف في شبكة').toContain('<ChoiceGrid')
    expect(src, 'عاد الرصف الحرّ المتعرّج').not.toContain('<Chips')

    /* قياسٌ واحد لكلّ حقل — لا صنفٌ يُكتب بيد كلّ حقل على حدة */
    expect(src, 'صنف الحقول القديم ما زال يُستعمل').not.toContain('const inputCls')
    expect(src, 'الحقول لا تأخذ القياس الموحّد').toContain('controlCls')

    /* والعناوين الصغيرة المكتوبة بيدٍ لكلّ حقل حلّ محلَّها `Field` */
    expect(src, 'عادت عناوين الحقول المكتوبة بيدها').not.toContain('mb-1.5 block text-xs font-bold text-white/60')
  })

  /* حلقةُ «لم تذكر رقمك» — رقمٌ يراه المتقدّمُ ولا يراه الخادم.

     القسمُ الأوّل يُرسَل إلى الخادم عند المضيّ منه (كي يوجد مرجعٌ تُرفع عليه
     الملفّات)، وكان الرقمُ اختياريّا فيه. فمن مضى بلا رقمٍ أُنشئ طلبُه بلا
     رقم، ثمّ اختار واتساب في القسم الثالث فقيل له «عد إلى القسم الأول
     وأضفه» — فعاد وكتبه، فرأته الشاشةُ ومرّرته، ولم يره الخادم: لا نداءَ
     بعد القسم الأوّل كان يحمله. فيُردّ الإرسالُ فيعود فيجده مكتوبا فيرسل
     فيُردّ. وقد وقعت على متقدّمٍ حقيقيّ (WJ-TR-2026-00001).

     والبابان اللذان أُغلقا يُحرسان هنا معا — وإغلاقُ أحدهما وحدَه لا يكفي:
     الأوّلُ يمنع الحلقةَ على من يأتي، والثاني يُخرج منها من هو فيها. */
  it('رقمُ الجوال شرطٌ في القسم الأوّل — لا في الثالث وحدَه', () => {
    const src = FORM()
    const list = /const missing = useMemo\(\(\) => \{[\s\S]*?\n {2}\}, \[[^\]]*\]\);/.exec(src)?.[0] ?? ''
    expect(list, 'كتلة قائمة النقص مفقودة').toBeTruthy()

    /* والفحصُ على `m[1]` بعينها لا على ورودِ `form.phone` في الكتلة: القسمُ
       الثالثُ يذكره أيضا، فحارسٌ يكتفي بوجود الاسم يخضرّ وهو لا يحرس شيئا. */
    const step1 = list.match(/m\[1\]\.push\([^\n]*/g) ?? []
    const phoneLine = list
      .split('\n')
      .find((l) => l.includes('m[1].push') && l.includes('form.phone'))
    expect(step1.length, 'قائمة نقص القسم الأوّل فارغة').toBeGreaterThan(0)
    expect(phoneLine, 'الرقم ليس شرطا في القسم الأوّل — فيُنشأ طلبٌ بلا رقم').toBeTruthy()

    /* وحدٌّ واحدٌ يحكم القسمَين: لو افترقا قَبِل قسمٌ ما يردّه الآخر */
    expect(/export const PHONE_MIN_DIGITS = (\d+);/.exec(src)?.[1], 'لا حدَّ معلَن للرقم').toBeTruthy()
    const uses = src.match(/normalizeDigits\(form\.phone\)\.length < PHONE_MIN_DIGITS/g) ?? []
    expect(uses.length, 'القسمان لا يقيسان الرقمَ بالحدّ نفسِه').toBeGreaterThanOrEqual(2)

    /* والحقلُ نفسُه يقول إنّه مطلوب — وإلّا فالنجمةُ غائبةٌ والقائمةُ تتّهم */
    const field = /<Field label="رقم الجوال[^>]*>/.exec(src)?.[0] ?? ''
    expect(field, 'حقل رقم الجوال مفقود').toBeTruthy()
    expect(field, 'الحقل لا يُعلن أنّه مطلوب').toContain('required')
    expect(field, 'الحقل بلا رسالة خطأ').toContain('error={errOf("phone")}')
  })

  it('الرقمُ يعبر إلى الخادم مع القسم الأخير — لا مع الأوّل وحدَه', () => {
    /* الطرفُ الثاني من الإغلاق: من أُنشئ طلبُه بلا رقمٍ قبل اليوم ما زال
       مفتوحا، وتصحيحُه لا يصل إلّا إن حمله نداءُ `phase-2`. */
    const submit = /const submit = async \(e: React\.FormEvent\) => \{[\s\S]*?\n {2}\};/.exec(read(PAGE))?.[0] ?? ''
    expect(submit, 'دالة الإرسال مفقودة').toBeTruthy()
    expect(submit, 'الإرسال الأخير لا يحمل الرقم — فتصحيحُه لا يصل').toMatch(/phone: normalizeDigits\(form\.phone\)/)

    /* والخادمُ يقبله ويكتبه — وإلّا فالنداءُ يحمله ويُرمى */
    expect(read(ROUTES), 'مخطط القسم الأخير لا يقبل الرقم').toMatch(/phone: z\.string\(\)\.max\(20\)\.optional\(\)/)
    const svc = read(SERVICE)
    const phase2 = /async completePhase2\([\s\S]*?\n {2}\}\n/.exec(svc)?.[0] ?? ''
    expect(phase2, 'دالة القسم الأخير مفقودة').toBeTruthy()
    expect(phase2, 'الخدمة لا تقرأ الرقم الواصل').toContain('input.phone')
    expect(phase2, 'الرقم الواصل لا يُكتب في القاعدة').toMatch(/sentPhone \? \{ phone/)
    /* وحارسُ الوسيلة يقيس الرقمَ الفعليّ لا المحفوظَ وحدَه — وإلّا بقيت
       الحلقةُ قائمةً ولو وصل الرقمُ في النداء نفسِه. */
    expect(phase2, 'الحارس ما زال يقرأ المحفوظ وحدَه').not.toContain('def.needsPhone && !app.phone')
    expect(phase2, 'الحارس لا يقيس الرقم الفعليّ').toContain('def.needsPhone && !phone')
  })

  it('الشبكة تُسوّي الخلايا فعلا — لا تكتفي بالاسم', () => {
    const kit = read('src/components/FormKit.tsx')
    /* خليّةٌ بعرضٍ كامل وارتفاعٍ أدنى موحّد: هذا ما يجعلها متساوية */
    expect(kit, 'الخليّة لا تملأ عمودها فتعود بعرض نصّها').toContain('min-h-12 w-full')
    expect(kit, 'الخيارات ليست في شبكة').toContain('grid-cols-2 sm:grid-cols-3')
    /* والعنوان h2 لا h3 — بوّابة الإتاحة تردّ القفز من h1 */
    expect(kit, 'عنوان السؤال يقفز بمستوى العناوين').toContain('<h2 className=')
    /* وقياسُ الحقل واحدٌ معلَن، لا يُكتب في كلّ موضع */
    expect(kit, 'لا قياس موحّد للحقول').toMatch(/export const controlCls =\s*\n\s*'h-12 w-full/)
  })
})

/* ═══ جولةُ ١٢ سبتمبر ٢٠٢٦ — ما طلبه صاحبُ المنصّة في النموذج ═══

   ستّةُ أعطابٍ في أوّل احتكاكٍ بالمنصّة، وكلُّها تعود إن لم تُحرَس:

   ١) الشرطُ يُكتب داخلَ الصندوق لا تحته — التلميحُ تحت الحقل يُقرأ بعد أن
      يُكتب الخطأ، وداخلُه يُقرأ قبله.
   ٢) الدولُ كلُّها ويُبحث فيها بالاسم — لا أحدَ عشرَ رمزا في قائمةٍ منسدلة.
   ٣) المضيُّ إلى القسم التالي يريه رأسَه لا ذيلَه.
   ٤) والملخّصُ يسمّي ما سيصل المراجعَ ولا يعدّه. */
describe('نموذج انضمام المدرب — جولةُ الطلبات', () => {
  it('الشرطُ داخلَ الصندوق: كلمةُ المرور والساعاتُ والهاتف', () => {
    const src = read(PAGE)
    /* الجملةُ المحذوفةُ بعينها — عادت إن ظهرت */
    expect(src, 'جملةُ «بلا رمز الدولة» عادت تحت حقل الهاتف').not.toContain('بلا رمز الدولة وبلا صفر البداية')

    const phone = /<Field label="رقم الجوال[^>]*>/.exec(src)?.[0] ?? ''
    expect(phone, 'حقل الهاتف مفقود').toBeTruthy()
    expect(phone, 'عاد التلميحُ تحت حقل الهاتف').not.toContain('hint=')

    const password = /<Field label="كلمة المرور"[^>]*>/.exec(src)?.[0] ?? ''
    expect(password, 'حقل كلمة المرور مفقود').toBeTruthy()
    expect(password, 'حدُّ كلمة المرور عاد تحت الصندوق').not.toContain('hint=')
    /* والحدُّ داخلَ الصندوق فعلا — لا محذوفا بحجّة النقل */
    const passwordInput = /<input\s+id="jt-password"[\s\S]*?\/>/.exec(src)?.[0] ?? ''
    expect(passwordInput, 'صندوقُ كلمة المرور بلا حدٍّ مكتوبٍ فيه').toContain('placeholder="٨ أحرف على الأقل"')

    const hours = /<Field label="ساعات أسبوعيا[^>]*>/.exec(src)?.[0] ?? ''
    expect(hours, 'حقل الساعات مفقود').toBeTruthy()
    expect(hours, 'شرطُ الساعات عاد تحت الصندوق').not.toContain('hint=')
    const hoursInput = /<input id="jt-hours"[\s\S]*?\/>/.exec(src)?.[0] ?? ''
    expect(hoursInput, 'صندوقُ الساعات بلا شرطٍ مكتوبٍ فيه').toContain('placeholder="بالأرقام الإنجليزية (1–80)"')
  })

  it('الدولُ كلُّها من مصدرٍ واحدٍ يُبحث فيه — لا قائمةٌ مكتوبةٌ بيد', () => {
    const src = FORM()
    /* القائمةُ اليدويّةُ لا تعود — لا بالاسم ولا بمحتواها */
    expect(src, 'عادت قائمةُ رموزِ الهاتف المكتوبةُ بيد').not.toContain('COUNTRY_CODES')
    expect(src, 'عادت خريطةُ المناطق الزمنيّة المكتوبةُ بيد').not.toContain('COUNTRY_TIMEZONE')
    expect(src, 'الدولُ العربيّةُ لم تعد تُشتقّ من المصدر الواحد').toContain('ARAB_COUNTRY_NAMES')

    /* ومنتقيان يُبحث فيهما لا `<select>` — والقديمان لا يعودان */
    expect(src, 'منتقي رمز الدولة غائب').toContain('<PhoneCodePicker id="jt-cc"')
    expect(src, 'منتقي دولة الإقامة غائب').toContain('<CountryPicker id="jt-country"')
    expect(src, 'عادت القائمةُ المنسدلةُ لرمز الدولة').not.toMatch(/<select id="jt-cc"/)
    expect(src, 'عادت القائمةُ المنسدلةُ لدولة الإقامة').not.toMatch(/<select id="jt-country"/)

    /* والمنتقي يُبحث فيه فعلا: صندوقُ بحثٍ ودورٌ معلَن، لا زينةُ اسم */
    const picker = read('src/components/CountryPicker.tsx')
    expect(picker, 'المنتقي بلا صندوق بحث').toContain("role=\"combobox\"")
    expect(picker, 'المنتقي بلا قائمةٍ معلَنةٍ لقارئ الشاشة').toContain("role=\"listbox\"")
    expect(picker, 'المنتقي لا يستعمل بحثَ القائمة').toContain('searchCountries')
    /* ولوحةُ المفاتيح: أسهمٌ واختيارٌ وطيّ — من يملأ نموذجا لا يرفع يدَه للفأرة */
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']) {
      expect(picker, `المنتقي لا يستجيب لـ${key}`).toContain(`'${key}'`)
    }
    /* والمنطقةُ الزمنيّةُ تُشتقّ من القائمة العالميّة لا من تسعَ عشرةَ دولة */
    expect(read(PAGE), 'المنطقةُ الزمنيّةُ لم تعد تُشتقّ').toContain('timezone: timezoneOf(form.country)')
  })

  it('المضيُّ يُري رأسَ القسم لا ذيلَه — وبعد الرسم لا معه', () => {
    const src = read(PAGE)
    const next = /const next = async \(\) => \{[\s\S]*?\n {2}\};/.exec(src)?.[0] ?? ''
    expect(next, 'دالة المضيّ مفقودة').toBeTruthy()
    /* التمريرُ داخلَ المعالِج يبدأ على القسم القديم ويُقطع حين يُستبدل */
    expect(next, 'عاد التمريرُ إلى معالِج الزرّ — يقع قبل الرسم فيُلقى المتقدّم في الذيل')
      .not.toContain('window.scrollTo')

    /* والأثرُ يُلتقط بمرساته لا بأوّل `useEffect` في الملفّ: تعبيرٌ جشعٌ
       يبدأ من أثرٍ آخرَ فيحرس ما لم يُقصد. فالبدايةُ إعلانُ المرساة. */
    const effect = /const stepsRef[\s\S]*?\}, \[step\]\);/.exec(src)?.[0] ?? ''
    expect(effect, 'لا أثرَ يمرّر بعد تبدّل القسم').toBeTruthy()
    /* ووثبةٌ لا رحلة: «الناعم» يُقطع في منتصفه حين يتبدّل المحتوى */
    expect(effect, 'التمريرُ عاد ناعما فيُقطع في منتصفه').not.toContain('smooth')
    /* والتركيزُ ينتقل معه — وإلّا بقي على زرٍّ اختفى */
    expect(effect, 'التركيزُ لا ينتقل إلى القسم الجديد').toContain('focus(')
    expect(src, 'مرساةُ القسم بلا `tabIndex` فلا تقبل التركيز').toMatch(/ref=\{stepsRef\}[^>]*tabIndex=\{-1\}/)
    /* والترويسةُ لاصقةٌ فوق الصفحة — فبلا هامشِ تمريرٍ تحجب ما وُثب إليه */
    expect(src, 'المرساةُ تحت الترويسة اللاصقة بلا هامش').toMatch(/ref=\{stepsRef\}[\s\S]{0,160}scroll-mt-/)
  })

  it('الملخّصُ يسمّي ما سيصل المراجعَ ولا يعدّه', () => {
    const src = read(PAGE)
    /* والفحصُ على البنية لا على ورودِ حرف: الجملةُ القديمةُ تُذكر في تعليقٍ
       يشرح ما كان، فحارسٌ يفتّش عن حروفها يحمرّ على شرحه لا على عودته.
       فالمحروسُ **التعبيرُ الذي كان يعدّ**. */
    expect(src, 'عاد عدُّ المستندات بلا اسم')
      .not.toMatch(/Object\.values\(uploads\)\.filter\([^)]*\)\.length/)
    /* من `uploadedDocs` إلى آخر الجدول: المستنداتُ تُسمّى قبله والصفوفُ تقرؤه */
    const rows = /const uploadedDocs[\s\S]*?\n {2}\];/.exec(src)?.[0] ?? ''
    expect(rows, 'جدولُ الملخّص مفقود').toBeTruthy()
    /* المستنداتُ باسم نوعِها واسمِ ملفِّها — «١ مستندا» لا يُراجَع */
    expect(rows, 'المستنداتُ لا تُسمّى بنوعها').toContain('DOC_KINDS')
    expect(rows, 'اسمُ الملفّ المرفوع لا يُعرض').toMatch(/uploads\[d\.kind\]\?\.name/)
    /* وما يُتواصَل به معه أمامَه — أكثرُ ما يُخطئ فيه الناسُ */
    for (const key of ['form.email', 'form.phone', 'contactChannel']) {
      expect(rows, `الملخّصُ لا يعرض ${key} — وهو ما سيُتواصَل به`).toContain(key)
    }
    /* وخبرتُه واعتمادُه وتوفّرُه — لا سطرٌ عامٌّ واحد */
    for (const k of ['خبرتك', 'اعتمادك', 'توفّرك', 'مستنداتك', 'ما تستطيع تدريسه']) {
      expect(rows, `الملخّصُ بلا سطرِ «${k}»`).toContain(k)
    }
    /* وما لم يُملأ يُقال ولا يُسكت عنه: السكوتُ يُقرأ رضا */
    expect(src, 'الحقلُ الفارغ يُسكت عنه فيظنّ المتقدّمُ أنّه مملوء').toContain('لم تذكره')
  })
})

/* ═══ ثلاثُ شكاوى من صاحب المنصّة على الهاتف (١٢ سبتمبر ٢٠٢٦) ═══ */
describe('نقرةٌ واحدةٌ، وعنوانٌ لا يفترض، ووعدٌ يُوفى', () => {
  const src = read(PAGE)
  /* بلا التعليقات — فذِكرُ الشيء في شرحٍ ليس فعلا له */
  const code = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

  it('الفئاتُ الثمانُ تُنقر نقرةً واحدة — لا منسدلةً تُفتح ثمّ يُختار منها', () => {
    /* «يجب أن أنقر نقرتين لأختار؟» — وثمانيةٌ تسع الشاشةَ ظاهرة، وأخواتُها
       في هذا النموذج كلُّها شبكةٌ تُنقر مرّة. */
    const grid = /<ChoiceGrid[^>]*TARGET_AUDIENCES/s.test(code)
      || /options=\{TARGET_AUDIENCES\}[\s\S]{0,200}?onToggle/.test(code)
    expect(grid, 'الفئاتُ ما زالت خلفَ منسدلة').toBe(true)
    expect(code, 'الفئاتُ ما زالت في MultiPick').not.toMatch(/<MultiPick[^>]*TARGET_AUDIENCES/s)
    /* والدولُ تبقى منسدلةً: اثنتان وعشرون فأكثر، وشبكتُها جدارٌ يبتلع الصفحة */
    expect(code, 'الدولُ خرجت من المنسدلة — وشبكتُها تبتلع الصفحة').toMatch(/<MultiPick[^>]*ARAB_COUNTRIES/s)
  })

  it('وعنوانا التواصل لا يفترضان أنّ الحساب مهنيّ', () => {
    /* «لا داعي لذلك، لأنّه ممكن يكون شخصيّا أو مهنيّا» — وأكثرُ المدرّبين
       جمهورُهم على حسابٍ واحدٍ لا يُصنّف. */
    expect(code, 'ما زال يفترض حسابا مهنيّا').not.toContain('حساب إنستغرام المهني')
    expect(code, 'ما زال يفترض صفحةً مهنيّة').not.toContain('صفحة فيسبوك المهنية')
    expect(code, 'حقلُ إنستغرام اختفى').toContain('حساب إنستغرام')
  })

  it('⚠️ ومتابعةُ الحالة تعرض زرَّ الحجز فعلا — والنصُّ يعد بزرٍّ «أدناه»', () => {
    /* «احجز موعدَ اجتماعك التعريفيّ من الزرّ أدناه» كانت تُقال في بطاقة
       المتابعة ولا زرَّ تحتها: يُغلق المتقدّمُ الصفحةَ ولا يحجز، ونظنّه
       تأخّر. والشرطُ شرطُ صفحة الحالة نفسُه — لا يُدعى من حجز. */
    const card = src.slice(src.indexOf('lookupResult &&'))
    expect(card, 'بطاقةُ المتابعة بلا زرِّ حجز').toContain('<BookInterview')
    expect(card, 'يُعرض لمن لا تقبل حالتُه الحجز').toContain('BOOKABLE_STATUSES.includes')
    expect(card, 'يُعرض لمن حجز سلفا').toContain('!lookupResult.hasInterview')
  })
})

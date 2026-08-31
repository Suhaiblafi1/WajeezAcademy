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
const ROUTES = 'server/http/routes/trainer-applications.routes.ts'
const SERVICE = 'server/services/trainer-application.service.ts'

describe('نموذج انضمام المدرب', () => {
  it('حدّ الدافع رقمٌ واحد في الواجهة والمخطط والخدمة', () => {
    const ui = /export const MOTIVATION_MIN = (\d+);/.exec(read(PAGE))?.[1]
    const schema = /motivation: z\.string\(\)\.trim\(\)\.min\((\d+)\)/.exec(read(ROUTES))?.[1]
    const service = /motivation\.length < (\d+)\)/.exec(read(SERVICE))?.[1]
    expect(ui, 'حدّ الواجهة مفقود').toBeTruthy()
    expect(schema, 'حدّ المخطط مفقود').toBeTruthy()
    expect(service, 'حدّ الخدمة مفقود').toBeTruthy()
    expect([schema, service], 'الخادم يخالف العدّاد الذي يراه المتقدّم').toEqual([ui, ui])
    expect(Number(ui)).toBe(75)
  })

  it('سؤال الاعتماد مع الخبرة لا بين الروابط', () => {
    const src = read(PAGE)
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
    const src = read(PAGE)
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
    const src = read(PAGE)
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
    const src = read(PAGE)
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
    const src = read(PAGE)
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
    const src = read(PAGE)
    expect(src).toMatch(/const PERIODS = \[[\s\S]*?value: "morning"[\s\S]*?value: "evening"[\s\S]*?\] as const;/)
    expect(src, 'الفترات لا تُرسَل مع التوفّر').toContain('periods: periods.length ? periods : undefined')
    /* والخادم يقبلها — وإلّا سقط الطلب كلّه عند الإرسال */
    expect(read(ROUTES), 'المخطط لا يعرف الفترات').toContain("periods: z.array(z.enum(['morning', 'evening'])).optional()")
  })

  it('المسودّة تُحفظ وتُستأنف، ولا تحفظ سرّا', () => {
    const src = read(PAGE)
    expect(src, 'لا حفظ للمسودّة').toContain('saveDraft({')
    expect(src, 'لا استئناف').toContain('loadDraft()')
    /* المسح عند نجاح الإرسال بعينه — لا في مكانٍ آخر يجعل الفحص يمرّ به */
    expect(src, 'المسودّة تبقى بعد وصول الطلب').toMatch(/setPhase2Done\(true\);\s*\n\s*clearDraft\(\);/)
    expect(src, 'الاستئناف يقع صامتا بلا أن يُقال').toContain('أكملنا من حيث توقّفت')

    /* كلمة المرور ورمز التحقق أسرارٌ عابرة: تُستثنى في الوحدة نفسها لا بالنسيان */
    const draft = read('src/application/trainer/application-draft.ts')
    expect(draft).toMatch(/NEVER_PERSISTED = \['accountPassword', 'verifyTokenInput', 'password'\]/)
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
    const src = read(PAGE)

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

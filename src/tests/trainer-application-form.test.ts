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
import { execFileSync } from 'node:child_process'
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
      ['السيرة الذاتية', 'uploads.cv'], ['الدورات السابقة', 'prevCourses.some'], ['الدرس التجريبي', 'demoConsent'],
    ] as const) {
      expect(list, `${subject}: إلزامٌ بلا سطرٍ في قائمة النقص — والزرّ يقرأ منها`).toContain(guard)
    }

    /* والقائمة تُعرض فعلا وتُنطق لقارئ الشاشة */
    expect(src, 'قائمة النقص لا تُعرض').toContain('aria-live="polite"')
  })

  it('قسم «ما يمكنك تدريسه» مرفوع من الطلب كلّه', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    expect(tracked, 'منتقي دورات الكتالوج ما زال في المستودع').not.toContain('TeachableCoursePicker')

    const src = read(PAGE)
    const steps = (/const STEPS = \[[\s\S]*?\] as const;/.exec(src)?.[0].match(/\{ n: \d+,/g) ?? []).length
    expect(steps, 'عدد الخطوات تغيّر').toBe(3)
    /* والخادم لم يعد يشترطها — وإلّا سقط كلُّ طلبٍ عند الإرسال */
    expect(read(ROUTES), 'المخطط ما زال يشترط دورة من الكتالوج').not.toMatch(/teachableCourseIds: z\.array\(z\.string\(\)\)\.min\(/)
    expect(read(SERVICE), 'الخدمة ما زالت ترفض الطلب بلا دورات').not.toContain("'no_teachable'")
    for (const page of [PAGE, 'src/pages/JoinTrainerComplete.tsx']) {
      expect(read(page), `${page} ما زال يرسل دورات الكتالوج`).not.toContain('teachableCourseIds:')
    }
  })
})

import { describe, expect, it } from 'vitest'
import { catalogCourses, skillsCatalog } from '../../domain/diagnostic/catalog'
import { measurableSkills } from '../../domain/diagnostic/v2_1/universe'
import { layersOfSkill } from '../../domain/diagnostic/v2/data'
import { planOf } from '../../domain/diagnostic/v2_1/data'
import {
  DILUTION_RATIO, SOFT_MAX_SKILLS, STATE_LABEL_AR,
  assessSkillSelection, byStateThenName, measurementDocDrift, skillStateOf,
} from '../../application/catalog/skill-measurement'

const measured = [...measurableSkills()]
/* المسجَّلة النشطة غير المقيسة — لا يكفي «ليست مقيسة»: في الكتالوج مهارات
   موقوفة تشخيصيا وحالتها ثالثة مختلفة */
const registeredUnmeasured = skillsCatalog
  .map((s) => s.slug)
  .filter((slug) => skillStateOf(slug).state === 'registered_unmeasured')

describe('ب-٤ حالة المهارة — من المحرك لا من التوثيق', () => {
  it('كل مهارة يقيسها المحرك تظهر «مقيسة»', () => {
    expect(measured.length).toBeGreaterThan(0)
    for (const slug of measured) expect(skillStateOf(slug).state, slug).toBe('measured')
  })

  it('المهارة النشطة التي لا يقيسها سؤال تظهر «مسجَّلة بلا سؤال» بأثرها مكتوبا', () => {
    expect(registeredUnmeasured.length).toBeGreaterThan(0)
    const st = skillStateOf(registeredUnmeasured[0])
    expect(st.state).toBe('registered_unmeasured')
    expect(st.noteAr).toContain('تدخل المقام ولا تُقاس')
  })

  it('الحالة الثالثة موجودة فعلا في الكتالوج: مهارات موقوفة تشخيصيا', () => {
    const inactive = skillsCatalog.map((s) => s.slug).filter((slug) => skillStateOf(slug).state === 'inactive')
    expect(inactive.length).toBeGreaterThan(0)
    expect(skillStateOf(inactive[0]).noteAr).toContain('لا تدخل الحساب')
  })

  it('المقيسة تُظهر ما يقيسها ولا تكتفي بالحالة', () => {
    const withDoc = measured.map((s) => skillStateOf(s)).find((s) => s.measuredBy)
    expect(withDoc, 'مهارة مقيسة وموثقة على الأقل').toBeTruthy()
    expect(withDoc!.noteAr).toContain('تفصل بين المرشحين')
    expect(withDoc!.noteAr).toContain(withDoc!.measuredBy!)
  })

  it('شريحة مجهولة لا ترمي وتُقرأ اسما', () => {
    const st = skillStateOf('slug_lا_يوجد'.replace(/[^\w]/g, '_'))
    expect(st.nameAr.length).toBeGreaterThan(0)
    expect(['measured', 'registered_unmeasured', 'inactive']).toContain(st.state)
  })

  it('الحالات الثلاث معنونة بالعربية', () => {
    for (const label of Object.values(STATE_LABEL_AR)) expect(label.length).toBeGreaterThan(3)
  })
})

describe('ب-٤ تقييم الاختيار — يقول ولا يمنع', () => {
  it('اختيار فارغ: أصفار بلا تحذير', () => {
    expect(assessSkillSelection([])).toEqual({ total: 0, measured: 0, unmeasured: 0, inactive: 0, warningsAr: [] })
  })

  it('المكرَّر يُفرد فلا يُحسب مرتين', () => {
    const s = measured[0]
    expect(assessSkillSelection([s, s, s]).total).toBe(1)
  })

  it('بلا مهارة مقيسة: تحذير صريح بالبديل لا لوم', () => {
    const a = assessSkillSelection(registeredUnmeasured.slice(0, 3))
    expect(a.measured).toBe(0)
    expect(a.warningsAr.join(' ')).toContain('لا مهارة مقيسة واحدة')
    expect(a.warningsAr.join(' ')).toContain('اطلب إضافة سؤال قياس')
  })

  it('تجاوز الحدّ اللَّيّن يُنبَّه عليه بسببه', () => {
    const many = skillsCatalog.slice(0, SOFT_MAX_SKILLS + 1).map((s) => s.slug)
    const a = assessSkillSelection(many)
    expect(a.total).toBe(SOFT_MAX_SKILLS + 1)
    expect(a.warningsAr.join(' ')).toContain('الحدّ المُوصى به')
  })

  it('التخفيف: أغلبية غير مقيسة مع وجود مقيسة يُنبَّه عليها بالنسبة', () => {
    const a = assessSkillSelection([measured[0], ...registeredUnmeasured.slice(0, 4)])
    expect(a.measured).toBe(1)
    expect(a.unmeasured).toBe(4)
    expect(a.unmeasured / a.total).toBeGreaterThanOrEqual(DILUTION_RATIO)
    expect(a.warningsAr.join(' ')).toContain('غير قابلة للقياس')
  })

  it('اختيار سليم بمقيسة كافية: بلا تحذير', () => {
    const a = assessSkillSelection(measured.slice(0, 3))
    expect(a.measured).toBe(3)
    expect(a.warningsAr).toEqual([])
  })
})

describe('ب-٤ الترتيب', () => {
  it('المقيسة تتقدّم على المسجَّلة', () => {
    const m = skillStateOf(measured[0])
    const u = skillStateOf(registeredUnmeasured[0])
    expect([u, m].sort(byStateThenName)[0].state).toBe('measured')
  })
})

describe('ب-٤ تباعد التوثيق عن المحرك — واقعة تُعلَن', () => {
  it('يُحصى الاتجاهان: مقيسة بلا توثيق، وموثَّقة لا تُقاس', () => {
    const d = measurementDocDrift()
    /* كان هنا `undocumented + staleDoc > 0` بحجة «يثبّت أن الرصد يعمل لا أن
       الرقم ثابت» — وهو في الحقيقة يثبّت رقما: أن الخلل قائم. أُغلق الاتجاهان
       في 2026-08-26؛ الناقص امتلأ بتأليف سبعة أسئلة قياس، والبائت تبيّن أنه
       ليس بائتا بل ثلاثة أسئلة منقولة عمدا إلى ما بعد التوصية. فانقلب الحارس
       إلى ما هو أقوى: صفر في الاتجاهين، مع بقاء تصنيف كل اتجاه محروسا لو عاد. */
    for (const slug of d.undocumented) expect(measurableSkills().has(slug)).toBe(true)
    for (const slug of d.staleDoc) expect(measurableSkills().has(slug)).toBe(false)
    expect(d.undocumented, `مقيسة بلا توثيق: ${d.undocumented.join(' · ')}`).toEqual([])
    expect(d.staleDoc, `موثَّقة لا تُقاس: ${d.staleDoc.join(' · ')}`).toEqual([])
  })

  it('الصفر ليس أجوف: القياس قائم وموثَّق، والإعفاء مقصور على المنقول عمدا', () => {
    /* صفرٌ يمرّ لأن لا شيء يجري ليس نجاحا. هنا يُثبَت أن الرصد له مُدخَل حقيقي:
       مهارات مقيسة فعلا وكلها موثَّقة، وأن إعفاء «ما بعد التوصية» لا يبتلع
       حالة يجب أن تسقط. */
    const registered = new Set(skillsCatalog.map((s) => s.slug))
    const measuredRegistered = [...measurableSkills()].filter((s) => registered.has(s))
    expect(measuredRegistered.length).toBeGreaterThan(0)
    for (const slug of measuredRegistered) {
      expect(layersOfSkill(slug)?.measured_by, `مقيسة بلا توثيق: ${slug}`).toBeTruthy()
    }
    /* كل موثَّقة لا يقيسها المحرك يجب أن يكون سؤالها منقولا فعلا — لا معفاة بلا سبب */
    for (const s of skillsCatalog) {
      const by = layersOfSkill(s.slug)?.measured_by
      if (!by || measurableSkills().has(s.slug)) continue
      expect(planOf(by)?.final_status, `${s.slug} معفاة والسؤال ${by} ليس منقولا`).toBe('post_recommendation')
    }
  })

  it('المفاتيح غير المسجَّلة تُستثنى من تباعد التوثيق — تُبلَّغ بعلّتها لا بعلّة مختلقة', () => {
    const registered = new Set(skillsCatalog.map((s) => s.slug))
    for (const slug of measurementDocDrift().undocumented) {
      expect(registered.has(slug), slug).toBe(true)
    }
  })

  it('لا سؤال قياس يقيس مفتاحا ليس مهارة — لا جواب يُهمَل بعد جمعه', () => {
    const registered = new Set(skillsCatalog.map((s) => s.slug))
    const orphans = [...measurableSkills()].filter((s) => !registered.has(s))
    /* كان هذا الاختبار يحرس الواقعة نفسها: خمسة مفاتيح (ai_applied_use ·
       communication_persuasion · cyber_safety · digital_content · sales)
       تُسأل ولا تدخل أي ترشيح، فيُحرَس ألا تزيد. أُغلقت في 2026-08-26 بإعادة
       توجيه الأسئلة الخمسة إلى مهاراتها المسجَّلة، مع إعادة تسمية مقابلة لكل
       إشارة تشترطها في القوالب المركبة — فالتوجيه وحده كان سيكسر خمسة قوالب.
       فانقلب الحارس إلى ما هو أقوى: العدد يبقى صفرا. أي سؤال جديد يقيس مفتاحا
       غير مسجَّل يسقط هنا قبل أن يصل متعلما. */
    expect(orphans, `مفاتيح تُسأل ولا تُحتسب: ${orphans.join(' · ')}`).toEqual([])
  })
})

describe('ب-٤ الواقع المنشور — الأرقام التي يعالجها البند', () => {
  /* كان هذا الاختبار يُثبت المشكلة: «أغلب الدورات بلا مهارة مقيسة» — أكثر من
     نصف الكتالوج لا يراه مطابق المهارات. وقد عولجت: ثلاثة أسئلة جديدة
     (kpi_design · risk_management · change_management) وخمس مهاراتٍ أُلحقت
     بدوراتٍ تعلّمها فعلا أنزلت العدد من ٥٤ إلى ٤٢.

     فانقلب الحارس إلى سقفٍ لا أرضية: العدد لا يعود يصعد. أي تراجع — بحذف
     سؤال أو فكّ ارتباط مهارة — يسقط هنا قبل أن يصل متعلما. */
  it('الدورات بلا مهارة مقيسة لا يعود عددها يرتفع', () => {
    const zero = catalogCourses.filter((c) => assessSkillSelection(c.skill_slugs).measured === 0)
    expect(zero.length, `دورات لا يراها مطابق المهارات: ${zero.length}`).toBeLessThanOrEqual(42)
    expect(zero.length, 'أقلّ من نصف الكتالوج — وكان أكثر من نصفه').toBeLessThan(catalogCourses.length / 2)
  })
})

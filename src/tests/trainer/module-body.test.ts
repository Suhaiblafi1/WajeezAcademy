/* المحتوى النظريُّ: مكتوبٌ أو ملفٌّ — ما يُحرَس (ع-٢).

   ═══ ثلاثةُ أعطابٍ يحرسها هذا الملفّ ═══

   ① **قاعدةُ التمام في موضعَين فتفترقان.** كانت «أربعون حرفا» مكتوبةً في
      الخادم وفي شاشة المدرّب، ورأسُ `plan-overlay` يقول صراحةً لمَ جُمعت:
      «رقمان يقولان الشيءَ نفسَه يفترقان، فيُقال له تمّ ويُردّ إرسالُه».
      وع-٢ يزيد عليها بديلا، فلو زِيد في موضعٍ دون آخرَ عاد الافتراقُ —
      يرى المدرّبُ محورَه تامّا بملفّه ويردّه الخادمُ بأنّه بلا متن.
   ② **ملفٌّ يُخترَع حيث لا خطّة.** الكتالوجُ لا يحمل ملفَّ متن، فلو تسرّب
      `undefined` قرأته الشاشةُ «ثمّ ملفّ» وفتحت إطارا فارغا.
   ③ **«قيد التأليف» فوق وحدةٍ لها ملفّ.** وهو أسوأُ من الفراغ: ما رُفع
      لأجله محجوبٌ خلف جملةٍ تقول إنّه لم يُكتب بعد. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BODY_FILE_MIMES, FILE_PURPOSES, TRAINER_FILE_PURPOSES, MAX_BODY_FILE_BYTES, MIN_MODULE_BODY, acceptedMimes,
  bodyFileBlockerAr, fileBlockerAr, fileReadsInline, moduleBodyBlockerAr, moduleBodyDone,
  readsInline, resourceHasSource, resourceSourceBlockerAr,
} from '../../application/trainer/module-body'
import { MIN_MODULE_BODY as VIA_OVERLAY, overlayModules } from '../../application/trainer/plan-overlay'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const LONG = 'ن'.repeat(MIN_MODULE_BODY)

describe('ع-٢ · متى يتمّ المحور', () => {
  it('① المكتوب يتمّه — والقصير لا', () => {
    expect(moduleBodyDone({ bodyAr: LONG })).toBe(true)
    expect(moduleBodyDone({ bodyAr: 'قصير' }), 'حرف يمرّ فتتعلّم الحيلة').toBe(false)
    expect(moduleBodyDone({}), 'فارغ يمرّ').toBe(false)
  })

  it('والملفّ وحده يتمّه — وهو كلّ ع-٢: «بدلا» لا «مع»', () => {
    expect(moduleBodyDone({ bodyFileKey: 'k-123' }), 'ملفّ لا يتمّ المحور').toBe(true)
    expect(moduleBodyDone({ bodyAr: '', bodyFileKey: 'k-123' })).toBe(true)
    expect(moduleBodyDone({ bodyFileKey: '   ' }), 'مفتاح فارغ يعدّ ملفّا').toBe(false)
  })

  it('وقاعدة واحدة لا اثنتان — والأرضيّة معادة التصدير هي هي', () => {
    expect(VIA_OVERLAY, 'أرضيّتان تفترقان').toBe(MIN_MODULE_BODY)
  })

  it('وما ينقص يقال بالبديل لا بـ«غير مكتمل»', () => {
    expect(moduleBodyBlockerAr({ bodyFileKey: 'k' })).toBeNull()
    const why = moduleBodyBlockerAr({}) ?? ''
    expect(why, 'لا يذكر البديل').toMatch(/أرفق|PDF|Word/)
  })
})

describe('ع-٢ · ما يقبل من الملفّات', () => {
  it('الصيغتان لا غير — وما عداهما بابه «المصادر»', () => {
    for (const mime of BODY_FILE_MIMES) expect(bodyFileBlockerAr(mime)).toBeNull()
    expect(bodyFileBlockerAr('image/png'), 'صورة تمرّ متنا').toBeTruthy()
    expect(bodyFileBlockerAr('application/zip'), 'أرشيف يمرّ متنا').toBeTruthy()
  })

  it('والسقف يفرض — وهو سقف الرفع نفسه لا رقم ثان', () => {
    expect(bodyFileBlockerAr('application/pdf', MAX_BODY_FILE_BYTES)).toBeNull()
    expect(bodyFileBlockerAr('application/pdf', MAX_BODY_FILE_BYTES + 1), 'بلا سقف').toBeTruthy()
    /* كان أربعةً — سقفَ مسار الذاكرة. وصار ملفُّ الشعبة يُرفع بالبثّ، فالسقفُ ٢٥
       (١١ أكتوبر ٢٠٢٦): كرّاساتٌ من ١٣ و٣٨ ميغابايت كانت تُضغط خارجَ المنصّة */
    expect(MAX_BODY_FILE_BYTES).toBe(25 * 1024 * 1024)
  })

  it('وPDF يقرأ في مكانه وWord ينزّل — فلا زرّ يبدو قارئا ثمّ يحفظ', () => {
    expect(readsInline('application/pdf')).toBe(true)
    expect(readsInline(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )).toBe(false)
    expect(readsInline(null)).toBe(false)
  })
})

describe('ع-٢ · الملفّ يصل المتعلّم', () => {
  const catalog = [{ id: 'M1', title: 'محور', body: 'متن الكتالوج' }]

  it('② بلا خطّة لا ملفّ — والكتالوج لا يحمله', () => {
    const [m] = overlayModules(catalog, null)
    expect(m.bodyFileKey, 'ملفّ اخترع بلا خطّة').toBeNull()
    expect(m.bodyFileName).toBeNull()
    expect(m.bodyFileMime).toBeNull()
  })

  it('ويصل من الخطّة باسمه ونوعه — فتعرف الشاشة أتعرضه أم تنزّله', () => {
    const [m] = overlayModules(catalog, {
      modules: [{
        moduleId: 'M1', titleAr: 'محور', bodyFileKey: 'k-9',
        bodyFileName: 'النظريّة.pdf', bodyFileMime: 'application/pdf',
      }],
      resources: [],
    })
    expect(m.bodyFileKey).toBe('k-9')
    expect(m.bodyFileName).toBe('النظريّة.pdf')
    expect(readsInline(m.bodyFileMime)).toBe(true)
    expect(m.fromTrainer, 'رفع ملفّ كتابة من مدرّبه').toBe(true)
  })

  it('ومحور في الخطّة بلا ملفّ لا يرث ملفّ غيره', () => {
    const [m] = overlayModules(catalog, {
      modules: [{ moduleId: 'M1', titleAr: 'محور', bodyAr: LONG }],
      resources: [],
    })
    expect(m.bodyFileKey).toBeNull()
  })
})

describe('ع-٢ · وشاشة المتعلّم', () => {
  it('③ «قيد التأليف» لا تعرض على وحدة لها ملفّ', () => {
    const study = code('src/pages/student/ModuleStudy.tsx')
    /* الشرطُ المكتوبُ قبل شاشةِ «قيد التأليف» يجب أن يستثني صاحبَ الملفّ */
    expect(study, 'الشاشة لا تقرأ ملفّ المتن أصلا').toContain('bodyFileKey')
    expect(study, 'لا تعرض الملفّ لقارئه').toContain('ModuleBodyDoc')
  })

  it('والقارئ يقرأ من مسار محروس بالجلسة لا من رابط مفتوح', () => {
    const doc = code('src/components/ModuleBodyDoc.tsx')
    expect(doc, 'مسار القراءة ليس مسار ملفّات الشعبة المحروس').toContain('/api/v1/cohort-files/')
    expect(doc, 'رابط موقّع ينسخ فيفتح بلا حساب').not.toMatch(/\bsig=|\bexp=/)
  })
})

/* ═══ د-٣ · والمصدرُ ملفّا يُرفع لا رابطا يُلصق ═══

   «ملفّ» كان **نوعا يُختار من القائمة** منذ البداية (`RESOURCE_KINDS`)، ولا
   شيءَ يُرفَع خلفه: الحقلُ يطلب `https://` والحاجزُ يشترطه. فمن اختاره لصق
   رابطا وسمّاه ملفّا، أو ترك النوعَ كذبا على ما تحته.

   وأخطرُ ما هنا **قاعدةُ «له ما يُفتح»**: كانت ستصير في موضعَين — زرُّ
   الحفظ في الشاشة وحاجزُ الخادم — فيُرفع الملفُّ ثمّ يُردّ حفظُه. */
describe('د-٣ · المصدر ملفّا', () => {
  const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

  it('باب المصدر أوسع من باب المتن — شرائح وجداول وصور', () => {
    expect(acceptedMimes('plan_resource')).toContain(PPTX)
    expect(acceptedMimes('plan_resource')).toContain('image/png')
    /* والمتنُ درسٌ يُقرأ: شريحةٌ ليست متنا */
    expect(acceptedMimes('module_body'), 'باب المتن اتّسع فصار كلّ شيء').not.toContain(PPTX)
    expect(fileBlockerAr('module_body', PPTX), 'شريحة تمرّ متنا').toBeTruthy()
    expect(fileBlockerAr('plan_resource', PPTX)).toBeNull()
  })

  /* وثالثُها الكرّاسة (٦ أكتوبر ٢٠٢٦): «PDF only but the template is Word» */
  /* ورابعُها تقريرُ المراجعة (٨ أكتوبر ٢٠٢٦): يرفعه المعتمِدُ لا المدرّب */
  it('والأغراض هي ما في المخطّط — لا خامس يخترع', () => {
    expect([...FILE_PURPOSES].sort()).toEqual(['module_body', 'plan_resource', 'review_report', 'workbook'])
  })

  it('⚠️ وتقرير المراجعة لا يطلب من باب المدرّب — PDF أو Word يرفعه المعتمد', () => {
    expect(TRAINER_FILE_PURPOSES as readonly string[], 'صار المدرّب يرفع تقرير مراجعة خطّته').not.toContain('review_report')
    expect([...TRAINER_FILE_PURPOSES].sort()).toEqual(['module_body', 'plan_resource', 'workbook'])
    expect(fileBlockerAr('review_report', 'application/pdf')).toBeNull()
    expect(fileBlockerAr('review_report', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBeNull()
    expect(fileBlockerAr('review_report', PPTX)).toBe('لا يقبل إلّا PDF أو Word')
  })

  it('⚠️ والكرّاسة PDF وحده — لا Word ولا شرائح ولا صور', () => {
    expect(acceptedMimes('workbook')).toEqual(['application/pdf'])
    expect(fileBlockerAr('workbook', 'application/pdf')).toBeNull()
    expect(fileBlockerAr('workbook', PPTX), 'شريحة تمرّ كرّاسة').toBeTruthy()
    expect(fileBlockerAr('workbook', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'Word يمرّ كرّاسة')
      .toContain('PDF')
  })

  it('وما يعرض في الصفحة يختلف بالغرض', () => {
    expect(fileReadsInline('plan_resource', 'image/png'), 'صورة تنزّل ولا تعرض').toBe(true)
    expect(fileReadsInline('plan_resource', PPTX), 'شرائح تعرض في متصفّح').toBe(false)
    expect(fileReadsInline('module_body', 'application/pdf')).toBe(true)
  })

  it('⚠️ ومصدر له ما يفتح: رابط **أو** ملفّ — وقاعدة واحدة لا اثنتان', () => {
    expect(resourceHasSource({ url: 'https://x.test/a.pdf' })).toBe(true)
    expect(resourceHasSource({ bodyFileKey: 'k-1' }), 'المرفوع يردّ لأنّه بلا رابط').toBe(true)
    expect(resourceHasSource({ url: '', bodyFileKey: '  ' }), 'مصدر بلا شيء يمرّ').toBe(false)
    expect(resourceHasSource({ url: 'ftp://x.test/a' }), 'رابط ليس https يمرّ').toBe(false)
    expect(resourceSourceBlockerAr({}), 'لا يقال ما ينقص').toBeTruthy()
  })

  /* والفحصُ على **غياب** الصيغة المكتوبة بيدها لا على حضور اسم الدالّة:
     استيرادٌ يبقى في الملفّ ويُرضي `toContain` بلا أن يُنادى شيء — وقد
     جُرّبت فمرّت، وهي عينُ ما وقع في حارس البند ٣٠ قبله.

     ومحصورٌ في **موضع المصادر** لا في الملفّ كلِّه: مرفقاتُ المهامّ فحصُها
     رابطٌ بيدها بحقّ — لا ملفَّ يُرفع فيها، فشرطُها ليس شرطَ المصادر.
     وحارسٌ يشمل الملفَّ كلَّه يحمرّ على ميزةٍ لا يحرسها. */

  /* ═══ والشرطُ انتقل من الحفظ إلى الإرسال (٥ أكتوبر ٢٠٢٦) ═══

     كان هذا الحارسُ يطلب الشرطَ في حاجزَي **الحفظ**: `saveProblems` في الشاشة
     و`superRefine` في مخطّط الخادم. وذاك ما حبس المدرّبين عن حفظ أيّ شيء: مصدرٌ
     بلا رابطٍ نُقل من اللوح القديم يردّ حفظَ الخطوة الأولى، والمصادرُ في الخامسة
     لا تُفتح قبلها. فصار الشرطُ في قائمة التجهيز (`buildChecklist`) وفي ما
     تقوله الشاشةُ عن الخطوة (`gapsFor`) — يمنع الإرسالَ لا الحفظ.

     والحارسُ على البنية: حدودُ الدالّة بعينها لا ورودُ اسمٍ في الملفّ. */
  const between = (src: string, start: string, end: string) => {
    const at = src.indexOf(start)
    if (at < 0) return ''
    const stop = src.indexOf(end, at + start.length)
    return stop < 0 ? '' : src.slice(at, stop)
  }

  it('والطرفان يقرآن المالك نفسه عند الإرسال — ولا يردّان الحفظ به', () => {
    const screen = code('src/pages/trainer/CohortWorkspace.tsx')
    const save = between(screen, 'const saveProblems = (', 'return out;')
    expect(save, 'لم يعثر على شرط الحفظ في الشاشة').toBeTruthy()
    expect(save, 'الشاشة تردّ الحفظ بمصدر بلا رابط — فيحبس المدرّب عن حفظ ما قبله').not.toContain('resourceHasSource')
    expect(save, 'الشاشة تفحص صيغة الرابط بيدها').not.toMatch(/\^https\?:/)
    const said = between(screen, 'const gapsFor = (', 'return [label];\n  };')
    expect(said, 'لم يعثر على ما تقوله الشاشة عن الخطوة').toBeTruthy()
    expect(said, 'المصدر بلا رابط لا يسمّى في ما ينقص الخطوة').toContain('resourceHasSource')

    const route = between(code('server/http/routes/learning-portal.routes.ts'), 'resources: z.array(', 'liveNoteAr:')
    expect(route, 'لم يعثر على مخطّط المصادر في الخادم').toBeTruthy()
    expect(route, 'الخادم يردّ الحفظ كلّه بمصدر بلا رابط').not.toMatch(/resourceSourceBlockerAr|resourceHasSource|superRefine/)

    const list = between(code('server/services/cohort-plan.service.ts'), 'export function buildChecklist(', '\n}\n')
    expect(list, 'لم يعثر على قائمة التجهيز').toBeTruthy()
    expect(list, 'قائمة التجهيز لا تمنع إرسال مصدر بلا رابط').toContain('resourceHasSource')
    expect(list, 'القائمة تفحص صيغة الرابط بيدها').not.toMatch(/\^https\?:/)
  })

  it('والمتعلّم يفتح المرفوع من مسار محروس لا من رابط خارجيّ', () => {
    const work = code('src/components/journey/StageWork.tsx')
    expect(work, 'المرفوع لا يفتح من مسار الشعبة').toContain('/api/v1/cohort-files/')
  })
})

/* وقفُ حجز المقابلة — حارسُ ما يُنسى يومَ يُطفأ المفتاح، وما يكذب ما دام يعمل.

   قرارُ صاحب المنصّة (٢٠ سبتمبر ٢٠٢٦): امتلأت المواعيد، فيُوقَف الحجزُ هذا
   الشهرَ ويُقال للمتقدّم إنّ طلبَه وصل وإنّ الرابطَ يعود في أكتوبر ٢٠٢٦.

   ═══ ولماذا حارسٌ أصلا لِما هو مؤقّت ═══

   لأنّ الوقفَ يُكسَر صامتا من بابَين:

   ① **بابُ التناقض.** المفتاحُ يُقرأ في أربعة مواضع: البطاقةُ، وعنوانُ شاشة
      ما بعد الإرسال، وزرُّها، وشرحُ حالتَي «مقدَّم» و«اختيار أوّليّ». فمن
      أطفأ التقويمَ في البطاقة وحدَها ترك ثلاثةَ أبوابٍ تَعِد بزرٍّ لا يُعرض
      — والمتقدّمُ يبحث عن «الزرّ أدناه» ولا زرَّ هناك.
   ② **وبابُ العودة.** يومَ تُفتح المواعيد يُطفأ `active` وحدَه، فيجب أن
      يعود كلُّ نصٍّ إلى ما كان. وفرعٌ منسيٌّ لا يسقط شيئا: يبقى الموقعُ
      يقول «الحجزُ موقوف» وتقويمُه مفتوح.

   ═══ والفحصُ على البنية لا على ورودِ حرف ═══

   في هذا المستودَع ثلاثةُ حرّاسَ مرّوا خضرا وهم منقوضون لأنّهم طابقوا نصّا
   في تعليقٍ أو اسما جزءا من اسم. وهذا الملفُّ نفسُه معرَّضٌ له: كلمةُ «احجز»
   باقيةٌ في الملفّات — في الفرع الذي يعود يومَ تُفتح المواعيد. فحارسٌ يقول
   «الملفُّ يحوي احجز» يمرّ وهو لا يقيس شيئا.

   فالمقيسُ هنا **الفرعُ المختار**: يُنتزع طرفا كلِّ شرطٍ على حدة، ويُفحص
   طرفُ الوقف بما يجب أن يقوله، وطرفُ العودة بما يجب أن يعود إليه. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  APPLICANT_STATUS, BOOKABLE_STATUSES, INTERVIEW_BOOKING_PAUSE,
} from '@/application/trainer/application-options'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

/** الشيفرةُ بلا تعليقاتها — فلا يُقاس شرحٌ يذكر «احجز» مكانَ شيفرةٍ تعرضه */
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** طرفا شرطٍ نصّيّ على المفتاح: `PAUSE.active ? "موقوف" : "مفتوح"` */
function branches(src: string): { paused: string; open: string } | null {
  const m = /INTERVIEW_BOOKING_PAUSE\.active\s*\?\s*"([^"]*)"\s*:\s*"([^"]*)"/.exec(src)
  return m ? { paused: m[1], open: m[2] } : null
}

describe('المفتاحُ — مصدرٌ واحدٌ تقرؤه الشاشاتُ كلُّها', () => {
  it('معلَنٌ بحالٍ وشهرَين مسمّيَين', () => {
    expect(typeof INTERVIEW_BOOKING_PAUSE.active).toBe('boolean')
    expect(INTERVIEW_BOOKING_PAUSE.monthAr.trim(), 'الشهرُ الممتلئُ بلا اسم').toBeTruthy()
    expect(INTERVIEW_BOOKING_PAUSE.resumeMonthAr.trim(), 'شهرُ العودة بلا اسم').toBeTruthy()
  })

  it('⚠️ وشهرُ العودة موعدٌ مسمّى لا «قريبا» — وإلّا عاد غدا يقلّب التقويم', () => {
    /* «قريبا» و«خلال أيّام» ليست مواعيد: من قرأها لا يعرف متى يعود، فيعود
       غدا إلى التقويم نفسِه — وهو ما وُضع الإشعارُ ليمنعه. */
    expect(INTERVIEW_BOOKING_PAUSE.resumeMonthAr, 'شهرُ العودة بلا سنةٍ — فيُقرأ بعد عامٍ كما يُقرأ اليوم')
      .toMatch(/\d|[٠-٩]/)
    expect(INTERVIEW_BOOKING_PAUSE.resumeMonthAr, 'وعدٌ مبهمٌ مكانَ شهرٍ مسمّى')
      .not.toMatch(/قريبا|لاحقا|خلال أيّام|قريباً/)
  })
})

describe('البطاقةُ — الإشعارُ يحلّ محلَّ التقويم، ولا يُعرض معه', () => {
  const card = () => code('src/components/BookInterview.tsx')

  /* ═══ ومِرساةُ الكتلة صارت حكمَ البوّابة (٢٤ سبتمبر ٢٠٢٦) ═══

     كان الشرطُ `if (INTERVIEW_BOOKING_PAUSE.active)` يُقرأ في البطاقة، ثمّ
     صار الحكمُ في `bookingGate` وثلاثةَ أحوالٍ لا اثنَين. فالكتلةُ تنتهي عند
     حالِ «لم يُدعَ» بعدها لا عند بناء الرابط — ولو بقيت المِرساةُ الأولى
     لَابتلعت الكتلتَين معا فمرّ الوقفُ بنصِّ غيره. */
  const PAUSE_FROM = "if (gate === 'paused')"
  const PAUSE_TO = "if (gate === 'not_invited')"

  /** كتلةُ الوقف وحدَها: من فرعها إلى أوّل فرعٍ بعده */
  const pauseBlock = (src: string): string => {
    const from = src.indexOf(PAUSE_FROM)
    const to = src.indexOf(PAUSE_TO)
    return from >= 0 && to > from ? src.slice(from, to) : ''
  }

  it('⚠️ تخرج قبل أن يُبنى رابطُ Calendly وقبل الإطار — لا بعدهما', () => {
    /* لو جاء الخروجُ بعد الإطار لعُرض التقويمُ ثمّ الإشعارُ تحته: فيحجز من
       وصل إلى الأعلى، ويقرأ الوقفَ من نزل — والشاشةُ الواحدةُ تقول شيئَين. */
    const src = card()
    const gate = src.indexOf(PAUSE_FROM)
    expect(gate, 'لا خروجَ على المفتاح أصلا — البطاقةُ تعرض التقويمَ دائما').toBeGreaterThan(-1)
    expect(gate, 'الخروجُ بعد بناء الرابط').toBeLessThan(src.indexOf('trainerInterviewUrl('))
    expect(gate, 'الخروجُ بعد الإطار — فيُعرض التقويمُ ثمّ يُقال إنّه موقوف')
      .toBeLessThan(src.indexOf('<iframe'))
    expect(pauseBlock(src), 'كتلةُ الوقف لا تردّ شيئا').toMatch(/return\s*\(/)
  })

  it('⚠️ ولا تقويمَ في كتلة الوقف — لا إطارٌ ولا رابطُ حجزٍ يُفتح في لسانٍ جديد', () => {
    const block = pauseBlock(card())
    expect(block, 'إطارُ Calendly داخلَ كتلة الوقف').not.toMatch(/<iframe|embed_domain/)
    expect(block, 'مخرجٌ إلى صفحة الحجز داخلَ كتلة الوقف — وهو حجزٌ بابُه مفتوح')
      .not.toMatch(/calendly|\{url\}|trainerInterviewUrl/i)
  })

  it('⚠️ وتقول الأربعةَ معا: وصل · وشكرا · ولماذا وُقف · ومتى يعود', () => {
    /* سكوتُ أيِّها يُنتج سؤالا، وأخطرُها الأوّل: من وجد بابا مغلقا بلا كلمةٍ
       عن طلبه قرأ الإغلاقَ ردّا عليه. */
    const block = pauseBlock(card())
    expect(block, 'لا يُقال له إنّ طلبَه وصل').toMatch(/وصلنا طلبك|طلبك كامل/)
    expect(block, 'لا شكرَ — وهو أوّلُ ما طُلب').toMatch(/شكرا/)
    expect(block, 'لا يُقال لماذا وُقف — فيُقرأ عطبا فينا أو ردّا عليه').toMatch(/امتلأت|امتلاء/)
    expect(block, 'لا يُقال متى يعود الرابط').toMatch(/resumeMonthAr/)
    expect(block, 'الشهرُ الممتلئُ غيرُ مسمّى — فيُقرأ الوقفُ أبديّا').toMatch(/monthAr/)
  })

  it('⚠️ وتنهاه عن إعادة التقديم — وهو أوّلُ ما يفعله من وجد بابا مغلقا', () => {
    /* وازدحامُ الطابور بنسخٍ من طلبٍ واحدٍ هو عينُ الشكوى التي وُقف الحجزُ
       لأجلها — فإغفالُ هذا السطر يُضاعف ما جاء الوقفُ ليخفّفه. */
    expect(pauseBlock(card()), 'لا يُنهى عن إعادة التقديم').toMatch(/إعادة تقديم|تقديم طلبك|طلبٌ واحدٌ يكفي/)
  })

  it('والتقويمُ باقٍ تحت المفتاح لا محذوفا — فيعود بإطفائه وحدَه', () => {
    /* الوقفُ شهرٌ واحد. ومن حذف التضمينَ أعاد بناءَه في أكتوبر — ويُبنى
       الثانيةَ ناقصا: تُنسى سياسةُ المحتوى، أو القياس، أو التقاطُ الحدث. */
    const src = card()
    expect(src, 'حُذف الإطارُ — فالعودةُ بناءٌ من جديدٍ لا إطفاءُ مفتاح').toMatch(/<iframe/)
    expect(src, 'ذهب التقاطُ حدث الحجز').toContain('calendly.event_scheduled')
  })
})

describe('الشاشاتُ الأخرى تتبع المفتاحَ نفسَه — فلا بابٌ يَعِد بزرٍّ لا يُعرض', () => {
  it('⚠️ شرحُ كلِّ حالةٍ قابلةٍ للحجز لا يَعِد بزرٍّ ما دام موقوفا', () => {
    /* والقيمةُ المقروءةُ هنا هي المعروضةُ فعلا — لا نصٌّ في ملفّ.

       وللصمت وجهٌ: «قيد المراجعة» لا يذكر الحجزَ أصلا، فلا يكذب حين يُوقَف.
       فالقاعدةُ ليست «كلُّ شرحٍ يذكر الوقف» بل: **من ذكر الحجزَ صدَق فيه**. */
    for (const s of BOOKABLE_STATUSES) {
      const explain = APPLICANT_STATUS[s].explain
      const mentionsBooking = /حجز/.test(explain)
      if (INTERVIEW_BOOKING_PAUSE.active) {
        expect(explain, `«${s}» يَعِد بزرٍّ والحجزُ موقوف`)
          .not.toMatch(/الزرّ أدناه|التقويم أدناه|احجز موعدَه/)
        if (mentionsBooking) {
          expect(explain, `«${s}» يذكر الحجزَ ولا يقول إنّه موقوف`).toMatch(/موقوف/)
        }
      } else {
        expect(explain, `«${s}» يقول إنّ الحجزَ موقوفٌ وهو مفتوح`).not.toMatch(/موقوف/)
      }
    }
  })

  it('⚠️ وزرُّ آخرِ خطوةٍ لا يَعِد بحجزٍ موقوف — وطرفُ العودة يعود إليه', () => {
    /* الزرُّ يقول «احجز» ما دام التقويمُ يُفتح بعده (قرارُ ١٨ سبتمبر ٢٠٢٦).
       فإذا وُقف الحجزُ صار وعدا لا يُوفى — وهو العطبُ نفسُه مقلوبا. */
    const src = code('src/pages/JoinTrainer.tsx')
    const send = src.slice(src.indexOf('key="send"'))
    const b = branches(send)
    expect(b, 'الزرُّ لا يقرأ المفتاح — فيقول «احجز» والحجزُ موقوف').toBeTruthy()
    expect(b!.paused, 'طرفُ الوقف يَعِد بحجز').not.toContain('احجز')
    expect(b!.paused, 'طرفُ الوقف لا يقول ما يقع بالضغط').toMatch(/أرسل/)
    expect(b!.open, 'طرفُ العودة لم يعد يقول «احجز» — فلا يعود الوعدُ بإطفاء المفتاح')
      .toContain('احجز')
  })

  it('⚠️ وعنوانُ «وصل طلبك» لا يُبقي عليه خطوةً ليست له', () => {
    /* «وبقيت خطوةٌ واحدة» صوابٌ ما دام تحته تقويم. فإذا وُقف الحجزُ لم تبقَ
       عليه خطوة — فيبحث عن فعلٍ ليس له، وطلبُه تامٌّ وما بقي علينا. */
    const src = code('src/pages/JoinTrainer.tsx')
    const b = branches(src.slice(src.indexOf('<h1 className="mt-6 text-2xl font-black">')))
    expect(b, 'العنوانُ لا يقرأ المفتاح').toBeTruthy()
    expect(b!.paused, 'يُقال له «بقيت خطوة» ولا خطوةَ يستطيعها').not.toMatch(/بقيت خطوة/)
    expect(b!.paused, 'لا شكرَ في العنوان — وهو ما طُلب أن يُقال').toMatch(/شكرا/)
    expect(b!.open, 'طرفُ العودة فقد «بقيت خطوة» — فلا يعود العنوانُ بإطفاء المفتاح')
      .toMatch(/بقيت خطوة/)
  })
})

/* بابُ الحجز مقفولٌ على من قدّم، مفتوحٌ لمن دُعي — قرارُ صاحب المنصّة
   (٢٤ سبتمبر ٢٠٢٦): «أوقِف الوصولَ للحجز من خلال تقديم الطلب، واتركه مفتوحا
   لمن نرسل له إيميلَ تحديد موعدٍ أو رسالةَ اطمئنانٍ فيها رابطُ الدعوة، الذي
   يجب أن يأخذه مباشرةً لكلندلي، وإرفاق suhaib@wajeez.co كما هو الحال لو
   وصلها من طلب التقديم سابقا».

   ═══ وأربعةُ أعطابٍ يحرسها هذا الملفّ ═══

   ① **بابٌ يُقفل في موضعٍ ويُترك في آخر.** البطاقةُ تُركَّب في ثلاثة مواضع
      (شاشتا ما بعد الإرسال، وصفحةُ الحالة). فلو قُفل في واحدةٍ وبقي في
      أخرى لَحجز من وجد الأخرى — والشكوى كما هي.
   ② **نصٌّ يعد بزرٍّ ليس هناك.** شرحُ حالة «مقدَّم» كان يقول «من الزرّ
      أدناه»، ولا زرَّ تحته اليوم. ومن قرأها ظنّ العطبَ في الصفحة فأعاد
      التقديم — وهو ما يُراد تخفيفُه لا مضاعفتُه.
   ③ **استعارةُ لغةِ الوقف.** «امتلأت المواعيد» كذبةٌ هنا: لم تمتلئ، وإنّما
      لم يُقرأ ملفُّه بعد. وتُكتشف يومَ يصله الرابطُ بعد يومَين.
   ④ **رابطٌ يخرج ناقصَ حاضريه.** الموقعُ يُلحق `guests=` من إعداد التكاملات،
      والبريدُ كان يبني رابطَه بلا ذلك — فتخرج دعوةٌ بلا من ضُبطوا، صامتةً
      لا تُحمِّر شيئا ولا تُرى إلّا في التقويم يومَ الموعد. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  APPLICANT_STATUS, INTERVIEW_BOOKING_INVITE_ONLY, INTERVIEW_BOOKING_PAUSE,
} from '@/application/trainer/application-options'
import { bookingGate } from '@/application/trainer/interview-invitation'
import { bookingReminderMail } from '../../../server/services/trainer-decision-mail'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const code = (p: string) => readFileSync(join(root, p), 'utf8')

describe('المفتاحُ نفسُه — موقدٌ، وغيرُ الوقف', () => {
  it('موقدٌ اليوم، وقيمتُه منطقيّة', () => {
    expect(typeof INTERVIEW_BOOKING_INVITE_ONLY.active).toBe('boolean')
    expect(INTERVIEW_BOOKING_INVITE_ONLY.active, 'البابُ مفتوحٌ لكلّ مقدّم').toBe(true)
  })

  it('⚠️ وهو غيرُ `INTERVIEW_BOOKING_PAUSE` — مفتاحان لا واحد', () => {
    /* لو جُمعا لَقرأ المدعوُّ وقفا لا يعنيه، أو لَفُتح البابُ للناس جميعا
       يومَ يُطفأ الوقف. والفصلُ يُفحص بالبنية: كائنان منفصلان. */
    expect(INTERVIEW_BOOKING_INVITE_ONLY).not.toBe(INTERVIEW_BOOKING_PAUSE)
    expect(Object.keys(INTERVIEW_BOOKING_INVITE_ONLY)).toEqual(['active'])
  })
})

describe('`bookingGate` — ثلاثةُ أحوالٍ وترتيبٌ بينها', () => {
  it('من دُعي والحجزُ مفتوح: له التقويم', () => {
    expect(bookingGate({ invited: true, paused: false, inviteOnly: true })).toBe('open')
  })

  it('⚠️ ومن لم يُدعَ: لا تقويمَ له', () => {
    expect(bookingGate({ invited: false, paused: false, inviteOnly: true })).toBe('not_invited')
  })

  it('⚠️ والوقفُ يسبق الدعوة — فلا تقويمَ لمدعوٍّ ووقتُنا ممتلئ', () => {
    /* لو قُدّمت الدعوةُ لَفُتح للمدعوّ تقويمٌ ممتلئٌ يقلّبه بلا يومٍ قابلٍ
       للنقر — وهو العطبُ عينُه الذي وُضع إشعارُ الوقف ليزيله. */
    expect(bookingGate({ invited: true, paused: true, inviteOnly: true })).toBe('paused')
    expect(bookingGate({ invited: false, paused: true, inviteOnly: true })).toBe('paused')
  })

  it('⚠️ والمفتاحُ يُطفأ فيعود البابُ مفتوحا للجميع — لا يُعاد بناؤه', () => {
    /* هذا طرفُ الرجوع: من أطفأ المفتاحَ يوما وجب أن يعود التقويمُ لمن لم
       يُدعَ. ولو أُهمل هذا الطرفُ لَصار الإطفاءُ بلا أثرٍ وأُعيدت كتابتُه. */
    expect(bookingGate({ invited: false, paused: false, inviteOnly: false })).toBe('open')
  })

  it('وافتراضُ الطرفَين حالُ المنصّة — فلا يُقرأ المفتاحُ في موضعَين', () => {
    const expected = INTERVIEW_BOOKING_PAUSE.active
      ? 'paused'
      : INTERVIEW_BOOKING_INVITE_ONLY.active ? 'not_invited' : 'open'
    expect(bookingGate({ invited: false })).toBe(expected)
  })
})

describe('البطاقةُ — إشعارٌ مكانَ التقويم لمن لم يُدعَ', () => {
  const card = () => code('src/components/BookInterview.tsx')

  /** كتلةُ «لم يُدعَ» وحدَها: من فرعها إلى أوّل سطرٍ بعده يبني الرابط */
  const block = (src: string): string => {
    const from = src.indexOf("if (gate === 'not_invited')")
    const to = src.indexOf('const url = trainerInterviewUrl(')
    return from >= 0 && to > from ? src.slice(from, to) : ''
  }

  it('⚠️ تخرج قبل أن يُبنى الرابطُ وقبل الإطار — لا بعدهما', () => {
    const src = card()
    const gate = src.indexOf("if (gate === 'not_invited')")
    expect(gate, 'لا فرعَ أصلا — البطاقةُ تعرض التقويمَ لمن لم يُدعَ').toBeGreaterThan(-1)
    expect(gate, 'الخروجُ بعد بناء الرابط').toBeLessThan(src.indexOf('trainerInterviewUrl('))
    expect(gate, 'الخروجُ بعد الإطار — فيُعرض التقويمُ ثمّ يُقال إنّه مغلق')
      .toBeLessThan(src.indexOf('<iframe'))
    expect(block(src), 'الكتلةُ لا تردّ شيئا').toMatch(/return\s*\(/)
  })

  it('⚠️ ولا تقويمَ في الكتلة — لا إطارٌ ولا رابطٌ يُفتح في لسانٍ جديد', () => {
    const b = block(card())
    expect(b, 'إطارُ Calendly داخلَ كتلة «لم يُدعَ»').not.toMatch(/<iframe|embed_domain/)
    expect(b, 'مخرجٌ إلى صفحة الحجز — وهو بابٌ أُغلق').not.toMatch(/calendly|\{url\}|trainerInterviewUrl/i)
  })

  it('⚠️ وتقول الثلاثةَ: وصل وشكرا · ويصلك الرابطُ بالبريد · ولا تُعِد التقديم', () => {
    const b = block(card())
    expect(b, 'لا يُقال له إنّ طلبَه وصل').toMatch(/وصلنا طلبك|طلبك كامل/)
    expect(b, 'لا شكرَ').toMatch(/شكرا/)
    expect(b, 'لا يُقال بأيّ طريقٍ يجيء الرابط — و«سنتواصل» لا تقول شيئا').toMatch(/بريدك/)
    expect(b, 'لا يُنهى عن إعادة التقديم').toMatch(/إعادة تقديم|تقديم طلبك|طلبٌ واحدٌ يكفي/)
  })

  it('⚠️ ولا تستعير لغةَ الوقف — فالمواعيدُ لم تمتلئ، ولا شهرَ عودةٍ يُوعَد به', () => {
    /* «امتلأت» هنا كذبةٌ تُكتشف يومَ يصله الرابطُ بعد يومَين. وشهرُ العودة
       وعدٌ لا نملكه: ذاك زمنٌ يمضي، وهذا ملفٌّ يُقرأ. */
    const b = block(card())
    expect(b, 'يدّعي امتلاءً لم يقع').not.toMatch(/امتلأت|امتلاء/)
    expect(b, 'يَعِد بشهرِ عودةٍ لا يملكه').not.toMatch(/resumeMonthAr|monthAr/)
  })

  it('⚠️ وشاشتا ما بعد الإرسال لا تمرّران دعوةً — فالبابُ مقفولٌ فيهما', () => {
    /* من أرسل استمارتَه قبل ثانيةٍ لم يُقرأ ملفُّه، فلا يُدعى. ولو مُرّرت
       `invited` هناك لَانفتح البابُ من حيث أُغلق بعينه. */
    const join = code('src/pages/JoinTrainer.tsx')
    const mounts = join.split('<BookInterview').slice(1)
    expect(mounts.length, 'لا بطاقةَ في شاشة الإرسال أصلا').toBeGreaterThan(0)
    for (const m of mounts) {
      expect(m.slice(0, 300), 'شاشةُ ما بعد الإرسال تدّعي دعوةً').not.toMatch(/invited/)
    }
  })
})

describe('نصُّ حالة «مقدَّم» — لا يَعِد بزرٍّ ليس هناك', () => {
  it('⚠️ لا يُحيل إلى زرٍّ أدناه ما دام البابُ مقفولا', () => {
    const explain = APPLICANT_STATUS.submitted.explain
    if (INTERVIEW_BOOKING_PAUSE.active || INTERVIEW_BOOKING_INVITE_ONLY.active) {
      expect(explain, 'يُحيل إلى زرٍّ لا وجودَ له').not.toMatch(/الزرّ أدناه|أدناه/)
    }
  })

  it('⚠️ ويقول بأيّ طريقٍ يجيء الموعدُ بدلا منه', () => {
    /* السكوتُ بعد سحب الزرّ أسوأُ من الزرّ الكاذب: من لم يُقَل له كيف يجيء
       الدورُ عاد كلَّ يومٍ يقلّب الصفحةَ نفسَها. */
    if (!INTERVIEW_BOOKING_PAUSE.active && INTERVIEW_BOOKING_INVITE_ONLY.active) {
      expect(APPLICANT_STATUS.submitted.explain).toMatch(/بريدك/)
    }
  })
})

describe('بريدُ الدعوة — يأخذه مباشرةً إلى التقويم', () => {
  const base = { fullName: 'سلمى العمري', reference: 'WJ-TR-2026-00041', statusUrl: 'https://x.test/status' }
  const ctaOf = (doc: { blocks: readonly unknown[] }) =>
    doc.blocks.find((b): b is { kind: 'cta'; href: string; label: string } =>
      typeof b === 'object' && b !== null && (b as { kind?: string }).kind === 'cta')

  it('⚠️ الزرُّ إلى التقويم حين يُمرَّر رابطُه والحجزُ مفتوح', () => {
    const cta = ctaOf(bookingReminderMail({
      ...base, paused: false, bookingUrl: 'https://calendly.com/hadeel-7/wajeez-academy?name=x',
    }).doc)
    expect(cta?.href, 'الزرُّ لا يأخذه إلى التقويم').toContain('calendly.com')
    expect(cta?.href, 'يمرّ بصفحة الحالة — وفيها حاجزُ دخولٍ لمن دعوناه').not.toContain('/status')
  })

  it('⚠️ ويسقط إلى صفحة الحالة حين لا رابطَ — لا زرٌّ بلا وجهة', () => {
    const cta = ctaOf(bookingReminderMail({ ...base, paused: false }).doc)
    expect(cta?.href).toBe(base.statusUrl)
  })

  it('⚠️ والوقفُ يردّه إلى صفحة الحالة وإن مُرِّر الرابط', () => {
    /* التقويمُ حين يُوقَف يُعرض شهرا فارغا بلا كلمة. وصفحةُ الحالة فيها
       إشعارُ الوقف وشهرُ العودة — فهي الصادقةُ حينئذ. */
    const cta = ctaOf(bookingReminderMail({
      ...base, paused: true, bookingUrl: 'https://calendly.com/hadeel-7/wajeez-academy',
    }).doc)
    expect(cta?.href).toBe(base.statusUrl)
  })

  it('⚠️ والسطرُ يصف ما يفتحه الزرُّ — لا يطلب تسجيلَ دخولٍ لتقويمٍ مباشر', () => {
    /* ثلاثةُ نصوصٍ لثلاث وجهات: من قرأ «سجّل الدخول» ثمّ وجد تقويما ظنّ
       الرابطَ خطأً وأغلقه. */
    const body = JSON.stringify(bookingReminderMail({
      ...base, paused: false, bookingUrl: 'https://calendly.com/hadeel-7/wajeez-academy',
    }).doc)
    expect(body, 'يطلب تسجيلَ دخولٍ والزرُّ يفتح تقويما').not.toMatch(/سجّل الدخول/)
    expect(body, 'لا يقول إنّ التقويمَ يُفتح مباشرةً').toMatch(/مباشرة/)
  })
})

describe('الرابطُ المُرسَل يحمل حاضريه — كما يحملهم رابطُ الموقع', () => {
  it('⚠️ `bookingLink` تقرأ `guests` من إعداد التكاملات وتمرّرها', () => {
    /* العطبُ كان صامتا: الرابطُ يخرج صحيحا وينقصه من ضُبطوا، فلا يظهر إلّا
       في التقويم يومَ الموعد. والفحصُ على البنية: المعامَلُ يُمرَّر فعلا. */
    const src = code('server/services/trainer-review.service.ts')
    const from = src.indexOf('private async bookingLink(')
    expect(from, 'لا دالّةَ بناءٍ للرابط أصلا').toBeGreaterThan(-1)
    const fn = src.slice(from, from + 420)
    expect(fn, 'الرابطُ يُبنى بلا حاضرين').toMatch(/guests:\s*calendly\.guests/)
  })

  it('⚠️ وتذكيرُ الحجز يمرّر الرابطَ إلى الرسالة — وإلّا بقي الزرُّ على صفحة الحالة', () => {
    const src = code('server/services/trainer-review.service.ts')
    const from = src.indexOf('bookingReminderMail({')
    expect(from, 'لا استدعاءَ لرسالة الدعوة').toBeGreaterThan(-1)
    expect(src.slice(from, from + 420), 'الرسالةُ تُبنى بلا رابط').toMatch(/bookingUrl:/)
  })
})

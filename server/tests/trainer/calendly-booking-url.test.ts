/* رابطُ الحجز: يُقبل بأيّ صورةٍ صحيحة، ويُشرَح حين لا يصحّ.

   ═══ العطبُ الذي كُتب له ═══

   كان الرابطُ ثابتا مضمَّنا في الواجهة، فتغييرُ المضيف يقتضي تعديلَ شيفرةٍ
   ونشرا. وقرارُ صاحب المنصّة (١٢ سبتمبر ٢٠٢٦): يُضبط من الشاشة، **ولا
   يُرفض أيُّ رابطٍ يُعدّ صحيحا لنفس المنصّة**، وما رُفض يُقال سببُه.

   فالحارسُ على أمرين معا: أنّ الصورَ الصحيحةَ كلَّها تُقبل وتُطبَّع إلى صورةٍ
   واحدة، وأنّ المرفوضَ يحمل سببا يقرؤه إنسانٌ فيُصلحه — لا «رابطٌ غيرُ
   صالح». */

import { describe, expect, it } from 'vitest'
import { normalizeCalendlyBookingUrl } from '../../services/integrations.service'

const ok = (input: string) => {
  const r = normalizeCalendlyBookingUrl(input)
  if (!r.ok) throw new Error(`رُفض وهو صحيح: «${input}» — ${r.messageAr}`)
  return r.url
}
const rejected = (input: string) => {
  const r = normalizeCalendlyBookingUrl(input)
  if (r.ok) throw new Error(`قُبل وهو لا يصلح: «${input}» → ${r.url}`)
  return r.messageAr
}

const TARGET = 'https://calendly.com/hadeel-7/wajeez-academy'

describe('كلُّ صورةٍ صحيحةٍ تُقبل وتُطبَّع إلى واحدة', () => {
  it('اسمُ المستخدم والمسارُ والرابطُ الكامل — كلُّها تعني الشيءَ نفسَه', () => {
    for (const form of [
      'hadeel-7/wajeez-academy',
      '/hadeel-7/wajeez-academy',
      'calendly.com/hadeel-7/wajeez-academy',
      'www.calendly.com/hadeel-7/wajeez-academy',
      'https://calendly.com/hadeel-7/wajeez-academy',
      'https://www.calendly.com/hadeel-7/wajeez-academy',
      'http://calendly.com/hadeel-7/wajeez-academy',
      'https://calendly.com/hadeel-7/wajeez-academy/',
      '  https://calendly.com/hadeel-7/wajeez-academy  ',
    ]) {
      expect(ok(form), `الصورةُ «${form}» لم تُطبَّع كما ينبغي`).toBe(TARGET)
    }
  })

  it('واسمُ المستخدم وحدَه يكفي — «إمّا اسمُ المستخدم فقط أو رابط»', () => {
    expect(ok('hadeel-7')).toBe('https://calendly.com/hadeel-7')
  })

  it('وعلاماتُ الاتّجاه المنسوخةُ مع النصّ العربيّ لا تُفسده', () => {
    /* تُلتقط مع النسخ من صفحةٍ عربيّةٍ ولا تُرى في الحقل — ولولا طرحُها
       لصار المضيفُ «‏calendly.com» فرُفض رابطٌ سليمٌ بلا سببٍ مفهوم. */
    expect(ok('‏https://calendly.com/hadeel-7/wajeez-academy‎')).toBe(TARGET)
  })

  it('⚠️ والمعاملاتُ تُطرح — وإلّا انكسر رقمُ الطلب الذي تُطابَق به الحجوزات', () => {
    /* `trainerInterviewUrl` تُلحق `?name=…&utm_content=…`. فلو بقي معامَلٌ
       في المخزَّن لصار الناتجُ `?month=…?name=…` — ويسقط `utm_content`
       فلا يُطابَق الحجزُ بأيّ طلب، بلا خطأٍ يظهر في أيّ مكان. */
    expect(ok('https://calendly.com/hadeel-7/wajeez-academy?month=2026-09')).toBe(TARGET)
    expect(ok('https://calendly.com/hadeel-7/wajeez-academy#top')).toBe(TARGET)
    expect(ok(TARGET), 'المطبَّعُ لا يحمل معامَلا').not.toContain('?')
  })
})

describe('وما لا يصحّ يُقال سببُه — لا «رابطٌ غيرُ صالح»', () => {
  it('عنوانُ لوحة التحكّم يُميَّز عن رابط الحجز — وهو أكثرُ الأخطاء وقوعا', () => {
    /* الاثنان على calendly.com ويتشابهان في شريط العنوان، ويفترقان تماما:
       أحدُهما يفتح تقويمَ الحجز، والآخرُ يطلب تسجيلَ دخول. */
    const why = rejected('https://calendly.com/event_types/user/me/12345')
    expect(why, 'لا يقول إنّه عنوانُ لوحةِ تحكّم').toContain('لوحة تحكّم')
    expect(why, 'لا يقول ما العمل').toContain('Copy link')
    expect(rejected('https://calendly.com/app/scheduled_events')).toContain('لوحة تحكّم')
  })

  it('ومضيفٌ آخرُ يُسمّى باسمه — فيُعرف أنّ اللصقَ من منصّةٍ أخرى', () => {
    const why = rejected('https://cal.com/hadeel/interview')
    expect(why, 'لا يُسمّي المضيفَ الذي رُفض').toContain('cal.com')
  })

  it('والفراغُ داخلَ الرابط يُقال — فأكثرُه نسخٌ ناقص', () => {
    expect(rejected('https://calendly.com/hadeel 7/x')).toContain('فراغ')
  })

  it('وحقلٌ فارغٌ يُقال إنّه فارغ', () => {
    expect(rejected('   ')).toContain('فارغ')
  })

  it('وعنوانُ Calendly بلا اسمِ مستخدمٍ لا يفتح تقويما', () => {
    expect(rejected('https://calendly.com')).toContain('اسمِ مستخدم')
  })
})

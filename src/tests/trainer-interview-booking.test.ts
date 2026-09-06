/* حجزُ مقابلة المدرّب — حارسُ ما يسهل كسرُه بلا أن يفشل شيء.

   المقابلةُ تجري خارج المنصّة، فالرابطُ هو كلُّ ما بين المتقدّم وبين موعده.
   ولو تعطّل — رابطٌ خطأ، أو بطاقةٌ تُعرض بعد الرفض، أو حالةٌ نُسيت — لم يسقط
   اختبارٌ ولم تظهر شاشةُ خطأ: يقف المتقدّمُ ينتظر مكالمةً لن تأتي، وهو بالضبط
   العطبُ الذي وُضع هذا الرابطُ ليزيله. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  APPLICANT_STATUS, BOOKABLE_STATUSES, TRAINER_INTERVIEW, trainerInterviewUrl,
} from '@/application/trainer/application-options'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('رابطُ الحجز', () => {
  it('https وإلى Calendly — ولا يُترك فارغا', () => {
    expect(TRAINER_INTERVIEW.url).toMatch(/^https:\/\/calendly\.com\/.+/)
  })

  it('ومدّتُه ومنصّتُه معلنتان، فتُقرآن في الشاشة لا تُخمَّنان', () => {
    expect(TRAINER_INTERVIEW.minutes).toBe(30)
    expect(TRAINER_INTERVIEW.platformAr).toBe('Zoom')
  })

  it('ويُعبَّأ بالاسم والبريد ورقم الطلب — فلا يكتبها ثالثةً', () => {
    const url = trainerInterviewUrl({ name: 'سلمى العمري', email: 's@x.com', reference: 'WJ-T-2026-0041' })
    const q = new URL(url).searchParams
    expect(q.get('name')).toBe('سلمى العمري')
    expect(q.get('email')).toBe('s@x.com')
    expect(q.get('a1')).toBe('WJ-T-2026-0041')
  })

  it('ويبقى صالحا بلا تعبئة — فلا يُنتَج رابطٌ بعلامة استفهامٍ عارية', () => {
    expect(trainerInterviewUrl({})).toBe(TRAINER_INTERVIEW.url)
    expect(trainerInterviewUrl({ name: '   ' })).toBe(TRAINER_INTERVIEW.url)
  })
})

describe('أين يُعرض الحجزُ وأين لا', () => {
  it('كلُّ حالةٍ قابلةٍ للحجز معروفةٌ في قائمة الحالات', () => {
    for (const s of BOOKABLE_STATUSES) {
      expect(APPLICANT_STATUS[s], `حالةٌ لا وجود لها: ${s}`).toBeDefined()
    }
  })

  it.each([
    ['draft', 'طلبٌ لم يصل بعد — يُكمله أوّلا'],
    ['email_verification_pending', 'بريدٌ لم يُوثَّق — الطلبُ ليس مُقدَّما رسميّا'],
    ['interview_scheduled', 'موعدُه محجوزٌ فعلا — والزرُّ يدعوه إلى حجزٍ ثانٍ'],
    ['active', 'صار مدرّبا'],
    ['rejected', 'انتهى الطلب'],
    ['withdrawn', 'سحب طلبَه'],
  ])('ولا يُعرض في «%s» — %s', (status) => {
    expect(BOOKABLE_STATUSES).not.toContain(status)
  })

  it('وشرحُ الحالة لا يَعِد بمكالمةٍ بينما الزرُّ تحته يقول احجز', () => {
    /* التناقضُ هنا ليس تجميلا: من يقرأ «سنتواصل معك لتحديد موعد» فوق زرِّ
       «احجز موعدك» لا يعرف أيَّهما الصحيح، فينتظر — وهو ما نزيله. */
    for (const s of BOOKABLE_STATUSES) {
      expect(APPLICANT_STATUS[s].explain, `«${s}» ما زال يَعِد بمكالمة`)
        .not.toMatch(/نتواصل معك|سنرتّب موعدها|نرتّب موعدها/)
    }
  })
})

describe('البطاقةُ في الشاشتين — لا في واحدةٍ تُنسى الأخرى', () => {
  it('شاشةُ «وصل طلبك» تعرضها', () => {
    const src = read('src/pages/JoinTrainer.tsx')
    expect(src).toMatch(/import BookInterview/)
    expect(src, 'المكوّنُ مستوردٌ ولا يُستعمل').toMatch(/<BookInterview\b/)
  })

  it('وصفحةُ الحالة تعرضها — وإلّا رُئي الرابطُ مرّةً ثمّ اختفى', () => {
    const src = read('src/pages/ApplicantStatus.tsx')
    expect(src).toMatch(/<BookInterview\b/)
    expect(src, 'تُعرض بلا شرطِ حالةٍ — فتظهر للمرفوض').toMatch(/BOOKABLE_STATUSES\.includes/)
  })

  it('والرابطُ خارجيٌّ يُفتح بأمان', () => {
    const card = read('src/components/BookInterview.tsx')
    expect(card).toMatch(/target="_blank"/)
    expect(card, 'رابطٌ بلا noopener يمنح الصفحةَ الخارجيّةَ تحكّما في لساننا')
      .toMatch(/rel="noopener noreferrer"/)
  })

  it('ولا يُضمَّن كإطار — سياسةُ المحتوى تحجبه بصمت', () => {
    const card = read('src/components/BookInterview.tsx')
    expect(card, "default-src 'self' يحجب إطارَ Calendly فيُنتج مستطيلا أبيضَ بلا خطأ")
      .not.toMatch(/<iframe|calendly\.com\/assets|data-url=/)
  })
})

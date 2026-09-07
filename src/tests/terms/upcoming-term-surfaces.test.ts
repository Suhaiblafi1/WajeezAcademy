/* «متى تبدأ؟» — الجوابُ يبلغ الأسطحَ الخمسة، ونصُّه واحد (البند ٥٢).

   العطبُ كان صريحا: `/courses` و`/pathways` **لا تعرضان تاريخا إطلاقا**، وفي
   صفحة المسار وصفحة الدورة الجوابُ الوحيدُ «يُعلن السعر مع فتح الشعبة» —
   صادقٌ ولا يفيد.

   وهذا الملفّ يقيس شيئين لا شيئا واحدا:

   ١) **النصّ**: عدُّ الأيّام وصيغتُه ومتى يُقال «يُغلق خلال…» ومتى لا يُقال
      شيءٌ أصلا. وهو منطقٌ يُختبَر بالاستدعاء لا بقراءة ملفّ.
   ٢) **البلوغ**: أنّ الأسطحَ الخمسةَ تنادي المكوّنَ الواحد — فلو أُضيف سطحٌ
      سادسٌ بنسخةٍ ثانيةٍ من الجملة لسقط هذا. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { daysUntil, termUrgencyAr, termMonthsAr } from '@/application/terms/upcoming-text'
import type { UpcomingTerm } from '@/services/upcoming-term'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const NOW = new Date('2026-01-01T00:00:00Z')
const iso = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString()

const term = (over: Partial<UpcomingTerm> = {}): UpcomingTerm => ({
  id: 't', titleAr: 'فصل الربيع ٢٠٢٦',
  startsOn: iso(40), endsOn: iso(130),
  registrationOpensAt: iso(10), registrationClosesAt: iso(35),
  registrationOpen: false, calendarPublished: false,
  ...over,
})

describe('عدُّ الأيّام — ونداءٌ لا لافتة', () => {
  it('يعدّ إلى الأمام والخلف', () => {
    expect(daysUntil(iso(9), NOW)).toBe(9)
    expect(daysUntil(iso(-3), NOW)).toBe(-3)
  })

  it('«خلال ٩ أيّام» حين يقترب، والتاريخُ حين يبعد', () => {
    const soon = termUrgencyAr(term({ registrationOpensAt: iso(9) }), NOW)
    expect(soon).toContain('9 أيّام')
    expect(soon).toContain('يفتح')

    const far = termUrgencyAr(term({ registrationOpensAt: iso(60) }), NOW)
    expect(far).not.toContain('خلال')
    expect(far).toContain('يبدأ')
  })

  it('والصيغةُ تُراعى — لا «1 أيام» ولا «2 أيام»', () => {
    expect(termUrgencyAr(term({ registrationOpensAt: iso(1) }), NOW)).toContain('يومٍ واحد')
    expect(termUrgencyAr(term({ registrationOpensAt: iso(2) }), NOW)).toContain('يومين')
  })

  it('والمفتوحُ يُستعجَل بإغلاقه لا بفتحه', () => {
    const closing = termUrgencyAr(
      term({ registrationOpen: true, registrationClosesAt: iso(9) }), NOW,
    )
    expect(closing).toContain('يُغلق')
    expect(closing).toContain('9 أيّام')
  })

  it('وما لا موعدَ له لا يُقال فيه شيء — ولا يُخترع', () => {
    expect(termUrgencyAr(term({ registrationOpensAt: null }), NOW)).toBeNull()
    /* ومفتوحٌ بلا موعدِ إغلاقٍ يُقال إنّه مفتوح، بلا عدٍّ مُختلَق */
    expect(
      termUrgencyAr(term({ registrationOpen: true, registrationClosesAt: null }), NOW),
    ).toBe('والتسجيل مفتوح')
  })

  it('والأشهرُ تُقال بحدَّيها — «(٩ فبراير — ١٠ مايو)»', () => {
    const months = termMonthsAr(term())
    expect(months).toContain('—')
    expect(months).not.toContain('Invalid')
  })
})

describe('والأسطحُ الخمسةُ تنادي النصَّ الواحد', () => {
  const SURFACES: [string, string][] = [
    ['الكتالوج — وكان بلا تاريخٍ إطلاقا', 'src/pages/Catalog.tsx'],
    ['صفحةُ المسار — «يُعلن السعر مع فتح الشعبة»', 'src/pages/Pathway.tsx'],
    ['صفحةُ الدورة — الجملةُ نفسُها', 'src/pages/CoursePath.tsx'],
    ['منتقي الشعب حين لا شعبةَ له', 'src/components/CohortPicker.tsx'],
    ['ودعوةُ الرئيسة — كانت بلا تاريخ', 'src/pages/Home.tsx'],
  ]

  for (const [why, path] of SURFACES) {
    it(why, () => {
      /* الاستيرادُ لا ذكرُ الاسم: أوّلُ صياغةٍ لهذا الفحص كانت `toContain`
         على اسم الوحدة، فمرّ `CohortPicker` **لأنّ تعليقا فيه يذكرها** —
         حارسٌ يخضرّ على ملفٍّ لا ينادي المكوّنَ أصلا. */
      expect(read(path), `${path} لا يستورد مكوّنَ الفصل القادم`)
        .toMatch(/^import \{[^}]*Upcoming\w+[^}]*\} from ["']@\/components\/UpcomingTermNote["']/m)
    })
  }

  it('ولا نسخةَ ثانيةً من الجملة خارج المكوّن', () => {
    /* «تُفتح في» كانت مكتوبةً في `CohortPicker` نفسِه — فلو عادت إلى أيّ سطحٍ
       لصار للجملة نسختان تفترقان عند أوّل تعديل. */
    for (const [, path] of SURFACES) {
      expect(read(path), `${path} يكتب نصَّ الفصل بنفسه`)
        .not.toMatch(/تُفتح في <span/)
    }
  })

  it('وتبقى الجملةُ القديمةُ حين لا فصلَ — لا يُخترع موعد', () => {
    expect(read('src/components/CohortPicker.tsx')).toContain('يُعلن الموعد مع فتح الشعبة')
    expect(read('src/components/UpcomingTermNote.tsx')).toMatch(/if \(!term\) return/)
  })
})

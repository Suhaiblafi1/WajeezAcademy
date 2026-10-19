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
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { daysUntil, termUrgencyAr, termMonthsAr } from '@/application/terms/upcoming-text'
import type { UpcomingTerm } from '@/services/upcoming-term'
import CohortPicker from '@/components/CohortPicker'

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

describe('عدّ الأيّام — ونداء لا لافتة', () => {
  it('يعدّ إلى الأمام والخلف', () => {
    expect(daysUntil(iso(9), NOW)).toBe(9)
    expect(daysUntil(iso(-3), NOW)).toBe(-3)
  })

  it('«خلال ٩ أيّام» حين يقترب، والتاريخ حين يبعد', () => {
    const soon = termUrgencyAr(term({ registrationOpensAt: iso(9) }), NOW)
    expect(soon).toContain('9 أيّام')
    expect(soon).toContain('يفتح')

    const far = termUrgencyAr(term({ registrationOpensAt: iso(60) }), NOW)
    expect(far).not.toContain('خلال')
    expect(far).toContain('يبدأ')
  })

  it('والصيغة تراعى — لا «1 أيام» ولا «2 أيام»', () => {
    expect(termUrgencyAr(term({ registrationOpensAt: iso(1) }), NOW)).toContain('يوم واحد')
    expect(termUrgencyAr(term({ registrationOpensAt: iso(2) }), NOW)).toContain('يومين')
  })

  it('والمفتوح يستعجل بإغلاقه لا بفتحه', () => {
    const closing = termUrgencyAr(
      term({ registrationOpen: true, registrationClosesAt: iso(9) }), NOW,
    )
    expect(closing).toContain('يغلق')
    expect(closing).toContain('9 أيّام')
  })

  it('وما لا موعد له لا يقال فيه شيء — ولا يخترع', () => {
    expect(termUrgencyAr(term({ registrationOpensAt: null }), NOW)).toBeNull()
    /* ومفتوحٌ بلا موعدِ إغلاقٍ يُقال إنّه مفتوح، بلا عدٍّ مُختلَق */
    expect(
      termUrgencyAr(term({ registrationOpen: true, registrationClosesAt: null }), NOW),
    ).toBe('والتسجيل مفتوح')
  })

  it('والأشهر تقال بحدّيها — «(٩ فبراير — ١٠ مايو)»', () => {
    const months = termMonthsAr(term())
    expect(months).toContain('—')
    expect(months).not.toContain('Invalid')
  })
})

/* ⚠️ صارت أربعةً — رُفع الكتالوج (قرارُ صاحب المنصّة، ١٢ سبتمبر ٢٠٢٦)

   «احذف هذه الجملة من كلّ موضعٍ تظهر فيه»، والجملةُ هي لوحُ `UpcomingTermBanner`
   فوق نتائج `/courses` و`/pathways`. فرُفع اللوحُ ورُفعت الصفحةُ من هذه
   القائمة معه — لا لأنّ الحارسَ أزعج، بل لأنّ ما كان يحرسه لم يعد قرارا.

   ثمّ رُفعت الرئيسةُ أيضا (١٢ سبتمبر ٢٠٢٦) — وهذه كانت **عطبا لا انتقالا**:
   بقيت بعد الرفعة الأولى تمرّر `prefix="الفصل القادم:"` فتُصيَّر الجملةُ
   المحذوفةُ حرفا بحرف، ورآها صاحبُ المنصّة حيّةً على الإنتاج بعد أن قيل له
   إنّها حُذفت. وسببُ الفوات أنّ البحثَ جرى على **اسم المكوّن**
   (`UpcomingTermBanner`) لا على ما يظهر على الشاشة.

   فأُضيف أدناه حارسٌ يقيس المُصيَّر لا الاسم — وهو الذي كان سيمسكها. */
/* ⚠️ وصارت صفرا — «لا شعبة لها بعد» (قرارُ صاحب المنصّة، ١٩ أكتوبر ٢٠٢٦)

   كانت الأسطحُ الثلاثةُ أدناه تنادي سطرَ الفصل القادم تحت ما لا شعبةَ له، وهذا الملفُّ يشترط أن تناديه.
   ثمّ سأل صاحبُ المنصّة عن دورةٍ بلا شعبةٍ يقول سطرُها «تفتح في موسم الشتاء… والتسجيل مفتوح حتّى ٣٠
   نوفمبر»: «كيف تفتح بفصل الشتاء وهي يجب أن تكون مفتوحةً الآن إذا كان ذلك صحيحا؟». والسطرُ يستعير حالَ
   الفصل لدورةٍ لا تُشترى. فاختار «لا شعبة لها بعد» بلا وعدٍ بموسم — فانقلب الحارس: لا ينادي سطحٌ منها
   سطرَ الفصل. والاستيرادُ يُفحص لا ذكرُ الاسم، فالتعليقُ الشارحُ لا يُسقطه. */
describe('والأسطح الثلاثة لا تعد بموسم لما لا شعبة له', () => {
  const SURFACES: [string, string][] = [
    ['صفحة المسار — صندوق «يعلن السعر مع فتح الشعبة»', 'src/pages/Pathway.tsx'],
    ['صفحة الدورة — الصندوق نفسه', 'src/pages/CoursePath.tsx'],
    ['منتقي الشعب حين لا شعبة له', 'src/components/CohortPicker.tsx'],
  ]

  for (const [why, path] of SURFACES) {
    it(`⚠️ ${why}`, () => {
      expect(read(path), `${path} يعيد سطر الفصل تحت ما لا شعبة له`)
        .not.toMatch(/^import \{[^}]*Upcoming\w+[^}]*\} from ["']@\/components\/UpcomingTermNote["']/m)
    })
  }

  it('⚠️ والمنتقي بلا شعبة يقول «لا شعبة لها بعد» — لا موسم ولا «التسجيل مفتوح»', () => {
    /* يُصيَّر ولا يُقرأ ملفُّه: ما يُفحص هو ما يراه الزائر */
    const html = renderToStaticMarkup(createElement(CohortPicker, { cohorts: [], selectedId: null, onSelect: () => {} }))
    expect(html).toContain('لا شعبة لها بعد')
    expect(html).not.toMatch(/تفتح في|التسجيل|يعلن الموعد/)
  })

  it('ولا نسخة ثانية من الجملة خارج المكوّن', () => {
    /* «تُفتح في» كانت مكتوبةً في `CohortPicker` نفسِه — فلو عادت إلى أيّ سطحٍ
       لصار للجملة نسختان تفترقان عند أوّل تعديل.

       والكتالوجُ في القائمة هنا وإن خرج من التي فوق: خرج لأنّه لم يعد
       **ينادي** المكوّن، لا ليصير مباحا أن يكتب الجملةَ بيده. */
    for (const [, path] of [...SURFACES, ['', 'src/pages/Catalog.tsx'] as [string, string], ['', 'src/pages/Home.tsx'] as [string, string]]) {
      expect(read(path), `${path} يكتب نصّ الفصل بنفسه`)
        .not.toMatch(/تفتح في <span/)
    }
  })

  /* ولا يعود اللوحُ إلى الكتالوج سهوا — الحذفُ قرارٌ يُحرَس كما تُحرَس الإضافة */
  it('ولوح «الفصل القادم» لا يعود إلى الكتالوج', () => {
    expect(read('src/pages/Catalog.tsx')).not.toMatch(/UpcomingTermBanner/)
  })

  /* ═══ الحارسُ الذي كان ينقص: يُقاس ما يظهر لا اسمُ ما يُستدعى ═══

     الجملةُ المحذوفةُ تُصيَّر من **موضعين** لا موضع: لوحُ `UpcomingTermBanner`
     (نصُّه مكتوبٌ في المكوّن)، و`UpcomingTermLine` متى مُرِّرت إليها بادئةٌ
     فيها «الفصل القادم» — وهذا ما بقي في الرئيسة بعد الرفعة الأولى.

     فالفحصُ يمسح واجهةَ الزائر كلَّها عن كلا البابين. ولو أُضيف غدا سطحٌ
     ثالثٌ يمرّر البادئةَ نفسَها لسقط هنا قبل أن يراه أحد. */
  it('ولا تصيّر «الفصل القادم» من أيّ سطح — لا بلوح ولا ببادئة تمرّر', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) { walk(full); continue }
        if (!name.endsWith('.tsx')) continue
        if (full.includes(`${sep}tests${sep}`)) continue
        /* ⚠ التعليقاتُ تُنزع أوّلا — وقد أسقطَ هذا الحارسُ نفسَه أوّلَ تشغيلٍ
           له لأنّ التعليقَ الشارحَ فوقَ موضعِ الحذف **يقتبس** السطرَ المحذوف.
           وهي العلّةُ عينُها التي يحذّر منها رأسُ هذا الملفّ: حارسٌ يقرأ
           الحرفَ حيث وقع لا حيث يعمل. فالمسحُ على الشيفرة وحدَها. */
        const src = readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
        /* ① اللوحُ يُستدعى — نصُّه يحمل الجملةَ في داخله */
        if (/<UpcomingTermBanner\b/.test(src)) offenders.push(`${full}: <UpcomingTermBanner`)
        /* ② بادئةٌ فيها «الفصل القادم» تُمرَّر إلى السطر */
        for (const m of src.matchAll(/<UpcomingTermLine[^>]*prefix=\{?["'`]([^"'`]*)["'`]/g)) {
          if (m[1].includes('الفصل القادم')) offenders.push(`${full}: prefix="${m[1]}"`)
        }
      }
    }
    walk('src')
    expect(offenders, `جملة «الفصل القادم» ما زالت تصيّر:\n${offenders.join('\n')}`).toEqual([])
  })

  /* وكان هنا «وتبقى الجملة القديمة حين لا فصل» — يشترط «يعلن الموعد مع فتح الشعبة» في المنتقي. وذهبت
     الجملةُ مع سطر الفصل بقرار ١٩ أكتوبر ٢٠٢٦، وحارسُ ما حلّ محلّها أعلاه. والمكوّنُ نفسُه لا يخترع موعدا: */
  it('ومكوّن الفصل لا يخترع موعدا حين لا فصل', () => {
    expect(read('src/components/UpcomingTermNote.tsx')).toMatch(/if \(!term\) return/)
  })
})

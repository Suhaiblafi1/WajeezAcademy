/* ═══ حقلٌ يقرؤه خمسةٌ ولا يكتبه أحد ═══

   للفصل عمودُ `status` بخمس قيمٍ منذ وُضع المخطَّط، ولم يكن في المنصّة سطرٌ
   واحدٌ يكتبه: `TermService.create` لا يمرّره فيأخذ `planned`، ولا بابَ
   بعدها. فكلُّ فصلٍ في القاعدة `planned` أبدا — وخمسةُ مواضعَ تقرؤه تعمل
   في الفراغ، منها سطرٌ يُكتب للمتعلّم («التسجيلُ مفتوحٌ الآن») لم يره أحدٌ
   قطّ، وحارسٌ يردّ `term_closed` لا يقع في الإنتاج.

   وسادسةٌ أوضحُها للعين: شاشةُ الإدارة تترجم `draft | planning | running` —
   أسماءً ليست من قيم العمود — فتعرض لكلّ فصلٍ كلمةَ «planned» بالإنجليزيّة.

   ═══ وما يُقاس هنا ═══

   ① المعجمُ من العمود لا من ذاكرةٍ سابقة — وهو الحارسُ الذي لو كان لما وقع.
   ② والقرارُ والتقويمُ لا يُخلطان: الفتحُ والإلغاءُ بيدٍ، والجريانُ
     والانتهاءُ بمضيّ الأيّام.
   ③ ولا معجمَ ثانٍ في الشاشة يفترق عن الأوّل. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  TERM_STATUSES, TERM_STATUS_AR, TERM_STATUS_EFFECT_AR, LIVE_TERM_STATUSES,
  canMove, dueByDate, nextStatuses,
} from '@/application/terms/lifecycle'

const root = process.cwd()
const raw = (p: string) => readFileSync(join(root, p), 'utf8')
/* بلا تعليقات: هذا الملفُّ وغيرُه يقتبسان القيمَ شرحا، ولو فُحص الخامُ لمرّ
   الحارسُ على ذكرِ كلمةٍ في تعليقٍ فوقها — وقد وقع ذلك في هذه المنصّة. */
const code = (p: string) => raw(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const TERM = { status: 'open', startsOn: day('2027-02-01'), endsOn: day('2027-04-30') }

describe('① المعجمُ من عمود العمل لا من ذاكرةٍ سابقة', () => {
  it('⚠️ القيمُ الخمسُ هي قيمُ المخطَّط بحرفها — وكان المعجمُ يخطئ ثلاثا منها', () => {
    const schema = raw('prisma/schema.prisma')
    const term = schema.slice(schema.indexOf('model Term {'), schema.indexOf('@@unique([year, season])'))
    const line = term.split('\n').find((l) => /^\s*status\s/.test(l)) ?? ''
    const declared = (line.split('//')[1] ?? '').split('|').map((x) => x.trim()).filter(Boolean)
    expect(declared.length, 'لم تُقرأ قيمُ العمود من المخطَّط — تعطّل الفحصُ نفسُه').toBe(5)
    expect([...TERM_STATUSES].sort(), 'المعجمُ يسمّي غيرَ ما في العمود').toEqual(declared.sort())
  })

  it('⚠️ ولكلِّ قيمةٍ اسمٌ عربيٌّ وأثرٌ يُقال قبل النقر', () => {
    for (const s of TERM_STATUSES) {
      expect(TERM_STATUS_AR[s], `لا اسمَ عربيَّ لـ${s} — يصل الإداريَّ خاما`).toBeTruthy()
      expect(TERM_STATUS_EFFECT_AR[s], `لا أثرَ مكتوبٌ لـ${s}`).toBeTruthy()
    }
  })

  it('والحيُّ ثلاثةٌ: ما انتهى أو أُلغي يخرج من قوائم العمل', () => {
    expect([...LIVE_TERM_STATUSES]).toEqual(['planned', 'open', 'active'])
  })
})

describe('② القرارُ بيدٍ، والتقويمُ بلا يد', () => {
  it('⚠️ المنتهي والملغى طرفان — لا يُبعَث فصلٌ أُنهي', () => {
    expect(nextStatuses('closed'), 'فُتح بابُ فصلٍ منتهٍ').toEqual([])
    expect(nextStatuses('cancelled')).toEqual([])
    expect(canMove('closed', 'open'), 'رجع المنتهي مفتوحا').toBe(false)
  })

  it('والمخطَّطُ يُفتح أو يُلغى — ولا يُقفز به إلى «جارٍ»', () => {
    expect(nextStatuses('planned').sort()).toEqual(['cancelled', 'open'])
    expect(canMove('planned', 'active'), 'صار جاريا ولم يُفتح قطّ').toBe(false)
  })

  it('⚠️ ومضيُّ الأشهر يُنهي الفصلَ ولو لم يُفتح — ما لم يُعلَن لا يُنتظر أبدا', () => {
    const past = { ...TERM, status: 'planned', startsOn: day('2024-02-01'), endsOn: day('2024-04-30') }
    expect(dueByDate(past, day('2026-01-01')), 'فصلٌ مضت سنتان عليه ما زال «مخطَّطا»').toBe('closed')
  })

  it('⚠️ وبلوغُ أوّلِ الأشهر يُجري المفتوحَ — ولا يفتح المخطَّط', () => {
    expect(dueByDate(TERM, day('2027-02-01')), 'بلغ أوّلَ أشهره وبقي «مفتوحا»').toBe('active')
    /* الفتحُ إعلانٌ للناس: لا يُعلَن باسم الإدارة ما لم تقله */
    expect(dueByDate({ ...TERM, status: 'planned' }, day('2027-03-01')),
      'فتح التقويمُ فصلا لم تفتحه الإدارة').toBeNull()
  })

  it('واليومُ الأخيرُ من الفصل يومٌ منه — لا ينتهي فجرَه', () => {
    /* `startsOn`/`endsOn` حقلا تاريخٍ يُقرآن منتصفَ ليل UTC، ولو قُورنا
       بالساعة لانتهى الفصلُ في أوّل ساعةٍ من آخر أيّامه. */
    expect(dueByDate({ ...TERM, status: 'active' }, new Date('2027-04-30T23:30:00.000Z')),
      'انتهى الفصلُ في آخر أيّامه').toBeNull()
    expect(dueByDate({ ...TERM, status: 'active' }, day('2027-05-01'))).toBe('closed')
  })

  it('وما انتهى أو أُلغي لا يحرّكه تقويم', () => {
    expect(dueByDate({ ...TERM, status: 'cancelled' }, day('2027-03-01'))).toBeNull()
    expect(dueByDate({ ...TERM, status: 'closed' }, day('2030-01-01'))).toBeNull()
  })
})

describe('③ ولا معجمَ ثانٍ في الشاشة', () => {
  it('⚠️ شاشةُ الفصول تقرأ المعجمَ المشترك ولا تكتب لنفسها واحدا', () => {
    const screen = code('src/pages/admin/Terms.tsx')
    expect(screen, 'رجع معجمٌ محلّيٌّ للحالات — وهو ما أخطأ ثلاثَ قيمٍ من خمس')
      .not.toMatch(/const\s+STATUS_AR\s*[:=]/)
    expect(screen, 'الشاشةُ لا تقرأ المعجمَ المشترك').toContain('TERM_STATUS_AR[')
  })

  it('⚠️ وأزرارُ النقل تُصيَّر فعلا، وتُبنى من القاعدة لا تُكتب باليد', () => {
    const screen = code('src/pages/admin/Terms.tsx')
    /* ⚠️ نُقض الفحصُ الأوّلُ فمرّ: كان على ورودِ `nextStatuses(t.status)` في
       الملفّ، فبقي أخضرَ حين عُطِّل شرطُ التصيير إلى `false &&` — النداءُ
       باقٍ في `map` والأزرارُ لا تصل الشاشةَ أبدا. فصار على **الشرط الذي
       يصيّرها** وعلى ما بداخله. */
    const at = screen.indexOf('nextStatuses(t.status).length')
    expect(at, 'لا شرطَ يصيّر أزرارَ الحالة — أو عُطِّل بثابت').toBeGreaterThan(-1)
    const block = screen.slice(at, at + 900)
    expect(block, 'الأزرارُ لا تُبنى من القاعدة — فقد تُعرض نقلةٌ لا تجوز')
      .toMatch(/nextStatuses\(\s*t\.status\s*\)\.map\(/)
    expect(block, 'لا زرَّ داخلَ الشرط').toContain('<Button')
    expect(block, 'الزرُّ لا ينقل الحالة').toContain('moveStatus(')
    expect(screen, 'الشاشةُ لا تنادي مسلكَ الحالة').toMatch(/terms\/\$\{t\.id\}\/status/)
  })
})

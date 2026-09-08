/* وصفُ زرّ فتح الشعب يقول ما تفعله الخدمة — لا ما كانت تفعله.

   ── العطبُ الذي وقع فعلا ──

   بطاقةُ «فتحُ شعبةٍ لكلّ دورة» في `/admin/cohorts` كانت تقول تحت عنوانها:

     «تبدأ بعد ستّة أسابيع · **ثلاثاء وخميس ٦ مساءً** بتوقيت عمّان · سعة ٢٠»

   ثمّ غُيّر الإيقاعُ (٨ سبتمبر): المواعيدُ الستّةُ صارت **يوما واحدا** لكلّ
   شعبةٍ لا يومَين، والجلساتُ ثلاثا أو أربعا بينها أسبوعان. والوصفُ بقي كما
   هو — فبقي يَعِد بلقاءَين أسبوعيَّين لشعبةٍ تلتقي مرّةً كلَّ أسبوعين.

   ── ولماذا يهمّ هذا الوصفُ بعينه ──

   هو آخرُ ما يقرؤه صاحبُ المنصّة **قبل أن يضغط زرّا يكتب في قاعدةٍ فيها
   مدفوعات**. فمن ضغط على وصفٍ كاذبٍ فتح ٨١ شعبةً بجدولٍ غيرِ الذي وافق عليه،
   ثمّ يراه المتعلّمون في صفحة الدورة ويسجّلون عليه.

   ── والفحصُ مشتقٌّ لا مكتوبٌ باليد ──

   الأرقامُ والمواعيدُ تُنتزع من `catalog-readiness.service.ts` نفسِها. فمن
   غيّر الخدمةَ وحدَّث الوصفَ معها مرّ، ومن غيّر أحدَهما وحدَه سقط. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const SERVICE = 'server/services/catalog-readiness.service.ts'
const PANEL = 'src/pages/admin/CohortReadiness.tsx'

/** ٢٠ ← «٢٠» */
const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])

/** أسماءُ العددِ كما تُكتب في الوصف */
const COUNT_WORD: Record<number, string> = {
  2: 'موعدان', 3: 'ثلاثةُ مواعيد', 4: 'أربعةُ مواعيد',
  5: 'خمسةُ مواعيد', 6: 'ستّةُ مواعيد', 7: 'سبعةُ مواعيد', 8: 'ثمانيةُ مواعيد',
}

/** ١٨:٠٠ ← «٦ مساءً» — كتحويل `amman` في الخدمة */
function ammanHour(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2))
  const twelve = h % 12 === 0 ? 12 : h % 12
  return `${toArabicDigits(twelve)} ${h >= 12 ? 'مساءً' : 'صباحا'}`
}

/** مواعيدُ الخدمة: كم موعدا، وكم يوما في الموعد الواحد، وأيُّ ساعات. */
function slotsFromService() {
  const src = read(SERVICE)
  const block = src.match(/const SLOTS[^=]*=\s*\[([\s\S]*?)\n\]/)
  expect(block, `لا كتلةَ SLOTS في ${SERVICE} — تغيّرت بنيتُها`).toBeTruthy()

  const slots = [...block![1].matchAll(/daysOfWeek:\s*\[([^\]]*)\]\s*,\s*startTime:\s*'(\d{2}:\d{2})'/g)]
    .map((m) => ({
      days: [...m[1].matchAll(/'([a-z]{3})'/g)].map((d) => d[1]),
      time: m[2],
    }))
  expect(slots.length, 'لا موعدَ واحدٌ قُرئ من SLOTS').toBeGreaterThan(0)
  return slots
}

/** رقمٌ ثابتٌ من الخدمة باسمِه */
function constant(name: string): number {
  const m = read(SERVICE).match(new RegExp(`${name}\\s*=\\s*(\\d+)`))
  expect(m, `لا ثابتَ ${name} في ${SERVICE}`).toBeTruthy()
  return Number(m![1])
}

/** نصُّ الوصف تحت عنوان بطاقة «فتحُ الشعب» — والبطاقةُ تُعرَف بأيقونتها. */
function caption(): string {
  const afterIcon = read(PANEL).split('<PlayCircle')[1]
  expect(afterIcon, `لا بطاقةَ فتحِ شعبٍ في ${PANEL} — اختفت أيقونةُ PlayCircle`).toBeTruthy()
  const p = afterIcon.match(/<p[^>]*>([\s\S]*?)<\/p>/)
  expect(p, 'لا فقرةَ وصفٍ بعد عنوان البطاقة').toBeTruthy()
  return p![1].replace(/\s+/g, ' ').trim()
}

describe('وصفُ زرّ فتح الشعب يطابق الخدمة', () => {
  it('لا وصفَ محذوف — والصمتُ أسوأُ من وصفٍ ناقص', () => {
    /* حارسٌ ضدّ «الإصلاح» بالحذف: من محا الوصفَ أمرّ كلَّ ما تحته، وترك
       من يضغط الزرَّ لا يعرف ما سيُكتب. */
    expect(caption().length, 'وصفُ البطاقة فارغ').toBeGreaterThan(40)
  })

  it('ويقول عددَ المواعيد كما هي في SLOTS', () => {
    const word = COUNT_WORD[slotsFromService().length]
    expect(word, 'عددُ المواعيد خارج ما يعرفه هذا الحارس — أضِف اسمَه').toBeTruthy()
    expect(caption(), `المواعيدُ ${slotsFromService().length} والوصفُ لا يقول «${word}»`)
      .toContain(word)
  })

  it('ويقول يوما واحدا لكلّ شعبة ما دام الموعدُ يوما واحدا', () => {
    /* ⚠️ هذا بعينُه ما سقط: بقي الوصفُ على «ثلاثاء وخميس» بعد أن صار كلُّ
       موعدٍ يوما واحدا. فيُقاس **أطولُ موعد** لا أسماءُ الأيّام: أسماؤها
       كانت وما تزال في SLOTS، والكاذبُ كان اقترانَ يومَين لشعبةٍ واحدة. */
    const maxDays = Math.max(...slotsFromService().map((s) => s.days.length))
    const text = caption()

    if (maxDays === 1) {
      expect(text, 'المواعيدُ يومٌ واحدٌ والوصفُ لا يقوله').toMatch(/يومٌ واحد|يوم واحد/)
      /* ولا يقترن يومان في الوصف كأنّهما شعبةٌ واحدة */
      const DAYS = 'الأحد|الإثنين|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت'
      const pair = new RegExp(`(${DAYS})\\s+و(${DAYS.replace(/ال/g, '')})`)
      expect(
        text,
        'الوصفُ يقرن يومَين لشعبةٍ واحدة، والموعدُ يومٌ واحد — وهو عطبُ «ثلاثاء وخميس» نفسُه',
      ).not.toMatch(pair)
    } else {
      expect(text, `الموعدُ ${maxDays} أيّام والوصفُ يقول يوما واحدا`).not.toMatch(/يومٌ واحد|يوم واحد/)
    }
  })

  it('وكلُّ ساعةٍ في SLOTS مذكورةٌ في الوصف', () => {
    /* والرقمُ والفترةُ يُفحصان مفترقَين: العربيّةُ تجمع «٦ أو ٨ مساءً» بفترةٍ
       واحدة، فاشتراطُ «٦ مساءً» حرفا يُسقط صياغةً سليمة. والذي يُمسَك أن
       تتغيّر الساعةُ في SLOTS فلا يتغيّر رقمُها هنا. */
    const text = caption()
    for (const t of new Set(slotsFromService().map((s) => s.time))) {
      const [digit, period] = ammanHour(t).split(' ')
      expect(text, `ساعةُ ${t} في SLOTS ولا رقمَ «${digit}» في الوصف`).toContain(digit)
      expect(text, `ساعةُ ${t} فترتُها «${period}» ولا ذكرَ لها في الوصف`).toContain(period)
    }
  })

  it('ويقول عددَ الجلسات المباشرة وتباعدَها وسعةَ الشعبة', () => {
    const text = caption()
    const short = constant('LIVE_SESSIONS_SHORT')
    const deep = constant('LIVE_SESSIONS_DEEP')
    const gap = constant('SESSION_INTERVAL_WEEKS')
    const capacity = constant('DEFAULT_CAPACITY')

    /* ⚠️ والعبارةُ كاملةً لا الرقمُ وحدَه. فالرقمُ وحدَه يمرّ لسببٍ خاطئ:
       «٦» موجودةٌ أصلا في «٦ أو ٨ مساءً»، فرفعُ الجلسات إلى ستٍّ كان يمرّ
       والوصفُ يقول ثلاثا أو أربعا. وكذلك «٢٠» في «٢٠٢٦». */
    const sessions = `${toArabicDigits(short)} أو ${toArabicDigits(deep)} جلسات`
    expect(text, `الجلساتُ ${short} أو ${deep} والوصفُ لا يقول «${sessions}»`).toContain(sessions)
    expect(gap, 'التباعدُ لم يعد أسبوعين — والوصفُ يقولها نصّا').toBe(2)
    expect(text, 'التباعدُ أسبوعان ولا ذكرَ له في الوصف').toContain('أسبوعان')
    expect(text, `السعةُ ${capacity} ولا ذكرَ لها في الوصف`)
      .toContain(`سعة ${toArabicDigits(capacity)}`)
  })
})

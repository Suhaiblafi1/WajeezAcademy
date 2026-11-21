/* اختيارُ الموسم لشعب الموسم الأوّل — الحسابُ والشاشتان (٢١ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: يختار المدرّبُ من صفحته الربيعَ أو موسما لاحقا أو الإلغاء، ومن لم يختر حتّى المهلة تُلغى
   شعبتُه («b»). والحسابُ في `season-choice.ts`، والأثرُ يحرسه `server/tests/learning/cohort-season-choice.test.ts`.
   وهنا: المواسمُ الثلاثةُ محسوبةً، وكلُّ يومٍ من الموسم الأوّل يقع في الأسبوع الأوّل من كلٍّ منها، وبطاقةُ المدرّب
   بخياراتها الثلاثة ومهلتها وعاقبة السكوت، وتأكيدُ الإدارة قبل الإرسال، ونصوصٌ بلا تشكيل. والفحصُ على الشيفرة
   بلا تعليقاتها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { CASE_MARKS } from '@/application/text/plain-ar'
import { termBounds } from '@/application/terms/season'
import {
  CANCEL_OPTION_AR, DEFAULT_CANCEL_AR, NO_OBLIGATION_AR, defaultSeasonDeadline, firstAtIn, seasonChoicesAfter,
  seasonMonthsAr, seasonOptionAr, seasonPickConsequenceAr, seasonSendConfirmAr, seasonStartAt, weeksIntoSeason,
} from '@/application/trainer/season-choice'
import { zonedClock, zonedDay } from '@/application/trainer/cohort-period'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const DAY = 86_400_000
const WEEK = 7 * DAY

describe('المواسم الثلاثة — محسوبة من فصل الشعبة', () => {
  it('⚠️ بعد شتاء 2026/2027: الربيع ثم الصيف ثم الخريف 2027 — كما قرر صاحب المنصة', () => {
    expect(seasonChoicesAfter({ year: 2026, season: 'nov_jan' })).toEqual([
      { year: 2027, season: 'apr_may' }, { year: 2027, season: 'jul_aug' }, { year: 2027, season: 'oct_nov' },
    ])
    expect(seasonOptionAr({ year: 2027, season: 'apr_may' })).toBe('موسم الربيع — أبريل ومايو 2027')
    expect(seasonMonthsAr({ year: 2027, season: 'oct_nov' })).toBe('أكتوبر ونوفمبر 2027')
  })

  it('⚠️ كل يوم من الموسم الأول يقع في الأسبوع الأول من كل موسم يختاره — بيومه وساعته، وأسبوع أقل يبقيه قبله', () => {
    const targets = seasonChoicesAfter({ year: 2026, season: 'nov_jan' })
    for (let t = Date.UTC(2026, 10, 1, 16); t <= Date.UTC(2027, 0, 31, 16); t += DAY) {
      const at = new Date(t)
      for (const s of targets) {
        const to = firstAtIn(at, s)
        const start = seasonStartAt(s).getTime()
        expect(to.getTime() - at.getTime(), at.toISOString()).toBe(weeksIntoSeason(at, s) * WEEK)
        expect(to.getTime() >= start && to.getTime() < start + WEEK, `${at.toISOString()} ← ${s.season}`).toBe(true)
        expect(to.getTime() < termBounds(s.year, s.season).endsOn.getTime() + DAY).toBe(true)
        expect(zonedClock(to)).toBe(zonedClock(at))
        expect(to.getTime() - WEEK < start, `${at.toISOString()}: أسابيع زائدة`).toBe(true)
      }
    }
  })

  it('⚠️ وأول الموسم بتوقيت عمان: منتصف ليل ١ أبريل هناك ما زال ٣١ مارس في UTC', () => {
    expect(seasonStartAt({ year: 2027, season: 'apr_may' }).toISOString()).toBe('2027-03-31T21:00:00.000Z')
  })

  it('⚠️ المهلة الافتراضية سبعة أيام — إلى آخر يومها بتوقيت عمان', () => {
    const d = defaultSeasonDeadline(new Date('2026-11-21T09:00:00Z'))
    expect(zonedDay(d)).toBe('2026-11-28')
    expect(zonedClock(d)).toBe('23:59')
  })
})

describe('بطاقة المدرب — ثلاثة خيارات، والمهلة، وما يقع إن لم يختر', () => {
  const card = code('src/components/trainer/SeasonChoiceCard.tsx')
  const cards = code('src/components/trainer/PostponeOfferCards.tsx')

  it('⚠️ الخيارات الثلاثة بأرقامها: الربيع، وموسم لاحق، والإلغاء', () => {
    expect(card).toMatch(/<p className="font-bold">1\. أجلها إلى \{first\.optionAr\}<\/p>/)
    expect(card).toMatch(/<p className="font-bold">2\. أجلها إلى موسم لاحق<\/p>[\s\S]*?\{later\.map\(\(o\) =>/)
    expect(card).toMatch(/<p className="font-bold">3\. \{CANCEL_OPTION_AR\}<\/p>/)
    expect(CANCEL_OPTION_AR).toBe('ألغها — وتبقى في فريق مدربي وجيز، وتفتح شعبة متى أردت.')
    expect(card).toContain('onClick={() => ask({ kind: "cancel" })}>ألغها</Button>')
  })

  it('⚠️ المهلة وعاقبة السكوت ولا التزام — في البطاقة نفسها', () => {
    expect(card).toMatch(/اختر قبل <b>\{fmtDateTimeAr\(offer\.deadlineAt\)\}<\/b>[\s\S]{0,160}\{DEFAULT_CANCEL_AR\}/)
    expect(DEFAULT_CANCEL_AR).toBe('وإن لم تختر حتى هذا التاريخ تلغى الشعبة.')
    expect(card).toContain('<li>{NO_OBLIGATION_AR}</li>')
    expect(NO_OBLIGATION_AR).toBe('لا يترتب عليك أي التزام عن هذه الشعبة، ولا شيء عليك إن اخترت الإلغاء.')
  })

  it('⚠️ لا ينفذ خيار بضغطة الخيار — يقال أثره ثم «نعم»', () => {
    expect(card.match(/onChoose\(/g), 'نداء التنفيذ في غير زر التأكيد').toHaveLength(1)
    expect(card).toMatch(/\{asking && \([\s\S]*?\{consequence\} متأكد؟[\s\S]*?onClick=\{\(\) => onChoose\(asking\)\}>نعم<\/Button>/)
    expect(seasonPickConsequenceAr({ kind: 'cancel' })).toContain('ولا شيء عليك')
    expect(seasonPickConsequenceAr({ kind: 'season', optionAr: 'موسم الربيع — أبريل ومايو 2027', firstAtAr: 'الأحد 4 أبريل' }))
      .toBe('تتحرك الشعبة إلى موسم الربيع — أبريل ومايو 2027، وأول لقاء فيها الأحد 4 أبريل، ويصل متعلميها الموعد الجديد.')
  })

  it('⚠️ وسؤال الموسم يعرض ببطاقته ويرسل إلى بابه — لا بزري التأجيل', () => {
    expect(cards).toMatch(/o\.kind === "season_choice" \? \(\s*<SeasonChoiceCard /)
    expect(cards).toContain('apiPost<{ status: "accepted" | "declined"; toFirstAt?: string | null }>(`/api/trainer/cohort-postpones/${o.id}/choose`, pick)')
  })
})

describe('شاشة الإدارة — تعاين ثم ترسل بعد تأكيد يقول ما يقع', () => {
  const box = code('src/components/admin/SeasonChoiceBox.tsx')
  const upcoming = code('src/components/admin/UpcomingCohorts.tsx')

  it('⚠️ المعاينة لا ترسل، والإرسال لما اختير بعد التأكيد وحده', () => {
    expect(box).toContain('apiGet<Preview>("/api/admin/cohort-season-choices/preview")')
    expect(box).toMatch(/!confirming \? \(\s*<Button[\s\S]*?onClick=\{\(\) => setConfirming\(true\)\}/)
    expect(box).toMatch(/\{seasonSendConfirmAr\(trainers, chosen\.length, fmtDateTimeAr\(deadlineAt!\.toISOString\(\)\)\)\}<\/span>\s*<Button tone="confirm" loading=\{busy\} onClick=\{send\}>نعم، أرسل<\/Button>/)
    expect(box.match(/onClick=\{send\}/g)).toHaveLength(1)
    expect(upcoming).toMatch(/<SeasonChoiceBox onChanged=/)
  })

  it('⚠️ والتأكيد يقول من يصله وأن من لم يختر تلغى شعبته', () => {
    expect(seasonSendConfirmAr(3, 5, 'السبت 28 نوفمبر'))
      .toBe('يصل البريد والجرس الآن إلى 3 مدربين — رسالة واحدة لكل مدرب عن 5 شعب. ومن لم يختر حتى السبت 28 نوفمبر تلغى شعبته تلقائيا. متأكد؟')
    for (const t of ['<b>يختار موسما:</b>', '<b>يختار الإلغاء:</b>', '<b>لا يختار حتى المهلة:</b>']) expect(box).toContain(t)
  })

  it('⚠️ المهلة الافتراضية سبعة أيام', () => {
    expect(box).toContain('useState(() => toLocal(defaultSeasonDeadline(new Date())))')
  })
})

describe('نصوص بلا تشكيل إعرابي — والتعليقات ليست منها', () => {
  const FILES = [
    'src/application/trainer/season-choice.ts', 'server/services/season-choice-mail.ts',
    'src/components/admin/SeasonChoiceBox.tsx', 'src/components/trainer/SeasonChoiceCard.tsx',
  ]
  const marked = (p: string): string[] => {
    const kind = p.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    const sf = ts.createSourceFile(p, readFileSync(join(process.cwd(), p), 'utf8'), ts.ScriptTarget.Latest, true, kind)
    const out: string[] = []
    const visit = (n: ts.Node) => {
      const text = ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) ? n.text
        : ts.isJsxText(n) ? n.getText() : null
      if (text !== null && new RegExp(CASE_MARKS.source).test(text)) out.push(text.trim().slice(0, 60))
      ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
  }
  for (const f of FILES) {
    it(`⚠️ ${f}`, () => {
      expect(marked(f), 'جملة مشكولة يقرؤها إنسان').toEqual([])
    })
  }
})

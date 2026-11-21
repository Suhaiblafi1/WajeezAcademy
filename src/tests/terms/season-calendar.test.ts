/* مواسمُ ٢٠٢٧ في الرئيسة (٢١ نوفمبر ٢٠٢٦) — والعلّةُ في رأس `src/application/terms/season-calendar.ts`.

   قرارُ صاحب المنصّة: «الفصلُ الحاليّ يُغلَق اليوم، والفصلُ الآتي الذي تجاوزناه اجعله مغلقا للتسجيل ليكون الفصلُ الربيعُ هو
   القادم». فالمحروس: الشتاءُ (يناير – فبراير) مغلقٌ دائما، والربيعُ «القادم» ويفتح تسجيلُه في مارس، والصيفُ في يونيو، والخريفُ
   في سبتمبر — وتتقدّم الحالُ بالتاريخ وحدَه. والرئيسةُ ترسم ما يحسبه، لا نصّا ثابتا. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { currentSeasonLineAr, seasonCards } from '@/application/terms/season-calendar'
import { plainAr } from '@/application/text/plain-ar'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const HOME = readFileSync(join(root, 'src/pages/Home.tsx'), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ')
const at = (iso: string) => new Date(iso)
const brief = (now: Date) => seasonCards(now).map((c) => [c.key, c.noteAr, c.next])

describe('مواسم 2027 في الرئيسة', () => {
  it('⚠️ اليوم: الشتاء مغلق، والربيع القادم تسجيله في مارس، والصيف يونيو، والخريف سبتمبر', () => {
    expect(brief(at('2026-11-21T10:00:00Z'))).toEqual([
      ['jan_feb', 'التسجيل مغلق', false],
      ['apr_may', 'التسجيل في مارس', true],
      ['jul_aug', 'التسجيل في يونيو', false],
      ['oct_nov', 'التسجيل في سبتمبر', false],
    ])
  })

  it('⚠️ والحال تتقدم بالتاريخ: مارس مفتوح، وأبريل يجري والصيف هو القادم، وبعد نوفمبر انتهى', () => {
    expect(brief(at('2027-03-05T10:00:00Z'))[1]).toEqual(['apr_may', 'التسجيل مفتوح', true])
    const april = brief(at('2027-04-10T10:00:00Z'))
    expect(april[1]).toEqual(['apr_may', 'يجري الآن', false])
    expect(april[2]).toEqual(['jul_aug', 'التسجيل في يونيو', true])
    expect(brief(at('2027-12-05T10:00:00Z')).map((c) => c[1])).toEqual(['التسجيل مغلق', 'انتهى', 'انتهى', 'انتهى'])
    /* والشتاء الذي تجاوزناه مغلق في كل وقت — لا «مكتمل» */
    expect(brief(at('2027-01-15T10:00:00Z'))[0]).toEqual(['jan_feb', 'التسجيل مغلق', false])
  })

  it('⚠️ سطر الموسم الحالي: يغلق اليوم 21 نوفمبر بتوقيت عمان، ومغلق بعده، ولا سطر بعد نهايته', () => {
    expect(currentSeasonLineAr(at('2026-11-20T10:00:00Z'))).toBe('التسجيل في الموسم الحالي يغلق 21 نوفمبر')
    expect(currentSeasonLineAr(at('2026-11-21T10:00:00Z'))).toBe('التسجيل في الموسم الحالي يغلق اليوم')
    /* منتصف ليل عمّان (+3) = 21:00 UTC */
    expect(currentSeasonLineAr(at('2026-11-21T21:30:00Z'))).toBe('التسجيل في الموسم الحالي مغلق')
    expect(currentSeasonLineAr(at('2027-02-02T10:00:00Z'))).toBeNull()
  })

  it('⚠️ الرئيسة ترسم البطاقات من الحساب — لا خطوات «كيف تسير رحلتك» — والنصوص بلا تشكيل', () => {
    expect(HOME).toMatch(/const cards = seasonCards\(now\)/)
    expect(HOME).toMatch(/\{cards\.map\(\(c, i\) => \{/)
    expect(HOME).toMatch(/<Chip tone=\{SEASON_TONE\[c\.state\]\} className="mt-1">\{c\.noteAr\}<\/Chip>/)
    expect(HOME, 'عادت خطوات الرحلة').not.toMatch(/كيف تسير رحلتك|title: 'نفهمك'/)
    expect(HOME, 'كلمة مكتمل لموسم لم يمتلئ').not.toContain('مكتمل')
    const texts = [...seasonCards(at('2026-11-21T10:00:00Z')).flatMap((c) => [c.nameAr, c.monthsAr, c.noteAr]), 'شهران لكل موسم، ويفتح التسجيل قبله بشهر.', 'القادم']
    for (const t of texts) expect(t).toBe(plainAr(t))
  })
})

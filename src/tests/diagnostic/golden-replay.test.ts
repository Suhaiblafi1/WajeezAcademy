/* كلُّ مسارٍ وقالبٍ ما زال يُبلَغ — تُعاد رحلتُه الفائزةُ المحفوظةُ فيفوز.

   ═══ لماذا وُجد (٧ أكتوبر ٢٠٢٦) ═══

   صارت الدوراتُ كلُّها ستَّ عشرةَ ساعة، فتغيّرت ساعاتُ كلّ كيانٍ في فضاء
   التوصيات ولم يتغيّر غيرُها. واجتاز الطلبُ CI كلَّه — ثمّ ظهر في Golden Suite
   أنّ TPL-SUPPLY-001 لم يعُد يُبلَغ لأيّ متعلّمٍ من ٢٧٥٢ توليفة، وأنّ فوزَ
   المركّب نزل في Monte Carlo من ٧٧٢ إلى ٦١٠ من عشرة آلاف. لم يحمرّ شيء:
   Golden Suite سكربتٌ يُشغَّل باليد، لا حارسٌ في CI.

   والبحثُ الشاملُ نفسُه أثقلُ من أن يُشغَّل في كلّ طلب (آلافُ الجلسات لكيانٍ
   واحد). لكنّ ناتجَه محفوظٌ: لكلّ كيانٍ **رحلةٌ فاز بها** في
   `docs/diagnostic-v2_1/golden-reachability.json`. فإعادتُها رخيصة — اثنتان
   وأربعون جلسة — وتمسك ما أفلت: تغييرٌ يُخسر كيانا رحلتَه الفائزة.

   ═══ وما لا يدّعيه ═══

   خسارةُ الرحلة المحفوظة لا تعني أنّ الكيانَ لا يُبلَغ أبدا — قد تفوز له
   توليفةٌ أخرى. فالسقوطُ هنا يقول: «شغّل `npm run simulate:v2_1-reachability`
   والتزم ناتجَه». فإن وُجدت رحلةٌ أخرى حُفظت وخضرّ؛ وإن لم توجد فهذا الانحدارُ
   الذي وُضع الحارسُ له.

   ⚠ أُثبت سقوطُه: أُعيد عيارُ كلفة المركّب إلى ما كان قبل الإصلاح (أوّلُ ٤٨
   ساعةً بلا كلفة و٠٫٠٠٠٣ للساعة) فسقط مسمّيا TPL-SUPPLY-001 وما فاز بدلا منه،
   ثمّ أُعيد فخضرّ. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runJourney, winnerOf, type Journey } from '../../../scripts/v2_1/golden-journey'
import { recommendationUniverse } from '../../domain/diagnostic/v2_1/universe'

const golden = JSON.parse(
  readFileSync(join(process.cwd(), 'docs/diagnostic-v2_1/golden-reachability.json'), 'utf8'),
) as { golden: Record<string, { verdict: string; positive: { won: boolean; journey?: Journey } }> }

const reachable = Object.entries(golden.golden).filter(([, g]) => g.verdict === 'reachable')

describe('رحلةُ كلّ كيانٍ الفائزةُ ما زالت تفوز', () => {
  it('الملفُّ يُقرأ، ولكلّ كيانٍ يُبلَغ رحلةٌ كاملةٌ محفوظة', () => {
    expect(reachable.length, 'لا كيانَ يُبلَغ — تغيّرت البنية؟').toBeGreaterThan(30)
    const missing = reachable.filter(([, g]) => !g.positive.journey).map(([id]) => id)
    expect(missing, 'كياناتٌ بلا رحلةٍ محفوظة — شغّل npm run simulate:v2_1-reachability').toEqual([])
  })

  it('وكلُّ كيانٍ نشطٍ في الفضاء له حكمٌ في الملفّ — فكيانٌ جديدٌ لا يمرّ بلا رحلة', () => {
    const judged = new Set(Object.keys(golden.golden))
    const unjudged = recommendationUniverse().active
      .filter((e) => e.entity_type !== 'course')
      .map((e) => e.entity_id)
      .filter((id) => !judged.has(id))
    expect(unjudged, 'كياناتٌ نشطةٌ لم يمرّ بها Golden Suite').toEqual([])
  })

  it('وكلُّ رحلةٍ محفوظةٍ تُعاد فيفوز صاحبُها', { timeout: 120_000 }, () => {
    const lost: string[] = []
    for (const [id, g] of reachable) {
      const out = runJourney(`replay-${id}`, g.positive.journey!)
      const winner = winnerOf(out.rec)
      if (winner !== id) lost.push(`${id} ← فاز بدلا منه ${winner ?? 'لا أحد'} (${out.rec.kind})`)
    }
    expect(lost, 'كياناتٌ خسرت رحلتَها الفائزة — شغّل npm run simulate:v2_1-reachability وراجع').toEqual([])
  })
})

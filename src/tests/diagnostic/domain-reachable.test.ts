/* البند ٣٩ · لا مجالَ يملك مسارا ولا يصل إليه احتياج.
 *
 * ── الكيانُ الذي لم يفز قطّ، وسببُه سطرٌ واحد ──
 *
 * `PW-GOV-002` كان الكيانَ الوحيدَ في الفضاء النشط الذي لا تفوز له توليفةُ
 * إشاراتٍ واحدة: جرّبت حزمةُ الذهب ٢٨ توليفةً فردّته كلَّها بـ«الكيان خارج
 * مجال حاجتك». وهو مسارٌ **مؤلَّفٌ ودوراتُه قائمة** — ينقصه طريقٌ يصل إليه.
 *
 * والسبب: مجالُه `gov_services` كان يصل إليه **صفرُ احتياجات**. والاحتياجُ
 * الذي يقول في عنوانه «تجربة العميل / **المستفيد**» — وهي كلمةُ القطاع العامّ
 * بعينها — كان يوجَّه إلى `operations` وحدَه. والخريطةُ القديمةُ في
 * `pathway-domains.v2.json` تقول الصوابَ منذ البداية:
 * `improve_customer_experience` ← `['gov_services', 'communication_influence']`.
 * ونصُّ سؤال القطاع يَعِد به صراحةً: «حكوميٌّ وحدَه يفتح المسارات الحكوميّة
 * **ومجال الخدمات الحكوميّة**» — وعدٌ نصفُه ميّت.
 *
 * ── ولماذا الحارسُ على البنية لا على هذا الكيان ──
 *
 * لأنّ العطبَ صنفٌ لا واقعة: أيُّ مجالٍ يُضاف له مسارٌ ولا يُوصَل به احتياجٌ
 * يولد ميّتا بالصمت نفسِه. فيُفحص الشرطُ على الفضاء كلِّه، ويسقط يومَ يولد
 * الثاني — لا بعد أن يقيسه أحدٌ بالصدفة. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { NEEDS_V21, GOALS_V21 } from '../../domain/diagnostic/v2_1/maps'

const pathwayDomains = JSON.parse(
  readFileSync('src/data/catalog/v2/pathway-domains.v2.json', 'utf8'),
) as { pathway_domains: Record<string, string[]> }

describe('٣٩ · كلُّ مجالٍ له مسارٌ يصل إليه احتياج', () => {
  const domainsWithPathway = new Set(Object.values(pathwayDomains.pathway_domains).flat())
  const domainsFromNeeds = new Set<string>(NEEDS_V21.flatMap((n) => n.domains))
  const domainsFromGoals = new Set<string>(GOALS_V21.flatMap((g) => g.domains))

  it('القراءةُ تعمل فعلا — فلا يخضرّ الحارسُ على مجموعةٍ فارغة', () => {
    expect(domainsWithPathway.size, 'لم يُقرأ أيُّ مسار').toBeGreaterThan(10)
    expect(domainsFromNeeds.size).toBeGreaterThan(10)
  })

  it('ولا مجالَ يملك مسارا ولا يصل إليه احتياجٌ ولا هدف', () => {
    const orphans = [...domainsWithPathway].filter(
      (d) => !domainsFromNeeds.has(d) && !domainsFromGoals.has(d),
    )
    expect(
      orphans,
      'مجالٌ فيه مسارٌ مؤلَّفٌ ولا إشارةَ تصل إليه — يولد ميّتا:\n'
      + orphans.map((d) => `  ${d}: ${Object.entries(pathwayDomains.pathway_domains).filter(([, v]) => v.includes(d)).map(([k]) => k).join('، ')}`).join('\n'),
    ).toEqual([])
  })

  it('و«الخدمات الحكوميّة» تصل من احتياج المستفيد بعينه — لا بالصدفة', () => {
    const ce = NEEDS_V21.find((n) => n.code === 'need_customer_experience')
    expect(ce, 'اختفى احتياجُ تجربة المستفيد').toBeTruthy()
    expect(ce!.domains).toContain('gov_services')
    /* والبوّابةُ لم تُفتح لغير أهلها: القطاعُ يبقى شرطا في المسار نفسِه */
    expect(ce!.domains).toContain('operations')
  })
})

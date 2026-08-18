import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  courseDesignReferences,
  publicReferences,
  referenceBadges,
  sessionContributingReferences,
} from '../../data/methodology'
import { skillsCatalog } from '../../domain/diagnostic/catalog'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('سجل المراجع المنهجية', () => {
  it('لا يظهر للعميل إلا مرجع implemented بدليل تطبيق', () => {
    for (const r of publicReferences()) {
      expect(r.implementation_status).toBe('implemented')
      expect(r.implementation_evidence.length).toBeGreaterThan(10)
      expect(r.public_visibility).toBe(true)
    }
  })

  it('لا مراجع هندسية أو قانونية في السجل التسويقي', () => {
    const ENGINEERING = ['WCAG', 'ARIA', 'OWASP', 'GDPR', 'React', 'TypeScript', 'GOV.UK']
    for (const r of publicReferences()) {
      const hay = `${r.name_ar} ${r.name_en} ${r.organization}`
      for (const eng of ENGINEERING) expect(hay).not.toContain(eng)
    }
  })

  it('شارات الرئيسية قصيرة ومعروفة ومرتبة', () => {
    const badges = referenceBadges()
    expect(badges.length).toBeGreaterThanOrEqual(4)
    for (const b of badges) expect(b.length).toBeLessThanOrEqual(10)
  })

  it('مراجع الجلسة: DigComp لا يظهر بلا مهارة رقمية مقيسة فعلا', () => {
    const digital = skillsCatalog.find((s) =>
      ((s as { source_frameworks?: string[] }).source_frameworks ?? []).includes('DigComp 2.2'),
    )!
    const nonDigital = skillsCatalog.find(
      (s) =>
        !((s as { source_frameworks?: string[] }).source_frameworks ?? []).includes('DigComp 2.2') &&
        ((s as { source_frameworks?: string[] }).source_frameworks ?? []).includes('O*NET'),
    )!
    expect(digital).toBeTruthy()
    expect(nonDigital).toBeTruthy()

    const withDigital = sessionContributingReferences({
      interestVector: {},
      skillVector: { [digital.slug]: 2 },
      hasTrace: false,
    })
    expect(withDigital.map((r) => r.id)).toContain('REF-DIGCOMP')

    const withoutDigital = sessionContributingReferences({
      interestVector: {},
      skillVector: { [nonDigital.slug]: 2 },
      hasTrace: false,
    })
    expect(withoutDigital.map((r) => r.id)).not.toContain('REF-DIGCOMP')
  })

  it('ECD يظهر فقط عند وجود أثر قرار فعلي', () => {
    const base = { interestVector: {}, skillVector: {} }
    expect(sessionContributingReferences({ ...base, hasTrace: true }).map((r) => r.id)).toContain('REF-ECD')
    expect(sessionContributingReferences({ ...base, hasTrace: false }).map((r) => r.id)).not.toContain('REF-ECD')
  })

  it('RIASEC يظهر فقط عندما غذّت أسئلة الميول متجه الاهتمامات', () => {
    const base = { skillVector: {}, hasTrace: false }
    expect(sessionContributingReferences({ ...base, interestVector: { R: 1 } }).map((r) => r.id)).toContain(
      'REF-RIASEC-ONET-IP',
    )
    expect(sessionContributingReferences({ ...base, interestVector: {} }).map((r) => r.id)).not.toContain(
      'REF-RIASEC-ONET-IP',
    )
  })

  it('مراجع تصميم الدورات: التصميم العكسي وبلوم فقط', () => {
    const ids = courseDesignReferences().map((r) => r.id)
    expect(ids).toContain('REF-BACKWARD-DESIGN')
    expect(ids).toContain('REF-BLOOM')
    expect(ids.length).toBe(2)
  })

  it('صفحة المنهجية بلا صور وبلا ادعاءات اعتماد', () => {
    const page = readFileSync(join(root, 'src/pages/Methodology.tsx'), 'utf8')
    expect(page).not.toMatch(/<img/i)
    for (const w of ['معتمد من', 'شريك رسمي', 'موثّق من', 'دقة علمية', 'مطابق بالكامل', 'مصادق عليه']) {
      expect(page).not.toContain(w)
    }
  })
})

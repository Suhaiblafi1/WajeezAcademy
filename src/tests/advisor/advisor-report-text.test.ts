/* تقريرُ «أداء المستشار» — عناوينُ أعمدته وطريقةُ حسابه نصٌّ يقرؤه إنسان (١٩ أكتوبر ٢٠٢٦).
   الحسابُ في `server/tests/advisors/advisor-report.test.ts`. والتعليقاتُ تُنزع. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainAr } from '@/application/text/plain-ar'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const REPORTS = readFileSync(join(root, 'server/services/reports.service.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('نصوصُ تقرير أداء المستشار', () => {
  it('بلا تشكيلٍ إعرابيّ', () => {
    for (const t of [
      'حالات مفتوحة', 'ساعات حتى أول تواصل (الوسيط)', 'تواصل خلال يوم ٪', 'بلا تواصل منذ يومين',
      'دفعات طلابه وهم عنده', 'العمولة المستحقة',
    ]) {
      expect(REPORTS).toContain(`'${t}'`)
      expect(t).toBe(plainAr(t))
    }
    const method = REPORTS.match(/key: 'advisor-performance', titleAr: 'أداء المستشار',\s*methodAr: '([^']+)'/)?.[1]
    expect(method, 'لا طريقةَ حسابٍ معلنة').toBeTruthy()
    expect(method).toBe(plainAr(method!))
  })
})

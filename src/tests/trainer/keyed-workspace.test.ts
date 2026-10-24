/* ═══ صفحةُ الشعبة تُبنى من جديد لكلّ شعبة (٢٤ أكتوبر ٢٠٢٦، `KeyedByParam.tsx`) ═══

   الموجِّهُ يُبقي المكوّنَ حين يتغيّر المعرّفُ وحدَه، فحملت صفحةُ الشعبة خطّةَ شعبةٍ إلى أخرى وكتبت ملفَّها
   فيها (`cohort-file-adopt.ts`). فـ:
   ① مفتاحُ ما يلفّه `KeyedByParam` هو المعرّفُ — شعبتان، مفتاحان.
   ② وصفحةُ الشعبة ملفوفةٌ به في الموجِّه.

   ورُئي ساقطا: أُسقط المفتاحُ من الغلاف فسقط ①، وأُعيدت الصفحةُ بلا غلاف فسقط ②. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

let params: Record<string, string> = {}
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useParams: () => params }))

const { KeyedByParam } = await import('@/components/KeyedByParam')

const keyAt = (id: string) => {
  params = { id }
  return (KeyedByParam({ children: createElement('i') }) as ReactElement).key
}

describe('① المفتاح هو المعرّف', () => {
  it('⚠️ شعبتان مفتاحان — فينهدم ما في اليد بالانتقال', () => {
    expect(keyAt('cohort-a')).toBe('cohort-a')
    expect(keyAt('cohort-b')).toBe('cohort-b')
  })
})

describe('② صفحةُ الشعبة ملفوفة', () => {
  it('⚠️ مسارُ الشعبة يبني CohortWorkspace داخل KeyedByParam', () => {
    const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    expect(app).toMatch(/<Route path="\/trainer\/cohort\/:id" element=\{<KeyedByParam><CohortWorkspace \/><\/KeyedByParam>\} \/>/)
  })
})

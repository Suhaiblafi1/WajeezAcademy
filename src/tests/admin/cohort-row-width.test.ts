/* عرضُ اسم الشعبة في «تشغيل الشعب» (٢٠ أكتوبر ٢٠٢٦).

   في لقطةٍ لشعبة «استراتيجية التسعير — شعبة ٤» بعد نقلها عُصر اسمُها عمودا ضيّقا — كلمةٌ أو كلمتان في كلّ سطر —
   بجانب شارة «نقلت إلى موسم الشتاء 2026/2027 · أول لقاء 1 ديسمبر 2026». والعلّة: الاسمُ `flex-1` بأساسٍ صفر،
   والشاراتُ بعرضها كاملا، فلا ينزل شيءٌ إلى سطرٍ جديد ويضيق الاسمُ وحدَه.

   فالاسمُ بأساسٍ (`basis-*`) يُنزل الشاراتِ سطرا إذا ضاق — كما في `src/tests/trainer/slot-card-width.test.ts`.
   والفحصُ على الشيفرة بلا تعليقاتها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PAGE = readFileSync(join(process.cwd(), 'src/pages/admin/AdminCohorts.tsx'), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('عرض اسم الشعبة', () => {
  it('⚠️ اسم الشعبة بأساس ينزل الشارات سطرا — لا يعصره «نقلت إلى…»', () => {
    const at = PAGE.indexOf('<button onClick={() => toggle(c.id)} aria-expanded={isOpen}')
    expect(at, 'لا صف شعبة').toBeGreaterThan(0)
    const head = PAGE.slice(at, at + 600).match(/flex-wrap[^"]*">\s*<div className="([^"]*)">\s*<p className="font-black">\{c\.title\}<\/p>/)
    expect(head, 'لا اسم شعبة في أول الصف').toBeTruthy()
    const cls = head![1].split(/\s+/)
    expect(cls).toEqual(expect.arrayContaining(['min-w-0', 'flex-1']))
    expect(cls.some((t) => /^basis-/.test(t)), `الاسم بلا أساس: ${head![1]}`).toBe(true)
  })
})

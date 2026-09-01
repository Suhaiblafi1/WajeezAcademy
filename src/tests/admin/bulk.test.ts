/* الإجراءُ الجماعيّ: الخبرُ يقول الرقمين.

   العطبُ الذي يحرسه هذا الملفّ ليس في التنفيذ — بل في أن يُقال «تمّ» وقد
   أخفق بعضُه، فيمضي الموظّفُ ظانّا أنّ الطابور فرغ. */

import { describe, expect, it } from 'vitest'
import { bulkMessage, runBulk } from '@/application/admin/bulk'

describe('التنفيذ واحدا واحدا', () => {
  it('يجمع الناجحَ والمخفقَ ولا يتوقّف عند أوّل إخفاق', async () => {
    const seen: string[] = []
    const out = await runBulk(['a', 'b', 'c'], async (id) => {
      seen.push(id)
      if (id === 'b') throw new Error('حالُ الصفّ لا تسمح')
    })
    expect(seen, 'توقّف عند الإخفاق فبقي ما بعده بلا تنفيذ').toEqual(['a', 'b', 'c'])
    expect(out.ok).toEqual(['a', 'c'])
    expect(out.failed).toEqual([{ id: 'b', message: 'حالُ الصفّ لا تسمح' }])
  })

  it('ويُبلّغ التقدّم بعد كلّ صفّ', async () => {
    const ticks: string[] = []
    await runBulk(['a', 'b'], async () => {}, (d, t) => ticks.push(`${d}/${t}`))
    expect(ticks).toEqual(['1/2', '2/2'])
  })
})

describe('صدقُ الخبر', () => {
  it('نجاحٌ كامل: رقمٌ واحد', () => {
    expect(bulkMessage({ ok: ['a', 'b'], failed: [] }, 'نُفّذ')).toBe('نُفّذ على 2.')
  })

  it('نجاحٌ جزئيّ: الرقمان والسببُ الأوّل — ولا كلمةَ «تمّ» وحدها', () => {
    const msg = bulkMessage({ ok: ['a'], failed: [{ id: 'b', message: 'مرفوضٌ سلفا' }] }, 'نُفّذ')
    expect(msg).toContain('1')
    expect(msg).toContain('تعذّر على 1')
    expect(msg).toContain('مرفوضٌ سلفا')
  })

  /* لا `not.toContain` على عربيّةٍ متشابهة: «لم يُنفَّذ» و«نُفّذ» يختلفان
     بالتشكيل وحدَه، فنفيٌ كهذا يمرّ لسببٍ غير الذي كُتب له. الفحصُ على
     البداية: الجملةُ تفتتح بالنفي لا بالإنجاز. */
  it('إخفاقٌ كامل: الجملة تفتتح بالنفي ولا تحمل عددَ ناجحين', () => {
    const msg = bulkMessage({ ok: [], failed: [{ id: 'a', message: 'لا صلاحية' }] }, 'نُفّذ')
    expect(msg.startsWith('لم يُنفَّذ')).toBe(true)
    expect(msg).toContain('لا صلاحية')
    expect(/على (\d+)\./.test(msg), 'خبرُ الإخفاق الكامل يحمل عددَ منفَّذٍ عليهم').toBe(false)
  })
})

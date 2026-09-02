/* الدورات المقترحة تُعرض مرّةً واحدة لا مرّتين.

   كان `edit.pool` يُصيَّر مرّتين في المكوّن نفسه: صفَّ شرائحَ للهديّة، وتحته
   صفَّ شرائحِ «+ أضف» — الأسماء نفسها بالترتيب نفسه. فسبعُ دوراتٍ تصير أربعَ
   عشرة شريحةً بعرضٍ متفاوت تلتفّ بلا محاذاة. وصفها صاحب المنتج: «المنظر
   مبعثر».

   والحارس على المصدر لأنّ العطب بنيويّ — تكرارُ تصييرِ القائمة نفسها — لا
   سلوكُ دالّة. وعدّ المواضع أدقّ من فحص وجود واحد: الصياغة السابقة كانت
   ستمرّ على أيّ حارسٍ يسأل «هل تُعرض القائمة؟». */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(join(process.cwd(), 'src/components/CourseJourney.tsx'), 'utf8')

/** كتلة الهديّة والإضافة أسفل الرحلة — لا قوائم التبديل داخل البطاقات.

    الحدّ الأدنى كان `SRC.indexOf('{edit.minReached')`، وهو يطابق
    `disabled={edit.minReached}` في موضعٍ أعلى الملفّ — فتنقلب الشريحة وتفرغ.
    فالنهاية من `lastIndexOf` لا `indexOf`. */
const START = SRC.indexOf('{/* الهدية والإضافة')
const END = SRC.lastIndexOf('{edit.minReached && !edit.swapOnly')
const BLOCK = SRC.slice(START, END)

describe('قائمة الدورات المقترحة', () => {
  it('٠) الشريحة المفحوصة ليست فارغة — حارسٌ على الحارس', () => {
    expect(START, 'لم تُعثر كتلة الهديّة والإضافة').toBeGreaterThan(-1)
    expect(END, 'لم يُعثر حدُّها الأدنى').toBeGreaterThan(START)
    expect(BLOCK.length).toBeGreaterThan(400)
  })

  it('١) تُصيَّر مرّةً واحدة في كتلة الهديّة والإضافة', () => {
    const renders = BLOCK.split('edit.pool.map(').length - 1
    expect(renders, 'القائمة تُصيَّر أكثر من مرّة — هذا هو التبعثر').toBe(1)
  })

  it('٢) الفعل الباقي: إضافةٌ بالسعر — الهديّة لم تعد تُختار من هنا', () => {
    expect(BLOCK).toContain('edit.onAdd(p.id)')
    expect(BLOCK).not.toContain('edit.onGiftToggle(p.id)')
  })

  it('٣) «أضف» لا يُعرض عند السقف', () => {
    expect(BLOCK).toContain('!edit.maxReached && (')
  })

  it('٤) شبكةٌ لا صفٌّ يلتفّ — المحاذاة هي ما كان ناقصا', () => {
    expect(BLOCK).toContain('grid gap-1.5 sm:grid-cols-2')
  })

  it('٥) ولكلّ زرٍّ اسمٌ يُسمع', () => {
    expect(BLOCK).toContain('aria-label={`أضف «${p.name}» إلى مسارك`}')
  })
})

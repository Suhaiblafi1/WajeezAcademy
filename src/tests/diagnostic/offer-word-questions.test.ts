/* ═══ ولا «عرضك» في أسئلة التشخيص (١٩ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة (٢ أكتوبر ٢٠٢٦): الكلمةُ غيرُ مناسبةٍ في الثقافة الأردنيّة، تُقرأ «عِرضك». وحارسُها
   (`src/tests/trainer/offer-word.test.ts`) يقرأ ملفّاتِ الشيفرة وحدَها — فبقي سؤالٌ في بنك أسئلة التشخيص
   يسأل كلَّ زائرٍ «هل عرضك أو منتجك واضح لمن يشتريه؟» أربعَ مرّاتٍ في ملفّين. فصار «هل ما تبيعه…».

   وهذا الحارسُ يقرأ كلَّ نصٍّ في الملفّات — قيمةً قيمة، بحركاتها أو بلاها.

   ═══ ومحتوى الدورات معها (١٩ أكتوبر ٢٠٢٦) ═══
   كانت الكلمةُ في دروس الدورات ثلاثا وثمانين مرّة، بمعنى «تقديمك» أو «مقترحك». وخُيّر صاحبُ المنصّة
   بين إعادة الكتابة بالمعنى، أو كلمةٍ واحدةٍ في كلّ موضع، أو إبقاء الدروس — فاختار الأوّل: «مقترحك»
   في دورتي البيع والجدوى (C-BIZ-104 · C-AI-104)، و«تقديمك» في سائرها. ولا تُمسّ «يُعرّضك» (من
   التعريض): الحرفُ قبلها يُخرجها من النمط. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/* أوّلُ الكلمة لا وسطُها — و«ل/ب/و/ف» قبلها منها، والحركاتُ بين حروفها لا تُخفيها */
const WORD = /(?<![ء-ي][ً-ْ]*)[وفبل]?عر[ً-ْ]*ض[ً-ْ]*ك(?![ء-ي])/
const FILES = [
  'src/data/catalog/questions.v1.ar.json', 'src/data/catalog/composite-templates.v1.json',
  'src/data/catalog/core-catalog.v2.json',
]

/** كلُّ نصٍّ في ملفّ JSON — بمسارِه ليُقال أين */
function strings(v: unknown, path: string, out: { path: string; text: string }[] = []) {
  if (typeof v === 'string') out.push({ path, text: v })
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${path}[${i}]`, out))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) strings(x, `${path}.${k}`, out)
  return out
}

describe('لا «عرضك» في أسئلة التشخيص', () => {
  it.each(FILES)('%s', (file) => {
    const all = strings(JSON.parse(readFileSync(join(process.cwd(), file), 'utf8')), '$')
    expect(all.length, 'لم يقرأ نصّا واحدا').toBeGreaterThan(50)
    const hits = all.filter((s) => WORD.test(s.text)).map((s) => `${s.path}: ${s.text.slice(0, 60)}`)
    expect(hits, hits.join('\n')).toEqual([])
  })

  it('والنمطُ يمسك الكلمةَ بحركاتها — ولا يمسك «عرضكم» ولا «العرض»', () => {
    expect(WORD.test('هل عرضَك واضح')).toBe(true)
    expect(WORD.test('عرضك')).toBe(true)
    expect(WORD.test('عرضكم')).toBe(false)
    /* وبسابقتها، وبحركةٍ في وسطها — ولا يمسك «يُعرّضك» (من التعريض) */
    expect(WORD.test('متحمّسٌ لعرضك')).toBe(true)
    expect(WORD.test('عرّضك')).toBe(true)
    expect(WORD.test('بما يُعرّضك لنفاد البضاعة')).toBe(false)
    expect(WORD.test('العرض الإعلاني')).toBe(false)
  })
})

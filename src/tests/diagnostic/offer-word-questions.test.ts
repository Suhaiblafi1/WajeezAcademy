/* ═══ ولا «عرضك» في أسئلة التشخيص (١٩ أكتوبر ٢٠٢٦) ═══

   قرارُ صاحب المنصّة (٢ أكتوبر ٢٠٢٦): الكلمةُ غيرُ مناسبةٍ في الثقافة الأردنيّة، تُقرأ «عِرضك». وحارسُها
   (`src/tests/trainer/offer-word.test.ts`) يقرأ ملفّاتِ الشيفرة وحدَها — فبقي سؤالٌ في بنك أسئلة التشخيص
   يسأل كلَّ زائرٍ «هل عرضك أو منتجك واضح لمن يشتريه؟» أربعَ مرّاتٍ في ملفّين. فصار «هل ما تبيعه…».

   وهذا الحارسُ يقرأ كلَّ نصٍّ في الملفّين — قيمةً قيمة، بحركاتها أو بلاها. ومحتوى الدورات
   (`core-catalog.v2.json`) خارجَه حتّى يقرّر صاحبُ المنصّة فيه: الكلمةُ هناك بمعنى «تقديمك» غالبا. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WORD = /عرض[ً-ْ]*ك(?![ء-ي])/
const FILES = ['src/data/catalog/questions.v1.ar.json', 'src/data/catalog/composite-templates.v1.json']

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
    expect(WORD.test('العرض الإعلاني')).toBe(false)
  })
})

/* التاريخُ المختصر لا يُلفّ في `dir="ltr"` (١٩ أكتوبر ٢٠٢٦).

   `fmtDate` و`fmtDateTime` يضعان علامةَ اتّجاهٍ يمينيّةً (U+200F) بعد كلّ رقم، وبها
   يُرتَّب التاريخُ في السطر العربيّ. ولُفّ في صفحة حالة المتقدّم بعنصرٍ يساريّ فقُرئ
   «192026/10/» بدل «19/10/2026». فالحارسُ على البنية: لا عنصرَ `dir="ltr"` نصُّه
   المباشرُ تاريخٌ مختصر — وما جاور نصّا لاتينيّا عُزل بـ`<bdi>`. والسببُ في
   `src/application/text/format-ar.ts`. */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fmtDate, fmtDateTime } from '@/application/text/format-ar'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === 'tests' ? [] : tsxFiles(p)
    return p.endsWith('.tsx') ? [p] : []
  })
}

/* بلا تعليقات — وتعليقُ JSX واحدٌ بين قوسين لا يعبر إلى آخر */
const noComments = (src: string) => src
  .replace(/\{\s*\/\*(?:(?!\*\/)[\s\S])*\*\/\s*\}/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')

/** عنصرٌ يساريٌّ يصل نصُّه المباشرُ — قبل أوّل وسمٍ فيه — إلى تاريخٍ مختصر */
const LTR_DATE = /dir="ltr"[^>]*>[^<]*\{\s*fmtDate(?:Time)?\(/g

describe('التاريخُ المختصر لا يُلفّ في dir="ltr"', () => {
  it('⚠️ والسبب قائم: فيه علاماتُ اتّجاهٍ يمينيّة', () => {
    /* إن زالت العلاماتُ يوما زال سببُ الحارس — فيُراجَع لا يُترك */
    expect(fmtDate('2026-10-19T11:16:14Z')).toMatch(/‏/)
    expect(fmtDateTime('2026-10-19T11:16:14Z')).toMatch(/‏/)
  })

  it('⚠️ لا عنصرَ يساريّ نصُّه المباشرُ تاريخٌ مختصر', () => {
    const hits = tsxFiles(join(root, 'src')).flatMap((f) => {
      const src = noComments(readFileSync(f, 'utf8'))
      return [...src.matchAll(LTR_DATE)].map((m) => `${relative(root, f)}: ${m[0].slice(0, 80)}`)
    })
    expect(hits, 'تاريخٌ مختصر داخل dir="ltr" — يُقرأ مقلوبا').toEqual([])
  })
})

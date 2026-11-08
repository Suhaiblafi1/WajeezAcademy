/* صفحةُ /build لا تحمل بياناتِ التشخيص قبل أن تُرى (٨ نوفمبر ٢٠٢٦).

   كانت صفحةُ «ابنِ مسارك» (`CoursePath.tsx`) تجرّ بالاستيراد الثابت ملفَّ التشخيص كلَّه (`catalog` ~١١٦ ك.ب مضغوطا):
   خريطةُ المسار→المجالات في `v2/data.ts` مع أسئلته، و`FIELD_LEVELS` في `focus.ts` مع الكتالوج. فنُقلتا إلى ملفّين
   صغيرين (`v2/pathway-domains.ts`، `v2_1/field-levels.ts`)، و«لمن الدورة» تُحمَّل بعد ظهور الصفحة (`import()`).

   والحارسُ يمشي شجرةَ الاستيراد الثابت من الصفحة ببنية TypeScript — لا بورود حرفٍ في ملفّ — ويتخطّى
   `import type` و`import()` لأنّهما لا يُحمَّلان مع الصفحة. */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'

const ROOT = resolve(__dirname, '../../..')
const SRC = join(ROOT, 'src')

/** ما لا يُحمَّل مع /build: بياناتُ التشخيص الثقيلة */
const HEAVY = [
  'src/domain/diagnostic/catalog.ts',
  'src/domain/diagnostic/v2/data.ts',
  'src/domain/diagnostic/v2_1/data.ts',
]

function resolveSpec(from: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec)
  else return null // حزمةٌ من node_modules
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (/\.(ts|tsx)$/.test(c) && existsSync(c)) return c
  }
  return null // json وما شابهه
}

/** الاستيرادُ الثابتُ الذي يُحمَّل فعلا — بلا `import type` ولا `export type` ولا `import()` */
function staticImports(file: string): string[] {
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, false, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: string[] = []
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) {
      const clause = st.importClause
      if (clause?.isTypeOnly) continue
      const named = clause?.namedBindings
      if (clause && !clause.name && named && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((e) => e.isTypeOnly)) continue
      if (ts.isStringLiteral(st.moduleSpecifier)) out.push(st.moduleSpecifier.text)
    } else if (ts.isExportDeclaration(st) && st.moduleSpecifier && !st.isTypeOnly && ts.isStringLiteral(st.moduleSpecifier)) {
      out.push(st.moduleSpecifier.text)
    }
  }
  return out
}

/** أوّلُ طريقٍ من الصفحة إلى ملفٍّ ثقيل، أو null */
function pathToHeavy(entry: string): string[] | null {
  const heavy = new Set(HEAVY.map((h) => join(ROOT, h)))
  const parent = new Map<string, string | null>([[entry, null]])
  const queue = [entry]
  while (queue.length) {
    const f = queue.shift()!
    if (heavy.has(f)) {
      const chain: string[] = []
      for (let x: string | null = f; x; x = parent.get(x) ?? null) chain.unshift(relative(ROOT, x))
      return chain
    }
    for (const spec of staticImports(f)) {
      const r = resolveSpec(f, spec)
      if (r && !parent.has(r)) { parent.set(r, f); queue.push(r) }
    }
  }
  return null
}

describe('صفحة /build خفيفة', () => {
  it('لا تبلغ بياناتِ التشخيص بالاستيراد الثابت', () => {
    expect(pathToHeavy(join(SRC, 'pages/CoursePath.tsx'))).toEqual(null)
  })

  it('والحارسُ يرى الطريقَ حين يوجد — التشخيصُ نفسُه يبلغها', () => {
    expect(pathToHeavy(join(SRC, 'pages/Diagnostic.tsx'))).not.toEqual(null)
  })
})

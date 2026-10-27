/* ما ذهب من الشاشات القديمة والنصوص البائتة (٢٧ أكتوبر ٢٠٢٦، المرحلة الثامنة — د).

   ① لا نصَّ للمطوّر في شاشة: «npm run api:dev» وحسابُ الديمو. وتلميحُ الديمو الوحيدُ في `permissionMessage`
      (`src/services/api.ts`) ومشروطٌ بوضع الديمو.
   ② وزرُّ «اعتمد هذه الدورة بموادّها» في دورات المدرّب ذهب — كان يؤهّل ويقول «اعتمدت». ودوراتُه المؤهَّلةُ تُقرأ كما كانت.
   ③ ونموذجُ الملاحظات النصّيّة ولاصقتُها ذهبا — الردُّ بطاقاتُ «قبل/بعد» وحدَها («No text notes»).
   ④ و«من أين أبدأ؟» فيها «اعتمدها» قبل «انشرها» — الدورةُ تولد مسودّةً ولا تُنشر قبل اعتمادها. */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import * as reviewNotes from '@/components/ReviewNotes'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')
/* الشيفرةُ بلا تعليقاتها — فلا يُطابَق نصٌّ في شرح */
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

/** نصوصُ الملفّ التي يراها إنسان — النصُّ والقالبُ ونصُّ JSX، لا التعليقات */
function shownTexts(file: string): string[] {
  const src = read(file)
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: string[] = []
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text)
    else if (ts.isTemplateExpression(n)) out.push(n.head.text, ...n.templateSpans.map((s) => s.literal.text))
    else if (ts.isJsxText(n)) out.push(n.text)
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

const screens = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((f) => {
  const p = `${dir}/${f}`
  return statSync(join(root, p)).isDirectory() ? screens(p) : p.endsWith('.tsx') ? [p] : []
})

describe('① لا نص للمطور في شاشة', () => {
  it('⚠️ لا «api:dev» ولا حساب الديمو فيما يراه من يفتح الإدارة', () => {
    const found = [...screens('src/pages'), ...screens('src/components')]
      .flatMap((f) => shownTexts(f).filter((t) => /api:dev|superadmin\.demo/.test(t)).map((t) => `${f}: ${t.slice(0, 60)}`))
    expect(found).toEqual([])
  })

  it('وتلميح الديمو الوحيد مشروط بوضع الديمو', () => {
    expect(code('src/services/api.ts')).toMatch(/const hint = platformConfigSnapshot\(\)\?\.demoMode\s*\?\s*" في الديمو: [^"]*superadmin\.demo/)
  })
})

describe('② ودورات المدرب بلا زر اللوح القديم', () => {
  it('⚠️ لا «اعتمد هذه الدورة بموادّها» ولا تأهيل من هنا — ودوراته المؤهلة تقرأ', () => {
    const page = code('src/pages/admin/TrainerMaterialsReview.tsx')
    expect(page).not.toContain('اعتمد هذه الدورة بموادّها')
    expect(page).not.toMatch(/apiPost\(/)
    expect(page).not.toMatch(/\/qualifications`/)
    expect(page).toMatch(/const qualified = materials\.filter\(\(r\) => r\.status === "qualified"/)
    expect(page).toMatch(/\{qualified\.map\(\(r\) => \(/)
  })
})

describe('③ ونموذج الملاحظات النصية ولاصقتها ذهبا', () => {
  it('⚠️ لا يصدر من الملاحظات إلا قراءتها', () => {
    expect(Object.keys(reviewNotes).sort()).toEqual(['ReviewNotesList', 'StageReviewNote'])
  })
})

describe('④ «من أين أبدأ؟»', () => {
  it('⚠️ «اعتمدها» بين «أضف دورة» و«انشرها» — إلى الطابور', () => {
    const dash = code('src/pages/admin/AdminDashboard.tsx')
    expect(dash).toMatch(
      /\{ label: "أضف دورة", to: "\/admin\/catalog" \},\s*\{ label: "اعتمدها", to: "\/admin\/catalog\?requests=1" \},\s*\{ label: "انشرها", to: "\/admin\/publishing" \},/,
    )
  })
})

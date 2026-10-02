/* ═══ لا «عرضك» في نصٍّ يصل إنسانا — قرارُ صاحب المنصّة (٢ أكتوبر ٢٠٢٦) ═══
 *
 * قال: «عرضك» غيرُ مناسبةٍ في الثقافة الأردنيّة (#405) — تُقرأ «عِرضك». فبُدّل بها
 * في الرسالتين يومئذ، ثمّ عُرض عليه ما بقي — اثنان وعشرون موضعا في الرسائل والصفحات
 * والبوّابة وسجلّ التغييرات — فاختار أن تُبدَّل كلُّها بـ«الاتفاقيّة» ويُحرَس ألّا
 * تعود («Option 1»). ومعها زرّا «اقرأ ووقّع»: صارا «افتح الاتفاقيّة» — يدلّان ولا
 * يأمران، كما قرّر في التذكير الأخير.
 *
 * ── ويُقرأ على البنية لا على ورود حرفٍ في ملفّ ──
 *
 * تُحلَّل الشيفرةُ بمحلّل TypeScript نفسِه، وتُقرأ نصوصُها وحدَها: السلاسلُ
 * والقوالبُ ونصوصُ JSX — لا التعليقات. فتعليقٌ يروي القرارَ ويذكر الكلمةَ (وهي
 * مذكورةٌ في رؤوسٍ تشرحه) لا يُسقطه، وجملةٌ تصل إنسانا تُسقطه. ويُثبَت هذا بعيّنةٍ
 * يُعرَف جوابُها قبل أن يُمسَح المستودَع، فلا يخضرّ ماسحٌ أعمى.
 *
 * والنطاقُ src وserver كلُّه لا ملفّاتُ المدرّب وحدَها: الكلمةُ لا تُقال لأحد،
 * وملفٌّ جديدٌ يخاطب مدرّبا لا يُنتظَر أن يُضاف إلى قائمة.
 */
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { conditionalOfferMail } from '../../../server/services/trainer-decision-mail'
import { renderMail } from '../../../server/services/mail-template'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

/** «عرضك» بحركاتها أو بلاها — ولا تُطابَق «عرضكم» ولا ما يتّصل بها من حرف */
const WORD = /عرض[ً-ْ]*ك(?![ء-ي])/

/** نصوصُ الشيفرة — لا تعليقاتُها */
function textsOf(file: string, src: string): { text: string; line: number }[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: { text: string; line: number }[] = []
  const visit = (n: ts.Node) => {
    let texts: string[] = []
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) texts = [n.text]
    else if (ts.isTemplateExpression(n)) texts = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)]
    else if (ts.isJsxText(n)) texts = [n.text]
    for (const text of texts) out.push({ text, line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 })
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

/** ملفّاتُ الشيفرة في src وserver — بلا الاختبارات */
function sources(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name !== 'node_modules' && name !== 'tests' && name !== '__tests__') sources(p, acc)
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) {
      acc.push(p)
    }
  }
  return acc
}

describe('لا «عرضك» في نصٍّ يصل إنسانا', () => {
  it('الماسحُ يقرأ النصوصَ ويتجاوز التعليقات — وإلّا فالحارسُ يقيس الفراغ', () => {
    const sample = [
      '/* عرضُك في تعليقٍ يروي القرار */',
      "const a = 'هذا عرضُك'",
      'const b = `حُدّث نصُّ عرضك — ${x}`',
      'const c = <h1>فقدتَ رابط عرضك؟</h1>',
      "const d = 'عرضكم وعرضكما'",
      '// عرضك في سطرٍ مُعلَّق',
    ].join('\n')
    const hits = textsOf('sample.tsx', sample).filter((t) => WORD.test(t.text)).map((t) => t.line)
    expect(hits, 'الماسحُ لا يرى النصَّ أو يرى التعليق').toEqual([2, 3, 4])
  })

  it('⚠️ ولا نصَّ في src ولا server يقول «عرضك»', () => {
    const files = [...sources(join(root, 'src')), ...sources(join(root, 'server'))]
    expect(files.length, 'لم تُقرأ ملفّاتُ الشيفرة — فالحارسُ يقيس الفراغ').toBeGreaterThan(200)
    const hits: string[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      if (!src.includes('عرض')) continue
      for (const t of textsOf(file, src)) {
        if (WORD.test(t.text)) hits.push(`${relative(root, file)}:${t.line} — ${t.text.trim().slice(0, 80)}`)
      }
    }
    expect(hits, 'عادت «عرضك» إلى نصٍّ يصل إنسانا — والبديلُ «الاتفاقيّة»').toEqual([])
  })

  /* وما يصل المدرّبَ فعلا يُقرأ كما يقرؤه هو: أوّلُ رسالةٍ تصله — عنوانُها ورأسُها
     وزرُّها ومتنُها مُخرَجا */
  it('⚠️ وأوّلُ رسالةٍ تصله «الاتفاقيّة التدريبيّة» — وزرُّها «افتح الاتفاقيّة» لا «اقرأ ووقّع»', () => {
    const mail = conditionalOfferMail({
      fullName: 'مدرّبٌ للاختبار', reference: 'TR-WORD-1', url: 'https://example.test/c/t',
      expiresAt: new Date('2026-10-12T09:00:00Z'), orientationOnAr: null, orientationUrl: null,
      deadlineOnAr: null, windowDays: 5, extensionDays: 2, requiredDocumentsAr: [],
      portalUrl: 'https://example.test/trainer',
    })
    const all = [mail.subject, mail.doc.heading, renderMail(mail.doc).text].join('\n')
    expect(all, 'قيل له «عرضك»').not.toMatch(WORD)
    expect(mail.subject).toContain('الاتفاقيّة التدريبيّة')
    const cta = mail.doc.blocks.find((b) => b.kind === 'cta') as { label?: string } | undefined
    expect(cta?.label, 'الزرُّ يأمر بالتوقيع').toBe('افتح الاتفاقيّة')
  })
})

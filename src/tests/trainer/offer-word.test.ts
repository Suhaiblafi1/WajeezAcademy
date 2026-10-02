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
 *
 * ── وأزرارُ الرسائل لا تأمر بالتوقيع (٢ أكتوبر ٢٠٢٦) ──
 *
 * بقيت بعد #408 ثلاثةُ أزرارٍ تقول «اقرأ… ووقّعه» (بريدُ إعادة التوقيع، وجوابُ طلب
 * التعديل، وعقدُ من لا شرطَ عليه) — فقال صاحبُ المنصّة: «Go ahead and fix the
 * buttons». فصارت «افتح الاتفاقيّة»، ويُحرَس كلُّ زرٍّ في رسالة (`kind: 'cta'`): لا
 * فعلَ توقيعٍ يأمر — «وقّع» و«ووقّعه» و«وقِّعْ» — أمّا ما يصف توقيعا وقع («الذي
 * وقّعتَه»، «الموقَّع») فخبرٌ لا أمر. وأزرارُ الشاشات خارجُه: زرُّ التوقيع في صفحة
 * التوقيع هو الفعلُ نفسُه، لا دعوةٌ إليه.
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

/** فعلُ التوقيع كلمةً تامّة: «وقّع» و«ووقّعه» و«وقِّعْ» و«وقّعي» — لا «وقّعتَه»
    (ما وقع) ولا «الموقَّع» (صفةٌ) ولا «التوقيع» (اسم) */
const SIGN_VERB = /(?:^|[^\u0621-\u064A])و?وق[\u064B-\u0652]*ع(?:[\u064B-\u0652]*(?:ه|ها|ي))?(?![\u0621-\u064A])/

/** نصوصُ أزرار الرسائل: `label` في كتلةٍ نوعُها `cta` — بكلّ فروعه إن كان شرطا */
function ctaLabelsOf(file: string, src: string): { text: string; line: number }[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: { text: string; line: number }[] = []
  const unwrap = (e: ts.Expression): ts.Expression =>
    ts.isAsExpression(e) || ts.isParenthesizedExpression(e) || ts.isSatisfiesExpression(e) ? unwrap(e.expression) : e
  const prop = (o: ts.ObjectLiteralExpression, name: string) => o.properties.find(
    (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText(sf) === name)
  const visit = (n: ts.Node) => {
    if (ts.isObjectLiteralExpression(n)) {
      const kind = prop(n, 'kind')
      const k = kind && unwrap(kind.initializer)
      const label = prop(n, 'label')
      if (k && ts.isStringLiteralLike(k) && k.text === 'cta' && label) {
        out.push(...textsOf(file, label.initializer.getText(sf)).map((t) => ({
          text: t.text, line: sf.getLineAndCharacterOfPosition(label.getStart()).line + 1,
        })))
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

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

  it('ماسحُ الأزرار يقرأ أزرارَ الرسائل وحدَها — ويفرّق الأمرَ من الخبر', () => {
    const sample = [
      "const a = { kind: 'cta', label: 'اقرأ ووقّع', href: u }",
      "const b = { kind: 'cta' as const, label: x ? 'اقرأ عقدك المحدَّث ووقّعه' : 'افتح الاتفاقيّة', href: u }",
      "const c = { kind: 'p', text: 'اقرأ ووقّع' }",
      "const d = { kind: 'cta', label: 'اقرأ العقدَ الذي وقّعتَه', href: u }",
      "const e = { kind: 'cta', label: 'افتح عقدك الموقَّع', href: u }",
      "const f = { kind: 'cta', label: 'وقِّعْ الآن', href: u }",
    ].join('\n')
    const hits = ctaLabelsOf('sample.ts', sample).filter((t) => SIGN_VERB.test(t.text)).map((t) => t.line)
    expect(hits, 'الماسحُ لا يرى الزرَّ، أو يرى غيرَه، أو لا يفرّق الأمرَ من الخبر').toEqual([1, 2, 6])
  })

  it('⚠️ ولا زرَّ في رسالةٍ يأمر بالتوقيع — «افتح الاتفاقيّة» لا «اقرأ ووقّع»', () => {
    const files = [...sources(join(root, 'src')), ...sources(join(root, 'server'))]
    let seen = 0
    const hits: string[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      if (!src.includes("'cta'")) continue
      for (const t of ctaLabelsOf(file, src)) {
        seen += 1
        if (SIGN_VERB.test(t.text)) hits.push(`${relative(root, file)}:${t.line} — ${t.text}`)
      }
    }
    expect(seen, 'لم يُقرأ زرٌّ — فالحارسُ يقيس الفراغ').toBeGreaterThan(10)
    expect(hits, 'زرٌّ يأمر بالتوقيع — والبديلُ «افتح الاتفاقيّة»').toEqual([])
  })

  /* ═══ ولا «العرض» في ما يقرؤه المدرّبُ عن اتفاقيّته (٢ أكتوبر ٢٠٢٦) ═══

     قرارُ صاحب المنصّة بعد #408: «نعم استبدل العرض أيضاً». فما يقرؤه المدرّبُ
     عن اتفاقيّته — رسائلُها وصفحةُ توقيعها وصفحةُ طلب رابطها ورسالةُ الرحيل —
     يقول «الاتفاقيّة» لا «العرض».

     والنطاقُ ملفّاتٌ بأسمائها لا المستودَعُ كلُّه، بقصد: «عرضُ الإسناد» (دعوةُ
     تدريس شعبة) شيءٌ آخر واسمُه باقٍ، وشاشاتُ الإدارة تخاطب الموظّف، ومتنُ
     العقد نصٌّ ملزِمٌ يُغيَّر بإصدارٍ لا بمسح. و«يُعرض» فعلا (يظهر) ليس هي. */
  const TRAINER_CONTRACT_FILES = [
    'server/services/trainer-decision-mail.ts',
    'server/services/trainer-departure.service.ts',
    'src/pages/ContractSign.tsx',
    'src/pages/ContractLinkRequest.tsx',
  ]
  /** «العرض» اسما: «العرضُ» و«عرضٌ» و«عرضا» و«عرضه» و«بالعرض» — لا «يُعرض» ولا «تعرض» */
  const OFFER_NOUN = /(?<![\u0621-\u0652])[وفبل]?(?:ال|لل)?عرض[\u064B-\u0652]*(?:ا|ه|ها)?(?![\u0621-\u064A])/

  it('ماسحُ «العرض» يرى الاسمَ ولا يرى الفعل', () => {
    const sample = [
      "const a = 'قرأتَ العرضَ ووقّعتَه'",
      "const b = 'إن كان لديك عرضٌ مفتوح'",
      "const c = 'لا يُعرض رقمُك لأحد'",
      "const d = 'وتعرض الأكاديمية الإسناد'",
      "const e = 'رابطا أحدثَ لهذا العرض'",
    ].join('\n')
    const hits = textsOf('sample.ts', sample).filter((t) => OFFER_NOUN.test(t.text)).map((t) => t.line)
    expect(hits, 'الماسحُ لا يرى الاسمَ أو يرى الفعل').toEqual([1, 2, 5])
  })

  it('⚠️ ولا «العرض» في رسائل الاتفاقيّة وصفحاتها — «الاتفاقيّة»', () => {
    const hits: string[] = []
    for (const rel of TRAINER_CONTRACT_FILES) {
      const file = join(root, rel)
      for (const t of textsOf(file, readFileSync(file, 'utf8'))) {
        if (OFFER_NOUN.test(t.text)) hits.push(`${rel}:${t.line} — ${t.text.trim().slice(0, 80)}`)
      }
    }
    expect(hits, 'عادت «العرض» إلى ما يقرؤه المدرّبُ عن اتفاقيّته').toEqual([])
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

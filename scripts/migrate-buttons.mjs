#!/usr/bin/env node
/* ترحيلُ الأزرار إلى `ui/Button` — الميكانيكا لأداة، والحكمُ بالعين بعدها.
 *
 *   node scripts/migrate-buttons.mjs <ملفّ…>          يعرض ولا يكتب
 *   node scripts/migrate-buttons.mjs --apply <ملفّ…>  ينفّذ
 *
 * ── ما تقرؤه الأداة، وما لا تقرؤه ──
 *
 * النبرةُ من الصيغة: التعبئةُ الذهبيّةُ فعلُ الصفحة الأوّل، والفيروزيّةُ
 * الفعلُ المُثبِت، والحدُّ بديلٌ، والأحمرُ ما لا يُتراجَع عنه.
 *
 * ⚠️ **وهي تقرأ ما كُتب، لا ما كان ينبغي.** فزرٌّ ذهبيٌّ في موضعٍ لا يستحقّ
 * الذهبَ يبقى `primary` بعد الترحيل — والقاعدةُ «رئيسيٌّ واحدٌ في الشاشة»
 * تُراجَع بالعين شاشةً شاشة، لا بنمط.
 *
 * ولا تُلمَس صيغةٌ مشروطة (`${x ? … : …}`): تلك حالةٌ تُقرأ، لا نبرةٌ ثابتة.
 * ولا زرٌّ لا انحناءَ كاملَ له (`rounded-full`) — فقد يكون شيئا آخر.
 */

import { readFileSync, writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (files.length === 0) {
  console.error('الاستعمال: node scripts/migrate-buttons.mjs [--apply] <ملفّ…>')
  process.exit(2)
}

function toneFor(cls) {
  if (/\bbg-gold\b/.test(cls)) return 'primary'
  if (/\bbg-teal\b/.test(cls)) return 'confirm'
  if (/\bborder-(?:red|rose)-/.test(cls)) return 'danger'
  if (/\bborder\b/.test(cls)) return 'secondary'
  return 'ghost'
}

/* الحجمُ من الحشو والخطّ — والصغيرُ هو ما كُتب بـ`py-1.5` أو خطٍّ أدقّ */
function sizeFor(cls) {
  return /\bpy-1(?:\.5)?\b/.test(cls) || /\btext-\[11px\]\b/.test(cls) ? 'sm' : 'md'
}

/** ما يبقى بعد نزع ما صار من شأن الزرّ */
const CONSUMED = new RegExp(
  '^(cursor-pointer|inline-flex|flex|items-center|justify-center|rounded-full|transition'
  + '|gap-[\\d.]+|px-\\d+|py-[\\d.]+|text-(xs|sm|\\[1[0-3]px\\])|font-(bold|black)'
  + '|bg-(gold|teal)(-light)?(\\/\\d+)?|text-on-(gold|teal)|text-foreground|text-muted-foreground'
  + '|border|border-\\w+(-\\d+)?\\/\\[?[\\d.]+\\]?|text-(red|danger|emerald|amber)-?\\w*'
  + '|hover:[\\w:/\\[\\].-]+|disabled:opacity-40)$',
)
const residue = (cls) => cls.split(/\s+/).filter((c) => c && !CONSUMED.test(c)).join(' ')

/** نهايةُ الوسم المفتوح بالمشي بالحرف — `=>` داخل خاصّيّةٍ لا تخدعه */
function tagEnd(src, from) {
  let depth = 0
  let quote = null
  for (let i = from; i < src.length; i += 1) {
    const c = src[i]
    if (quote) { if (c === quote) quote = null; continue }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue }
    if (c === '{') depth += 1
    else if (c === '}') depth -= 1
    else if (depth === 0 && c === '/' && src[i + 1] === '>') return { end: i + 2, self: true }
    else if (depth === 0 && c === '>') return { end: i + 1, self: false }
  }
  return null
}

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  let out = ''
  let cursor = 0
  let done = 0

  const re = /<button\b/g
  let m
  while ((m = re.exec(src))) {
    if (m.index < cursor) continue
    const t = tagEnd(src, m.index + 7)
    if (!t || t.self) continue
    const attrs = src.slice(m.index + 7, t.end - 1)
    const cm = /(^|\s)className="([^"]*)"/.exec(attrs)
    if (!cm) continue
    const cls = cm[2]
    if (!/\brounded-full\b/.test(cls) || !/\bcursor-pointer\b/.test(cls)) continue
    if (cls.includes('${')) continue

    /* الوسمُ المغلق: الأزرارُ لا تتداخل، فأوّلُ `</button>` هو وسمُه */
    const closeAt = src.indexOf('</button>', t.end)
    if (closeAt < 0) continue

    const rest = residue(cls)
    const attrsOut = [
      `tone="${toneFor(cls)}"`,
      sizeFor(cls) === 'sm' ? 'size="sm"' : '',
      attrs.slice(0, cm.index).trim(),
      rest ? `className="${rest}"` : '',
      attrs.slice(cm.index + cm[0].length).trim(),
    ].filter(Boolean).join(' ')

    out += src.slice(cursor, m.index)
    out += `<Button ${attrsOut}>`
    out += src.slice(t.end, closeAt)
    out += '</Button>'
    cursor = closeAt + '</button>'.length
    done += 1
  }
  out += src.slice(cursor)

  console.log(`${file}: ${done} زرّا`)
  if (APPLY && done > 0) writeFileSync(file, out, 'utf8')
}

if (!APPLY) console.log('\n(عرضٌ فقط — أضِف --apply للتنفيذ)')

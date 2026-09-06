#!/usr/bin/env node
/* أداةُ ترحيلٍ إلى سلّم الأسطح — تُشغَّل بيد، وتُراجَع نتيجتُها بالعين.
 *
 * ليست جزءا من البناء ولا من الاختبارات. غرضُها واحد: تحويلُ
 * `<div className="rounded-… border …">` إلى `Panel` أو `Card` **مع وسمِها
 * المغلق** — وهو ما لا يصلح له بحثٌ واستبدالٌ نصّيّ: الوسمُ المغلق قد يبعد
 * أربعين سطرا وبينه عشرةُ `</div>` ليست له.
 *
 * فتُعدّ الطبقات: من الوسم المفتوح، `<div` يزيد و`</div>` ينقص، والصفرُ هو
 * وسمُه. وما لا يُطابَق يُترك كما هو ويُذكَر في التقرير — **لا تخمين**.
 *
 *   node scripts/migrate-surfaces.mjs <ملفّ…>          يعرض ولا يكتب
 *   node scripts/migrate-surfaces.mjs --apply <ملفّ…>  ينفّذ
 *
 * ⚠️ وما تكتبه هذه الأداةُ يُراجَع: النبرةُ (`tone`) والدرجةُ (`Panel` أم
 * `Card`) قرارُ تصميمٍ لا يُؤخذ من طولِ الحشو. فهي تُنجز الميكانيكا، ويبقى
 * الحكمُ على من يقرأ.
 */

import { readFileSync, writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (files.length === 0) {
  console.error('الاستعمال: node scripts/migrate-surfaces.mjs [--apply] <ملفّ…>')
  process.exit(2)
}

/* الدرجةُ من الانحناء: الأوسعُ قسمٌ، والأضيقُ عنصرٌ داخله. وهو ما اتّفق عليه
   المستودَعُ فعلا قبل التوحيد، فيُحترَم ولا يُقلَب. */
const LEVEL = [
  { re: /\brounded-3xl\b/, tag: 'Panel' },
  { re: /\brounded-2xl\b/, tag: 'Card' },
  /* الأضيقُ غاطسٌ: تفصيلٌ داخل عنصر. وأرضيّةُ الورق علامتُه في المستودَع */
  { re: /\brounded-xl\b/, tag: 'Inset' },
]

/* ═══ النبرة تُقرأ من اللون ═══

   اللونُ في هذا المستودَع لغةٌ متّسقة: الأحمرُ خطأٌ، والذهبيُّ تنبيه،
   والأخضرُ نجاح، والفيروزيُّ إبراز. فتُقرأ منه `tone` بدل أن تُكتب بيد.

   ⚠️ وحدُّه: يقرأ **ما قصده الكاتبُ حين كتبه**. فإن كان اللونُ خطأً في
   الأصل بقي خطأً بعد الترحيل — الأداةُ توحّد الصيغةَ لا تراجع الحكم. */
const TONES = [
  { re: /\b(?:border|bg|text)-(?:red|rose)-/, tone: 'danger' },
  { re: /\b(?:border|bg|text)-(?:gold|amber)/, tone: 'warn' },
  { re: /\b(?:border|bg|text)-(?:emerald|green)-/, tone: 'positive' },
  { re: /\b(?:border|bg|text)-(?:teal|sky)/, tone: 'accent' },
]

function toneFor(cls) {
  return TONES.find((t) => t.re.test(cls))?.tone ?? null
}

/** هل هذه الصيغةُ سطحٌ نُرحّله؟ — حدٌّ وانحناءٌ وأرضيّةٌ محايدة */
function levelFor(cls) {
  if (!/\bborder\b/.test(cls)) return null
  /* لا تُرحَّل صيغةٌ فيها شرطٌ: `${x ? "…" : "…"}` قرارٌ لا نمط */
  if (cls.includes('${')) return null
  let tag = LEVEL.find((l) => l.re.test(cls))?.tag ?? null
  /* أرضيّةُ الورق غاطسةٌ مهما كان انحناؤها — هي التفصيلُ داخل العنصر */
  if (tag && /\bbg-(?:paper|surface)/.test(cls)) tag = 'Inset'
  return tag
}

/* الوسومُ التي تُرحَّل. وغيرُ `div` يُحفظ في `as` — فالدلالةُ لا تُهدر:
   `article` عنصرٌ قائمٌ بذاته، و`li` صفٌّ في قائمة، وقارئُ الشاشة يقرؤها. */
const TAGS = ['div', 'article', 'section', 'li']

/** ما يبقى في `className` بعد نزع ما صار من شأن السطح */
function residue(cls) {
  return cls
    .split(/\s+/)
    .filter((c) => c && !new RegExp(
      '^(rounded-(xl|2xl|3xl)|border|border-\\w+(-\\d+)?\\/\\[?[\\d.]+\\]?'
      + '|bg-\\w+(-\\d+)?\\/\\[?[\\d.]+\\]?|p-[3-6])$',
    ).test(c))
    .join(' ')
}

/* ═══ قارئُ الوسم المفتوح ═══

   لا يصلح تعبيرٌ نمطيٌّ هنا: خاصّيّةٌ واحدةٌ فيها `onClick={() => …}` تحمل
   `>` فيظنّها التعبيرُ نهايةَ الوسم فيقطعه في منتصفه. فيُمشى بالحرف: تُعدُّ
   الأقواسُ المعقوفة وتُتخطّى النصوص، والنهايةُ `>` على عمق صفر. */
function* openTags(src) {
  const re = new RegExp(`<(${TAGS.join('|')})\\b`, 'g')
  let m
  while ((m = re.exec(src))) {
    const name = m[1]
    let i = m.index + name.length + 1
    let depth = 0
    let quote = null
    let end = -1
    for (; i < src.length; i += 1) {
      const c = src[i]
      if (quote) { if (c === quote) quote = null; continue }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue }
      if (c === '{') depth += 1
      else if (c === '}') depth -= 1
      else if (c === '>' && depth === 0) { end = i + 1; break }
      else if (c === '/' && depth === 0 && src[i + 1] === '>') { end = -2; break }
    }
    if (end < 0) continue
    const attrs = src.slice(m.index + name.length + 1, end - 1)
    const cm = /(^|\s)className="([^"]*)"/.exec(attrs)
    if (!cm) continue
    yield {
      index: m.index,
      name,
      end,
      cls: cm[2],
      before: attrs.slice(0, cm.index).trim(),
      after: attrs.slice(cm.index + cm[0].length).trim(),
    }
  }
}

/* يجد الوسمَ المغلقَ بعدِّ التداخل.
 *
 * ⚠️ والوسمُ المغلقُ على نفسه (`<div … />`) **لا يُعدّ فتحا** — وهذا عطبٌ وقع
 * فعلا: عُدَّ فتحا فأزاح الوسمَ المغلقَ درجةً، فأُغلق `Panel` خارج الحلقة
 * التي فُتح فيها. ولم يمسكه `tsc` — أمسكه المحلّلُ في `eslint` وحدَه.
 *
 * فتُقرأ نهايةُ كلّ وسمٍ بالمشي بالحرف كما في `openTags`، ويُنظَر: أهو
 * `/>` أم `>`؟ */
function matchClose(src, openEnd, name) {
  const token = new RegExp(`<${name}\\b|</${name}>`, 'g')
  token.lastIndex = openEnd
  let depth = 1
  let m
  while ((m = token.exec(src))) {
    if (m[0].startsWith('</')) {
      depth -= 1
      if (depth === 0) return { start: m.index, end: m.index + m[0].length }
      continue
    }
    /* وسمٌ مفتوح: يُمشى إلى نهايته ليُعرف أيُغلق نفسَه */
    let i = m.index + name.length + 1
    let d = 0
    let quote = null
    let selfClosing = false
    for (; i < src.length; i += 1) {
      const c = src[i]
      if (quote) { if (c === quote) quote = null; continue }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue }
      if (c === '{') d += 1
      else if (c === '}') d -= 1
      else if (d === 0 && c === '/' && src[i + 1] === '>') { selfClosing = true; break }
      else if (d === 0 && c === '>') break
    }
    token.lastIndex = i + 1
    if (!selfClosing) depth += 1
  }
  return null
}

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  let out = ''
  let cursor = 0
  let done = 0
  const skipped = []

  for (const m of openTags(src)) {
    const tag = levelFor(m.cls)
    if (!tag) continue
    const close = matchClose(src, m.end, m.name)
    if (!close) { skipped.push(`سطر ${src.slice(0, m.index).split('\n').length}: لا وسمَ مغلقا`); continue }
    if (m.index < cursor) continue /* داخل سطحٍ رُحّل بالفعل — يُترك لدورةٍ ثانية */

    const asAttr = m.name === 'div' ? '' : `as="${m.name}"`
    const tone = toneFor(m.cls)
    const toneAttr = tone ? `tone="${tone}"` : ''
    const cls = residue(m.cls)
    const rest = [asAttr, toneAttr, m.before, cls ? `className="${cls}"` : '', m.after]
      .filter(Boolean).join(' ')
    out += src.slice(cursor, m.index)
    out += rest ? `<${tag} ${rest}>` : `<${tag}>`
    out += src.slice(m.end, close.start)
    out += `</${tag}>`
    cursor = close.end
    done += 1
  }
  out += src.slice(cursor)

  console.log(`${file}: ${done} سطحا${skipped.length ? ` · تُخطّي ${skipped.length}` : ''}`)
  for (const s of skipped) console.log(`   ⚠ ${s}`)
  if (APPLY && done > 0) writeFileSync(file, out, 'utf8')
}

if (!APPLY) console.log('\n(عرضٌ فقط — أضِف --apply للتنفيذ)')

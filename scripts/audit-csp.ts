/* بوّابةُ الـCSP — `unsafe-inline` في السكربتات تُلغي الحمايةَ التي جاءت لأجلها.

   كانت سياسةُ المحتوى تقول `script-src 'self' 'unsafe-inline'`. والشقُّ الثاني
   يقول للمتصفّح: **نفّذ أيَّ سكربتٍ مكتوبٍ في الصفحة**. فأيُّ نصٍّ يُحقن في
   الصفحة — من حقلٍ لم يُهرَّب، أو ردٍّ يُصيَّر خامًا — يُنفَّذ بصلاحيّة الموقع
   كاملةً: يقرأ جلسةَ المستخدم ويُرسل حيث شاء. وهذا هو الهجومُ الذي وُضعت
   السياسةُ لمنعه أصلا، فبقيت السياسةُ اسما بلا أثر في أخطر بنودها.

   ولا يكفي حذفُ `'unsafe-inline'`: في `index.html` سكربتان لهما عملٌ لا
   يُنقَل إلى الحزمة —

     · **المظهرُ قبل أوّل رسم**: يُقرأ الاختيارُ ويُوضع قبل أن تُرسَم الصفحة،
       فلا وميضَ أبيضَ ثمّ داكن. ولو كان في الحزمة لجاء بعد الرسم.
     · **شبكةُ أمان الحزمة المحذوفة** (بيضُ صفحات سفاري): صفحةٌ مخزّنةٌ تطلب
       حزمةً حُذفت بعد نشرٍ جديد. والإنقاذُ لا يمكن أن يكون في الحزمة — هي
       التي لم تصل.

   فالعلاجُ البصمة: يُسمّى كلُّ سكربتٍ داخليٍّ ببصمة محتواه (`sha256-…`)،
   فيُنفَّذ هو وحدَه ويُرفض كلُّ ما سواه.

   وثمنُ البصمة أنّها تفترق عن الواقع بصمت: يُعدَّل سطرٌ في `index.html`، أو
   يتغيّر تصغيرُ الأداة بترقيةٍ، فتفترق البصمةُ عن المبنيّ — فتُحجَب
   السكربتات، ويعود الوميضُ وتسقط شبكةُ الأمان، ولا شيءَ يقول. فهذه البوّابة
   تقول.

     npx tsx scripts/audit-csp.ts            تقرير
     npx tsx scripts/audit-csp.ts --check    يسقط عند أيّ فرق
     npx tsx scripts/audit-csp.ts --write    يكتب البصمات في vercel.json
*/

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const SRC_HTML = join(ROOT, 'index.html')
const BUILT_HTML = join(ROOT, 'dist/index.html')
const VERCEL = join(ROOT, 'vercel.json')

/** سكربتٌ داخليّ: بلا `src`. والبصمةُ على المحتوى كما يراه المتصفّح — أي المبنيّ لا المصدر */
const INLINE = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g

/** `application/ld+json` بياناتٌ لا تُنفَّذ، فلا يحكمها `script-src` */
function isExecutable(attrs: string): boolean {
  const m = /type\s*=\s*"([^"]+)"/.exec(attrs)
  if (!m) return true
  const t = m[1].trim().toLowerCase()
  return t === 'module' || t === 'text/javascript' || t === 'application/javascript'
}

function hashesOf(html: string): string[] {
  const out: string[] = []
  for (const m of html.matchAll(INLINE)) {
    if (!isExecutable(m[1])) continue
    out.push(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`)
  }
  return out
}

interface VercelConfig {
  headers?: { source: string; headers: { key: string; value: string }[] }[]
}

function cspEntry(cfg: VercelConfig) {
  for (const rule of cfg.headers ?? []) {
    for (const h of rule.headers) {
      if (h.key.toLowerCase() === 'content-security-policy') return h
    }
  }
  return null
}

function main() {
  const write = process.argv.includes('--write')
  const check = process.argv.includes('--check')

  if (!existsSync(BUILT_HTML)) {
    console.error('\n✗ لا مخرَجَ مبنيّ — البصمةُ تُحسب على ما يراه المتصفّح.\n  شغّل `npm run build` أوّلا.\n')
    process.exit(check || write ? 1 : 0)
  }
  /* المبنيُّ الأقدمُ من مصدره يعطي بصمةً لِما لم يُنشَر */
  if (statSync(BUILT_HTML).mtimeMs < statSync(SRC_HTML).mtimeMs) {
    console.error('\n✗ `dist/index.html` أقدمُ من `index.html` — أعِد البناء قبل الفحص.\n')
    process.exit(check || write ? 1 : 0)
  }

  const hashes = hashesOf(readFileSync(BUILT_HTML, 'utf8'))
  const raw = readFileSync(VERCEL, 'utf8')
  const cfg = JSON.parse(raw) as VercelConfig
  const entry = cspEntry(cfg)
  if (!entry) {
    console.error('\n✗ لا ترويسةَ Content-Security-Policy في vercel.json\n')
    process.exit(1)
  }

  const want = `script-src 'self' ${hashes.join(' ')}`
  const current = /script-src[^;]*/.exec(entry.value)?.[0].trim() ?? ''

  console.log(`\nبوّابةُ سياسة المحتوى — ${hashes.length} سكربتا داخليّا في المبنيّ`)

  if (current === want) {
    console.log('✅ بصماتُ السكربتات مطابقةٌ لما سيُنشَر.\n')
    return
  }

  if (write) {
    /* تُبدَّل الجملةُ في النصّ الخامّ لا بإعادة تسلسل الملفّ: إعادةُ التسلسل
       تُعيد تنسيقَه كلَّه فيصير فرقُ سطرٍ واحدٍ فرقَ أربعين سطرا لا يُراجَع. */
    const next = raw.replace(/script-src[^;]*/, want)
    if (next === raw) {
      console.error('\n✗ تعذّر إيجادُ جملة script-src في نصّ vercel.json\n')
      process.exit(1)
    }
    writeFileSync(VERCEL, next)
    console.log('✍️  كُتبت البصمات في vercel.json:')
    console.log(`   ${want}\n`)
    return
  }

  console.log('\n✗ سياسةُ المحتوى تفترق عن المبنيّ:\n')
  console.log(`  فيها : ${current}`)
  console.log(`  والصحيح: ${want}\n`)
  console.log('  العلاج: npx tsx scripts/audit-csp.ts --write\n')
  if (check) process.exit(1)
}

main()

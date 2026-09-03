/* سحبُ فهرس مكتبة وجيز — نصفُ الجسر الثاني للبند ح-٨.

   §٧ من سياسة التأليف تُلزم الإحالةَ إلى ملخّصٍ من المكتبة وتمنع اختراعَ
   عنوان. ولا سبيلَ إلى الاثنين معا بلا فهرسٍ يُقرأ: فمن لا يعرف ما في
   المكتبة لا يُحيل، ومن أحال بلا فهرسٍ لم يتحقّق أحدٌ من إحالته.

   وحتّى تُربط واجهةُ «وجيز مهارات» يبقى الفهرسُ فارغا، والبوّابةُ تقول
   «معلَّق» ولا تُسقط — والاثنتان والخمسون وحدةً المؤلَّفةُ بلا إحالةٍ
   واحدةٍ ليست مخالفةً بل سكوتٌ صحيح: السكوتُ أصدقُ من عنوانٍ لا يُتحقَّق
   منه.

   ── العقدُ المتوقَّع من الواجهة ──

   الطلب:  GET $WAJEEZ_LIBRARY_API_URL
           Authorization: Bearer $WAJEEZ_LIBRARY_API_TOKEN   (إن وُجد)

   الجواب — أيُّ الصور الثلاث تُقبل:
     { "items": [ … ] }                 · { "data": [ … ] }        · [ … ]

   والعنصرُ الواحد، وما يُقرأ منه (وما سواه يُهمَل):
     {
       "id":        "wj-123",                       ← أو `slug` أو `code`
       "title_ar":  "الجرأة على القيادة",            ← أو `title`
       "author_ar": "برينيه براون",                  ← أو `author`
       "url":       "https://wajeez.co/summary/123", ← اختياري
       "topics_ar": ["القيادة", "المحادثات الصعبة"]  ← اختياري، للاقتراح
     }

   والصفحاتُ تُتبَع بـ`next` أو `next_url` إن وُجدت، حتّى عشرين صفحة.

   الاستعمال:
     WAJEEZ_LIBRARY_API_URL=… npx tsx scripts/sync-wajeez-library.ts
     npx tsx scripts/sync-wajeez-library.ts --check    يقول أمربوطةٌ أم معلَّقة
*/

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LibraryIndex, LibraryItem } from '../src/application/content/library'

const MIRROR = join(process.cwd(), 'src/data/library/wajeez-library.json')
const MAX_PAGES = 20

function readMirror(): LibraryIndex {
  return JSON.parse(readFileSync(MIRROR, 'utf8')) as LibraryIndex
}

/* أسماءُ الحقول تُقرأ بأكثر من صورة — لأنّ العقدَ لم يُثبَّت بعد، ولا يُعاد
   بناءُ السكربت لأنّ الحقلَ جاء `title` لا `title_ar`. */
function toItem(raw: Record<string, unknown>): LibraryItem | null {
  const s = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string).trim() : '')
  const id = s('id') || s('slug') || s('code')
  const titleAr = s('title_ar') || s('title')
  if (!id || !titleAr) return null
  const authorAr = s('author_ar') || s('author')
  const url = s('url') || s('link')
  const topics = raw['topics_ar'] ?? raw['topics'] ?? raw['tags']
  const topicsAr = Array.isArray(topics)
    ? topics.filter((t): t is string => typeof t === 'string')
    : undefined
  return {
    id,
    titleAr,
    ...(authorAr ? { authorAr } : {}),
    ...(url ? { url } : {}),
    ...(topicsAr && topicsAr.length > 0 ? { topicsAr } : {}),
  }
}

function itemsOf(payload: unknown): { items: LibraryItem[]; next: string | null } {
  const body = (payload ?? {}) as Record<string, unknown>
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(body['items'])
      ? (body['items'] as unknown[])
      : Array.isArray(body['data'])
        ? (body['data'] as unknown[])
        : []
  const next = typeof body['next'] === 'string'
    ? (body['next'] as string)
    : typeof body['next_url'] === 'string'
      ? (body['next_url'] as string)
      : null
  const items = list
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    .map(toItem)
    .filter((x): x is LibraryItem => x !== null)
  return { items, next }
}

async function main() {
  const url = process.env.WAJEEZ_LIBRARY_API_URL?.trim()
  const token = process.env.WAJEEZ_LIBRARY_API_TOKEN?.trim()
  const check = process.argv.includes('--check')

  if (check) {
    const mirror = readMirror()
    if (mirror.items.length === 0) {
      console.log('\n⏳ فهرسُ مكتبة وجيز معلَّق — بانتظار ربط واجهة «وجيز مهارات».')
      console.log('   والبوّابةُ لا تُسقط على غياب الإحالة حتّى يُربط.')
      console.log('   وحين يُربط: WAJEEZ_LIBRARY_API_URL=… npx tsx scripts/sync-wajeez-library.ts\n')
      return
    }
    console.log(`\n✅ الفهرسُ مربوط: ${mirror.items.length} ملخّصا · المصدر ${mirror.source} · ${mirror.fetchedAt}\n`)
    return
  }

  if (!url) {
    console.error('\n⏳ لا `WAJEEZ_LIBRARY_API_URL` — والفهرسُ يبقى معلَّقا كما هو.')
    console.error('   العقدُ المتوقَّعُ موصوفٌ في رأس هذا الملفّ؛ ضعِ العنوانَ ثمّ أعِد.\n')
    process.exit(2)
  }

  const all = new Map<string, LibraryItem>()
  let at: string | null = url
  for (let page = 0; at && page < MAX_PAGES; page++) {
    const res: Response = await fetch(at, {
      headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    })
    if (!res.ok) {
      console.error(`\n✗ الواجهة ردّت ${res.status} على ${at}`)
      console.error('  ولا يُكتب فهرسٌ ناقصٌ فوق فهرسٍ قائم — أصلح الاتّصال ثمّ أعِد.\n')
      process.exit(1)
    }
    const { items, next } = itemsOf(await res.json())
    for (const it of items) all.set(it.id, it)
    at = next && next !== at ? next : null
  }

  if (all.size === 0) {
    console.error('\n✗ الواجهةُ ردّت بلا عناصرَ مفهومة — راجع صورةَ الجواب في رأس الملفّ.\n')
    process.exit(1)
  }

  const next: LibraryIndex = {
    source: new URL(url).host,
    fetchedAt: new Date().toISOString(),
    items: [...all.values()].sort((a, b) => a.titleAr.localeCompare(b.titleAr, 'ar')),
  }
  writeFileSync(MIRROR, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  console.log(`\n✅ كُتب الفهرس: ${next.items.length} ملخّصا من ${next.source}.`)
  console.log('   وبوّابةُ التأليف الآن تردّ كلَّ عنوانٍ يُذكر ولا وجودَ له فيه.\n')
}

main().catch((e: unknown) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : String(e)}\n`)
  process.exit(1)
})

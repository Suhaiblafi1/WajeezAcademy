/* ك-٣ في الشاشة — «بلا مهارات» تُقال قبل الحاجز لا عنده.

   حاجزُ النشر يمنع دورةً بلا مهارة، وهو الصواب. لكنّ مَن يقرأ قائمةَ
   الدورات لا يرى شيئا يميّزها، فيكتشف المنعَ **بعد أسبوعٍ عند زرّ النشر**
   ولا يعرف أيَّ دورةٍ من إحدى وثمانين هي السبب.

   فالعلامةُ في الصفّ، والبابُ بجوارها. وهذا ما يُحرَس هنا — على البنية:
   أنّ العلامةَ معلّقةٌ بـ`skillCount === 0` لا بنصٍّ يُكتب، وأنّ الحفظَ
   ينادي البابَ الحقيقيَّ لا يحسب شيئا عنده. */

import { describe, expect as vexpect, it } from 'vitest'
/* ما يُفحص بلا تشكيلٍ إعرابيّ — بعضُ ما يُقرأ هنا بعد «اللغة البيضاء» وبعضُه (الخادمُ والعقودُ والتشخيص) قبلها */
const plainDeep = (v: unknown): unknown =>
  typeof v === 'string' ? plainAr(v) : Array.isArray(v) ? v.map(plainDeep)
    : v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plainDeep(x)])) : v
const expect = Object.assign((v: unknown, m?: string) => vexpect(plainDeep(v), m), vexpect) as typeof vexpect
import { readFileSync as readRaw } from 'node:fs'
import { plainAr } from '@/application/text/plain-ar'
/* ما يُقرأ من الملفّات بلا تشكيلٍ إعرابيّ — بعضُها بعد «اللغة البيضاء» وبعضُها (العقود والخادم) قبلها */
function readFileSync(p: Parameters<typeof readRaw>[0]): Buffer
function readFileSync(p: Parameters<typeof readRaw>[0], e: BufferEncoding | { encoding: BufferEncoding }): string
function readFileSync(p: Parameters<typeof readRaw>[0], e?: BufferEncoding | { encoding: BufferEncoding }): string | Buffer {
  return e === undefined ? readRaw(p) : plainAr(String(readRaw(p, e)))
}
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const src = readFileSync(join(root, 'src/pages/admin/CatalogAdmin.tsx'), 'utf8')
/* التعليقاتُ تشرح القاعدةَ فتسمّيها — والفحصُ على ما يُنفَّذ لا على شرحه */
const code = src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

/* ═══ قسمُ الدورات وحدَه ═══

   الشاشةُ تعرض خمسةَ أصنافٍ، وما يخصّ غيرَها لا يُحاكَم هنا. وحدُّه القسمُ
   الذي يليه لا أوّلُ `)}` يصادفه القارئ — فالقسمُ فيه أقواسٌ متداخلة، وأوّلُ
   إغلاقٍ يقع داخلَه لا عند طرفه. وقد وقع ذلك فعلا في أوّل صياغة: الحارسُ
   التقط شظيّةً من القسم فاحمرّ على شيفرةٍ سليمةٍ موجودةٍ بعدَها. */
const coursesBlock = /\{browse === "courses" && \(([\s\S]*?)\{browse === "skills" && \(/.exec(code)?.[1] ?? ''

describe('صفّ الدورة يقول لماذا لن تنشر', () => {
  it('قسم الدورات موجود أصلا — وإلّا حرس ما بعده الفراغ', () => {
    expect(coursesBlock, 'قسم تصفّح الدورات غير موجود').toBeTruthy()
    expect(coursesBlock.length).toBeGreaterThan(400)
  })

  /* ═══ وهذا الحارسُ خضِرَ مرّةً وهو لا يحرس ═══

     كان يطلب ورودَ `skillCount === 0` في القسم. فحُذفت العلامةُ كلُّها
     **وبقي أخضر**: الصيغةُ نفسُها مكتوبةٌ في نبرة الزرّ
     (`tone={c.skillCount === 0 ? …}`)، فطابقها ومضى.

     وهو العطبُ الذي يحذّر منه المستودَع نصّا: حارسٌ يطابق حرفا في ملفٍّ لا
     بنيةً فيه. فصار الفحصُ على **التصييرِ الشرطيّ** — `&&` يتبع الشرطَ —
     وعلى أنّ ما يُصيَّر علامةٌ تُرى، لا نبرةُ زرٍّ ولا فراغ. */
  it('والعلامة تصيّر عند الصفر — لا نبرة زرّ وحدها', () => {
    const at = coursesBlock.indexOf('skillCount === 0 &&')
    expect(at, 'لا تصيير شرطيّ على «بلا مهارات» — فالصفّان سواء').toBeGreaterThan(-1)
    /* وما يُصيَّر علامةٌ تُرى: `Chip` في مدى ما يُصيَّر لا بعد الصفّ كلِّه */
    expect(
      coursesBlock.slice(at, at + 220),
      'الشرط قائم ولا يصيّر تحته شيء يقرأ',
    ).toContain('Chip')
  })

  it('وباب الإصلاح ينادي المسار الحقيقيّ', () => {
    expect(coursesBlock).toMatch(/apiPut\(`\/api\/admin\/catalog\/courses\/\$\{c\.id\}\/skills`/)
  })

  /* ═══ ولا تعيد الشاشةُ بناءَ القاعدة عندها ═══

     قاعدةُ «كم مهارةً تكفي» يملكها حاجزُ النشر في الخادم. فلو كتبت الشاشةُ
     عتبتَها بنفسها صار للقاعدة صاحبان — ويمضيان معا حتّى يتغيّر أحدُهما.
     والمسموحُ هنا مقارنةٌ بالصفر وحدَها: «أفارغةٌ هي؟» سؤالُ عرضٍ لا حكمُ
     نشر. */
  it('ولا عتبة عدد مكتوبة في الشاشة', () => {
    const thresholds = [...coursesBlock.matchAll(/skillCount\s*[<>]=?\s*(\d+)/g)].map((m) => m[0])
    expect(thresholds, `عتبة للمهارات في الشاشة: ${thresholds.join('، ')}`).toEqual([])
  })

  it('والاستبدال يقال للمستخدم — فمن ظنّها إضافة فكّ ما لم يقصد', () => {
    expect(coursesBlock).toContain('يستبدل')
  })
})

describe('والصلاحية لا الدور', () => {
  it('الباب يخفى عمّن لا يملك تعديل الدورات', () => {
    expect(code, 'محرّر المهارات معروض للجميع').toContain('canEditCourse')
    expect(code).toContain('catalog.course.edit')
    /* ولا فحصَ دورٍ في الشاشة — الصلاحيةُ وحدَها */
    const roles = [...code.matchAll(/roles\??\.(includes|some)\(/g)].map((m) => m[0])
    expect(roles, `الشاشة تفحص الأدوار: ${roles.join('، ')}`).toEqual([])
  })
})

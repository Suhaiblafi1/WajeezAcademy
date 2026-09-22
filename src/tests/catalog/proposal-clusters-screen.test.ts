/* تقريرُ التجميع يُقرأ في الشاشة — لا بـSSH ودوكر.

   ─────────── ما وُضع له هذا الحارس ───────────

   القواعدُ في `src/application/catalog/proposal-clusters.ts` منذ ٢٢ سبتمبر
   ٢٠٢٦، ومُختبَرةٌ ومنقوضةٌ هناك. وكان بابُها الوحيدُ سكربتا يُنادى على
   الخادم بـSSH ودوكر — فحاول صاحبُ المنصّة أن يقرأه ثلاث مرّاتٍ ولم يبلغه:
   شغّله من مجلّد المنزل، ثمّ من جهازٍ لا دوكرَ فيه.

   وتقريرٌ **يُقرأ كلَّ فترة** — وهذا وصفُه بعينه، إذ سؤالُه «أنجمّعها كلَّ
   فترةٍ في مسارات؟» — لا يُقرأ إن احتاج ثلاثَ أدواتٍ ليُفتح. فهو الآن نقطةُ
   نهايةٍ تقرؤها الشاشةُ التي يُصنَّف فيها.

   ─────────── والمقيسُ بنيةٌ لا ورودُ حرف ───────────

   لا يكفي أن يرد اسمُ المسار في ملفّ. المقيس: أنّ النقطةَ **موجودةٌ ومحميّة**
   بالإذن نفسِه الذي يحمي الطابور، وأنّ الشاشةَ تناديها، وأنّ المدى يتبع مدى
   الطابور — فلا يُقرأ تقريرٌ عن مفتوحٍ وفي الشاشة مبتوت. */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const ROUTES = 'server/http/routes/admin-trainer.routes.ts'
const SERVICE = 'server/services/course-proposal.service.ts'
const SCREEN = 'src/pages/admin/CourseProposals.tsx'
const PATH = '/api/admin/course-proposals/clusters'

/** جسمُ `app.get('<path>', {...})` كاملا — لتُقرأ خصائصُه لا جوارُه */
function routeBlock(src: string, method: string, path: string): string | null {
  const head = `app.${method}('${path}'`
  const at = src.indexOf(head)
  if (at < 0) return null
  /* حتّى مطلعِ المسار التالي — فخصائصُ مسارٍ لا تُقرأ من مسارٍ بعده */
  const next = src.indexOf('\n  app.', at + head.length)
  return src.slice(at, next < 0 ? src.length : next)
}

describe('تقريرُ التجميع له بابٌ في الخادم', () => {
  it('نقطةُ النهاية موجودة', () => {
    expect(routeBlock(read(ROUTES), 'get', PATH), 'لا نقطةَ نهايةٍ للتقرير').toBeTruthy()
  })

  it('ومحميّةٌ بالإذن نفسِه الذي يحمي الطابور — لا تقلّ عنه', () => {
    const src = read(ROUTES)
    const queue = routeBlock(src, 'get', '/api/admin/course-proposals')!
    const clusters = routeBlock(src, 'get', PATH)!
    const permOf = (b: string) => /requirePermission\('([^']+)'\)/.exec(b)?.[1]
    expect(permOf(queue), 'تعطّل الفحص: لا إذنَ على الطابور').toBeTruthy()
    expect(
      permOf(clusters),
      'التقريرُ يقرأ عناوينَ الاقتراحات وأسماءَ أصحابها — فلا يُفتح لمن لا يقرأ الطابور',
    ).toBe(permOf(queue))
  })

  it('ولا قواعدَ في الخدمة — تستورد المقيسَ ولا تعيد كتابته', () => {
    const src = read(SERVICE)
    expect(src, 'الخدمةُ لا تستورد قواعدَ التجميع').toContain("from '../../src/application/catalog/proposal-clusters'")
    expect(src, 'الخدمةُ تستدعي `clusterProposals`').toMatch(/clusterProposals\(/)
    /* وحكمٌ يُعاد كتابتُه في الخدمة يفترق عمّا يُنقَض في اختبار القواعد */
    expect(src, 'حكمٌ مكتوبٌ باليد في الخدمة بدل استيراده').not.toMatch(/'path_candidate'|"path_candidate"/)
  })

  it('والمطابقةُ من مرشِّح الطابور نفسِه — فلا يرى القارئُ رمزا غيرَ ما في السطر', () => {
    const src = read(SERVICE)
    const block = src.slice(src.indexOf('async clusters('))
    expect(block.slice(0, 1600), 'التقريرُ يبني كتالوجا ثانيا').toContain('this.matchableCourses()')
  })
})

describe('والشاشةُ تناديه', () => {
  it('شاشةُ الاقتراحات تقرأ نقطةَ النهاية', () => {
    expect(read(SCREEN), 'الشاشةُ لا تنادي التقرير').toContain(PATH)
  })

  it('ومداه مدى الطابور — فلا يُقرأ تقريرٌ عن غير ما في الشاشة', () => {
    const src = read(SCREEN)
    /* الطابورُ يقرأ `scope=all` حين تُظهَر المبتوتات، فاللوحةُ تتبعه */
    expect(src, 'مدى الطابور لا يُقرأ من `showDecided`').toMatch(/scope=\$\{showDecided \? "all" : "open"\}/)
    expect(src, 'مدى اللوحة لا يتبع مدى الطابور').toMatch(/scope=\{showDecided \? "all" : "open"\}/)
  })

  it('ومطويٌّ حتّى يُطلَب — لا يُحمَّل الكتالوجُ على من جاء ليصنّف سطرا', () => {
    const src = read(SCREEN)
    const at = src.indexOf('function ClusterPanel')
    expect(at, 'لا لوحةَ للتقرير').toBeGreaterThan(-1)
    const panel = src.slice(at, src.indexOf('export default', at))
    expect(panel, 'لا حالةَ فتحٍ — فهو يُحمَّل دائما').toMatch(/useState\(false\)/)
    expect(panel, 'يُنادى قبل أن يُفتح').toMatch(/if \(!open\) return/)
  })
})

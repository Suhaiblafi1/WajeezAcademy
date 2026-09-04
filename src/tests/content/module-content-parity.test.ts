/* أجزاءُ المتن تصل المتعلّم كاملةً — حارسٌ على سلسلةِ الحقول لا على حقلٍ بعينه.

   العلّةُ التي وقعت: أُضيف حقلا النشاط التطبيقيّ والروبرك إلى سياسة التأليف
   وبوّابتِها وملفِّ الكتالوج والمخطَّط والمستورِد واللقطة وواجهةِ المتعلّم —
   ونُسي إسقاطٌ واحد: `PublicCatalogService.coreCatalog`. وهي الواجهةُ التي
   يقرؤها الموقعُ فعلا (`public-content.ts` يستبدل بها الكتالوجَ المضمَّن ولا
   يُقرأ المضمَّنُ إلّا حين تسقط). فبقي أربعٌ وثمانون وحدةً بلا نشاطٍ ولا
   روبرك عند المتعلّم — أي نصفُ ميزانيّة وقته (٥٠–٦٠ دقيقةً من ١٢٠، وعشرٌ
   للروبرك) — بلا خطأٍ يظهر في أيّ مكان: الحقلُ الغائبُ يُقرأ «لا نشاطَ
   لهذه الوحدة»، وهي حالةٌ مشروعةٌ لثلاثِ مئةٍ وعشرين وحدةً غيرِ مؤلَّفة.

   فلا اختبارَ سلوكٍ يمسك هذا، ولا مراجعةَ شيفرةٍ: الإسقاطُ الناقص صحيحُ
   الأنواع، ويمرّ البناءَ والتلويمَ واختباراتِ الخادم كلَّها.

   والحارسُ هنا على **التكافؤ** لا على قائمةٍ مكتوبةٍ بيد: مصدرُ الحقيقة
   `CONTENT_FIELDS` في خدمة التأليف، ومنه يُشتقّ ما يجب أن تحمله كلُّ حلقةٍ
   في السلسلة. فمن أضاف جزءا سابعا فلن يعرف أين ينساه: الاختبارُ يسمّي له
   الحلقةَ الناقصة بعينها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const AUTHORING = read('server/services/module-authoring.service.ts')
const PUBLIC_API = read('server/services/public-catalog.service.ts')
const SNAPSHOT = read('server/catalog/snapshot-builder.ts')
const IMPORTER = read('server/catalog/importer.ts')
const SCHEMA = read('prisma/schema.prisma')
const FE_TYPE = read('src/data/core-catalog-source.ts')
const FE_MAP = read('src/data/courses.ts')

/** مصدرُ الحقيقة: أجزاءُ المتن كما تعرفها حاكميّةُ الإصدارات */
function contentFields(): string[] {
  const m = AUTHORING.match(/const CONTENT_FIELDS = \[([^\]]+)\]/)
  if (!m) throw new Error('لم يُعثر على CONTENT_FIELDS في خدمة التأليف')
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean)
}

/** `practiceAr` ← → `module_practice_ar` */
const jsonKeyOf = (field: string) => `module_${field.replace(/Ar$/, '')}_ar`

/** جسمُ إسقاطِ الوحدات وحدَه — فلا يُقبل ذكرُ الحقل في موضعٍ آخر من الملفّ */
function moduleProjection(src: string, startMarker: string): string {
  const at = src.indexOf(startMarker)
  expect(at, `لم يُعثر على «${startMarker}»`).toBeGreaterThan(-1)
  return src.slice(at, at + 2500)
}

const FIELDS = contentFields()

describe('أجزاءُ متنِ الوحدة — تكافؤُ السلسلة', () => {
  it('مصدرُ الحقيقة يحمل الأجزاءَ الستّة المعروفة', () => {
    expect(FIELDS).toEqual(['bodyAr', 'checksAr', 'videoAr', 'scenarioAr', 'practiceAr', 'rubricAr'])
  })

  it('لكلِّ جزءٍ عمودٌ في المخطَّط', () => {
    for (const f of FIELDS) {
      expect(SCHEMA, `عمود ${f} مفقود في CourseModuleVersion`).toMatch(new RegExp(`\\n\\s+${f}\\s+String\\?`))
    }
  })

  it('المستورِدُ يقرأ كلَّ جزءٍ من ملفّ الكتالوج', () => {
    for (const f of FIELDS) {
      expect(IMPORTER, `${jsonKeyOf(f)} لا يُستورد`).toContain(`${f}: m.${jsonKeyOf(f)}`)
    }
  })

  it('اللقطةُ المنشورة تُخرج كلَّ جزء', () => {
    const body = moduleProjection(SNAPSHOT, 'const moduleRows =')
    for (const f of FIELDS) {
      expect(body, `${jsonKeyOf(f)} غائب عن اللقطة`).toContain(`{ ${jsonKeyOf(f)}: v.${f} }`)
    }
  })

  /* الحلقةُ التي انكسرت فعلا */
  it('الواجهةُ العامّة — مصدرُ المتعلّم — تُخرج كلَّ جزء', () => {
    const body = moduleProjection(PUBLIC_API, 'modules: courses.flatMap(')
    for (const f of FIELDS) {
      expect(body, `${jsonKeyOf(f)} غائب عن /api/public/core-catalog — لن يصل المتعلّم`)
        .toContain(`{ ${jsonKeyOf(f)}: v.${f} }`)
    }
  })

  it('نوعُ الواجهة ومُحوِّلُها يقرآن كلَّ جزء', () => {
    for (const f of FIELDS) {
      expect(FE_TYPE, `${jsonKeyOf(f)} غير معلَنٍ في نوع الكتالوج`).toContain(`${jsonKeyOf(f)}?:`)
      expect(FE_MAP, `${jsonKeyOf(f)} لا يُقرأ في data/courses.ts`).toContain(`m.${jsonKeyOf(f)}`)
    }
  })
})

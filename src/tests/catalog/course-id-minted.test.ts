/* معرّفُ الدورة يولّده النظام — ولا يُكتب بيدٍ في أيّ موضع.
 *
 * ── العطبُ الذي وُلد منه، مقيسا ──
 *
 * في المعالج حقلٌ نصُّه النائب **`المعرّف — CRS-XXX-000`**، وفي الخادم شرطٌ
 * **`/^C-[A-Z0-9-]+$/`**. فمن كتب `CRS-FIN-001` كما طلبت منه الشاشةُ رُدّ
 * بـ«معرف الدورة بصيغة C-XXX-000» — أي أنّ **الشاشةَ تطلب ما يرفضه الخادم**.
 * وهما في ملفّين لا يقرأ أحدُهما الآخر، فلا شيءَ كان يُحمِّر.
 *
 * وأعمقُ منه: العائلةُ في المعرّف ليست حرفا بل **معنى** — `courseDomain`
 * تقرؤها فتُخرج المجالَ المعرفيّ (`C-CYB-101` ← الأمن السيبراني)، وعليه
 * تقوم مرشِّحاتُ المجال وقائمةُ تأهيل المدرّب ومنعُ التزاحم في التقويم.
 * فإنسانٌ يكتب `C-XYZ-777` يُسقط دورتَه في «أخرى» ولا يُخبره أحد.
 *
 * ── وما يحرسه هذا الملفّ ──
 *
 * أنّ البابَ **أُغلق بنيويّا** لا بنصيحة: لا حقلَ يُكتب، ولا حقلَ يُرسل،
 * ولا حقلَ يُقرأ في الخادم. وسلوكُ المولِّد نفسِه (العائلةُ من المسار الأمّ)
 * يحرسه `server/tests/publishing/e2e-publishing.test.ts` على قاعدةٍ حقيقيّة —
 * فهذا على الشكل، وذاك على الأثر.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EMPTY_COURSE_DRAFT, courseBlockersOf } from '@/application/catalog/course-wizard'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

/* التعليقاتُ تُفرَّغ قبل الفحص: هذا الملفُّ نفسُه يشرح ما أُزيل فيذكر
   «CRS-XXX-000»، والشيفرةُ تفعل مثلَه. وحارسٌ يطابق نصًّا في تعليقٍ حارسٌ
   يخضرّ لسببٍ خاطئ — وقد مرّ في هذه المنصّة ثلاثةٌ منها. */
const code = (p: string) => read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ').replace(/\/\/[^\n]*/g, ' ')

const WIZARD = code('src/components/CourseWizard.tsx')
const DRAFT = code('src/application/catalog/course-wizard.ts')
const ROUTES = code('server/http/routes/catalog.routes.ts')
const SERVICE = code('server/services/catalog-admin.service.ts')

describe('معرّفُ الدورة · لا يُكتب بيد', () => {
  it('لا حقلَ معرّفٍ في المعالج — ولا نصَّ نائبٍ يطلبه', () => {
    expect(WIZARD, 'عاد حقلُ المعرّف قابلا للكتابة').not.toMatch(/setD\(\{ \.\.\.d, id:/)
    expect(WIZARD, 'النصُّ النائبُ الذي يرفضه الخادمُ عاد').not.toContain('CRS-XXX-000')
  })

  it('ولا `id` في مسوّدة المعالج أصلا — فلا موضعَ يحمله', () => {
    expect('id' in EMPTY_COURSE_DRAFT, 'المسوّدةُ ما زالت تحمل معرّفا').toBe(false)
    expect(DRAFT, 'شرطُ المعرّف عاد إلى موانع الخطوة').not.toContain('CRS-XXX-000')
  })

  it('ولا يمنع النقصُ فيه التقدّمَ — إذ لا نقصَ فيه', () => {
    /* الخطوةُ الأولى تكتمل بمسارٍ واسمٍ وساعات، ولا رابعَ */
    const filled = { ...EMPTY_COURSE_DRAFT, pathwayId: 'PW-STU-003', titleAr: 'دورةُ اختبار', totalHours: '4' }
    expect(courseBlockersOf('basics', filled), 'مانعٌ باقٍ بعد اكتمال الخطوة').toEqual([])
  })

  it('ولا يُرسَل من المتصفّح — فلا سبيلَ إلى فرضه من الخارج', () => {
    /* الحمولةُ وحدَها — ما بعد اسمِ المسار: وسمُ النوع (`apiPost<{ id: string }>`)
       يسبقه، وهو إعلانُ ما يعود لا ما يُرسَل. */
    const body = /"\/api\/admin\/catalog\/courses",([\s\S]*?)\}\);/.exec(WIZARD)?.[1] ?? ''
    expect(body, 'حمولةُ الإنشاء لم تُقرأ — تعطّل الفحصُ نفسُه').toBeTruthy()
    expect(body, 'المتصفّحُ ما زال يرسل معرّفا').not.toMatch(/\bid:/)
  })

  it('ولا يُقرأ في الخادم — ولو أُرسل', () => {
    const schema = /app\.post\('\/api\/admin\/catalog\/courses'[\s\S]*?const body = z\.object\(\{([\s\S]*?)pathwayId/.exec(ROUTES)?.[1] ?? ''
    expect(schema, 'المعرّفُ ما زال في مخطَّط الحمولة').not.toMatch(/\bid:/)
  })

  it('والمولِّدُ يشتقّ العائلةَ من المسار الأمّ لا من فراغ', () => {
    expect(SERVICE, 'لا مولِّدَ أصلا').toContain('async mintCourseId')
    /* دورتان: سابقاتُ المسار أوّلا، ثمّ مقطعُ المسار نفسِه — والفحصُ على
       الاستعلامَين لا على ورودِ الاسم */
    /* والأصليّةُ وحدَها: `PathwayCourse` تحمل المساندات من عائلاتٍ أخرى
       عمدا، وعدُّها يخلط — أمسكه اختبارُ النشر على قاعدةٍ حقيقيّة. */
    expect(SERVICE, 'لا يقرأ دوراتِ المسار الأصليّةَ ليأخذ عائلتَها').toMatch(/course\.findMany\(\{\s*\n?\s*where: \{ homePathwayId: pathwayId \}/)
    expect(SERVICE, 'لا يرتدّ إلى مقطع المسار حين لا سابقةَ له').toMatch(/\^PW-\(\[A-Z0-9\]\+\)-/)
    /* والرقمُ يلي أكبرَ ما في العائلة — لا يبدأ من واحدٍ فيصطدم */
    expect(SERVICE, 'لا يقرأ أكبرَ رقمٍ في العائلة').toMatch(/startsWith: `C-\$\{family\}-`/)
  })

  it('والمجالُ يُكتب عند الميلاد — لا يُترك فارغا لترحيلٍ لن يعود', () => {
    /* كانت كلُّ دورةٍ تُنشأ من المعالج تولد بـ`domainAr = null`، فمخطِّطُ
       الفصل يقرأ الفارغَ ولا يمنع تزاحما. والعائلةُ صارت معلومةً هنا. */
    expect(SERVICE, 'المجالُ لا يُكتب مع الدورة').toMatch(/domainAr,?\s*$/m)
    expect(SERVICE, 'المجالُ يُخترع لعائلةٍ لا تُعرف').toContain('COURSE_DOMAIN_FAMILIES.includes')
  })
})

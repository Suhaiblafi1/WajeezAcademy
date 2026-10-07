/* ═══ أغراضُ ملفّات الشعبة في الشيفرة هي أغراضُها في القاعدة (٧ أكتوبر ٢٠٢٦) ═══

   بلّغ صاحبُ المنصّة: «هناك خطأ عند تحميل الملفات». وكان رفعُ كلّ كرّاسةٍ يُردّ بخطأ خادم:
   زيد الغرضُ `workbook` في `FILE_PURPOSES` يومَ صار رفعُ الكرّاسة PDF وحدَه (٦ أكتوبر)، ولم
   يُزَد في تعليق العمود `CohortFile.purpose` — والتعليقُ عقدٌ يُولَّد منه قيدُ القاعدة
   (`scripts/status-checks.ts`). وحارسُ CI (`status-constraints.test.ts`) يقابل القيدَ
   بالتعليق، وكانا متأخّرَين معا فاتّفقا — ولم يقابل أحدٌ الشيفرةَ بالتعليق.

   فهنا الحلقةُ الناقصة: ما تعرفه الشيفرةُ من أغراضٍ هو ما في التعليق، لا أقلّ ولا أكثر.
   ومعها حارسُ CI: التعليقُ هو القيد — فالشيفرةُ هي القيد. وفي الخادم يُرفع بكلّ غرضٍ على
   قاعدةٍ مُرحَّلة (`server/tests/cohort-file/cohort-file.test.ts`). */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FILE_PURPOSES } from '@/application/trainer/module-body'
import { checkName, checkSql, statusColumns } from '../../../scripts/status-checks'

const column = () => statusColumns().find((c) => c.model === 'CohortFile' && c.field === 'purpose')

describe('أغراضُ ملفّات الشعبة: الشيفرةُ = التعليقُ = آخرُ قيدٍ مُرحَّل', () => {
  it('⚠️ ما في `FILE_PURPOSES` هو ما في تعليق `CohortFile.purpose`', () => {
    const c = column()
    expect(c, 'تعليقُ العمود لم يعد قائمةً يُولَّد منها قيد').toBeTruthy()
    expect([...c!.values].sort(), 'زيد غرضٌ في الشيفرة ولم يُزَد في تعليق العمود — فيردّه القيد')
      .toEqual([...FILE_PURPOSES].sort())
  })

  it('⚠️ وآخرُ ترحيلٍ يكتب القيدَ يكتبه كما يولّده التعليقُ اليوم', () => {
    const c = column()!
    const dir = join(process.cwd(), 'prisma/migrations')
    const last = readdirSync(dir).filter((d) => /^\d{14}_/.test(d)).sort()
      .map((d) => readFileSync(join(dir, d, 'migration.sql'), 'utf8'))
      .filter((sql) => sql.includes(`ADD CONSTRAINT "${checkName(c)}"`))
      .pop()
    expect(last, 'لا ترحيلَ يكتب قيدَ الأغراض').toBeTruthy()
    const add = checkSql(c).split('\n')[1]
    expect(last, 'التعليقُ تغيّر ولم يُولَّد ترحيلُه: npx tsx scripts/status-checks.ts').toContain(add)
  })
})

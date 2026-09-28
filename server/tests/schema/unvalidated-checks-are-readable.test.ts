/* قيدٌ غيرُ مصدَّقٍ بلا تقريرٍ يقرأ توزيعَه — وهو ما وقعتُ فيه أنا.
 *
 * ── العطبُ الذي وُلد منه هذا الفحص ──
 *
 * `20260927040000_status_checks_three_columns` أضاف ثلاثةَ قيودِ `CHECK`
 * بـ`NOT VALID`، وعلّتُه صحيحةٌ ومكتوبةٌ في رأسه: `ADD CONSTRAINT` يفحص
 * الصفوفَ القائمةَ كلَّها فيسقط الترحيلُ على الإنتاج إن حمل صفٌّ واحدٌ قيمةً
 * غريبة. فأُنفِذ ما وُضع القيدُ له — كلُّ كتابةٍ جديدةٍ تُفحَص — وأُجِّل فحصُ
 * ما مضى.
 *
 * **ثمّ بقي التأجيلُ أبدا.** لأنّ تصديقَه يحتاج أن يُعرَف توزيعُ القيم في
 * الإنتاج، ولا سبيلَ إلى ذلك من حاويةِ تطوير. فصار القيدُ معلّقا لا لأنّ
 * أحدا قرّر إبقاءه، بل لأنّ **لا أحدَ يملك الأداةَ التي تجيب**.
 *
 * وليس التصديقُ هو المقصودَ الأوّل. المقصودُ أن يُعرَف: أفي الإنتاج صفٌّ
 * يحمل حالةً **لم تعد موجودةً في الشيفرة**؟ فـ`#303` حذف ثلاثَ حالاتٍ
 * (`email_verification_pending` · `shortlisted` · `demo_requested`) ونقل ما
 * وجد من صفوفها. فمن فُوِّت منها يجلس في حالٍ لا تعرضها شاشةٌ ولا ينقله
 * انتقال — لا يبدو معطوبا، بل لا يبدو أصلا.
 *
 * ── فالقاعدة ──
 *
 * قيدٌ يُضاف `NOT VALID` **يُرفَق معه تقريرٌ يقرأ توزيعَ عموده**. فمن أجّل
 * الفحصَ تركَ لمن بعده أداةً يرفع بها التأجيل، لا سؤالا بلا جواب.
 *
 * ── والفحصُ على البنية ──
 *
 * تُقرأ الترحيلاتُ فيُستخرَج كلُّ قيدٍ `NOT VALID` لم يُصدَّق بعده، ويُقابَل
 * بخريطةٍ **تُستورَد** لا تُقرأ نصّا، ثمّ يُسأل `listReports()` نفسُه: أهذا
 * المفتاحُ موجودٌ فعلا؟ فخريطةٌ تشير إلى تقريرٍ لا وجودَ له أسوأُ من لا
 * خريطة — تُقرأ وعدا وتُخلِفه.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { ReportsService, STATUS_DISTRIBUTION_REPORTS } from '../../services/reports.service'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const MIGRATIONS = join(root, 'prisma/migrations')

interface Unvalidated { table: string; constraint: string; migration: string }

/** كلُّ نصوص الترحيلات، كلٌّ باسم مجلّده */
function migrationSql(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS)
    .filter((d) => existsSync(join(MIGRATIONS, d, 'migration.sql')))
    .map((d) => ({ name: d, sql: readFileSync(join(MIGRATIONS, d, 'migration.sql'), 'utf8') }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * القيودُ المضافةُ `NOT VALID` والتي **لم يُصدِّقها** ترحيلٌ بعدها.
 *
 * وشرطُ «بعدها» يُقاس بترتيب أسماء المجلّدات — وهو ترتيبُ تنفيذها نفسُه
 * (بادئةٌ زمنيّة). فتصديقٌ في ترحيلٍ أسبقَ لا يصدّق قيدا وُلد بعده.
 */
function unvalidatedChecks(): Unvalidated[] {
  const files = migrationSql()
  const added: Unvalidated[] = []
  for (const f of files) {
    const re = /ALTER\s+TABLE\s+"(\w+)"\s+ADD\s+CONSTRAINT\s+"(\w+)"[\s\S]*?NOT\s+VALID\s*;/gi
    for (const m of f.sql.matchAll(re)) {
      added.push({ table: m[1]!, constraint: m[2]!, migration: f.name })
    }
  }
  return added.filter((c) => {
    const validatedLater = files.some((f) =>
      f.name.localeCompare(c.migration) > 0
      && new RegExp(`VALIDATE\\s+CONSTRAINT\\s+"${c.constraint}"`, 'i').test(f.sql))
    return !validatedLater
  })
}

describe('قيدٌ غيرُ مصدَّقٍ يُرفَق معه ما يقرأ عمودَه', () => {
  const unvalidated = unvalidatedChecks()
  /* ولا اتّصالَ بقاعدةٍ: `listReports()` تقرأ التعريفاتَ وحدَها ولا تنادي
     `run`، فعميلٌ صوريٌّ يكفي. وبناءُ عميلٍ حقيقيٍّ هنا يجعل فحصا بنيويّا
     خالصا يسقط لأنّ قاعدةً لم تُشغَّل — وذاك إخفاقٌ يكذب على سببه. */
  const keys = new Set(
    new ReportsService({} as unknown as PrismaClient).listReports().map((r) => r.key),
  )

  it('المسحُ يجد قيودَ `NOT VALID` فعلا — وإلّا كان يخضرّ على فراغ', () => {
    expect(
      unvalidated.length,
      'لم يُقرأ قيدٌ واحدٌ — تعطّل المسحُ، أو صُدِّقت كلُّها (فيُحدَّث هذا الفحصُ)',
    ).toBeGreaterThan(0)
    expect(unvalidated.map((c) => c.table)).toContain('TrainerApplication')
  })

  it('لكلّ جدولٍ فيه قيدٌ معلَّقٌ مفتاحُ تقريرٍ يُقرأ منه توزيعُه', () => {
    const orphans = unvalidated
      .filter((c) => !STATUS_DISTRIBUTION_REPORTS[c.table])
      .map((c) => `${c.table} (${c.constraint} في ${c.migration})`)
    expect(
      orphans,
      'قيدٌ `NOT VALID` بلا تقريرٍ يقرأ توزيعَ عموده — فلا سبيلَ إلى تصديقه. '
      + 'أضفْ تقريرا في `reports.service.ts` وسمِّه في '
      + `\`STATUS_DISTRIBUTION_REPORTS\`:\n${orphans.join('\n')}`,
    ).toEqual([])
  })

  it('ولا مفتاحَ في الخريطة بلا تقريرٍ يحمله — فلا وعدٌ يُخلَف', () => {
    const missing = Object.entries(STATUS_DISTRIBUTION_REPORTS)
      .filter(([, key]) => !keys.has(key))
      .map(([table, key]) => `${table} → ${key}`)
    expect(missing, `خريطةٌ تشير إلى تقريرٍ لا وجودَ له:\n${missing.join('\n')}`).toEqual([])
  })

  it('ولا جدولَ في الخريطة صُدِّق قيدُه — فالخريطةُ لا تتضخّم بما لا موجبَ له', () => {
    const tables = new Set(unvalidated.map((c) => c.table))
    const stale = Object.keys(STATUS_DISTRIBUTION_REPORTS).filter((t) => !tables.has(t))
    expect(
      stale,
      'جدولٌ في الخريطة ولا قيدَ معلَّقٌ له — صُدِّق أو حُذف، فيُرفَع اسمُه '
      + `(والتقريرُ يبقى إن كان يُقرأ لغرضه):\n${stale.join('\n')}`,
    ).toEqual([])
  })
})

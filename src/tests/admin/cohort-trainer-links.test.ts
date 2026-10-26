/* الشعبةُ ومدرّبُها رابطان كلٌّ إلى الآخر — ولا يحرّر أحدُهما الآخر (٢٦ أكتوبر ٢٠٢٦، المرحلة السادسة).

   «خطّة لوحة الإدارة» (٠٥): «ملفُّ المدرّب يعرض شعبَه روابط، والشعبةُ تعرض مدرّبَها رابطا، ولا يحرّر أحدُهما الآخر».
   ① في بطاقة الشعبة اسمُ المدرّب رابطٌ إلى ملفّه — لمن يفتح الملفّات، وإلّا نصّ.
   ② وفي ملفّه شعبُه روابطُ إلى بطاقاتها — لمن يفتح «الشعب»، وإلّا نصّ.
   ③ والملفُّ لا يُسند ولا ينزع: بابُ الإسناد في بطاقة الشعبة.
   ④ وزرُّ «حالات متأخّرة عن تواريخها» ذهب — العاملُ يُجريها (`server/tests/learning/cohort-trainer-links.test.ts`).

   والفحصُ على الشيفرة بلا تعليقاتها. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const COHORTS = code('src/pages/admin/AdminCohorts.tsx')
const RECORD = code('src/pages/admin/TrainerApplications.tsx')

describe('① اسم المدرّب في بطاقة الشعبة رابط إلى ملفّه', () => {
  it('⚠️ في «نظرة عامة» — لمن يفتح الملفّات، وإلّا نصّ', () => {
    expect(COHORTS).toMatch(/const opensRecords = viewer\?\.permissions\.includes\("trainer\.applications\.view"\) \?\? false;/)
    const overview = COHORTS.slice(COHORTS.indexOf('{tab === "overview" && ('))
    const trainerCell = overview.slice(overview.indexOf('>المدرب</dt>'), overview.indexOf('>المسجلون</dt>'))
    expect(trainerCell).toMatch(/\{opensRecords && t\.applicationId\s*\? <Link to=\{`\/admin\/trainers\/\$\{t\.applicationId\}`\}[^>]*>\{t\.name\}<\/Link>\s*: t\.name\}/)
  })

  it('⚠️ وقائمة الشعب تحمل معرّف طلبه — به يفتح الملفّ', () => {
    expect(code('server/services/cohort.service.ts')).toMatch(/trainers: c\.trainers\.map\(\(t\) => \(\{\s*profileId: t\.profileId, applicationId: t\.profile\.applicationId,/)
  })
})

describe('② وشعبه في ملفّه روابط إلى بطاقاتها', () => {
  it('⚠️ لمن يفتح «الشعب» — وإلّا نصّ', () => {
    const tab = RECORD.slice(RECORD.indexOf('function TrainerCoursesTab'), RECORD.indexOf('export default function TrainerApplications'))
    expect(tab).toMatch(/\{opensCohorts\s*\? <Link to=\{`\/admin\/cohorts\?cohort=\$\{c\.id\}`\}[^>]*>\{c\.title\}<\/Link>\s*: <span[^>]*>\{c\.title\}<\/span>\}/)
    expect(RECORD).toMatch(/<TrainerCoursesTab [\s\S]{0,200}opensCohorts=\{user\?\.permissions\.includes\("cohort\.manage"\) \?\? false\}/)
  })
})

describe('③ والملفّ لا يسند ولا ينزع', () => {
  it('⚠️ لا باب إسناد في ملفّ المدرّب — الإسناد في بطاقة الشعبة', () => {
    for (const f of ['src/pages/admin/TrainerApplications.tsx', 'src/pages/admin/TrainerOps.tsx']) {
      expect(code(f), `${f} يسند مدرّبا`).not.toMatch(/\/api\/admin\/cohorts\/\$\{[^}]+\}\/trainers|\/assignments`/)
    }
    expect(code('src/pages/admin/CohortOps.tsx'), 'بطاقة الشعبة بلا باب إسناد').toMatch(/\/api\/admin\/cohorts\/\$\{[^}]+\}\/trainers/)
  })
})

describe('④ وزرّ «حالات متأخّرة عن تواريخها» ذهب', () => {
  it('⚠️ لا يناديه شيء في الشاشة — وتوحيد الأسعار باق', () => {
    const panel = code('src/pages/admin/CohortReadiness.tsx')
    expect(panel).not.toMatch(/sync-statuses|حالات متأخّرة عن تواريخها/)
    expect(panel).toContain('/api/admin/cohorts/align-prices')
  })
})

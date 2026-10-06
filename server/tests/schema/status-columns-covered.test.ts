/* لا عمودَ حالةٍ يحمل عقدا ولا يراه المولِّد.
 *
 * ── العطبُ الذي وُلد منه ──
 *
 * رأسُ `scripts/status-checks.ts` يقول: «التعليقُ عقدٌ، أو ليس شيئا». وكان
 * مُفسِّرُه يشترط أن يكون التعليقُ على **سطر الحقل نفسِه** — وقوائمُ Prisma
 * تُكتب على أسطرٍ تاليةٍ حين تطول.
 *
 * فأفلت منه ثلاثةُ أعمدةٍ **لها قوائمُ موثَّقةٌ فعلا**، منها
 * `TrainerApplication.status` — أوسعُ عمودِ حالةٍ في المنصّة، أربعَ عشرةَ
 * قيمةً وعليه يقوم طابورُ المدرّبين كلُّه. وقد حُذفت منه ثلاثُ حالاتٍ في ٢٦
 * سبتمبر ٢٠٢٦ بلا قيدٍ في القاعدة يمنع عودتَها.
 *
 * والعطبُ صامت: خطأٌ مطبعيٌّ في قيمةٍ يُحفَظ بلا اعتراض، ويبقى سنينَ لا
 * يكتشفه إلّا من يسأل «لماذا هذا الصفُّ لا يظهر؟».
 *
 * ── ولمَ فحصٌ لا مجرّدُ إصلاح ──
 *
 * الإصلاحُ يُعيد الثلاثةَ اليوم. وهذا يمنع الرابعَ غدا: من كتب عمودَ حالةٍ
 * جديدا وقائمتَه على أسطرٍ لا يراها المولِّدُ يسقط هنا، لا بعد سنةٍ حين
 * يُسأل عن صفٍّ لا يظهر.
 *
 * ── والفحصُ على البنية ──
 *
 * يُستورَد `statusColumns()` نفسُه — لا يُقرأ مخرَجُه نصّا — ويُقابَل بمسحٍ
 * مستقلٍّ على المخطّط. فلو بُدّل المُفسِّرُ تبعه الفحصُ، ولو عمي عن عمودٍ
 * بانَ الفرقُ.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { statusColumns, checkName, type StatusColumn } from '../../../scripts/status-checks'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const SCHEMA = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8')

/** الأسماءُ التي تُقرأ حالةً — نسخةٌ مستقلّةٌ عمدا، فلا يُقاس المُفسِّرُ بنفسه */
const STATUS_NAMES = /^(status|state|kind|type|level|result|outcome|purpose)$/

/** كلُّ عمودٍ نصّيٍّ اسمُه اسمُ حالة — بقطع النظر عن تعليقه */
function statusNamedColumns(): string[] {
  const out: string[] = []
  let model: string | null = null
  for (const line of SCHEMA.split('\n')) {
    const m = /^model\s+(\w+)\s*\{/.exec(line)
    if (m) { model = m[1]; continue }
    if (/^\}/.test(line)) { model = null; continue }
    if (!model) continue
    const f = /^\s*(\w+)\s+String\??\s/.exec(line)
    if (!f || !STATUS_NAMES.test(f[1])) continue
    out.push(`${model}.${f[1]}`)
  }
  return out
}

/* ═══ الأعمدةُ الثمانيةَ عشرَ بلا عقدٍ بعد — تُسمّى ولا تُترك صامتة ═══

   هذه لا قائمةَ قيمٍ في تعليقها أصلا، فلا عقدَ يُشتقّ منها قيد. وذِكرُها
   هنا خبرٌ يُقرأ: «هذا بلا عقدٍ بعد» — لا صمتٌ يُظَنّ تغطيةً.

   ومن وثّق قائمةَ واحدٍ منها في تعليقه فسيُغطّيه المولِّدُ آليّا، ويسقط
   هذا الفحصُ على استثناءٍ لم يعد له موجب — فيُرفَع اسمُه من هنا. */
const NO_CONTRACT_YET: readonly string[] = [
  /* الكتالوج: مسوّداتٌ وإصداراتٌ — قيمُها في الشيفرة ولم تُوثَّق في المخطّط */
  'PathwayVersion.status', 'CompositeTemplate.status', 'CompositeTemplateVersion.status',
  'CourseVersion.status', 'CourseModuleVersion.status',
  'Skill.status', 'SkillVersion.status', 'MethodologyReference.status',
  'Question.status', 'QuestionVersion.status', 'RecommendationVersion.status',
  /* والمدرّب والمتعلّم */
  'DepartureCase.outcome', 'TrainerPath.status', 'TrainerCourseProposal.status',
  'LearnerPathDraft.status', 'AdvisorRequest.status',
  /* وأدواتٌ داخليّة */
  'PasswordResetToken.purpose', 'OutboxMail.status',
]

describe('① كلُّ عمودِ حالةٍ: إمّا له قيدٌ أو مذكورٌ بلا عقد', () => {
  const covered = new Set(statusColumns().map((c) => `${c.model}.${c.field}`))

  it('لا عمودَ يسقط بين الاثنين — فلا صمتَ يُظَنّ تغطية', () => {
    const unaccounted = statusNamedColumns()
      .filter((k) => !covered.has(k) && !NO_CONTRACT_YET.includes(k))
    expect(unaccounted,
      'عمودُ حالةٍ لا قيدَ له ولا ذُكر في `NO_CONTRACT_YET` — وثّقْ قائمتَه '
      + 'في تعليقه بجانب حقله، أو أضفْه إلى الاستثناءات بسببه').toEqual([])
  })

  it('ولا استثناءٌ بقي وقد صار مغطّى — فالقائمةُ لا تكذب', () => {
    const stale = NO_CONTRACT_YET.filter((k) => covered.has(k))
    expect(stale, 'صار له قيدٌ وبقي في قائمة «بلا عقد» — يُرفَع اسمُه').toEqual([])
  })

  it('ولا استثناءٌ لعمودٍ لا وجودَ له — فالقائمةُ تتبع المخطّط', () => {
    const all = new Set(statusNamedColumns())
    expect(NO_CONTRACT_YET.filter((k) => !all.has(k)),
      'استثناءٌ لعمودٍ حُذف من المخطّط').toEqual([])
  })
})

describe('② والثلاثةُ التي أفلتت — لا تُفلت ثانية', () => {
  const byKey = new Map(statusColumns().map((c) => [`${c.model}.${c.field}`, c]))

  /* ═══ ولمَ تُسمّى بأعيانها ═══

     الفحصُ الأوّلُ يمنع **الصنفَ**: عمودٌ بلا قيدٍ ولا استثناء. وهذه تُسمّى
     لأنّها وقعت فعلا، ولأنّ إحداها (`TrainerApplication.status`) يقوم عليها
     طابورُ المدرّبين كلُّه — فسقوطُها صامتٌ يُكلِّف سنة. */
  const MUST: readonly [string, number][] = [
    /* ١٥ منذ ٦ أكتوبر ٢٠٢٦: `deferred` — المؤجَّلُ إلى الفصول القادمة (`deferral.ts`) */
    ['TrainerApplication.status', 15],
    ['TrainerChangeRequest.status', 10],
    ['AssignmentSubmission.status', 5],
  ]

  it.each(MUST)('«%s» مغطّى بقيمه كاملة', (key, count) => {
    const col = byKey.get(key)
    expect(col, `${key} عاد بلا قيد — والقائمةُ في تعليقه`).toBeDefined()
    expect(col!.values, `${key} نقصت قيمُه`).toHaveLength(count)
    expect(col!.values.every((v) => /^[a-z0-9_]+$/.test(v)),
      `${key} دخل النثرُ في قيمه`).toBe(true)
  })

  it('وقائمةُ حالات الطلب هي نفسُها التي في الشيفرة — لا نسختان تفترقان', async () => {
    const { TRAINER_STATUSES } = await import('../../services/trainer-application.service')
    const col = byKey.get('TrainerApplication.status')!
    expect([...col.values].sort(), 'المخطّطُ والشيفرةُ يقولان حالتَين مختلفتَين')
      .toEqual([...TRAINER_STATUSES].sort())
  })
})

describe('③ واسمُ القيد ثابتٌ — فلا يتكرّر بتوليدٍ ثانٍ', () => {
  it('لكلّ عمودٍ اسمٌ واحدٌ لا يتصادم', () => {
    const cols: StatusColumn[] = statusColumns()
    const names = cols.map(checkName)
    expect(new Set(names).size, 'اسمُ قيدٍ تكرّر — فيُسقط توليدُ الترحيل').toBe(names.length)
  })
})

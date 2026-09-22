/* مسارُ الأسرة والتربية (PW-FAM-001) — ولمَ حارسُه على البابِ لا على وجودِه.

   ── العلّةُ التي يحرسها ──

   `family_parenting` كان مجالا في المعجم منذ كُتب، ونصُّه يقول «لا مسار
   حاليًا (فجوة كتالوج موثقة)». وكان فيه **عشرُ مهاراتٍ مسجَّلةٍ**
   (SK-FAM-001..010) لا تحملها دورةٌ واحدة، ورمزُ هدفٍ (`family_wellbeing`)
   تربطه `pathway-domains.v2.json` بالمجال **ولا يعلنه سؤالٌ قطّ** — سقط
   خيارُ «أسرة ورفاه» يومَ انتقل السطحُ من V2 إلى V2.1 ولم يسقط الربطُ معه.

   فلو بُني المسارُ وحدَه — دوراتٌ وبروفايلٌ ومجال — لَوُلد ميّتا: لا هدفَ
   يصل إليه ولا احتياج، كما وُلد PW-GOV-002 قبله فردّت حزمةُ الذهب ٢٨
   توليفةً كلَّها بـ«الكيان خارج مجال حاجتك». ولهذا يفحص هذا الملفُّ **الطريقَ
   إلى المسار** على المحرّك الحيّ، لا وجودَ صفوفِه في ملفّ بيانات: صفٌّ
   موجودٌ لا يصله أحدٌ ليس مسارا، هو دَينٌ مكتوبٌ بلغةِ الأصول.

   ⚠ أُثبت سقوطُه: نُزع `need_family` من NEEDS_V21 فسقط الفحصُ الأوّل مسمّيا
   المخرَجَ البديل، ونُزع `family_role` من GOALS_V21 فسقط الثاني، وأُعيدت
   المهاراتُ العشرُ إلى ACADEMIC_GOVERNANCE فسقط الرابع. ثمّ رُدَّ كلٌّ منها
   فخضرّ. */

import { describe, expect, it } from 'vitest'
import { createEngineV21 } from '../../domain/diagnostic/v2_1'
import { GOALS_V21, NEEDS_V21, Q, type CareerStage } from '../../domain/diagnostic/v2_1/maps'
import { measurableSkills } from '../../domain/diagnostic/v2_1/universe'
import { launchPathways, courseById } from '../../domain/diagnostic/catalog'
import { isDiagnosticSkillActive, layersOfSkill, domainsOfPathway } from '../../domain/diagnostic/v2/data'

const PATHWAY = 'PW-FAM-001'
const DOMAIN = 'family_parenting'

/** المراحلُ بترتيب سؤال المرحلة — الفهرسُ هو ما يُجاب به */
const STAGES: CareerStage[] = ['university_student', 'fresh_graduate', 'early_career', 'experienced',
  'manager', 'senior_manager', 'founder', 'freelancer', 'trainer_ld', 'other_unsure']

/** جلسةٌ حتميّةٌ كاملةٌ على المحرّك الحيّ: المرحلةُ والهدفُ والاحتياجُ تُختار بنصِّها */
function session(stage: CareerStage, goalMatch: string | null, needMatch: string | null) {
  const e = createEngineV21(`fam-${stage}-${goalMatch}-${needMatch}`)
  for (let i = 0; i < 30; i++) {
    const s = e.nextQuestion()
    if (s.stop.shouldStop || !s.question) break
    const q = s.question
    let idx = 0
    if (q.question_id === Q.STAGE) idx = STAGES.indexOf(stage)
    else if (q.question_id === Q.GOAL && goalMatch) idx = Math.max(0, q.options_ar.findIndex((o) => o.includes(goalMatch)))
    else if (q.question_id === Q.NEED && needMatch) idx = Math.max(0, q.options_ar.findIndex((o) => o.includes(needMatch)))
    else if (q.answer_type === 'skill_level_5' || q.answer_type === 'likert_5') idx = 2
    e.answer({
      questionId: q.question_id,
      value: q.options_ar[idx] ?? q.options_ar[0],
      optionIds: [q.active_option_ids?.[idx] ?? `o${idx + 1}`],
    })
  }
  const rec = e.recommend()
  return rec.primaryPathway?.pathwayId ?? `«${rec.kind}» بلا مسار`
}

describe('مسارُ الأسرة والتربية — الطريقُ إليه لا وجودُه', () => {
  const pathway = launchPathways.find((p) => p.id === PATHWAY)

  it('القراءةُ تعمل — فلا يخضرّ الحارسُ على كتالوجٍ لا يحمل المسارَ أصلا', () => {
    expect(pathway, `لا مسارَ ${PATHWAY} في الكتالوج الفعّال`).toBeTruthy()
    expect(pathway!.course_ids.length).toBeGreaterThan(0)
    expect(domainsOfPathway(PATHWAY)).toContain(DOMAIN)
  })

  /* البابُ الأوّل: الاحتياجُ — وهو المحرّكُ الرئيس لاكتشاف المجال في V2.1.

     والهدفُ هنا **محايدٌ بقصد** (`specific_skill`: مجالاتُه فارغةٌ عمدا،
     Goal ≠ Domain): فلو تُرك لأوّلِ خيارٍ لاختلف بالمرحلة، ولسحب هدفُ
     «تحديد المجال الأنسب» صاحبَه إلى مسارِ القرار المهنيِّ بحقٍّ — وهو سلوكٌ
     صحيحٌ لا يُدان. فالمقيسُ هنا أنّ الاحتياجَ **وحدَه** يبلغ المسارَ حين لا
     يجرُّ الهدفُ إلى مجالٍ آخر. والاتّجاهُ المقابلُ يفحصه ما بعده. */
  it('يصل إليه والدٌ من احتياجِ التربية في كلِّ مرحلةٍ يُعرض عليها', () => {
    const need = NEEDS_V21.find((n) => n.code === 'need_family')
    expect(need, 'اختفى احتياجُ التربية — لا بابَ للمجال').toBeTruthy()
    expect(need!.domains).toContain(DOMAIN)

    const neutral = GOALS_V21.find((g) => g.code === 'specific_skill')
    expect(neutral?.domains, 'هدفُ «مهارة محددة» صار يحمل مجالا — فلم يعد محايدا').toEqual([])

    const stages = need!.stages === 'all' ? STAGES : need!.stages
    const misses = stages
      .map((st) => [st, session(st, neutral!.label_ar.slice(0, 12), need!.label_ar.slice(0, 12))] as const)
      .filter(([, got]) => got !== PATHWAY)
    expect(misses, 'مراحلُ يُعرض عليها الاحتياجُ ولا يصل منها المسار: '
      + misses.map(([st, got]) => `${st} → ${got}`).join(' · ')).toEqual([])
  })

  /* البابُ الثاني: الهدفُ — ورمزُه القديمُ كان يَعِد ولا يقع */
  it('ويصل إليه من هدفِ التربية، ورمزُ family_wellbeing صار يُعلَن لا يُنتظَر', () => {
    const goal = GOALS_V21.find((g) => g.legacy_goal === 'family_wellbeing')
    expect(goal, 'لا هدفَ يولّد family_wellbeing — البروفايلُ يَعِد بما لا يقع').toBeTruthy()
    expect(goal!.domains).toContain(DOMAIN)
    expect(goal!.stages === 'all' ? STAGES : goal!.stages).not.toHaveLength(0)

    const stages = goal!.stages === 'all' ? STAGES : goal!.stages
    const misses = stages
      .map((st) => [st, session(st, goal!.label_ar.slice(0, 12), null)] as const)
      .filter(([, got]) => got !== PATHWAY)
    expect(misses, 'مراحلُ يُعرض عليها الهدفُ ولا يصل منها المسار: '
      + misses.map(([st, got]) => `${st} → ${got}`).join(' · ')).toEqual([])
  })

  /* بلا مهارةٍ مقيسةٍ واحدةٍ يصير وزنُ فجوةِ المهارات (٢٥٪) خاملا في المسار،
     فلا يفرّقه عن منافسيه شيءٌ يُقاس. ويحرسه coverage-baseline على الفضاء
     كلِّه، وهذا يحرسه على هذا المسارِ بعينه فيُسمّيه عند السقوط. */
  it('وله مهارةٌ مقيسةٌ واحدةٌ على الأقلّ — لا وزنَ مهاراتٍ خامل', () => {
    const measurable = measurableSkills()
    const slugs = pathway!.course_ids.flatMap((cid) => courseById.get(cid)?.skill_slugs ?? [])
    expect(slugs.length, 'دوراتُ المسارِ بلا مهاراتٍ أصلا').toBeGreaterThan(0)
    expect(slugs.filter((s) => measurable.has(s)), `${PATHWAY} بلا مهارةٍ مقيسة`).not.toHaveLength(0)
  })

  /* المهاراتُ العشرُ كانت محكومةً بـfuture_catalog_skill — ومهارةٌ محكومةٌ لا
     تدخل التشخيصَ ولا الفجوةَ ولا التفسير، فتُعلَّم في الدورةِ ولا تُحتسب في
     الترشيح. ورُفع الحكمُ عنها بالشرطِ المكتوبِ في القيد نفسِه: ارتباطٌ
     بمنتجٍ فعليّ. فلو أُعيد الحكمُ عليها بقي المسارُ ودوراتُه ولم يبقَ أثرُها. */
  it('ومهاراتُ الأسرةِ العشرُ مفعَّلةٌ أكاديميّا — لا محكومةٌ تُعلَّم ولا تُحتسب', () => {
    const taught = new Set(pathway!.course_ids.flatMap((cid) => courseById.get(cid)?.skill_slugs ?? []))
    const family = [...taught].filter((s) => s.startsWith('family_') || s.startsWith('child_')
      || s.startsWith('parent_') || s === 'positive_discipline' || s === 'role_modeling'
      || s === 'teen_confidence_support')
    expect(family.length, 'لا مهارةَ أسريّةً في دوراتِ المسار').toBeGreaterThanOrEqual(10)
    const frozen = family.filter((s) => {
      const meta = layersOfSkill(s)
      return meta !== undefined && !isDiagnosticSkillActive(meta)
    })
    expect(frozen, 'مهارةٌ تُعلَّم في المسارِ وهي محكومةٌ أكاديميّا فلا تدخل الترشيح: '
      + frozen.join(' · ')).toEqual([])
  })
})

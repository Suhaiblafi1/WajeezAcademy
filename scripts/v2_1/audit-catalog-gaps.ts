#!/usr/bin/env node
/* فجواتُ الكتالوج كما يكشفها تشخيصُ V2.1 — تُقاس ولا تُدَّعى.

   ═══ لمَ كُتب هذا بدل أن يُصحَّح ما قبلَه ═══

   كانت الوثيقةُ تُولَّد من محاكاةِ محرّك **V2** ومن `personas-report.json`
   المحفوظِ معه، ثمّ يُلحَق بها سببٌ جذريٌّ **مكتوبٌ باليد في المولّد**:
   «سؤال الهدف ينتج ٧ رموز فقط». فكانت الأرقامُ تتجدّد والتعليلُ لا يتجدّد،
   وانتقلت المنصّةُ إلى V2.1 فبقي التعليلُ يصف محرّكا لا يخدم أحدا.

   وقياسُ ٢١٠٠ تركيبةِ إجابةٍ على المحرّك الحيّ (٢٢ سبتمبر ٢٠٢٦) قال:
   المساراتُ الاثنا عشرَ التي وصفتها الوثيقةُ بأنّها لا تُوصَل **كلُّها
   تفوز**، وسؤالُ الهدف ينتج اثني عشرَ رمزا لا سبعة — منها
   `digital_transformation` الذي تعدّه الوثيقةُ ناقصا. فالفارزُ في V2.1
   **الاحتياجُ** لا الهدف، وذاك ما لم تدركه.

   وأخطرُ ما فيها أنّها تُقرأ فيُبنى عليها: وثيقةٌ بائدةٌ تسوق قارئَها إلى
   المشكلة الخطأ، وقد ساقت. فالعلاجُ ألّا يبقى في الوثيقة حرفُ تعليلٍ لا
   يُحسَب: ما لا يُقاس لا يُكتب.

   ═══ وما يُقاس هنا ═══

   · **مسحٌ حتميّ** لفضاء الإجابات (مرحلة × هدف × احتياج) على محرّك V2.1.
   · **ومجالٌ بلا كيان**: مجالٌ في المعجم لا يسنده كيانٌ واحدٌ في الفضاء.
   · **ورمزُ هدفٍ تنتظره بروفايلاتُ المسارات ولا يولّده سؤال** — وعدٌ في
     ملفّ إعداداتٍ لا يقع.

   ═══ وحدُّ المسح يُقال ولا يُخبَّأ ═══

   المسحُ يغيّر المرحلةَ والهدفَ والاحتياج، ويجيب ما سواها بأوّل خيارٍ ثابت.
   فمسارٌ **فاز فيه** قد وُصل يقينا؛ ومسارٌ **لم يفز فيه** لم يثبت أنّه لا
   يُوصَل — قد يُوصَل بإجابةٍ لا يغيّرها المسح. وهذا فرقٌ تكتبه الوثيقةُ
   صراحةً، لأنّ خلطَه هو ما أنتج دعوى «اثنا عشر مسارا ميّتا».

   الاستعمال:
     npx tsx scripts/v2_1/audit-catalog-gaps.ts            يكتب الوثيقة
     npx tsx scripts/v2_1/audit-catalog-gaps.ts --check    يقارن ولا يكتب (CI) */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createEngineV21 } from '../../src/domain/diagnostic/v2_1'
import { GOALS_V21, Q, type CareerStage } from '../../src/domain/diagnostic/v2_1/maps'
import { recommendationUniverse } from '../../src/domain/diagnostic/v2_1/universe'
import { launchPathways } from '../../src/domain/diagnostic/catalog'
import { domainLabelAr, domainsV2 } from '../../src/domain/diagnostic/v2/data'
import type { DomainId } from '../../src/domain/diagnostic/v2/types'
import profilesJson from '../../src/data/overlays/pathway-profiles.v1.json'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const DOC = 'docs/CATALOG_GAPS_FROM_DIAGNOSTIC_AR.md'
const CHECK = process.argv.includes('--check')

const STAGES: CareerStage[] = ['university_student', 'fresh_graduate', 'early_career', 'experienced',
  'manager', 'senior_manager', 'founder', 'freelancer', 'trainer_ld', 'other_unsure']
/* أوسعُ من أطول قائمةِ خيارات — والمحرّكُ يقصُّ ما جاوز، فلا تركيبةَ تفوت */
const MAX_GOAL = 15
const MAX_NEED = 14

interface Outcome { top: string | null; kind: string; goal?: string }

/** جلسةٌ واحدةٌ حتميّة: المرحلةُ والهدفُ والاحتياجُ تُختار، وما سواها أوّلُ خيار */
function session(stage: CareerStage, g: number, nd: number): Outcome {
  const e = createEngineV21(`gaps-${stage}-${g}-${nd}`)
  for (let i = 0; i < 25; i++) {
    const s = e.nextQuestion()
    if (s.stop.shouldStop || !s.question) break
    const q = s.question
    let idx = 0
    if (q.question_id === Q.STAGE) idx = STAGES.indexOf(stage)
    else if (q.question_id === Q.GOAL) idx = Math.min(g, q.options_ar.length - 1)
    else if (q.question_id === Q.NEED) idx = Math.min(nd, q.options_ar.length - 1)
    else if (q.answer_type === 'skill_level_5' || q.answer_type === 'likert_5') idx = 2
    e.answer({
      questionId: q.question_id,
      value: q.options_ar[idx] ?? q.options_ar[0],
      optionIds: [q.active_option_ids?.[idx] ?? `o${idx + 1}`],
    })
  }
  const rec = e.recommend()
  return {
    top: rec.primaryPathway?.pathwayId ?? null,
    kind: rec.kind,
    goal: e.getState().facts['primary_goal']?.value as string | undefined,
  }
}

function sweep() {
  const wins = new Map<string, number>()
  const kinds = new Map<string, number>()
  const goalsSeen = new Set<string>()
  let sessions = 0
  for (const stage of STAGES) {
    for (let g = 0; g < MAX_GOAL; g++) {
      for (let nd = 0; nd < MAX_NEED; nd++) {
        const r = session(stage, g, nd)
        sessions += 1
        if (r.goal) goalsSeen.add(r.goal)
        if (r.top) wins.set(r.top, (wins.get(r.top) ?? 0) + 1)
        else kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1)
      }
    }
  }
  return { wins, kinds, goalsSeen, sessions }
}

const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(1)}٪`

function build(): string {
  const { wins, kinds, goalsSeen, sessions } = sweep()
  const universe = recommendationUniverse()
  const entities = universe.entities as unknown as {
    entity_id: string; entity_type: string; domains: string[]; status: string; reachable_goals: string[]
  }[]

  /* ① مجالٌ لا يسنده كيان — فجوةٌ صريحةٌ لا اجتهاد فيها */
  const covered = new Set(entities.flatMap((e) => e.domains))
  const bare = domainsV2.map((d: { id: string }) => d.id).filter((d: string) => !covered.has(d))

  /* ② مسارٌ لم يفز في المسح — لا «ميّت»، بل لم يُوصَل بما غيّره المسح */
  const unwon = launchPathways.filter((p) => !wins.has(p.id))

  /* ③ رمزُ هدفٍ تنتظره البروفايلاتُ ولا يعلنه سؤالُ الهدف */
  const declared = new Set(GOALS_V21.map((g) => g.legacy_goal))
  const profiles = (profilesJson as { profiles: Record<string, { goals?: string[] }> }).profiles
  const awaited = new Map<string, string[]>()
  for (const [pid, prof] of Object.entries(profiles)) {
    for (const goal of prof.goals ?? []) {
      if (!declared.has(goal)) awaited.set(goal, [...(awaited.get(goal) ?? []), pid])
    }
  }

  const noPath = [...kinds.values()].reduce((a, b) => a + b, 0)
  const ranked = [...wins].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const title = (id: string) => launchPathways.find((p) => p.id === id)?.short_title ?? ''

  return `# فجوات الكتالوج كما يكشفها تشخيص V2.1

> **وُلّدت آليًا — ولا يُكتب فيها حرفُ تعليلٍ لا يُحسَب.**
> \`npx tsx scripts/v2_1/audit-catalog-gaps.ts\` · ويقارنها \`--check\` في \`npm run verify\`.
>
> المصدر: مسحٌ حتميٌّ لـ**${sessions}** جلسةً على محرّك V2.1 الحيّ (مرحلة × هدف × احتياج).

## ما يقوله هذا المسح وما لا يقوله

المسحُ يغيّر **المرحلةَ والهدفَ والاحتياج**، ويجيب ما سواها بأوّل خيارٍ ثابت. فـ:

- مسارٌ **فاز** فيه → وُصل يقينا، وله تركيبةُ إجاباتٍ تثبته.
- مسارٌ **لم يفز** فيه → **لم يثبت أنّه لا يُوصَل**. قد يُوصَل بإجابةٍ لا
  يغيّرها المسح (قطاع · سياقُ قيادة · مرحلةُ مشروع · تقييمُ عائلات).

وهذا الفرقُ ليس تحفّظا لفظيّا: نسخةُ هذه الوثيقة التي تصف محرّك V2 قالت إنّ
اثني عشرَ مسارا «لا تُوصَل»، وقياسُ V2.1 يقول إنّ **كلَّها تفوز**. فالخلطُ بين
«لم يظهر في عيّنتي» و«لا يُوصَل» هو ما أنتج تلك الدعوى.

## ١) مجالات لا يسندها كيانٌ واحد

${bare.length === 0
  ? 'لا مجالَ في المعجم بلا كيان.'
  : `| المجال | الرمز |\n|---|---|\n${bare.map((d: string) => `| ${domainLabelAr(d as DomainId)} | \`${d}\` |`).join('\n')}\n\nمجالٌ هنا لا يصله متعلّمٌ بحال — لا مسارَ فيه ولا قالبَ مركّب.`}

## ٢) مسارات لم تفز بالمرتبة الأولى في هذا المسح (${unwon.length} من ${launchPathways.length})

${unwon.length === 0
  ? `**لا مسار.** كلُّ المسارات الـ${launchPathways.length} فازت بالمرتبة الأولى في تركيبةٍ واحدةٍ على الأقلّ.`
  : unwon.map((p) => `- \`${p.id}\` — ${p.short_title}`).join('\n')}

## ٣) رموزُ هدفٍ تنتظرها بروفايلاتُ المسارات ولا يعلنها سؤال الهدف (${awaited.size})

${awaited.size === 0
  ? 'لا رمزَ منتظَرٌ بلا مُعلِن.'
  : `سؤالُ الهدف يعلن **${declared.size}** رمزا، وظهر في المسح **${goalsSeen.size}**. وهذه رموزٌ تسمّيها \`pathway-profiles.v1.json\` ولا يولّدها سؤالٌ قطّ:\n\n| الرمز | المسارات التي تنتظره |\n|---|---|\n${[...awaited]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([g, ps]) => `| \`${g}\` | ${ps.map((p) => `\`${p}\``).join(' · ')} |`)
      .join('\n')}\n\nوهي **لا تمنع فوزا** — المسارُ يُوصَل بالاحتياج والمجال والمرحلة. لكنّ الملفَّ يَعِد بما لا يقع، ومن قرأه ظنّ الهدفَ بابَه.`}

## ٤) جلسات بلا مسارٍ أوّل (${noPath} من ${sessions} · ${pct(noPath, sessions)})

| المخرَج | جلسات | النسبة |
|---|---|---|
${[...kinds].sort((a, b) => b[1] - a[1]).map(([k, v]) => `| \`${k}\` | ${v} | ${pct(v, sessions)} |`).join('\n') || '| — | 0 | 0٪ |'}

## ٥) توزيع المرتبة الأولى

| المسار | جلسات | النسبة | العنوان |
|---|---|---|---|
${ranked.map(([id, n]) => `| \`${id}\` | ${n} | ${pct(n, sessions)} | ${title(id)} |`).join('\n')}

## ٦) قاعدة القرار عند إضافة مسار

> هذا القسمُ **تحريريٌّ لا محسوب** — قرارُ صاحب المنصّة، يُحفظ في المولّد
> ليعود مع كلّ توليد. وما سواه في هذه الوثيقة مقيسٌ من المحرّك.

عندما تُضاف مسارات جديدة لهذه المجالات، لها بابان (ج-١):

- **من المصدر:** ربطها في \`src/data/catalog/v2/pathway-domains.v2.json\` وبروفايلات الجمهور، ثم إعادة الاستيراد — المستورد يكتب صفوف \`PathwayDomain\`.
- **من الإدارة بعد النشر:** معالج «مسار جديد» في إدارة الكتالوج يطلب المجال والجمهور في خطوتين إلزاميتين (ج-٣)، أو \`PUT /api/admin/catalog/pathways/:id/domains\` و\`.../profile\` لمسار قائم.

في الحالتين تُحمَل المجالات داخل لقطة الكتالوج المنشورة، فيلتقطها المحرك دون تغيير كود ولا إعادة بناء للواجهة. ومسارٌ بلا مجال لا يجتاز حاجز النشر أصلا، فلا يوجد منشورٌ لا يدخل مطابقة المجالات.
`
}

const fresh = build()
const path = join(root, DOC)

if (!CHECK) {
  writeFileSync(path, fresh)
  console.log(`✅ ${DOC}`)
} else {
  const committed = readFileSync(path, 'utf8')
  if (committed === fresh) {
    console.log(`✅ ${DOC} يطابق المحرّك الحيّ.`)
  } else {
    console.error(`❌ ${DOC} لا يطابق المحرّك الحيّ.`)
    console.error('\nوثيقةٌ تصف محرّكا غيرَ الذي يخدم المتعلّمين تسوق قارئَها إلى المشكلة الخطأ.')
    console.error('شغّل «npm run report:catalog-gaps» والتزم الوثيقةَ في الطلب نفسِه.')
    process.exit(1)
  }
}

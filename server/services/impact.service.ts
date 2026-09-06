/* خدمة تحليل الأثر — تشغّل الشخصيات الاثنتي عشرة على اللقطة المنشورة الحالية
   وعلى اللقطة المرشحة (المنشور + المعتمد)، وتقارن التوصيات حتميا.
   تعتمد على محرك التشخيص نفسه — لا محاكاة تقريبية.

   البند ب-٢ أضاف الطبقة الناقصة: **مقارنة تسلسل الأسئلة** لا النتائج وحدها.
   تعديلٌ يغيّر ما يُسأل ثم يهبط على المسار نفسه كان يُقرأ «لا أثر» — وهو أثر
   في تجربة كل من يخوض التشخيص. فصار الحكم على ثلاثة أوجه: المسار، والثقة،
   والأسئلة. ومن غيّر السؤال وحده يعرف الآن أنه غيّره. */

import type { PrismaClient } from '@prisma/client'
import { buildSnapshotFromDb, getActiveSnapshot } from '../catalog/snapshot-builder'
import { installCatalogSnapshot, type CatalogSnapshotPayload } from '../../src/domain/diagnostic/catalog'
import { runSession } from '../../src/tests/diagnostic/helpers'
import { PERSONAS } from '../../src/tests/diagnostic/personas'
/* الحزمة المضمنة عبر الاستيراد الثابت لا القراءة من القرص — انظر التعليق في
   runRegressionAgainstBundled أدناه */
import questionsJson from '../../src/data/catalog/questions.v1.ar.json'
import skillsJson from '../../src/data/catalog/skills.v1.ar.json'
import coreCatalogJson from '../../src/data/catalog/core-catalog.v2.json'
import templatesJson from '../../src/data/catalog/composite-templates.v1.json'
import optionEffectsJson from '../../src/data/overlays/option-effects.v2.json'
import pathwayProfilesJson from '../../src/data/overlays/pathway-profiles.v1.json'

export interface PersonaOutcome {
  name: string
  questions: number
  kind: string
  top: string | null
  tpl: string | null
  conf: number
  /** تسلسل معرّفات الأسئلة كما سُئلت — الوجه الثالث للأثر (ب-٢) */
  asked: string[]
}

/** فرق أسئلة شخصية واحدة — ما اختفى وما ظهر وما تغيّر ترتيبه */
export interface QuestionDrift {
  name: string
  removed: string[]
  added: string[]
  /** الأسئلة نفسها بترتيب مختلف — تغيّر في تجربة الحوار لا في محتواه */
  reordered: boolean
}

export interface ConfidenceDrift {
  name: string
  before: number
  after: number
  delta: number
}

export interface ImpactSummary {
  before: PersonaOutcome[]
  after: PersonaOutcome[]
  changed: { name: string; before: PersonaOutcome; after: PersonaOutcome }[]
  changedCount: number
  totalPersonas: number
  /* ── ب-٢ ── */
  /** حكم عربي واحد يُقرأ قبل التفصيل */
  verdictAr: string
  /** true إن تغيّر شيء في أي وجه من الأوجه الثلاثة */
  touchesDiagnostic: boolean
  changedQuestions: QuestionDrift[]
  changedConfidence: ConfidenceDrift[]
  /** من تغيّر مساره أو قالبه — أثقل أنواع الأثر */
  changedWinners: { name: string; beforeTop: string | null; afterTop: string | null }[]
  /** ما قِيس عليه «قبل»: اللقطة المنشورة فعلا، أو الجداول حين لا لقطة بعد */
  baselineAr: string
  /** تسمية اللقطة المنشورة المقيس عليها — null حين لم يُنشر شيء بعد */
  baselineLabel: string | null
}


/* ── ب-٢: أوجه الأثر الثلاثة — دالة نقية تُختبَر بلا تشغيل محرك ──
   المسار وحده لا يكفي حكما: تعديلٌ يغيّر ما يُسأل ثم يهبط على المسار نفسه كان
   يُقرأ «لا أثر»، وهو أثر في تجربة كل من يخوض التشخيص. */
export function diffOutcomes(
  before: PersonaOutcome[],
  after: PersonaOutcome[],
): Pick<ImpactSummary, 'verdictAr' | 'touchesDiagnostic' | 'changedQuestions' | 'changedConfidence' | 'changedWinners'> {
  const changedQuestions: QuestionDrift[] = []
  const changedConfidence: ConfidenceDrift[] = []
  const changedWinners: ImpactSummary['changedWinners'] = []
  const byName = new Map(after.map((a) => [a.name, a]))

  for (const b of before) {
    /* شخصية ناقصة في «بعد» لا تُحتسب فرقا مختلقا — الغياب ليس تغيّرا */
    const a = byName.get(b.name)
    if (!a) continue
    const wasSet = new Set(b.asked)
    const nowSet = new Set(a.asked)
    const removed = b.asked.filter((q) => !nowSet.has(q))
    const added = a.asked.filter((q) => !wasSet.has(q))
    /* الترتيب يُقاس حين لا اختفاء ولا ظهور: بقاء الأسئلة نفسها بترتيب آخر
       أثرٌ في الحوار وإن لم يتغيّر محتواه */
    const reordered =
      removed.length === 0 && added.length === 0 && b.asked.join('>') !== a.asked.join('>')
    if (removed.length > 0 || added.length > 0 || reordered) {
      changedQuestions.push({ name: b.name, removed, added, reordered })
    }
    if (Math.abs(a.conf - b.conf) >= 1e-9) {
      changedConfidence.push({ name: b.name, before: b.conf, after: a.conf, delta: a.conf - b.conf })
    }
    if (b.top !== a.top || b.tpl !== a.tpl || b.kind !== a.kind) {
      changedWinners.push({ name: b.name, beforeTop: b.top ?? b.tpl, afterTop: a.top ?? a.tpl })
    }
  }

  const touchesDiagnostic =
    changedWinners.length > 0 || changedConfidence.length > 0 || changedQuestions.length > 0
  const verdictAr = !touchesDiagnostic
    ? 'لا يمس التشخيص — لا مسار تغيّر ولا ثقة ولا سؤال في الشخصيات الاثنتي عشرة.'
    : [
        'يغيّر التشخيص:',
        changedWinners.length > 0 ? `${changedWinners.length} شخصية تغيّر ترشيحها` : null,
        changedConfidence.length > 0 ? `${changedConfidence.length} تغيّرت ثقتها` : null,
        changedQuestions.length > 0 ? `${changedQuestions.length} تغيّرت أسئلتها` : null,
      ].filter(Boolean).join(' · ')

  return { verdictAr, touchesDiagnostic, changedQuestions, changedConfidence, changedWinners }
}

/** يشغّل كل الشخصيات على الحالة الحالية للمحرك ويعيد النتائج */
function runCohort(): PersonaOutcome[] {
  return PERSONAS.map(([name, script]) => {
    const r = runSession(script)
    return {
      name,
      questions: r.askedOrder.length,
      kind: r.recommendation.kind,
      top: r.recommendation.primaryPathway?.pathwayId ?? null,
      tpl: r.recommendation.composite?.templateId ?? null,
      conf: r.recommendation.confidence.total,
      asked: r.askedOrder,
    }
  })
}

const same = (a: PersonaOutcome, b: PersonaOutcome) =>
  a.kind === b.kind && a.top === b.top && a.tpl === b.tpl && Math.abs(a.conf - b.conf) < 1e-9

/** تحليل أثر كامل: لقطة منشورة حالية مقابل لقطة مرشحة تشمل المعتمد — ويعيد حالة المحرك كما كانت */
export async function analyzeImpact(prisma: PrismaClient, changeRef: string, actorId?: string): Promise<ImpactSummary & { runId: string }> {
  /* «قبل» = ما يقرأه المحرك الآن فعلا: اللقطة المنشورة المجمّدة.
     كانت تُعاد بناؤها من الجداول، وهو صحيح ما دامت الجداول واللقطة متطابقتين
     — وهما تفترقان في الحالة التي يُنشر فيها أصلا. فحين تُستورد جداول جديدة
     ولمّا تُنشر لقطتها، كان الطرفان يُبنيان من الجداول نفسها فيتطابقان،
     ويقول التحليل «لم تتغيّر توصية أحد» عن نشرٍ يغيّر الكتالوج كله.
     أخطر أنواع الخطأ: طمأنينة في الخطوة التي وُضعت لتحذّر. */
  const active = await getActiveSnapshot(prisma)
  const beforePayload = (active?.payload ?? (await buildSnapshotFromDb(prisma)).payload) as unknown as CatalogSnapshotPayload
  const candidateSnap = await buildSnapshotFromDb(prisma, { extraStatuses: ['approved'] })

  installCatalogSnapshot(beforePayload, 'impact-before')
  const before = runCohort()

  installCatalogSnapshot(candidateSnap.payload as unknown as CatalogSnapshotPayload, 'impact-after')
  const after = runCohort()

  /* إعادة المحرك إلى ما كان — التحليل لا يترك أثرا */
  installCatalogSnapshot(beforePayload, 'impact-restored')

  const changed = before
    .map((b, i) => ({ name: b.name, before: b, after: after[i] }))
    .filter((x) => !same(x.before, x.after))

  const summary: ImpactSummary = {
    before, after, changed, changedCount: changed.length, totalPersonas: before.length,
    baselineAr: active
      ? `اللقطة المنشورة «${active.label}» — ما يقرأه المحرك الآن`
      : 'الجداول المنشورة — لا لقطة منشورة بعد، فلا شيء يقرأه المحرك ليُقاس عليه',
    baselineLabel: active?.label ?? null,
    ...diffOutcomes(before, after),
  }
  const run = await prisma.impactAnalysisRun.create({
    data: { changeRef, summary: summary as unknown as object, createdBy: actorId },
  })
  return { ...summary, runId: run.id }
}

/** تشغيل ارتداد للقطات المنشورة — يقارنها بالحزمة المضمنة ويحفظ DiagnosticRegressionRun */
export async function runRegressionAgainstBundled(prisma: PrismaClient, catalogVersionId?: string) {
  /* الحزمة المضمنة = إعادة التهيئة الافتراضية، والحالة وقت الإقلاع لم تعد
     متاحة بعد أول install — فنعيد تركيبها من ملفات المصدر نفسها.

     كانت تُقرأ من القرص بجذر محسوب من import.meta.url بصعود مستويين: صحيح
     للمصدر (server/services/…)، وخاطئ للحزمة التي يشغّلها الإنتاج من
     api/index.js وحده — فيصعد المستويان فوق جذر المستودع وتسقط القراءة
     بـENOENT. الاستيراد الثابت يزيل الحساب والقراءة معا: الاعتمادُ يُرى في
     الشيفرة ولا يُخمَّن من مسارٍ يُحسب وقتَ التشغيل. وحزمةُ Vercel زالت بزوالها،
     والقاعدةُ تبقى — فما يُقرأ من القرص وقتَ التشغيل يكسره أوّلُ تغييرِ تخطيط. */
  const bundled = {
    questions: questionsJson,
    skills: skillsJson,
    coreCatalog: coreCatalogJson,
    templates: templatesJson,
    optionEffects: optionEffectsJson,
    pathwayProfiles: pathwayProfilesJson,
  }
  installCatalogSnapshot(bundled as unknown as CatalogSnapshotPayload, 'bundled')
  const bundledOut = runCohort()

  const dbSnap = await buildSnapshotFromDb(prisma)
  installCatalogSnapshot(dbSnap.payload as unknown as CatalogSnapshotPayload, 'db-published')
  const dbOut = runCohort()

  installCatalogSnapshot(bundled as unknown as CatalogSnapshotPayload, 'bundled-restored')

  const results = bundledOut.map((b, i) => ({ ...b, db: dbOut[i], match: same(b, dbOut[i]) }))
  const passed = results.every((r) => r.match)
  await prisma.diagnosticRegressionRun.create({
    data: { catalogVersionId: catalogVersionId ?? null, results: results as unknown as object, passed },
  })
  return { passed, results }
}

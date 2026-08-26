/* هدر مقاعد الأسئلة — V2.1 (قياس مضاد للواقع، لا رصد)
   السكربت الشقيق question-value.ts رصديٌّ: يقيس هل تغيّر الفائز بعد الإجابة
   التي وقعت فعلا. وعجزه أنه لا يفرّق بين حالتين مختلفتين تماما:
     • سؤال حاسم صادف أن جوابه أبقى المتصدر،
     • وسؤال لا يستطيع أيُّ جواب من أجوبته أن يغيّر شيئا.
   الأول يجب حمايته، والثاني وقتُ متعلم مهدور — ويظهران متطابقين في الرصد.

   هنا نقيس المضاد للواقع: لكل سؤال طُرح، نعيد تشغيل الجلسة كاملة بكل جواب
   بديل ونقارن النتيجة النهائية. فإن لم يغيّر أيُّ بديل المسارَ الموصى به ولا
   الثقة، فالمقعد مهدور إثباتا لا ظنّا.

   القياس حتمي: بذرة ثابتة ونفس مولّد الجلسات المستعمل في golden-suite.
   لا يغيّر السكربت سؤالا ولا محركا — تقرير قياس فقط. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createEngineV21 } from '../../src/domain/diagnostic/v2_1'
import { GOALS_V21, NEEDS_V21, Q, type CareerStage } from '../../src/domain/diagnostic/v2_1/maps'
import { questionById } from '../../src/domain/diagnostic/catalog'
import type { BankQuestion } from '../../src/domain/diagnostic/types'

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]

const STAGE_LABEL: Record<CareerStage, string> = {
  university_student: 'طالب جامعي',
  fresh_graduate: 'خريج حديث',
  early_career: 'موظف في بداية مساري المهني',
  experienced: 'موظف ذو خبرة',
  manager: 'مدير / قائد فريق',
  senior_manager: 'مدير أول / تنفيذي',
  founder: 'مؤسس / صاحب عمل',
  freelancer: 'مستقل — أعمل لحسابي',
  trainer_ld: 'مدرب / معلم / مختص تعلم وتطوير',
  other_unsure: 'غير ذلك / غير متأكد',
}
const ALL_STAGES = Object.keys(STAGE_LABEL) as CareerStage[]
const TIME_BY_ORDER = ['أقل من ساعتين أسبوعيًا', '٢–٤ ساعات', '٥–٧ ساعات', '٨ ساعات أو أكثر']
const MASTERY = ['أن أتقن مهارة أو تخصصًا واحدًا بعمق', 'أن أبني مجموعة مهارات مترابطة لتحقيق هدف', 'غير متأكد']
const INTERESTS = ['تقنية', 'أعمال', 'تسويق', 'تعليم', 'صناعة محتوى', 'قيادة', 'حكومة/سياسات', 'مالية', 'لا أعرف']

/** الفرق الذي نعتبره تحتَه «لا شيء تغيّر» — أصغر من أي حركة ذات معنى في الثقة */
const EPS = 1e-6
/** سقف البدائل المجرَّبة لكل سؤال — يحمي من انفجار زمن التشغيل على أسئلة طويلة الخيارات */
const MAX_ALTS = 6
/** خط الأساس — البوابة تفشل إن نما الهدر أو ظهر سؤال ميت جديد */
const BASELINE_PATH = 'question-waste-baseline.json'

interface Baseline {
  seed: number
  sessions: number
  totalSeats: number
  deadSeats: number
  fullyDead: string[]
}

interface Script {
  stage: CareerStage
  employment: string
  goal: string
  need: string
  time: string
  mastery: string
  interest: string
  skillLevel: number
  govSector: boolean
}

/** سياسة الإجابة الحتمية — مطابقة لمنطق question-value.ts وsim-journeys.ts */
function answerIndex(q: BankQuestion, s: Script): number {
  const byLabel = (l?: string) => (l ? q.options_ar.indexOf(l) : -1)
  let idx = -1
  if (q.question_id === Q.STAGE) idx = byLabel(STAGE_LABEL[s.stage])
  else if (q.question_id === Q.EMPLOYMENT) idx = byLabel(s.employment)
  else if (q.question_id === Q.GOAL) idx = byLabel(s.goal)
  else if (q.question_id === Q.NEED) idx = byLabel(s.need)
  else if (q.question_id === Q.TIME) idx = byLabel(s.time)
  else if (q.question_id === Q.MASTERY) idx = byLabel(s.mastery)
  else if (q.question_id === 'QB-M3E-002') idx = byLabel(s.interest)
  else if (q.question_id === 'QB-M3B-001' && s.govSector) idx = byLabel('حكومي')
  else if (q.answer_type === 'skill_level_5' || q.answer_type === 'likert_5') idx = s.skillLevel - 1
  else idx = 0
  return idx < 0 ? 0 : Math.min(idx, Math.max(0, q.options_ar.length - 1))
}

interface Seat {
  questionId: string
  /** الخيار الذي اختارته السياسة — نجرّب ما عداه */
  chosenIdx: number
  optionCount: number
  /** الثقة قبل الإجابة وبعدها — لكشف الأسئلة التي تخفض الثقة */
  confBefore: number
  confAfter: number
}
interface Outcome {
  seats: Seat[]
  winner: string | null
  confidence: number
}

/** الثقة الكلية من توصية المحرك — v2 اختياري في النوع، وغيابه يعني «لا ثقة محسوبة» */
function confOf(engine: ReturnType<typeof createEngineV21>): number {
  return engine.recommend().v2?.confidence.overall ?? 0
}

/** يشغّل جلسة كاملة بالسياسة، مع إمكان فرض جواب واحد على سؤال بعينه */
function runSession(s: Script, sessionId: string, force?: { questionId: string; idx: number }, collectSeats = false): Outcome {
  const engine = createEngineV21(sessionId)
  const seats: Seat[] = []
  for (let step = 0; step < 20; step++) {
    const next = engine.nextQuestion()
    if (next.stop.shouldStop || !next.question) break
    const q = next.question
    const idx = force && force.questionId === q.question_id ? force.idx : answerIndex(q, s)
    const confBefore = collectSeats ? confOf(engine) : 0
    engine.answer({
      questionId: q.question_id,
      value: q.options_ar[idx] ?? 'لا ينطبق',
      optionIds: [q.active_option_ids?.[idx] ?? `o${idx + 1}`],
    })
    if (collectSeats) {
      seats.push({
        questionId: q.question_id,
        chosenIdx: idx,
        optionCount: q.options_ar.length,
        confBefore,
        confAfter: confOf(engine),
      })
    }
  }
  const r = engine.recommend()
  return { seats, winner: r.primaryPathway?.pathwayId ?? null, confidence: r.v2?.confidence.overall ?? 0 }
}

interface QStat {
  /** عدد المقاعد التي شغلها السؤال عبر الجلسات */
  seats: number
  /** مقاعد لم يغيّر فيها أيُّ جواب بديل شيئا — هدر مُثبَت */
  dead: number
  /** مقاعد قلب فيها بديلٌ واحد على الأقل المسارَ الموصى به */
  couldFlip: number
  /** مجموع أكبر تغيّر ممكن في الثقة عبر البدائل */
  sumBestConfSwing: number
  /** مقاعد خفضت الثقة عند الإجابة عنها */
  loweredConf: number
  /** مجموع الانخفاض (موجب = مقدار الهبوط) */
  sumConfDrop: number
}

function main() {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const write = args.includes('--write-baseline')
  const nums = args.filter((a) => !a.startsWith('--'))
  const seed = Number(nums[0] ?? 20260822)
  const sessions = Number(nums[1] ?? 300)
  const rng = mulberry32(seed)
  const stats = new Map<string, QStat>()
  const bump = (id: string): QStat => {
    const s = stats.get(id) ?? { seats: 0, dead: 0, couldFlip: 0, sumBestConfSwing: 0, loweredConf: 0, sumConfDrop: 0 }
    stats.set(id, s)
    return s
  }
  let totalSeats = 0
  let deadSeats = 0
  const t0 = Date.now()

  for (let i = 0; i < sessions; i++) {
    const stage = pick(rng, ALL_STAGES)
    const goals = GOALS_V21.filter((g) => g.stages === 'all' || g.stages.includes(stage))
    const needs = NEEDS_V21.filter((n) => n.stages === 'all' || n.stages.includes(stage))
    const script: Script = {
      stage,
      employment: pick(rng, ['أعمل لدى جهة', 'لا أعمل حاليًا', 'لدي مشروعي الخاص']),
      goal: pick(rng, goals).label_ar,
      need: pick(rng, needs).label_ar,
      time: pick(rng, TIME_BY_ORDER),
      mastery: pick(rng, MASTERY),
      interest: pick(rng, INTERESTS),
      skillLevel: 1 + Math.floor(rng() * 5),
      govSector: rng() < 0.15,
    }
    const sid = `qw-${seed}-${i}`
    const base = runSession(script, sid, undefined, true)

    for (const seat of base.seats) {
      const st = bump(seat.questionId)
      st.seats++
      totalSeats++
      const drop = seat.confBefore - seat.confAfter
      if (drop > EPS) {
        st.loweredConf++
        st.sumConfDrop += drop
      }

      /* البدائل: كل خيار عدا المختار، بسقف MAX_ALTS موزّع على المدى */
      const alts: number[] = []
      for (let k = 0; k < seat.optionCount; k++) if (k !== seat.chosenIdx) alts.push(k)
      const step = alts.length > MAX_ALTS ? Math.ceil(alts.length / MAX_ALTS) : 1
      const tried = alts.filter((_, n) => n % step === 0).slice(0, MAX_ALTS)

      let flipped = false
      let bestSwing = 0
      for (const idx of tried) {
        const alt = runSession(script, sid, { questionId: seat.questionId, idx })
        if (alt.winner !== base.winner) flipped = true
        const swing = Math.abs(alt.confidence - base.confidence)
        if (swing > bestSwing) bestSwing = swing
      }
      if (flipped) st.couldFlip++
      st.sumBestConfSwing += bestSwing
      /* مقعد ميت: لا بديل قلب المسار ولا حرّك الثقة. الأسئلة بخيار واحد
         (tried فارغة) ميتة بالتعريف — لا اختيار فيها أصلا. */
      if (!flipped && bestSwing <= EPS) {
        st.dead++
        deadSeats++
      }
    }
  }

  const rows = [...stats.entries()]
    .map(([id, s]) => ({
      id,
      text: questionById.get(id)?.text_ar?.slice(0, 55) ?? '—',
      seats: s.seats,
      dead: s.dead,
      deadRate: s.seats > 0 ? s.dead / s.seats : 0,
      couldFlip: s.couldFlip,
      avgSwing: s.seats > 0 ? s.sumBestConfSwing / s.seats : 0,
      loweredConf: s.loweredConf,
      avgDrop: s.loweredConf > 0 ? s.sumConfDrop / s.loweredConf : 0,
    }))
    .sort((a, b) => b.dead - a.dead || b.seats - a.seats)

  const fullyDead = rows.filter((r) => r.dead === r.seats)
  const everUseful = rows.filter((r) => r.dead < r.seats)
  const lowering = rows.filter((r) => r.loweredConf > 0).sort((a, b) => b.avgDrop * b.loweredConf - a.avgDrop * a.loweredConf)
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  const md: string[] = []
  md.push('# هدر مقاعد الأسئلة — تشخيص V2.1', '')
  /* زمن التشغيل لا يدخل الملف الملتزَم: يختلف كل مرة فيجعل التقرير غير قابل
     لإعادة الإنتاج ويُوسّخ الشجرة بلا تغيّر في نتيجة واحدة. مكانه الطرفية. */
  md.push(`توليد: ${new Date().toISOString().slice(0, 10)} · بذرة ${seed} · ${sessions} جلسة حتمية.`, '')
  md.push('> قياس **مضاد للواقع**: لكل سؤال طُرح، أُعيد تشغيل الجلسة بكل جواب بديل.')
  md.push('> «مقعد ميت» = لا جواب من أجوبته يغيّر المسار الموصى به ولا الثقة — هدر مُثبَت لا مُقدَّر.', '')
  md.push('## الخلاصة', '')
  md.push(`- **مقاعد الأسئلة الكلية:** ${totalSeats}`)
  md.push(`- **المقاعد الميتة:** ${deadSeats} (${((deadSeats / Math.max(1, totalSeats)) * 100).toFixed(1)}٪ من وقت المتعلم)`)
  md.push(`- **أسئلة ميتة في كل مقاعدها:** ${fullyDead.length} من ${rows.length}`)
  md.push(`- **أسئلة تخفض الثقة أحيانا:** ${lowering.length}`, '')

  if (fullyDead.length > 0) {
    md.push('## أسئلة لم يغيّر أيُّ جواب لها شيئا — في كل مقاعدها', '')
    md.push('| السؤال | النص (مختصر) | مقاعد |')
    md.push('|---|---|---|')
    for (const r of fullyDead) md.push(`| \`${r.id}\` | ${r.text.replace(/\|/g, '\\|')} | ${r.seats} |`)
    md.push('')
  }

  md.push('## كل الأسئلة — مرتّبة بالهدر', '')
  md.push('| السؤال | النص (مختصر) | مقاعد | ميتة | نسبة الهدر | يمكنه القلب | متوسط أكبر أرجحة ثقة | خفض الثقة | متوسط الخفض |')
  md.push('|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    md.push(
      `| \`${r.id}\` | ${r.text.replace(/\|/g, '\\|')} | ${r.seats} | ${r.dead} | ${(r.deadRate * 100).toFixed(0)}٪ | ${r.couldFlip} | ${r.avgSwing.toFixed(4)} | ${r.loweredConf} | ${r.avgDrop.toFixed(4)} |`,
    )
  }
  md.push('')
  md.push('## القراءة', '')
  md.push('- **نسبة هدر عالية + مقاعد كثيرة** → السؤال يستهلك وقت المتعلم بلا مقابل قراري. مرشح للنقل إلى جولة التأكيد أو للتقاعد (قرار أكاديمي لا يُنفَّذ من هذا التقرير).')
  md.push('- **يمكنه القلب ولو نادرا** → فاصلٌ حقيقي يجب حمايته، مهما بدا هامشيا في الرصد.')
  md.push('- **خفض الثقة** → السؤال يضيف معلومة تُضعف يقين المحرك. هذا ليس عيبا بالضرورة (الصدق أهم من الرقم)، لكنه يستحق مراجعة: هل يُترجَم جوابُ سؤالِ جدوى إلى شك في صحة التطابق؟', '')

  /* --check بوابة تحقق لا تُعدّل: الكتابة فيها تترك شجرة CI متسخة بعد كل تشغيل */
  if (!check) writeFileSync('docs/QUESTION_WASTE_V2_1_AR.md', md.join('\n'))

  const current: Baseline = {
    seed,
    sessions,
    totalSeats,
    deadSeats,
    fullyDead: fullyDead.map((r) => r.id).sort(),
  }
  if (write) {
    writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n')
    console.log(`✍️  ${BASELINE_PATH} — خط أساس جديد: ${deadSeats}/${totalSeats} مقعدا ميتا · ${current.fullyDead.length} سؤالا ميتا كليا`)
    return
  }
  if (check) {
    if (!existsSync(BASELINE_PATH)) {
      console.error(`✗ لا خط أساس — شغّل: npm run audit:question-waste -- --write-baseline`)
      process.exit(1)
    }
    const base = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline
    const failures: string[] = []
    if (base.seed !== seed || base.sessions !== sessions) {
      failures.push(`خط الأساس مُقاس ببذرة ${base.seed} و${base.sessions} جلسة — والتشغيل الحالي ${seed}/${sessions}. لا مقارنة بلا تطابق.`)
    } else {
      /* الاتجاه هو المحروس: الهدر لا ينمو. انخفاضه مرحّب به ويُحدَّث بـ--write-baseline */
      if (deadSeats > base.deadSeats) failures.push(`المقاعد الميتة نمت: ${base.deadSeats} ← ${deadSeats}`)
      const fresh = current.fullyDead.filter((id) => !base.fullyDead.includes(id))
      if (fresh.length > 0) failures.push(`أسئلة صارت ميتة كليا ولم تكن: ${fresh.join('، ')}`)
    }
    if (failures.length > 0) {
      console.error('✗ بوابة هدر الأسئلة:')
      for (const f of failures) console.error('  •', f)
      process.exit(1)
    }
    const gained = base.deadSeats - deadSeats
    console.log(`✓ بوابة هدر الأسئلة: ${deadSeats}/${totalSeats} مقعدا ميتا` + (gained > 0 ? ` — انخفض ${gained} عن خط الأساس (حدّثه بـ--write-baseline)` : ''))
    return
  }
  console.log(`📄 docs/QUESTION_WASTE_V2_1_AR.md — ${sessions} جلسة · ${elapsed}s`)
  console.log(`   مقاعد كلية: ${totalSeats} · ميتة: ${deadSeats} (${((deadSeats / Math.max(1, totalSeats)) * 100).toFixed(1)}٪)`)
  console.log(`   أسئلة ميتة كليا: ${fullyDead.length} من ${rows.length} · تخفض الثقة: ${lowering.length}`)
  if (fullyDead.length > 0) console.log('   الميتة كليا:', fullyDead.map((r) => `${r.id}(${r.seats})`).join(' '))
  console.log('   أعلى خمسة هدرا:', rows.slice(0, 5).map((r) => `${r.id} ${(r.deadRate * 100).toFixed(0)}٪`).join(' · '))
  console.log(`   أسئلة نافعة ولو مرة: ${everUseful.length}`)
}
main()

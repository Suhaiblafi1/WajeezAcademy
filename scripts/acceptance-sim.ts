/* محاكاة قبول لمحرك التشخيص التكيفي v4 — أربعة سيناريوهات
   تشغيل: esbuild --bundle ثم node */
import {
  nextQuestion,
  computeResult,
  type DiagQuestion,
  type DiagOption,
} from "../src/data/diagnostic";

type Answers = Record<string, string>;

const resolve = <T,>(v: T | ((a: Answers) => T) | undefined, a: Answers): T | undefined =>
  typeof v === "function" ? (v as (a: Answers) => T)(a) : v;

interface SimOutcome {
  asked: string[];
  deepAsked: string[];
  answers: Answers;
  top: string;
  topId: string;
  confidence: number;
  needsAdvisor: boolean;
  faster: string | null;
  cheaper: string | null;
  reconciled: boolean;
  priorOverlap: string[];
}

function simulate(script: Answers): SimOutcome {
  let answers: Answers = {};
  let asked: string[] = [];
  const deepAsked: string[] = [];
  let guard = 0;

  for (;;) {
    if (++guard > 60) throw new Error("حلقة لا نهائية — المحرك لم يتوقف");
    const q = nextQuestion(answers, asked);
    if (!q) break;
    if (q.level === "deep" || q.level === "conditional") deepAsked.push(q.id);

    let value: string;
    if (q.type === "text" || q.type === "ratings") {
      value = script[q.id] ?? "";
    } else {
      const opts: DiagOption[] = resolve(q.options, answers) ?? [];
      const scripted = script[q.id];
      if (q.type === "multi") {
        const wanted = (scripted ?? "").split(",").filter(Boolean);
        const valid = wanted.filter((w) => opts.some((o) => o.value === w));
        value = valid.length ? valid.join(",") : (opts.find((o) => o.value !== "none")?.value ?? "none");
      } else {
        value = scripted && opts.some((o) => o.value === scripted) ? scripted : opts[0]?.value ?? "";
      }
    }
    answers = { ...answers, [q.id]: value };
    asked = [...asked, q.id];
  }

  const res = computeResult(answers);
  return {
    asked,
    deepAsked,
    answers,
    top: res.top.name,
    topId: res.top.id,
    confidence: res.confidence,
    needsAdvisor: res.needsAdvisor,
    faster: res.faster?.name ?? null,
    cheaper: res.cheaper ? `${res.cheaper.p.name} (${res.cheaper.price}$)` : null,
    reconciled: res.reconciled,
    priorOverlap: res.priorOverlap,
  };
}

function report(name: string, o: SimOutcome, checks: [string, boolean][]) {
  console.log(`\n═══ ${name} ═══`);
  console.log(`الأسئلة (${o.asked.length}): ${o.asked.join(" → ")}`);
  console.log(`أسئلة التعميق/الشرطية: ${o.deepAsked.length ? o.deepAsked.join("، ") : "لا شيء"}`);
  console.log(`التوصية: ${o.top} · الثقة ${o.confidence}% · مستشار: ${o.needsAdvisor ? "نعم" : "لا"}`);
  console.log(`بديل أسرع: ${o.faster ?? "—"} · أقل تكلفة: ${o.cheaper ?? "—"} · تسوية هدف: ${o.reconciled ? "نعم" : "لا"}`);
  if (o.priorOverlap.length) console.log(`تقاطع الرصيد السابق: ${o.priorOverlap.join("، ")}`);
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "✓" : "✗"} ${label}`);
    if (!pass) ok = false;
  }
  return ok;
}

let allOk = true;

/* ١) الواثق — موظف حكومي واضح الهدف، عائقه البيانات، وله رصيد سابق متقاطع */
const o1 = simulate({
  persona: "employee", goal: "performance", day_story: "meetings", clarity: "very_clear",
  emp_sector: "government", gov_audience: "data", emp_role: "specialist", emp_obstacle: "data",
  emp_moment: "تأخرت في تسليم تقرير المؤشرات الأسبوعي بسبب ضعفي في الجداول",
  sk_gaps: "data,ai", sc_data: "2", sc_ai: "2",
  prev_courses: "دورة حوكمة البيانات من معهد",
  target_date: "mid", format: "mixed", learn_lang: "arabic", commit_pref: "full_path",
  second_goal: "none", notes: "",
});
allOk = report("الواثق — موظف حكومي واضح", o1, [
  ["أسئلة ضمن الحد (≤24 — البنك كبر: اللغة والقصة والرصيد)", o1.asked.length <= 24],
  ["لا سؤال تأكيد (قال هدفه بثقة)", !o1.asked.includes("confirm_goal")],
  ["أسئلة الحكومي ظهرت", o1.asked.includes("gov_audience")],
  ["سؤال «ما يبطئك» ظهر لكل موظف", o1.asked.includes("emp_obstacle")],
  ["قصة الموظف الواقعية ظهرت", o1.asked.includes("emp_moment")],
  ["سؤال اللغة ظهر", o1.asked.includes("learn_lang")],
  ["سؤال الرصيد السابق ظهر", o1.asked.includes("prev_courses")],
  ["سؤال الساعات الأسبوعية أُزيل نهائيا", !o1.asked.includes("weekly_hours")],
  ["التقييم الذاتي أُزيل نهائيا", !o1.asked.includes("sk_rating")],
  ["موقف البيانات السلوكي ظهر", o1.asked.includes("sc_data")],
  ["موقف الذكاء الاصطناعي ظهر (فجوة معلنة)", o1.asked.includes("sc_ai")],
  ["سؤال المهارات استبعد ما ذكره في عوائقه", !o1.answers["sk_gaps"].split(",").includes("data")],
  ["تقاطع الرصيد اكتُشف عندما كانت التوصية مسار البيانات", o1.topId !== "PW-GOV-007" || o1.priorOverlap.length >= 1],
  ["ثقة عالية (≥75)", o1.confidence >= 75],
  ["لا إحالة لمستشار", !o1.needsAdvisor],
]) && allOk;

/* ٢) الملتبس — مستكشف ضبابي يطلب مستشارا */
const o2 = simulate({
  persona: "unsure", goal: "change", day_story: "routine_meaning", clarity: "vague",
  uns_interests: "none", fup_uns_none: "data", fup_goal_vague: "project", uns_experiment: "advisor",
  sk_gaps: "none",
  prev_courses: "",
  target_date: "year", format: "recorded", learn_lang: "either",
  notes: "",
});
allOk = report("الملتبس — مستكشف ضبابي", o2, [
  ["تعميق الغموض ظهر (fup)", o2.deepAsked.some((id) => id.startsWith("fup_"))],
  ["لا مواقف سلوكية بلا فجوات معلنة", !o2.asked.some((id) => id.startsWith("sc_"))],
  ["إحالة لمستشار بشري", o2.needsAdvisor],
  ["ثقة منخفضة (<55)", o2.confidence < 55],
]) && allOk;

/* ٣) مغيّر الهدف — قال شيئا ثم نضجت فكرته */
const o3 = simulate({
  persona: "employee", goal: "performance", day_story: "meetings", clarity: "medium",
  confirm_goal: "change", reconcile_goal: "change",
  emp_sector: "private", emp_role: "desk", emp_obstacle: "writing",
  emp_moment: "اجتماع مراجعة مع مديري ولم أستطع عرض تقريري بوضوح",
  sk_gaps: "communication", sc_writing: "2", sc_communication: "2",
  prev_courses: "",
  target_date: "mid", format: "live", learn_lang: "arabic",
  second_goal: "none", notes: "",
});
allOk = report("مغيّر الهدف — من الأداء إلى التحول", o3, [
  ["سؤال التأكد ظهر (وضوح متوسط)", o3.asked.includes("confirm_goal")],
  ["السؤال الاستنكاري ظهر بعد تغير الإجابة", o3.asked.includes("reconcile_goal")],
  ["قصة الموظف الواقعية ظهرت", o3.asked.includes("emp_moment")],
  ["موقف الكتابة ظهر (عائق معلن)", o3.asked.includes("sc_writing")],
  ["موقف التواصل ظهر (فجوة معلنة)", o3.asked.includes("sc_communication")],
  ["التسوية سُجلت في النتيجة", o3.reconciled],
]) && allOk;

/* ٤) الطموح بموعد قريب — طالب يستعجل الوظيفة */
const o4 = simulate({
  persona: "student", goal: "job", day_story: "studying", clarity: "clear",
  sk_gaps: "communication", sc_communication: "2",
  prev_courses: "",
  target_date: "soon", format: "applied", learn_lang: "english_ok",
  conflict_resolve: "lighter", second_goal: "none", notes: "",
});
allOk = report("الطموح بموعد قريب — طالب مستعجل", o4, [
  ["سؤال الواقعية ظهر (طموح قريب بلا سؤال ساعات)", o4.asked.includes("conflict_resolve")],
  ["أسئلة فرع الطالب ظهرت", o4.asked.some((id) => id.startsWith("stu_"))],
  ["موقف التواصل ظهر (فجوة معلنة)", o4.asked.includes("sc_communication")],
  ["سؤال اللغة ظهر", o4.asked.includes("learn_lang")],
  ["اكتمل التشخيص وأعطى توصية", o4.top.length > 0],
]) && allOk;

console.log(`\n${allOk ? "✓ كل سيناريوهات القبول نجحت" : "✗ بعض السيناريوهات فشلت"}`);
process.exit(allOk ? 0 : 1);

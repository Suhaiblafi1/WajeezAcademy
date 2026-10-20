/* اختيار الشعبة — كلُّ شعبةٍ صندوقُها، بموعدها ومدرّبها.

   بقرار صاحب المنتج: «يجب أن يكون هناك تاريخ لأقرب شعبة لكلّ دورة، ويحقّ له
   اختيار الشعبة التي يريد بحسب المتوفّر وما يناسبه». وقبله كان اختيار الموعد
   يعيش في صفحةٍ مستقلّة («الشعب المفتوحة») بعيدةً عن الدورة التي يفكّر فيها —
   فيقرأ عن دورةٍ هنا ويبحث عن موعدها هناك.

   والمكوّن واحدٌ يُستعمل في ثلاثة مواضع — صفحة المسار العامّة، وصفحة الدورة،
   و«مساري» — فلا يفترق ما يراه الزائر عمّا يراه المشتري.

   ═══ وصارت الشعبُ صناديقَ ظاهرةً لا «موعد آخر (١)» (٢٠ أكتوبر ٢٠٢٦) ═══

   كان الأقربُ وحدَه ظاهرا والبقيّةُ خلف زرّ، وتحت الدورة شارةٌ واحدةٌ تجمع مدرّبي شعبها:
   «المدرب: أحمد، إيناس». فقرأها صاحبُ المنصّة شعبةً واحدةً بمدرّبَين: «لماذا تظهر الشعبة التي
   فيها مدرّبين اثنين وكأنّهم شعبةٌ واحدة! يجب أن تظهر وكأنّهم شعبتان للدورة، وهو يختار الشعبة
   المناسبة له كتوقيتٍ ومدرّب.. ينطبق هذا على كلّ الدورات.. ويفضّل أن يظهر اسمُ المدرّب بوضوح
   وصورتُه بنفس صندوق الشعبة، ينقله لمكان النبذة عن المدرّب».

   فلكلّ شعبةٍ صندوق: وجهُ مدرّبها واسمُه (بابُهما بطاقتُه في صفحة الفريق حيث نبذتُه)، ثمّ موعدُها
   وأيّامُها، ومقاعدُها حين توشك أن تمتلئ. والاختيارُ زرُّ راديو حقيقيّ — يُنقَّل بالأسهم ويُعلَن
   لقارئ الشاشة. والمختارةُ تنفتح على نبذة خطّتها ولقاءاتها.

   وخشيةُ الازدحام التي أخفت البقيّةَ قائمةٌ في طرفها: أكثرُ الدورات شعبةٌ أو اثنتان، ومن له أكثرُ
   من ثلاثٍ تظهر أقربُ ثلاثٍ منها والباقي بطلب. */

import { useId, useState, type MouseEvent } from "react";
import { Link } from "react-router";
import { CalendarDays, Check, ChevronDown, ChevronLeft, Users } from "lucide-react";
import type { CohortOption, CohortTrainer } from "@/services/cohort-prices";
import { daysLabelAr, untilLabelAr } from "@/utils/format";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { initialsOf } from "@/application/text/initials";
import LiveSessionDates from "@/components/LiveSessionDates";
import { Inset } from "@/components/ui/Surface";

/** ما يقال تحت دورةٍ لا شعبةَ لها — قرارُ صاحب المنصّة (١٩ أكتوبر ٢٠٢٦)، وشرحُه عند موضعه أدناه */
const NO_COHORT_AR = "لا شعبة لها بعد";

/** كم شعبةً تظهر قبل «شعب أخرى» — الأقربُ أوّلا */
const VISIBLE_COHORTS = 3;

/** «شعبتان» و«3 شعب» — عددٌ يُقرأ */
const cohortsCountAr = (n: number) => (n === 2 ? "شعبتان" : n >= 3 && n <= 10 ? `${n} شعب` : `${n} شعبة`);

/** سطرُ موعدٍ واحد — التاريخ ثمّ بُعده ثمّ أيّامه */
function When({ c }: { c: CohortOption }) {
  const until = untilLabelAr(c.startsAt);
  const days = daysLabelAr(c.daysOfWeek);
  return (
    <span className="block min-w-0 text-fine leading-5 text-muted-foreground">
      <CalendarDays className="me-1 inline h-3.5 w-3.5 align-[-2px] text-teal-light-ink" aria-hidden="true" />
      <span className="font-bold text-foreground">{cohortDayAr(c.startsAt)}</span>
      {until && <span> · {until}</span>}
      {days && <span> · {days}{c.startTime ? ` ${c.startTime}` : ""}</span>}
    </span>
  );
}

/** بابُ نبذة المدرّب — بطاقتُه في صفحة الفريق، ونبذتُه تنفتح هناك */
const bioHref = (t: CohortTrainer) => `/trainers#trainer-${encodeURIComponent(t.id)}`;

/** وجهُ المدرّب — صورتُه المعتمَدة، أو حروفُ اسمه حين لا صورة أو لم تصل */
function Face({ t }: { t: CohortTrainer }) {
  const [failed, setFailed] = useState(false);
  const box = "grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full ring-2 ring-paper";
  return t.photoUrl && !failed ? (
    <img src={t.photoUrl} alt="" width={44} height={44} loading="lazy" decoding="async"
      onError={() => setFailed(true)} className={`${box} object-cover object-[50%_30%]`} />
  ) : (
    /* `bg-teal-deep` مع `text-white` يبقى أبيضَ في المظهر النهاريّ — كبطاقة الفريق */
    <span aria-hidden="true" className={`${box} bg-teal-deep text-sm font-black text-white`}>{initialsOf(t.name)}</span>
  );
}

/* المدرّبُ جزءٌ من القرار: «أكثر من شعبة لأكثر من مدرّب وتواريخ مختلفة فيختار ما يشاء»
   (صاحب المنصّة، ٨ سبتمبر ٢٠٢٦). ولا يُعرض اسمٌ ولا وجهٌ لم يُعتمَد نشرُه — الخادمُ يرشّح قبل أن يصل. */
function Trainers({ c }: { c: CohortOption }) {
  if (c.trainerProfiles.length === 0) return null;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
      {c.trainerProfiles.map((t) => {
        const inner = (
          <>
            <Face t={t} />
            <span className="min-w-0">
              <span className="block text-sm font-black leading-5 text-foreground group-hover:underline">{t.name}</span>
              {t.id && (
                <span className="flex items-center gap-0.5 whitespace-nowrap text-fine font-bold leading-4 text-teal-light-ink">
                  نبذة المدرب
                  <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                </span>
              )}
            </span>
          </>
        );
        /* الرابطُ داخل صندوق الاختيار جائز: الضغطُ عليه ينقل ولا يختار (`label` لا يُفعَّل بعنصرٍ تفاعليّ فيه) */
        return t.id ? (
          <Link key={t.id} to={bioHref(t)} aria-label={`نبذة المدرب ${t.name}`}
            className="group flex min-w-0 items-center gap-2.5 rounded-full pe-2">
            {inner}
          </Link>
        ) : (
          <span key={t.name} className="flex min-w-0 items-center gap-2.5">{inner}</span>
        );
      })}
    </span>
  );
}

/** المقاعدُ حين توشك أن تنفد — «حسب التوفّر» عينُه */
function Seats({ c }: { c: CohortOption }) {
  if (typeof c.seatsLeft !== "number" || c.seatsLeft > 5) return null;
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-fine font-black text-gold-ink">
      <Users className="h-3 w-3" aria-hidden="true" />
      بقي {c.seatsLeft}
    </span>
  );
}

export default function CohortPicker({
  cohorts,
  selectedId,
  onSelect,
  compact = false,
}: {
  cohorts: CohortOption[];
  selectedId: string | null;
  /** يُنادى بمعرّف الشعبة المختارة — والاختيار يعيش عند صاحب الصفحة */
  onSelect: (cohortId: string) => void;
  /** في القوائم الطويلة: اللقاءاتُ مطويّة */
  compact?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const group = useId();

  /* ═══ لا شعبة = «لا شعبة لها بعد» — لا موسمٌ ولا «التسجيل مفتوح» (١٩ أكتوبر ٢٠٢٦) ═══

     كان هنا سطرُ الفصل القادم (البند ٥٢): «تفتح في موسم الشتاء… والتسجيل مفتوح حتّى ٣٠ نوفمبر» تحت
     كلّ دورةٍ لا شعبةَ لها. والسطرُ يستعير حالَ **الفصل** ويلصقه بالدورة: دورةٌ بلا شعبةٍ لا تُشترى، ولا شيءَ
     يقول إنّها تُفتح في الشتاء. فسأل صاحبُ المنصّة: «كيف تفتح بفصل الشتاء وهي يجب أن تكون مفتوحةً الآن إذا
     كان ذلك صحيحا؟» — واختار من ثلاثة: «لا شعبة لها بعد»، بلا وعدٍ بموسم. وقِيس يومئذ: نحو ١٢٠ دورةً من
     ١٤٩ بلا شعبةٍ مفتوحة، فكان السطرُ الكاذبُ أكثرَ ما يُقرأ في الكتالوج. */
  if (cohorts.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-fine font-bold text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        {NO_COHORT_AR}
      </span>
    );
  }

  const selected = cohorts.find((c) => c.id === selectedId) ?? cohorts[0];
  const many = cohorts.length > 1;
  /* الأقربُ أوّلا، والمختارةُ ظاهرةٌ دائما ولو كانت بعد الثلاث */
  const shown = showAll || cohorts.length <= VISIBLE_COHORTS + 1
    ? cohorts
    : cohorts.filter((c, i) => i < VISIBLE_COHORTS || c.id === selected.id);
  const hidden = cohorts.length - shown.length;

  return (
    <div>
      {many && (
        <p id={`${group}-label`} className="mb-2 text-read font-bold leading-6 text-muted-foreground">
          {cohortsCountAr(cohorts.length)} — اختر الموعد والمدرب
        </p>
      )}
      <ul className="grid gap-2" {...(many ? { role: "radiogroup", "aria-labelledby": `${group}-label` } : {})}>
        {shown.map((c) => {
          const on = c.id === selected.id;
          const body = (
            <>
              {many && (
                <span aria-hidden="true" className={`mt-3 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 transition ${
                  on ? "border-teal-light bg-teal-light" : "border-white/30"
                }`}>
                  {on && <Check className="h-2.5 w-2.5 text-paper" strokeWidth={4} />}
                </span>
              )}
              <span className="grid min-w-0 flex-1 gap-1.5">
                {/* ومن لم يُعتمد نشرُ اسمه لا يُقال عنه شيء — لا اسمَ ولا وعدٌ بموعد إعلانه */}
                <Trainers c={c} />
                <When c={c} />
                {/* الاسمُ يفرّق شعبتين تبدآن في اليوم نفسِه (صباحيّةً ومسائيّة) — كانتا سطرين
                    متطابقين حرفا بحرف، فالاختيارُ بينهما رجمٌ بالغيب. */}
                {c.title && <span className="block truncate text-fine leading-4 text-muted-foreground">{c.title}</span>}
                {/* تحت الموعد لا بجانب الاسم — على الهاتف كانت تقصّ اسمَ المدرّب */}
                <Seats c={c} />
              </span>
            </>
          );
          return (
            /* سطحُ النظام (`Inset`) لا حدٌّ وانحناءٌ بيده — والمختارةُ بنغمتها. وحشوُه حشوُ السطح، فما
               يُضغط منه خارجَ اللصيقة يختار كذلك: الصندوقُ كلُّه خيار. */
            <Inset
              as="li"
              key={c.id}
              tone={on && many ? "accent" : "default"}
              className={many && !on ? "cursor-pointer" : ""}
              onClick={many ? (e: MouseEvent<HTMLElement>) => { if (e.target === e.currentTarget) onSelect(c.id); } : undefined}
            >
              {many ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-light">
                  <input
                    type="radio"
                    name={group}
                    value={c.id}
                    checked={on}
                    onChange={() => onSelect(c.id)}
                    aria-label={`شعبة تبدأ ${cohortDayAr(c.startsAt)}${c.trainers.length > 0 ? ` مع ${c.trainers.join(" و")}` : ""}`}
                    className="sr-only"
                  />
                  {body}
                </label>
              ) : (
                <div className="flex items-start gap-3">{body}</div>
              )}
              {/* ونبذةُ خطّتها ومواعيدُ لقاءاتها — للمختارة وحدها، داخل صندوقها: من بدّل الشعبة
                  رأى ما اختاره لا ما كان قبله. والمفتاحُ يعيد حالَ الطيّ مع كلّ شعبة. */}
              {on && (selected.summaryAr || selected.sessions.length > 0) && (
                <div className="mt-3 border-t border-white/10 pt-1">
                  {/* «سطران يقرؤهما المتعلّم قبل أن يدفع» (١٠ أكتوبر ٢٠٢٦) */}
                  {selected.summaryAr && (
                    <p className="mt-2 whitespace-pre-line text-read leading-6 text-foreground">{selected.summaryAr}</p>
                  )}
                  <LiveSessionDates key={selected.id} sessions={selected.sessions} defaultOpen={!compact} />
                </div>
              )}
            </Inset>
          );
        })}
      </ul>
      {hidden > 0 && (
        <button type="button" onClick={() => setShowAll(true)}
          className="mt-2 inline-flex min-h-9 items-center gap-1 text-fine font-bold text-teal-light-ink underline underline-offset-4">
          كل الشعب ({cohorts.length})
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

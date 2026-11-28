/* ═══ بطاقةُ اختيار الموسم — الإلغاءُ (نوصي به) أو الإعادةُ في المواسم القادمة (٢١ نوفمبر ٢٠٢٦، وخياران منذ ٢٤ نوفمبر) ═══

   وما سُئل بمواسمَ بعينها قبل الخيارين يبقى بخياراته المحفوظة، فالبطاقةُ ترسمها خيارا ثالثا.

   قرارُ صاحب المنصّة وعلّتُه في `src/application/trainer/season-choice.ts`، والأثرُ في `cohort-postpone.service.ts`
   (`choose`). والبطاقةُ تقول قبل أن يختار: أوّلَ لقاءٍ في كلّ موسمٍ يختاره، وأنّ الإلغاءَ لا شيءَ عليه فيه ويبقى في فريق
   المدرّبين، والمهلةَ وما يقع إن لم يختر حتّى تمضي (تُلغى — «b»، ثمّ ٢٨ نوفمبر: «اجعله يلغي تلقائيّا»). وكلُّ خيارٍ يُسأل مرّةً بجملةٍ تقول أثرَه على شعبته
   ومتعلّميها — ثمّ «نعم» تنفّذه. لا يُفرض عليه خيار، ولا يُطلب منه عملٌ يعمله بنفسه. */

import { useState } from "react";
import { CalendarClock, ChevronDown } from "lucide-react";
import { Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { fmtDateTimeAr, untilLabelAr } from "@/utils/format";
import {
  SEASON_CANCEL_POINTS_AR, SEASON_CANCEL_SUMMARY_AR, SEASON_CANCEL_TITLE_AR, SEASON_RELAUNCH_POINTS_AR, SEASON_RELAUNCH_SUMMARY_AR,
  SEASON_SILENCE_AR, seasonPickConsequenceAr, seasonRelaunchTitleAr, type SeasonPick,
} from "@/application/trainer/season-choice";
import type { TrainingSeason } from "@/application/trainer/application-options";

export interface SeasonOption {
  year: number; season: TrainingSeason; optionAr: string; firstAt: string | null; hasDates: boolean;
}
export interface SeasonChoiceOffer {
  id: string; cohortId: string; title: string; fromFirstAt: string | null; deadlineAt: string; options: SeasonOption[];
}

/** ما يتحرّك بالموسم — أوّلُ لقاءٍ فيه، أو أنّها تُربط به حين لا موعدَ فيها بعد */
function whereItLands(o: SeasonOption): string {
  if (o.firstAt) return `أول لقاء ${fmtDateTimeAr(o.firstAt)} — نفس اليوم والساعة، وتتحرك كل مواعيدها معه.`;
  return o.hasDates ? "تتحرك مدتها المقترحة إلى أول هذا الموسم." : "تربط بهذا الموسم، وتحدد مواعيدها بعد.";
}

const monthsOf = (o: SeasonOption) => o.optionAr.split(" — ")[1] ?? o.optionAr;

/** أهما الاختيارُ نفسُه — فيظهر تأكيدُه داخل خانته لا أسفلَ البطاقة */
function samePick(a: SeasonPick | null, b: SeasonPick): boolean {
  if (!a || a.kind !== b.kind) return false;
  return a.kind !== "season" || (b.kind === "season" && a.year === b.year && a.season === b.season);
}

/** «التفاصيل» — شريطٌ منسدلٌ مغلقٌ افتراضا: الخيارُ يُقرأ بسطره، ونقاطُه لمن أرادها */
function Details({ points }: { points: readonly string[] }) {
  return (
    <details className="group mt-2">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-read font-bold text-teal-ink [&::-webkit-details-marker]:hidden">
        التفاصيل
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="mt-1.5 list-disc space-y-1 ps-5 text-read">
        {points.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </details>
  );
}

/* ═══ والبطاقةُ أوضح (٢٤ نوفمبر ٢٠٢٦) ═══
   قرارُ صاحب المنصّة وهو يراها: «هذا السؤالُ يظهر أسفلَ كلّ الخيارات وهذا غيرُ عمليّ.. والتنسيقُ لا يوضّح الخيارات بطريقةٍ
   سهلة بل مربّعاتٌ تلو الأخرى.. يجب أن يكون العملُ أسهلَ والخياراتُ أوضح، والتفاصيلُ بشريطٍ منسدلٍ للقراءة». فصار:
   · الخياران **جنبا إلى جنب** (وتحت بعضهما في الهاتف)، لكلٍّ عنوانُه وسطرٌ واحدٌ وزرُّه، والإلغاءُ أوّلُهما ونوصي به.
   · النقاطُ في **«التفاصيل»** منسدلةً مغلقة.
   · و**التأكيدُ داخلَ الخانة التي ضغطها** — «متأكد؟ نعم / تراجع» مكانَ زرّها، لا أسفلَ البطاقة.
   · والمهلةُ وما يقع بالسكوت **أعلى البطاقة** في سطرٍ واحد، يُقرأ قبل الاختيار. */
export default function SeasonChoiceCard({ offer, busy, error, onChoose }: {
  offer: SeasonChoiceOffer;
  busy: boolean;
  error: string | null;
  onChoose: (pick: SeasonPick) => void;
}) {
  const [asking, setAsking] = useState<SeasonPick | null>(null);
  /* الإلغاءُ أوّلُ الخيارين ونوصي به، ثمّ الإعادةُ في المواسم القادمة يختار موسمَها لاحقا — كما رتّبهما صاحبُ المنصّة
     (٢٤ نوفمبر ٢٠٢٦). وما سُئل بمواسمَ بعينها قبله تبقى مواسمُه خيارا ثالثا */
  const seasons = offer.options;

  const ask = (pick: SeasonPick) => setAsking(pick);
  const optionOf = (p: SeasonPick) => (p.kind === "season" ? offer.options.find((o) => o.year === p.year && o.season === p.season) : undefined);
  const consequence = asking
    ? (asking.kind !== "season"
      ? seasonPickConsequenceAr({ kind: asking.kind })
      : seasonPickConsequenceAr({
        kind: "season", optionAr: optionOf(asking)?.optionAr ?? "",
        firstAtAr: optionOf(asking)?.firstAt ? fmtDateTimeAr(optionOf(asking)!.firstAt) : null,
      }))
    : null;
  const seasonPick = (o: SeasonOption): SeasonPick => ({ kind: "season", year: o.year, season: o.season });

  /** زرُّ الخيار — أو تأكيدُه في مكانه إن ضُغط */
  const action = (pick: SeasonPick, label: string) => (
    asking && samePick(asking, pick) ? (
      <Inset tone="solid" role="group" aria-label="تأكيد الاختيار">
        <p className="text-read font-bold">{consequence} متأكد؟</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button tone={asking.kind === "cancel" ? "danger" : "confirm"} size="sm" loading={busy} onClick={() => onChoose(asking)}>نعم</Button>
          <Button tone="secondary" size="sm" disabled={busy} onClick={() => setAsking(null)}>تراجع</Button>
        </div>
      </Inset>
    ) : (
      <Button tone="secondary" size="sm" disabled={busy} onClick={() => ask(pick)}>{label}</Button>
    )
  );

  return (
    <Panel as="section" tone="warn" aria-labelledby={`season-${offer.id}`}>
      <h2 id={`season-${offer.id}`} className="flex items-center gap-2 font-black">
        <CalendarClock className="h-4 w-4 text-gold-ink" aria-hidden="true" />
        شعبة «{offer.title}»
      </h2>
      <p className="mt-1 text-read text-muted-foreground">
        لم يكتمل عدد المسجلين فيها هذا الموسم.{" "}
        {offer.fromFirstAt ? `أول لقاء الآن ${fmtDateTimeAr(offer.fromFirstAt)}.` : "لا موعد فيها بعد."}
      </p>
      <p className="mt-1 text-read">
        اختر قبل <b>{fmtDateTimeAr(offer.deadlineAt)}</b>{" "}
        <span className="text-muted-foreground">({untilLabelAr(offer.deadlineAt)}). {SEASON_SILENCE_AR}</span>
      </p>

      <ol className="mt-3 grid gap-3 md:grid-cols-2">
        <li className="flex">
          <Inset tone="accent" className="flex w-full flex-col">
            <p className="font-bold">1. {SEASON_CANCEL_TITLE_AR}</p>
            <p className="mt-1 text-read text-muted-foreground">{SEASON_CANCEL_SUMMARY_AR}</p>
            <Details points={SEASON_CANCEL_POINTS_AR} />
            <div className="mt-auto pt-3">{action({ kind: "cancel" }, "ألغها")}</div>
          </Inset>
        </li>
        <li className="flex">
          <Inset className="flex w-full flex-col">
            <p className="font-bold">2. {seasonRelaunchTitleAr()}</p>
            <p className="mt-1 text-read text-muted-foreground">{SEASON_RELAUNCH_SUMMARY_AR}</p>
            <Details points={SEASON_RELAUNCH_POINTS_AR} />
            <div className="mt-auto pt-3">{action({ kind: "later" }, "أعد إطلاقها لاحقا")}</div>
          </Inset>
        </li>
      </ol>

      {seasons.length > 0 && (
        <details className="group mt-3">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-read font-bold text-teal-ink [&::-webkit-details-marker]:hidden">
            3. أو اختر موسمها الآن
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {seasons.map((o) => (
              <li key={`${o.season}-${o.year}`}>
                <Inset className="flex h-full flex-col">
                  <p className="text-read"><b>{o.optionAr}:</b> <span className="text-muted-foreground">{whereItLands(o)}</span></p>
                  <div className="mt-auto pt-2">{action(seasonPick(o), `أعد إطلاقها في ${monthsOf(o)}`)}</div>
                </Inset>
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="mt-2 text-read text-danger-ink" role="alert">{error}</p>}
    </Panel>
  );
}

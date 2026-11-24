/* ═══ بطاقةُ اختيار الموسم — الإلغاءُ (نوصي به) أو الربيع، بضغطةٍ واحدة (٢١ نوفمبر ٢٠٢٦، وخياران منذ ٢٤ نوفمبر) ═══

   وما سُئل بثلاثة قبل الخيارين («موسمٌ لاحق» معها) يبقى بخياراته المحفوظة، فالبطاقةُ ترسم ما في صفّه.

   قرارُ صاحب المنصّة وعلّتُه في `src/application/trainer/season-choice.ts`، والأثرُ في `cohort-postpone.service.ts`
   (`choose`). والبطاقةُ تقول قبل أن يختار: أوّلَ لقاءٍ في كلّ موسمٍ يختاره، وأنّ الإلغاءَ لا شيءَ عليه فيه ويبقى في فريق
   المدرّبين، والمهلةَ وما يقع إن لم يختر حتّى تمضي (منذ ٢٤ نوفمبر: لا يتغيّر شيءٌ ونتواصل معه). وكلُّ خيارٍ يُسأل مرّةً بجملةٍ تقول أثرَه على شعبته
   ومتعلّميها — ثمّ «نعم» تنفّذه. لا يُفرض عليه خيار، ولا يُطلب منه عملٌ يعمله بنفسه. */

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { fmtDateTimeAr, untilLabelAr } from "@/utils/format";
import {
  SEASON_CANCEL_POINTS_AR, SEASON_CANCEL_TITLE_AR, SEASON_SILENCE_AR, seasonPickConsequenceAr, seasonRelaunchPointsAr,
  seasonRelaunchTitleAr, type SeasonPick,
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

export default function SeasonChoiceCard({ offer, busy, error, onChoose }: {
  offer: SeasonChoiceOffer;
  busy: boolean;
  error: string | null;
  onChoose: (pick: SeasonPick) => void;
}) {
  const [asking, setAsking] = useState<SeasonPick | null>(null);
  const [first, ...later] = offer.options;
  /* الإلغاءُ أوّلُ الخيارين ونوصي به، ثمّ الربيع — كما رتّبهما صاحبُ المنصّة (٢٤ نوفمبر ٢٠٢٦). وما سُئل بثلاثة قبله يبقى
     موسمُه اللاحقُ ثالثا */

  const ask = (pick: SeasonPick) => setAsking(pick);
  const optionOf = (p: SeasonPick) => (p.kind === "season" ? offer.options.find((o) => o.year === p.year && o.season === p.season) : undefined);
  const consequence = asking
    ? (asking.kind === "cancel"
      ? seasonPickConsequenceAr({ kind: "cancel" })
      : seasonPickConsequenceAr({
        kind: "season", optionAr: optionOf(asking)?.optionAr ?? "",
        firstAtAr: optionOf(asking)?.firstAt ? fmtDateTimeAr(optionOf(asking)!.firstAt) : null,
      }))
    : null;
  const seasonPick = (o: SeasonOption): SeasonPick => ({ kind: "season", year: o.year, season: o.season });

  return (
    <Panel as="section" tone="warn" aria-labelledby={`season-${offer.id}`}>
      <h2 id={`season-${offer.id}`} className="flex items-center gap-2 font-black">
        <CalendarClock className="h-4 w-4 text-gold-ink" aria-hidden="true" />
        شعبة «{offer.title}»: اختر ما يناسبك
      </h2>
      <p className="mt-1 text-read text-muted-foreground">
        لم يكتمل عدد المسجلين فيها هذا الموسم.{" "}
        {offer.fromFirstAt ? `أول لقاء الآن ${fmtDateTimeAr(offer.fromFirstAt)}.` : "لا موعد فيها بعد."}
      </p>

      <ol className="mt-3 space-y-2">
        <li>
          <Inset tone="accent">
            <p className="font-bold">1. {SEASON_CANCEL_TITLE_AR}</p>
            <ul className="mt-1 list-disc space-y-0.5 ps-5 text-read">
              {SEASON_CANCEL_POINTS_AR.map((t) => <li key={t}>{t}</li>)}
            </ul>
            <Button className="mt-2" tone="secondary" size="sm" disabled={busy} onClick={() => ask({ kind: "cancel" })}>ألغها</Button>
          </Inset>
        </li>
        {first && (
          <li>
            <Inset>
              <p className="font-bold">2. {seasonRelaunchTitleAr(first)}</p>
              <ul className="mt-1 list-disc space-y-0.5 ps-5 text-read">
                {seasonRelaunchPointsAr(first).map((t) => <li key={t}>{t}</li>)}
              </ul>
              <p className="mt-1 text-read text-muted-foreground">{whereItLands(first)}</p>
              <Button className="mt-2" tone="secondary" size="sm" disabled={busy} onClick={() => ask(seasonPick(first))}>
                أعد إطلاقها في {monthsOf(first)}
              </Button>
            </Inset>
          </li>
        )}
        {later.length > 0 && (
          <li>
            <Inset>
              <p className="font-bold">3. أعد إطلاقها في موسم لاحق</p>
              <ul className="mt-1 space-y-2">
                {later.map((o) => (
                  <li key={`${o.season}-${o.year}`}>
                    <p className="text-read"><b>{o.optionAr}:</b> <span className="text-muted-foreground">{whereItLands(o)}</span></p>
                    <Button className="mt-1" tone="secondary" size="sm" disabled={busy} onClick={() => ask(seasonPick(o))}>
                      أعد إطلاقها في {monthsOf(o)}
                    </Button>
                  </li>
                ))}
              </ul>
            </Inset>
          </li>
        )}
      </ol>

      <ul className="mt-3 space-y-1 text-read">
        <li>
          اختر قبل <b>{fmtDateTimeAr(offer.deadlineAt)}</b>{" "}
          <span className="text-muted-foreground">({untilLabelAr(offer.deadlineAt)})</span>. {SEASON_SILENCE_AR}
        </li>
      </ul>

      {error && <p className="mt-2 text-read text-danger-ink" role="alert">{error}</p>}

      {asking && (
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="تأكيد الاختيار">
          <span className="text-read font-bold">{consequence} متأكد؟</span>
          <Button tone={asking.kind === "cancel" ? "danger" : "confirm"} loading={busy} onClick={() => onChoose(asking)}>نعم</Button>
          <Button tone="secondary" disabled={busy} onClick={() => setAsking(null)}>تراجع</Button>
        </div>
      )}
    </Panel>
  );
}

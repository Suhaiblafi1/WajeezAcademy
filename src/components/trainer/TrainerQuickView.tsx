/* بطاقةُ المدرّب المنبثقة — قرارُ صاحب المنصّة (٩ نوفمبر ٢٠٢٦).

   حيث يرى الزائرُ اسمَ مدرّبٍ أو صورتَه — قسمُ «تعرّف على مدرّبك» في صفحة الدورة، وبطاقاتُ `/trainers`، وشارةُ
   «المدرب: …» على بطاقات الدورات — يفتح الضغطُ عليه بطاقةً صغيرة: صورتُه (بحلقتها إن كان له فيديو)، واسمُه وتعريفُه
   وبلدُه، ونبذةٌ قصيرةٌ تُكمَل بـ«المزيد»، وأربعُ تخصّصاتٍ على الأكثر، ورابطُ صفحته كاملة. ومن له فيديو يشاهده **في
   البطاقة نفسِها**: تُستبدل الصورةُ بالمشغّل (`TrainerVideoFrame` من `TrainerVideo.tsx`)، ولا إطارَ قبل الضغط، ويُزال
   بإغلاق البطاقة فيقف الصوت.

   ═══ ومصدرُها بوّابةٌ واحدة ═══

   ما يعرفه المنادي يُرسم فورا (`seed`: اسمُه وصورتُه، وفيديو هذه الدورة إن عُرف)، وما سواه يُقرأ حين تُفتح من صفحته
   العامّة `/api/public/trainers/:slug` — وهي تردّ ٤٠٤ لمن لم يجز عرضُه (`publicTrainerWhere()`). ومسارُ صفحته لا يصل
   المنادي إلّا ممّن مرّ بالبوّابة نفسِها (`publicCourseTrainer` و`listPublicTrainers`). فلا يُعرض في البطاقة شيءٌ عن
   مدرّبٍ مخفيّ أو موقوف.

   وفيديو الدورة يغلب فيديو تعريفه حين يُعرف — كالنافذة الصغيرة في صفحة الدورة. ومن لا مسارَ له (أو ردّت صفحتُه ٤٠٤)
   تُرسم بطاقتُه بما عُرف وحدَه بلا رابط صفحته. وما سوى ذلك من خطأ: «تعذر التحميل» وزرٌّ يعيد. */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { ArrowLeft, BadgeCheck, MapPin, Play, RefreshCw, X } from "lucide-react";
import Modal from "@/components/Modal";
import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { apiGet, ApiError } from "@/services/api";
import { TrainerVideoFrame, type EmbedVideo } from "@/components/TrainerVideo";
import { TrainerAvatarRing } from "@/components/trainer/TrainerAvatarRing";
import {
  QUICK_VIEW_SPECIALTIES, mergeQuickView,
  type QuickViewPage, type QuickViewStatus, type TrainerQuickViewData, type TrainerSeed,
} from "@/application/trainer/quick-view";

/* ─────────── البطاقةُ نفسُها — بلا نافذةٍ ولا شبكة، فتُصيَّر في الاختبار ─────────── */

export function TrainerQuickViewCard({
  data, status, playing, onPlay, onRetry, onClose, avatarRef,
}: {
  data: TrainerQuickViewData;
  status: QuickViewStatus;
  playing: boolean;
  onPlay: () => void;
  onRetry: () => void;
  onClose: () => void;
  avatarRef?: React.Ref<HTMLButtonElement>;
}) {
  const embed: EmbedVideo | null = data.video?.kind === "embed" ? data.video : null;
  const link = data.video?.kind === "link" ? data.video : null;
  const shownSpecialties = data.specialties.slice(0, QUICK_VIEW_SPECIALTIES);
  const moreSpecialties = data.specialties.length - shownSpecialties.length;
  const isPlaying = playing && embed !== null;

  return (
    <Card
      tone="solid"
      data-trainer-quick-view=""
      className="relative w-full overflow-y-auto shadow-2xl motion-safe:animate-sheet-up"
      style={{ maxHeight: "calc(92vh / var(--app-scale, 1))" }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="إغلاق"
        className="absolute left-2 top-2 z-10 grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      {isPlaying && embed && <QuickViewPlayer video={embed} name={data.name} headline={data.headline} photoUrl={data.photoUrl} />}

      <div className={`flex items-center gap-4 ${isPlaying ? "mt-4" : "pe-10"}`}>
        {!isPlaying && (
          <TrainerAvatarRing
            name={data.name}
            photoUrl={data.photoUrl}
            onPlay={embed ? onPlay : undefined}
            buttonRef={avatarRef}
            boxClassName="h-20 w-20"
            shape="circle"
            gap="surface"
            monogramClassName="text-2xl"
          />
        )}
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-lg font-black leading-snug">
            <span className="min-w-0">{data.name}</span>
            <BadgeCheck className="h-4 w-4 shrink-0 text-teal-light-ink" aria-label="مدرب موثق" />
          </h2>
          {data.headline && <p className="mt-0.5 line-clamp-2 text-read leading-6 text-muted-foreground">{data.headline}</p>}
          {data.country && (
            <p className="mt-1 flex items-center gap-1 text-read text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
              {data.country}
            </p>
          )}
        </div>
      </div>

      {status === "loading" && !data.bio && (
        <div aria-hidden="true" data-skeleton="" className="mt-4 space-y-2">
          {["w-full", "w-11/12", "w-4/5", "w-2/3"].map((w) => (
            <span key={w} className={`block h-3 ${w} rounded-full bg-foreground/10 motion-safe:animate-pulse`} />
          ))}
          <span className="flex gap-1.5 pt-2">
            {["w-16", "w-20", "w-14"].map((w) => <span key={w} className={`block h-6 ${w} rounded-full bg-foreground/10 motion-safe:animate-pulse`} />)}
          </span>
        </div>
      )}
      {status === "loading" && <span className="sr-only" role="status">جار التحميل</span>}

      {status === "error" && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-read text-muted-foreground">
          <span>تعذر التحميل</span>
          <Button tone="ghost" size="sm" icon={RefreshCw} onClick={onRetry}>
            أعد المحاولة
          </Button>
        </div>
      )}

      {data.bio && <QuickViewBio bio={data.bio} />}

      {shownSpecialties.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="التخصصات">
          {shownSpecialties.map((s) => (
            <li key={s} className="rounded-full bg-teal/10 px-2.5 py-1 text-read text-teal-light-ink">{s}</li>
          ))}
          {moreSpecialties > 0 && (
            <li dir="ltr" className="rounded-full bg-foreground/5 px-2.5 py-1 text-read text-muted-foreground">+{moreSpecialties}</li>
          )}
        </ul>
      )}

      {(embed || link || data.slug) && (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-foreground/10 pt-4">
          {embed && !isPlaying && (
            <Button tone="secondary" size="sm" icon={Play} onClick={onPlay}>
              شاهد الفيديو
            </Button>
          )}
          {link && (
            <Button as="a" href={link.href} target="_blank" rel="noopener noreferrer" tone="secondary" size="sm" icon={Play}>
              شاهد الفيديو
            </Button>
          )}
          {data.slug && (
            <Link
              to={`/t/${encodeURIComponent(data.slug)}`}
              className="inline-flex min-h-11 items-center gap-1.5 text-read font-bold text-teal-light-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              صفحة المدرب كاملة
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}

/** المشغّلُ مكانَ الصورة: ‎9:16‎ لـ«شورتس» بارتفاعٍ لا يتجاوز الشاشة، و‎16:9‎ بعرض البطاقة. والإطارُ بالتشغيل التلقائيّ */
function QuickViewPlayer({ video, name, photoUrl, headline }: { video: EmbedVideo; name: string; photoUrl: string | null; headline?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  /* زرُّ الصورة الذي ضُغط زال — فالتركيزُ إلى المشغّل لا إلى أوّل الصفحة */
  useEffect(() => { ref.current?.focus(); }, []);
  const size: CSSProperties = video.vertical
    ? { width: "min(100%, calc(min(62vh / var(--app-scale, 1), 560px) * 9 / 16))", aspectRatio: "9 / 16" }
    : { width: "100%", aspectRatio: "16 / 9" };
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-label={`فيديو تعريفي: ${name}`}
      data-quick-view-player=""
      style={size}
      className="relative mx-auto mt-10 overflow-hidden rounded-xl bg-[#000] shadow-lg focus:outline-none"
    >
      <TrainerVideoFrame video={video} name={name} headline={headline} photoUrl={photoUrl} />
    </div>
  );
}

/** النبذةُ بخمسة أسطرٍ، و«المزيد» يكملها في البطاقة نفسِها — ولا «المزيد» لنبذةٍ قصيرةٍ تتّسع لها */
function QuickViewBio({ bio }: { bio: string }) {
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  /* هل قصّها السطرُ الخامس؟ يُقاس حين يُرسم ومع كلّ تغيّرٍ في عرض البطاقة */
  useEffect(() => {
    const el = ref.current;
    if (!el || open || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setClamped(el.scrollHeight > el.clientHeight + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [bio, open]);
  return (
    <div className="mt-4">
      <p ref={ref} className={`whitespace-pre-line text-read leading-7 text-foreground/85 ${open ? "" : "line-clamp-5"}`}>{bio}</p>
      {(clamped || open) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex min-h-11 items-center text-read font-bold text-teal-light-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          {open ? "أقل" : "المزيد"}
        </button>
      )}
    </div>
  );
}

/* ─────────── النافذةُ والقراءة ─────────── */

/** بطاقةُ المدرّب في نافذة المنصّة: تُقرأ صفحتُه حين تُفتح، ويُزال كلُّ شيءٍ بإغلاقها فيعود التركيزُ إلى ما فتحها */
export default function TrainerQuickView({ seed, onClose, autoPlay = false }: { seed: TrainerSeed; onClose: () => void; autoPlay?: boolean }) {
  const slug = seed.slug;
  const [reply, setReply] = useState<{ slug: string; attempt: number; page: QuickViewPage | null; failed: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  /* من حلقة الصورة في القائمة: الفيديو يعمل حين تُفتح — ولا يعمل إلّا إن كان يُضمَّن (`isPlaying` في البطاقة) */
  const [playing, setPlaying] = useState(autoPlay);

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    apiGet<QuickViewPage>(`/api/public/trainers/${encodeURIComponent(slug)}`)
      .then((page) => { if (alive) setReply({ slug, attempt, page, failed: false }); })
      .catch((e: unknown) => {
        if (!alive) return;
        /* ٤٠٤: لا صفحةَ له (لم يجز عرضُه أو طلبُه غيرُ نشط) — البطاقةُ بما عُرف وحدَه، لا خطأٌ يُعاد */
        const gone = e instanceof ApiError && e.status === 404;
        setReply({ slug, attempt, page: null, failed: !gone });
      });
    return () => { alive = false; };
  }, [slug, attempt]);

  const current = reply && reply.slug === slug && reply.attempt === attempt ? reply : null;
  const status: QuickViewStatus = !slug ? "ready" : !current ? "loading" : current.failed ? "error" : "ready";
  /* ٤٠٤: لا صفحةَ له — فلا رابطَ إليها */
  const gone = current !== null && current.page === null && !current.failed;
  const data = mergeQuickView(gone ? { ...seed, slug: null } : seed, current?.page ?? null);

  return (
    <Modal label={`المدرب: ${seed.name}`} onClose={onClose} sheet panelClassName="w-full sm:max-w-md">
      <TrainerQuickViewCard
        data={data}
        status={status}
        playing={playing}
        onPlay={() => setPlaying(true)}
        onRetry={() => setAttempt((n) => n + 1)}
        onClose={onClose}
      />
    </Modal>
  );
}

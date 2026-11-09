/* «تعرّف على مدرّبك» — فيديو المدرّب للزائر (٨ نوفمبر ٢٠٢٦).

   القرارُ وقواعدُ الاختيار والتضمين في `src/application/trainer/marketing-video.ts`. وهنا الرسمُ وحدَه. وما وصل من
   الخادم يُفحص بـ`renderableVideo` قبل أن يُرسم — فلا يدخل `src` إطارٍ إلّا رابطٌ بنيناه نحن من أصلٍ مسموح.

   ═══ نافذةٌ صغيرةٌ كنافذة مشاركٍ في «زوم» — لا إطارٌ كبيرٌ في الصفحة (٩ نوفمبر ٢٠٢٦) ═══

   كان الإطارُ مضمَّنا في الصفحة بحجمه (نحو ‎390×693‎ على الحاسوب لـ«شورتس») وعليه شعارُ يوتيوب وعنوانُه، فيغلب
   الصفحة. وقال صاحبُ المنصّة: «الفيديو ليس بالشكل المطلوب وغير احترافي.. استخدم أفكارا إبداعية واجعله بشاشة أصغر
   وكأنك تقوم بعمل زوم». ودوراتُنا مباشرةٌ على Zoom، فصار الفيديو:

   ① نافذةً صغيرةً (‎9:16‎ نحو ‎168×300‎، أو ‎16:9‎ نحو ‎300×169‎) خلفيّتُها صورةُ المدرّب المعتمدة من أصلنا — أو حرفُه
      على تدرّجٍ حين لا صورة — وعليها اسمُه القصيرُ بميكروفونٍ في أسفلها و«فيديو تعريفي» في أعلاها وزرُّ تشغيلٍ بنبضٍ
      هادئ. **ولا إطارَ ولا صورةً مصغّرةً من يوتيوب قبل الضغط**: لا طلبَ إلى المزوّد قبل أن يطلبه الزائر، و`img-src`
      كما هي.
   ② والضغطُ يكبّر مشغّلا من موضع النافذة (‎0.6 ← 1‎ في ربع ثانية) على أرضيّةٍ داكنة، ويبدأ التشغيلَ فورا
      (`playerSrcOf`). ويُغلق بـ×، وEsc، وبالضغط خارجه — فيُزال الإطارُ ويقف الصوت، ويعود التركيزُ إلى ما فتحه.
      والنافذةُ نفسُها `Modal` المنصّة (حبسُ التركيز، ومنعُ تمرير الخلفيّة، وإخفاءُ ما خلفها عن قارئ الشاشة).

   ورابطٌ لا يُضمَّن (`kind: 'link'`) يبقى زرّا يفتحه في لسانٍ جديد — بلا نافذة.

   ومن لا فيديو له لا يُرسم له شيء: لا صندوقٌ فارغٌ ولا «لا فيديو بعد».

   ═══ وفي صفحته حلقةٌ حول صورته، وفي كلّ موضعٍ بطاقتُه المنبثقة (٩ نوفمبر ٢٠٢٦) ═══

   صفحةُ المدرّب لم تعد تعرض هذه النافذة: صورتُه بحلقة «قصّة» تفتح المشغّلَ المكبَّرَ نفسَه (`TrainerVideoZoom`) من
   موضعها (`trainer/TrainerAvatarRing.tsx`). وهنا اسمُه و«عن المدرب» يفتحان بطاقتَه (`trainer/TrainerQuickView.tsx`)،
   والنافذةُ الصغيرةُ تبقى للفيديو. والإطارُ نفسُه (`TrainerVideoFrame`) في المشغّل المكبَّر وفي البطاقة.

   ═══ والألوانُ هنا حرفيّةٌ عمدا ═══

   النافذةُ شاشةُ فيديو: داكنةٌ في المظهرين. و`text-white` و`bg-black/…` يقلبهما المظهرُ الفاتح (`styles/light.css`)
   حبرا على ورق — فكُتبا بقيمتهما (`text-[#fff]` و`bg-[#000]/…`) لتبقى الشاشةُ شاشة. */

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { ExternalLink, Loader2, Mic, MonitorPlay, Play, UserRound, X } from "lucide-react";
import TrainerQuickView from "@/components/trainer/TrainerQuickView";
import { seedOf } from "@/application/trainer/quick-view";
import { zoomFromEl, type ZoomFrom } from "@/components/trainer/zoom-from";
import { apiGet } from "@/services/api";
import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Modal from "@/components/Modal";
import { initialsOf } from "@/application/text/initials";
import { firstLastNameAr } from "@/application/commerce/private-path";
import {
  playerSrcOf, renderableVideo, safePhotoUrl, type PublicTrainerVideo,
} from "@/application/trainer/marketing-video";

export type EmbedVideo = Extract<PublicTrainerVideo, { kind: "embed" }>;

/* ─────────── ① النافذةُ الصغيرة ─────────── */

/** نافذةُ المشارك: صورتُه أو حرفُه، واسمُه القصير، وزرُّ التشغيل — بلا إطار */
export function TrainerVideoTile({
  video, name, photoUrl, onOpen, tileRef,
}: {
  video: EmbedVideo;
  name: string;
  photoUrl: string | null;
  onOpen: (e: MouseEvent<HTMLButtonElement>) => void;
  tileRef?: React.Ref<HTMLButtonElement>;
}) {
  const photo = safePhotoUrl(photoUrl);
  const short = firstLastNameAr(name) || name;
  return (
    <button
      ref={tileRef}
      type="button"
      onClick={onOpen}
      aria-label={`شغل الفيديو التعريفي: ${name}`}
      className={
        "group relative shrink-0 overflow-hidden rounded-2xl bg-[#0b1f22] shadow-lg shadow-[#000]/30 ring-1 ring-[#000]/10 "
        + "transition hover:shadow-xl hover:ring-2 hover:ring-[#4ade80]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal "
        + "focus-visible:ring-offset-2 focus-visible:ring-offset-paper "
        + (video.vertical ? "aspect-[9/16] w-[132px] sm:w-[168px]" : "aspect-video w-full max-w-[300px]")
      }
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-500 motion-safe:group-hover:scale-105"
        />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#2a7f89] via-[#14474d] to-[#08272B]" />
      )}
      {/* ظلٌّ في الأعلى والأسفل ليُقرأ ما عليهما فوق أيّ صورة */}
      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-[#000]/45 via-transparent to-[#000]/60" />

      <span aria-hidden="true" className="absolute right-2 top-2 rounded-full bg-[#000]/55 px-2 py-0.5 text-read font-bold leading-5 text-[#fff] backdrop-blur-sm">
        فيديو تعريفي
      </span>

      {photo ? (
        <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
          <span className="relative grid h-12 w-12 place-items-center">
            <span className="absolute inset-0 rounded-full bg-[#fff]/60 motion-safe:animate-tile-pulse" />
            <span className="relative grid h-12 w-12 place-items-center rounded-full bg-[#fff]/95 text-[#08272B] shadow-lg transition motion-safe:group-hover:scale-110">
              <Play className="h-5 w-5 translate-x-px fill-current" />
            </span>
          </span>
        </span>
      ) : (
        /* بلا صورة: دائرةُ حرفه في الوسط كنافذة مشاركٍ أطفأ الكاميرا، وزرُّ التشغيل شارةٌ على طرفها */
        <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
          <span className="relative grid h-16 w-16 place-items-center">
            <span className="absolute inset-0 rounded-full bg-[#fff]/40 motion-safe:animate-tile-pulse" />
            <span className="relative grid h-16 w-16 place-items-center rounded-full bg-[#fff]/15 text-2xl font-black text-[#fff] ring-2 ring-[#fff]/40 backdrop-blur-sm transition motion-safe:group-hover:scale-105">
              {initialsOf(name)}
            </span>
            <span className="absolute -bottom-1 -left-1 grid h-7 w-7 place-items-center rounded-full bg-[#fff] text-[#08272B] shadow-lg">
              <Play className="h-3.5 w-3.5 translate-x-px fill-current" />
            </span>
          </span>
        </span>
      )}

      <span aria-hidden="true" className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-md bg-[#000]/60 px-1.5 py-0.5 text-read font-bold leading-5 text-[#fff] backdrop-blur-sm">
        <Mic className="h-3 w-3 shrink-0 text-[#4ade80]" />
        <span className="truncate">{short}</span>
      </span>
    </button>
  );
}

/* ─────────── ② المشغّلُ المكبَّر ─────────── */

/** الإطارُ وما خلفه حتى يرسم المزوّدُ أوّلَ صورة — يملأ حاويتَه، ومقاسُها عند من يرسمه: النافذةُ المكبَّرة هنا،
    والبطاقةُ المنبثقة (`trainer/TrainerQuickView.tsx`). ولا إطارَ لما لم نبنه */
/* ═══ شارةُ الاسم فوق المشغّل — «النمط ٢» على يوتيوب نفسِه (٩ نوفمبر ٢٠٢٦) ═══

   اختار صاحبُ المنصّة نمطا بهويّة وجيز لفيديو المدرّب (ترجمةٌ بلونها، واسمُه أوّلَ ثوانٍ، وشعارٌ صغير)، ثمّ
   «2» — أن يُضاف على المشغّل في الموقع لا بمونتاج الملفّ. فيُرسم فوق الإطار ما لا يحتاج وقتَ التشغيل:
   شارةٌ بيضاءُ أسفلَه بالشعار والاسم والوصف، تظهر حين يُفتح وتغيب بعد ثوانٍ.

   **وما لا يُرسم، ولماذا**: الترجمةُ وشريطُ التقدّم يحتاجان وقتَ التشغيل من يوتيوب، ولا يُقرأ إلّا بسكربته
   (`iframe_api`) — و`script-src 'self'` في سياسة الموقع يمنعه. والترجمةُ القديمةُ محروقةٌ في صورة الفيديو.

   **ولا تحجب شيئا**: `pointer-events-none` — فاللمسُ يصل أزرارَ يوتيوب تحتها. وتعلو شريطَ تحكّمه (‎bottom-16‎). */
const NAME_TAG_MS = 7000;

export function VideoNameTag({ name, headline }: { name: string; headline?: string | null }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(false), NAME_TAG_MS);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div
      aria-hidden="true"
      data-video-name-tag=""
      className={`pointer-events-none absolute bottom-16 right-3 z-10 flex max-w-[85%] items-center gap-2.5 rounded-2xl bg-[#fff]/95 py-2 pe-3.5 ps-2 shadow-xl transition-opacity duration-700 motion-safe:animate-backdrop-in ${shown ? "opacity-100" : "opacity-0"}`}
    >
      <img src="/logo-mark.png" alt="" className="h-8 w-8 shrink-0 rounded-lg" />
      <span className="h-8 w-1 shrink-0 rounded-full bg-teal" />
      <span className="min-w-0 text-right leading-tight">
        <b className="block truncate text-read font-black text-[#0E2225]">{firstLastNameAr(name)}</b>
        {headline && <span className="block truncate text-read text-[#4A6266]">{headline}</span>}
      </span>
    </div>
  );
}

export function TrainerVideoFrame({ video, name, photoUrl, headline }: { video: EmbedVideo; name: string; photoUrl: string | null; headline?: string | null }) {
  const photo = safePhotoUrl(photoUrl);
  const src = playerSrcOf(video);
  if (!src) return null;
  return (
    <>
      {/* ما خلف الإطار حتى يرسم المزوّدُ أوّلَ صورة: صورتُه معتمةً ودوّامة — لا سوادٌ يُظنّ عطلا */}
      <div aria-hidden="true" className="absolute inset-0 grid place-items-center overflow-hidden bg-[#000]">
        {photo && <img src={photo} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl" />}
        <Loader2 className="relative h-8 w-8 text-[#fff]/80 motion-safe:animate-spin" />
      </div>
      <iframe
        src={src}
        title={`فيديو تعريفي: ${name}`}
        referrerPolicy="strict-origin-when-cross-origin"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
      <VideoNameTag name={name} headline={headline} />
    </>
  );
}

/** ما في النافذة المكبَّرة: شريطٌ باسمه وزرِّ الإغلاق، والإطارُ بالتشغيل التلقائيّ. ولا إطارَ لما لم نبنه */
export function TrainerVideoPlayerWindow({
  video, name, photoUrl, from, onClose, headline,
}: {
  video: EmbedVideo;
  name: string;
  photoUrl: string | null;
  headline?: string | null;
  from: ZoomFrom;
  onClose: () => void;
}) {
  if (!playerSrcOf(video)) return null;
  /* العموديُّ يقاس بارتفاعه (‎min(80vh, 680px)‎ مع شريطه) والأفقيُّ بعرضه (‎min(92vw, 960px)‎) — وكلاهما لا يتجاوز الشاشة.
     و`vw`/`vh` تُقسم على مقياس الجسم (`--app-scale`): هي مقاسُ الشاشة الحقيقيّ، وما في الجسم يُضرب فيه */
  const vw = "calc(88vw / var(--app-scale, 1))";
  const vh = "calc(80vh / var(--app-scale, 1) - 56px)";
  const size: CSSProperties = video.vertical
    ? { width: `min(${vw}, calc(min(${vh}, 680px) * 9 / 16))`, aspectRatio: "9 / 16" }
    : { width: `min(${vw}, 960px, calc(${vh} * 16 / 9))`, aspectRatio: "16 / 9" };
  const zoom = { "--zoom-x": `${from.x}px`, "--zoom-y": `${from.y}px` } as CSSProperties;
  return (
    <div style={zoom} className="overflow-hidden rounded-2xl bg-[#000] shadow-2xl ring-1 ring-[#fff]/10 motion-safe:animate-video-zoom motion-reduce:animate-backdrop-in">
      <div className="flex items-center justify-between gap-3 py-1.5 pe-1.5 ps-4">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-[#fff]">
          <Mic className="h-3.5 w-3.5 shrink-0 text-[#4ade80]" aria-hidden="true" />
          <span className="truncate">{name}</span>
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff]/10 text-[#fff] transition hover:bg-[#fff]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div style={size} className="relative max-w-full">
        <TrainerVideoFrame video={video} name={name} photoUrl={photoUrl} headline={headline} />
      </div>
    </div>
  );
}

/** المشغّلُ المكبَّرُ في نافذة المنصّة على أرضيّةٍ داكنة — يُرسم ما دام `from`، ويُزال بالإغلاق فيقف الصوت.
    تفتحه النافذةُ الصغيرة هنا، وصورةُ المدرّب بحلقتها في صفحته (`trainer/TrainerAvatarRing.tsx`) */
export function TrainerVideoZoom({
  video, name, photoUrl, from, onClose, headline,
}: {
  video: EmbedVideo;
  name: string;
  photoUrl: string | null;
  headline?: string | null;
  from: ZoomFrom | null;
  onClose: () => void;
}) {
  if (!from) return null;
  return (
    <Modal
      label={`فيديو تعريفي: ${name}`}
      onClose={onClose}
      backdropClassName="bg-[#000]/80 backdrop-blur-md motion-safe:animate-backdrop-in"
    >
      <TrainerVideoPlayerWindow video={video} name={name} photoUrl={photoUrl} headline={headline} from={from} onClose={onClose} />
    </Modal>
  );
}

/* ─────────── ①+② لمدرّبٍ واحد ─────────── */

/** النافذةُ وإلى جانبها اسمُه وسطرٌ يدعو وزرٌّ ثانٍ يفتح المشغّلَ نفسَه. والرابطُ الذي لا يُضمَّن زرٌّ وحدَه */
export function TrainerVideoCard({
  video, name, headline, photoUrl, title, kicker, onAbout,
}: {
  video: PublicTrainerVideo;
  name: string;
  headline?: string | null;
  photoUrl?: string | null;
  /** ما يُكتب بجانب النافذة مكانَ اسمه — في صفحته هو، واسمُه في رأسها */
  title?: string;
  /** عنوانُ القسم فوق اسمه — لمدرّبٍ واحد، فلا يأخذ العنوانُ سطرا فوق النافذة */
  kicker?: ReactNode;
  /** يفتح بطاقتَه المنبثقة (`trainer/TrainerQuickView.tsx`) — فيصير اسمُه زرّا، ومعه «عن المدرب» */
  onAbout?: () => void;
}) {
  const [from, setFrom] = useState<ZoomFrom | null>(null);
  const tileRef = useRef<HTMLButtonElement>(null);

  /* اسمُه زرٌّ يفتح بطاقتَه حين تُمرَّر — والنافذةُ الصغيرةُ تبقى للفيديو كما كانت */
  const heading = onAbout && !title ? (
    <button
      type="button"
      onClick={onAbout}
      className="-my-2 inline-flex min-h-11 items-center text-start text-read font-black leading-snug text-foreground decoration-teal/60 decoration-dotted underline-offset-4 transition hover:text-teal-light-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
    >
      {name}
    </button>
  ) : (
    <p className="text-read font-black leading-snug text-foreground">{title ?? name}</p>
  );
  const about = onAbout && (
    <Button tone="ghost" size="sm" icon={UserRound} onClick={onAbout} className="mt-3 whitespace-nowrap">
      عن المدرب
    </Button>
  );

  if (video.kind === "link") {
    return (
      <div className="min-w-0">
        {kicker}
        {heading}
        {headline && <p className="mt-1 text-read leading-relaxed text-muted-foreground">{headline}</p>}
        <div className="flex flex-wrap gap-x-2">
          <Button as="a" href={video.href} target="_blank" rel="noopener noreferrer" tone="secondary" size="sm" icon={ExternalLink} className="mt-3">
            شاهد الفيديو
          </Button>
          {about}
        </div>
      </div>
    );
  }

  /* يكبر من النافذة الصغيرة دائما — ولو فُتح من الزرّ الثاني */
  const open = () => setFrom(zoomFromEl(tileRef.current));

  return (
    <div className={video.vertical ? "flex items-center gap-4 sm:gap-5" : "flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5"}>
      <TrainerVideoTile video={video} name={name} photoUrl={photoUrl ?? null} onOpen={open} tileRef={tileRef} />
      <div className="min-w-0">
        {kicker}
        {heading}
        {headline && <p className="mt-1 line-clamp-2 text-read leading-relaxed text-muted-foreground">{headline}</p>}
        <p className="mt-2 text-read leading-relaxed text-muted-foreground">شاهد رسالة مدربك قبل أن تبدأ</p>
        <div className="flex flex-wrap gap-x-2">
          <Button tone="secondary" size="sm" icon={Play} onClick={open} className="mt-3 whitespace-nowrap">
            شاهد الفيديو
          </Button>
          {about}
        </div>
      </div>
      <TrainerVideoZoom video={video} name={name} headline={headline} photoUrl={photoUrl ?? null} from={from} onClose={() => setFrom(null)} />
    </div>
  );
}

/* ─────────── قسمُ صفحة الدورة ─────────── */

interface CourseTrainerReply {
  announced: boolean;
  trainers: { id: string; name: string; headline: string | null; photoUrl?: unknown; video?: unknown; slug?: unknown }[];
}

interface Shown { id: string; name: string; headline: string | null; photoUrl: string | null; video: PublicTrainerVideo; slug: string | null }


/** قسمُ صفحة الدورة — مدرّبوها المعلَنون الذين لهم فيديو. ولا شيءَ إن لم يكن */
export default function CourseTrainerVideos({ courseId, className = "" }: { courseId: string; className?: string }) {
  /* المحمولُ يحمل دورتَه معه: ما حُمل لدورةٍ أخرى ليس جوابا لهذه */
  const [loaded, setLoaded] = useState<{ courseId: string; shown: Shown[] } | null>(null);

  useEffect(() => {
    let alive = true;
    apiGet<CourseTrainerReply>(`/api/courses/${encodeURIComponent(courseId)}/trainer`)
      .then((r) => {
        if (!alive) return;
        const shown = r.announced
          ? r.trainers.flatMap((t) => {
              const video = renderableVideo(t.video);
              return video ? [{ id: t.id, name: t.name, headline: t.headline, photoUrl: safePhotoUrl(t.photoUrl), video, slug: seedOf(t).slug }] : [];
            })
          : [];
        setLoaded({ courseId, shown });
      })
      .catch(() => { /* بلا خادم — لا قسم */ });
    return () => { alive = false; };
  }, [courseId]);

  /* بطاقةُ المدرّب المنبثقة — من اسمه أو «عن المدرب» (٩ نوفمبر ٢٠٢٦) */
  const [about, setAbout] = useState<Shown | null>(null);

  const shown = loaded?.courseId === courseId ? loaded.shown : [];
  if (shown.length === 0) return null;
  const quick = about && <TrainerQuickView seed={seedOf(about)} onClose={() => setAbout(null)} />;

  const heading = (
    <h2 id="meet-trainer" className="flex items-center gap-2 text-sm font-black text-foreground">
      <MonitorPlay className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> تعرّف على مدرّبك
    </h2>
  );
  /* مدرّبٌ واحد — وهو الغالب: العنوانُ بجانب النافذة فوق اسمه، فارتفاعُ القسم ارتفاعُ النافذة وحدَها */
  if (shown.length === 1) {
    const t = shown[0]!;
    return (
      <Card as="section" aria-labelledby="meet-trainer" className={className}>
        <TrainerVideoCard
          video={t.video} name={t.name} headline={t.headline} photoUrl={t.photoUrl}
          kicker={<div className="mb-2.5">{heading}</div>}
          onAbout={() => setAbout(t)}
        />
        {quick}
      </Card>
    );
  }

  return (
    <Card as="section" aria-labelledby="meet-trainer" className={className}>
      {heading}
      <ul className="mt-3 flex flex-wrap gap-x-12 gap-y-5">
        {shown.map((t) => (
          <li key={t.id}>
            <TrainerVideoCard video={t.video} name={t.name} headline={t.headline} photoUrl={t.photoUrl} onAbout={() => setAbout(t)} />
          </li>
        ))}
      </ul>
      {quick}
    </Card>
  );
}

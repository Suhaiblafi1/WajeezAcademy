/* صورةُ المدرّب بحلقة «قصّة» حين يكون له فيديو — قرارُ صاحب المنصّة (٩ نوفمبر ٢٠٢٦).

   كان فيديو التعريف في صفحة المدرّب قسما مستقلّا تحت نبذته (نافذةُ #901 الصغيرة). فاختار صاحبُ المنصّة أن يصير
   **حلقةً حول صورته نفسِها** كقصص التواصل: تدرّجٌ فيروزيٌّ يدور ببطء، وشارةُ تشغيلٍ صغيرةٌ على طرف الصورة. والضغطُ على
   الصورة يفتح المشغّلَ المكبَّر نفسَه (`TrainerVideoZoom` في `TrainerVideo.tsx`) من موضعها.

   ═══ والصورةُ تبقى صورةً لمن لا فيديو له ═══

   الحلقةُ والشارةُ والزرُّ لمن له فيديو يُضمَّن وحدَه (`onPlay`). وبلاه: صورتُه كما هي أو حرفُه — لا زرَّ ولا حلقة.
   ورابطٌ لا يُضمَّن (`kind: 'link'`) لا حلقةَ له: يفتحه الرابطُ الصغير تحت تعريفه في لسانٍ جديد (`TrainerVideoLink`).

   ═══ والصورةُ من أصلنا وحدَه ═══

   ما وصل من الخادم يمرّ بـ`safePhotoUrl` قبل أن يُرسم، كخلفيّة النافذة الصغيرة. ولا شيءَ من المزوّد قبل الضغط. */

import type { MouseEvent, Ref } from "react";
import { ExternalLink, Play } from "lucide-react";
import { initialsOf } from "@/application/text/initials";
import { safePhotoUrl, type PublicTrainerVideo } from "@/application/trainer/marketing-video";

/* تدرّجُ العلامة الفيروزيّ بلمعةٍ فاتحة — والحلقةُ مربّعٌ مضاعفٌ يدور خلف الصورة فلا يُرى منه إلّا إطارُها */
const RING_GRADIENT =
  "conic-gradient(from 0deg, rgb(var(--teal-light)), rgb(var(--teal)), rgb(var(--teal-deep)), rgb(var(--teal)), "
  + "#d9f5f8, rgb(var(--teal-light)))";

/** الشكلُ والمقاس: الصفحةُ تبقي مربّعَها المستدير، والبطاقةُ المنبثقة دائرة */
const SHAPES = {
  squircle: { outer: "rounded-[1.35rem]", inner: "rounded-[1.2rem]", img: "rounded-2xl" },
  circle: { outer: "rounded-full", inner: "rounded-full", img: "rounded-full" },
} as const;

/** لونُ الفاصل بين الحلقة والصورة — أرضيّةُ ما تجلس عليه */
const GAPS = {
  paper: { gap: "bg-paper", badge: "ring-paper" },
  surface: { gap: "bg-surface", badge: "ring-surface" },
} as const;

export function TrainerAvatarRing({
  name, photoUrl, onPlay, buttonRef, boxClassName = "h-24 w-24", shape = "squircle", gap = "paper", monogramClassName = "text-3xl",
}: {
  name: string;
  photoUrl: string | null | undefined;
  /** يُمرَّر لمن له فيديو يُضمَّن وحدَه — فتصير الصورةُ زرّا بحلقةٍ وشارة */
  onPlay?: (e: MouseEvent<HTMLButtonElement>) => void;
  buttonRef?: Ref<HTMLButtonElement>;
  /** المقاسُ وحدَه (`h-24 w-24`) */
  boxClassName?: string;
  shape?: keyof typeof SHAPES;
  gap?: keyof typeof GAPS;
  monogramClassName?: string;
}) {
  const photo = safePhotoUrl(photoUrl);
  const s = SHAPES[shape];
  const face = photo ? (
    <img
      src={photo}
      alt={onPlay ? "" : `صورة ${name}`}
      loading="lazy"
      decoding="async"
      className={`${boxClassName} ${s.img} block object-cover object-[50%_30%] transition duration-500 motion-safe:group-hover:scale-[1.03]`}
    />
  ) : (
    /* `bg-teal-deep` مع `text-white` يبقى أبيضَ في المظهر النهاريّ (`styles/light.css`) */
    <span aria-hidden="true" className={`${boxClassName} ${s.img} grid place-items-center bg-teal-deep font-black text-white ${monogramClassName}`}>
      {initialsOf(name)}
    </span>
  );

  if (!onPlay) return <span className="block shrink-0">{face}</span>;

  const g = GAPS[gap];
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onPlay}
      aria-label={`شغل الفيديو التعريفي: ${name}`}
      data-video-ring=""
      className={
        `group relative block w-fit shrink-0 ${s.outer} p-[3px] transition motion-safe:hover:scale-[1.02] `
        + "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      }
    >
      <span aria-hidden="true" className={`absolute inset-0 overflow-hidden ${s.outer}`}>
        <span className="absolute -inset-1/2 motion-safe:animate-story-ring" style={{ backgroundImage: RING_GRADIENT }} />
      </span>
      <span className={`relative block ${s.inner} ${g.gap} p-[2px]`}>{face}</span>
      <span
        aria-hidden="true"
        data-play-badge=""
        className={`absolute -bottom-1 -left-1 grid h-8 w-8 place-items-center rounded-full bg-[#fff] text-[#08272B] shadow-lg ring-[3px] ${g.badge} transition motion-safe:group-hover:scale-110`}
      >
        <Play className="h-3.5 w-3.5 translate-x-px fill-current" />
      </span>
    </button>
  );
}

/** صورةُ رأس صفحته (`TrainerPublic.tsx`): بحلقةٍ وشارةٍ لما يُضمَّن وحدَه، وإلّا فصورتُه كما كانت قبل الفيديو تماما
    — ولا شيءَ حين لا صورةَ ولا فيديو */
export function TrainerPagePhoto({
  name, photoUrl, video, onPlay, buttonRef,
}: {
  name: string;
  photoUrl: string | null;
  video: PublicTrainerVideo | null;
  onPlay: (e: MouseEvent<HTMLButtonElement>) => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  if (video?.kind === "embed") return <TrainerAvatarRing name={name} photoUrl={photoUrl} onPlay={onPlay} buttonRef={buttonRef} />;
  return photoUrl ? <img src={photoUrl} alt="" className="h-24 w-24 shrink-0 rounded-2xl object-cover" /> : null;
}

/** «شاهد الفيديو التعريفي» تحت تعريفه: يفتح المشغّلَ لما يُضمَّن، ورابطَه في لسانٍ جديدٍ لما لا يُضمَّن */
export function TrainerVideoLink({
  video, onPlay, className = "",
}: {
  video: PublicTrainerVideo;
  onPlay: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}) {
  const look =
    "inline-flex min-h-11 items-center gap-1.5 text-read font-bold text-teal-light-ink underline-offset-4 transition hover:underline "
    + "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal " + className;
  const icon = (
    <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-teal/15">
      <Play className="h-3 w-3 translate-x-px fill-current" />
    </span>
  );
  if (video.kind === "link") {
    return (
      <a href={video.href} target="_blank" rel="noopener noreferrer" className={look}>
        {icon}
        شاهد الفيديو التعريفي
        <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
      </a>
    );
  }
  return (
    <button type="button" onClick={onPlay} className={look}>
      {icon}
      شاهد الفيديو التعريفي
    </button>
  );
}

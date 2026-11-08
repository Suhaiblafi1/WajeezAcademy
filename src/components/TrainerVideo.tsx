/* «تعرّف على مدرّبك» — فيديو المدرّب للزائر (٨ نوفمبر ٢٠٢٦).

   القرارُ وقواعدُ الاختيار والتضمين في `src/application/trainer/marketing-video.ts`. وهنا الرسمُ وحدَه:
   إطارٌ ١٦:٩ يُحمَّل حين يقترب من الشاشة، أو زرٌّ يفتح الرابطَ في لسانٍ جديد. وما وصل من الخادم يُفحص
   بـ`renderableVideo` قبل أن يُرسم — فلا يدخل `src` إطارٍ إلّا رابطٌ بنيناه نحن من أصلٍ مسموح.

   ومن لا فيديو له لا يُرسم له شيء: لا صندوقٌ فارغٌ ولا «لا فيديو بعد». */

import { useEffect, useState } from "react";
import { ExternalLink, MonitorPlay } from "lucide-react";
import { apiGet } from "@/services/api";
import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { renderableVideo, type PublicTrainerVideo } from "@/application/trainer/marketing-video";

/** الإطارُ أو الزرّ — لمدرّبٍ واحد */
export function TrainerVideoFrame({ video, trainerName }: { video: PublicTrainerVideo; trainerName: string }) {
  if (video.kind === "link") {
    return (
      <Button as="a" href={video.href} target="_blank" rel="noopener noreferrer" tone="secondary" size="sm" icon={ExternalLink}>
        شاهد الفيديو
      </Button>
    );
  }
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black/40">
      <iframe
        src={video.src}
        title={`فيديو تعريفي: ${trainerName}`}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}

interface CourseTrainerReply {
  announced: boolean;
  trainers: { id: string; name: string; headline: string | null; video?: unknown }[];
}

interface Shown { id: string; name: string; headline: string | null; video: PublicTrainerVideo }

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
              return video ? [{ id: t.id, name: t.name, headline: t.headline, video }] : [];
            })
          : [];
        setLoaded({ courseId, shown });
      })
      .catch(() => { /* بلا خادم — لا قسم */ });
    return () => { alive = false; };
  }, [courseId]);

  const shown = loaded?.courseId === courseId ? loaded.shown : [];
  if (shown.length === 0) return null;

  return (
    <Card as="section" aria-labelledby="meet-trainer" className={className}>
      <h2 id="meet-trainer" className="flex items-center gap-2 text-sm font-black text-foreground">
        <MonitorPlay className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> تعرّف على مدرّبك
      </h2>
      <ul className="mt-3 space-y-5">
        {shown.map((t) => (
          <li key={t.id} className="grid gap-3 md:grid-cols-5 md:items-center md:gap-5">
            <div className="min-w-0 md:col-span-2">
              <p className="text-read font-black leading-snug text-foreground">{t.name}</p>
              {t.headline && <p className="mt-1 text-read leading-relaxed text-muted-foreground">{t.headline}</p>}
            </div>
            <div className="md:col-span-3">
              <TrainerVideoFrame video={t.video} trainerName={t.name} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

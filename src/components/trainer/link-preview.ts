/* ═══ معاينةُ روابطه — تُرسم هنا وتُرفع (٢٦ أكتوبر ٢٠٢٦) ═══

   «أضف معاينة، نعم» (صاحب المنصّة): رابطُه القصيرُ إذا لُصق في واتساب وفيسبوك ولينكدإن ظهرت صورتُه المصمَّمة.
   والخادمُ بلا محرّكِ رسم، فصفحةُ «شارك دوراتك» ترسم المعاينةَ بخطّ المنصّة (`share-art.ts`، صيغةُ `link`) وترفعها
   لكلّ رابطٍ من روابطه: العامِّ بدوراته كلِّها، ولكلّ شعبةٍ بدورتها.

   ولا تُرفع في كلّ زيارة: لكلّ صورةٍ **بصمةُ ما رُسمت منه** (`previewSig`) — اسمُه ومسمّاه وصورتُه ودوراتُه ومواعيدُها
   والكود ونسخةُ التصميم. فإن طابقت بصمةَ الخادم لم يُرسم شيء؛ وإن تغيّر شيءٌ منها رُسمت ورُفعت. والخادمُ يكتب
   العنوانَ والوصفَ بنفسه (`server/services/link-preview.ts`). */

import { apiGet, apiUpload } from "@/services/api";
import { fmtDayMonth } from "@/application/text/format-ar";
import { bestCode } from "@/application/trainer/share-kit";
import { drawArt, type ArtData } from "./share-art";

/** نسخةُ تصميم المعاينة — تُرفع إذا تغيّرت فتتجدّد الصورُ القديمةُ كلُّها (٣: بلا عنوان الموقع، ٢٦ أكتوبر ٢٠٢٦ · ٤: رأسٌ أصغر، ٢٧ أكتوبر ٢٠٢٦) */
export const LINK_ART_VERSION = 4;

export interface LinkToPreview {
  /** الرابطُ القصير كاملا — `…/s/XXXXXX` */
  url: string;
  courses: ArtData["courses"];
}

/** بصمةٌ قصيرةٌ ثابتة (FNV-1a بـ٣٢ بتّا مرّتين) — تقول «تغيّر ما رُسمت منه» لا أكثر */
export function previewSig(face: Pick<ArtData, "name" | "headline" | "photoUrl" | "code">, courses: ArtData["courses"]): string {
  const text = JSON.stringify([LINK_ART_VERSION, face.name, face.headline ?? null, face.photoUrl, face.code, courses]);
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b ^ text.charCodeAt(text.length - 1 - i), 0x811c9dc5) >>> 0;
  }
  return `v${LINK_ART_VERSION}-${a.toString(36)}${b.toString(36)}`;
}

const codeOf = (url: string) => new URL(url, window.location.origin).pathname.split("/").pop() ?? "";

/** يرسم ويرفع ما تغيّر من معايناته — واحدةً بعد واحدة، وما تعذّر يُترك للزيارة التالية */
export async function syncLinkPreviews(
  face: Omit<ArtData, "courses">,
  links: LinkToPreview[],
  have: Record<string, string | null>,
): Promise<void> {
  for (const l of links) {
    const code = codeOf(l.url);
    if (!code || !(code in have)) continue;
    const sig = previewSig(face, l.courses);
    if (have[code] === sig) continue;
    try {
      const canvas = await drawArt("link", { ...face, courses: l.courses });
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
      if (!blob) continue;
      await apiUpload(`/api/trainer/me/share-kit/preview/${encodeURIComponent(code)}?sig=${encodeURIComponent(sig)}`,
        new File([blob], `${code}.jpg`, { type: "image/jpeg" }));
    } catch {
      /* معاينةٌ لم تُرفع لا تمنع شيئا: الرابطُ يعمل، ويقرأ الزاحفُ وسومَ وجهته */
    }
  }
}

/* ═══ وتتجدّد من لوحته الرئيسة أيضا (٢٧ أكتوبر ٢٠٢٦) ═══
   كانت المعاينةُ تُرسم حين يفتح «شارك دوراتك» وحدَها. فإن نشر رابطَه ثمّ تغيّر موعدُ شعبته أو جاءته دورةٌ أو تغيّر
   الكود، بقيت صورتُه بالقديم حتّى يعود إليها. فسُئل صاحبُ المنصّة فقال: «الاثنتان» — وهذه الأولى: لوحتُه الرئيسةُ
   التي يفتحها كثيرا تجدّدها أيضا (`TrainerDashboard`)، مرّةً في كلّ جلسة متصفّح، ولا يُرسم إلّا ما تغيّرت بصمتُه. */

/** ما يُرسم منه: وجهُه وكودُه وروابطُه القصيرة — كما يرسله `/api/trainer/me/share-kit` */
export interface PreviewKit {
  name: string; headline: string | null; photoUrl: string | null
  code: string; percentOff: number; hisCodes: { code: string; percentOff: number | null }[]
  short: { wide: string | null; cohorts: Record<string, string> }
  previews?: Record<string, string | null>
}
/** شعبةٌ له — كما يرسلها `/api/trainer/me/referral-links` */
export interface PreviewCohort { cohortId: string; courseTitle: string; startsAt: string | null }

/** وجهُه للرسم */
export function previewFaceOf(kit: PreviewKit): Omit<ArtData, "courses"> {
  return {
    name: kit.name, headline: kit.headline, photoUrl: kit.photoUrl,
    code: bestCode({ code: kit.code, percentOff: kit.percentOff }, kit.hisCodes),
    dayAr: (iso: string) => fmtDayMonth(iso),
  };
}

/** روابطُه وما يُرسم لكلٍّ: العامُّ بدوراته كلِّها بترتيب بدئها، ولكلّ شعبةٍ دورتُها */
export function previewLinksOf(kit: PreviewKit, cohorts: PreviewCohort[]): LinkToPreview[] {
  if (cohorts.length === 0) return [];
  const courses = (cs: PreviewCohort[]) => cs.map((c) => ({ courseTitle: c.courseTitle, startsAt: c.startsAt }))
    .sort((a, b) => (a.startsAt ?? "9").localeCompare(b.startsAt ?? "9"));
  return [
    ...(kit.short.wide ? [{ url: kit.short.wide, courses: courses(cohorts) }] : []),
    ...cohorts.flatMap((c) => (kit.short.cohorts[c.cohortId] ? [{ url: kit.short.cohorts[c.cohortId], courses: courses([c]) }] : [])),
  ];
}

const REFRESHED_KEY = "wajeez:link-previews-refreshed";

/** يجدّد معايناته من أيّ صفحةٍ في بوّابته — مرّةً في الجلسة، وما تعذّر يُترك للمرّة التالية */
export async function refreshMyLinkPreviews(): Promise<void> {
  try {
    if (sessionStorage.getItem(REFRESHED_KEY)) return;
  } catch { /* بلا تخزين: يجدّد في كلّ زيارة، وما لم يتغيّر لا يُرسم */ }
  try {
    /* ═══ وشعبُه أوّلا، والعُدّةُ بعدها (٢٧ أكتوبر ٢٠٢٦) ═══
       `share-kit` يُنشئ كودَ الخصم أوّلَ مرّةٍ يُطلب (`TrainerShareCodeService.mine`). وكانت اللوحةُ تطلبه لكلّ مدرّبٍ يفتحها،
       فيُسَكّ كودٌ وأثرُه لمن لا شعبةَ له يُرسم عنها. فلا يُطلب إلّا ولمعاينته شيءٌ يُرسم. */
    const cohorts = await apiGet<PreviewCohort[]>("/api/trainer/me/referral-links");
    if (cohorts.length > 0) {
      const kit = await apiGet<PreviewKit>("/api/trainer/me/share-kit");
      await syncLinkPreviews(previewFaceOf(kit), previewLinksOf(kit, cohorts), kit.previews ?? {});
    }
    /* ويُعلَّم بعد أن تمّ لا قبله: ما تعذّر يُعاد في الزيارة التالية من الجلسة نفسِها */
    try { sessionStorage.setItem(REFRESHED_KEY, "1"); } catch { /* بلا تخزين */ }
  } catch {
    /* من ليس له طريقٌ إلى روابطه — لا شيء يُرسم */
  }
}

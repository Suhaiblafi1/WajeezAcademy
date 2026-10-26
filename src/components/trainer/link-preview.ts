/* ═══ معاينةُ روابطه — تُرسم هنا وتُرفع (٢٦ أكتوبر ٢٠٢٦) ═══

   «أضف معاينة، نعم» (صاحب المنصّة): رابطُه القصيرُ إذا لُصق في واتساب وفيسبوك ولينكدإن ظهرت صورتُه المصمَّمة.
   والخادمُ بلا محرّكِ رسم، فصفحةُ «شارك دوراتك» ترسم المعاينةَ بخطّ المنصّة (`share-art.ts`، صيغةُ `link`) وترفعها
   لكلّ رابطٍ من روابطه: العامِّ بدوراته كلِّها، ولكلّ شعبةٍ بدورتها.

   ولا تُرفع في كلّ زيارة: لكلّ صورةٍ **بصمةُ ما رُسمت منه** (`previewSig`) — اسمُه ومسمّاه وصورتُه ودوراتُه ومواعيدُها
   والكود ونسخةُ التصميم. فإن طابقت بصمةَ الخادم لم يُرسم شيء؛ وإن تغيّر شيءٌ منها رُسمت ورُفعت. والخادمُ يكتب
   العنوانَ والوصفَ بنفسه (`server/services/link-preview.ts`). */

import { apiUpload } from "@/services/api";
import { drawArt, type ArtData } from "./share-art";

/** نسخةُ تصميم المعاينة — تُرفع إذا تغيّرت فتتجدّد الصورُ القديمةُ كلُّها */
export const LINK_ART_VERSION = 1;

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

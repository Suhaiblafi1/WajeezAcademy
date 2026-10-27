/* رفعُ صورة الحساب — ثلاثُ خطوات: رابطٌ موقّتٌ من الخادم، ثمّ البايتاتُ إليه مباشرةً لا في JSON.

   والتجهيزُ قبلها في المتصفّح (`ImageFramer` و`lib/prepare-image.ts`): يفرض الشروطَ ويُسقط EXIF. ويرفع منه حسابُ
   المتعلّم (`student/Account.tsx`) و«تصميمك الخاص» في حساب المؤثّر (`InfluencerHome.tsx`) — والصورةُ واحدة. */

import { apiPost } from "./api";
import { PHOTO_OUT_MIME } from "@/lib/prepare-image";

/* رابطُ الرفع نسبيٌّ يُصدره الخادم، ويُسبق بأصل الـAPI كما تفعل بقيّةُ شاشات الرفع. وفي الإنتاج `VITE_API_URL` غيرُ
   مضبوطٍ فيستوي الأمران، لكنّه في التطوير يشير إلى منفذٍ آخر — فالرفعُ بلا هذه البادئة يقصد خادمَ Vite لا الـAPI. */
const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

/** خطأٌ يُقال لصاحبه كما هو */
export class AvatarUploadError extends Error {}

/** يرفع الصورةَ المجهّزة — ويُرجع عنوانَها، وهل تنتظر اعتمادَ الإدارة (المدرّبُ وحدَه) */
export async function uploadAccountAvatar(blob: Blob): Promise<{ avatarUrl: string; awaitingApproval: boolean }> {
  const r = await apiPost<{
    uploadUrl: string; maxBytes: number; avatarUrl: string; awaitingApproval: boolean;
  }>("/api/learner/avatar-upload", { mime: PHOTO_OUT_MIME });
  if (blob.size > r.maxBytes) throw new AvatarUploadError(`الصورة أكبر من الحد (${Math.round(r.maxBytes / 1024)} ك.ب)`);
  const res = await fetch(`${API_BASE}${r.uploadUrl}`, {
    method: "PUT", headers: { "content-type": PHOTO_OUT_MIME }, body: blob,
  });
  /* الحالةُ تُقال: ٥٠١ إشعالٌ مطفأ، و٤١٥ نوعٌ مرفوض، و٤٠٣ رابطٌ منتهٍ */
  if (!res.ok) throw new AvatarUploadError(`تعذر رفع الصورة (${res.status})`);
  return { avatarUrl: r.avatarUrl, awaitingApproval: r.awaitingApproval };
}

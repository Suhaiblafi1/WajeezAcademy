/* وجوهُ مدرّبي البطاقة — دوائرُ متراصّةٌ كصفحة المنحة.
   والحسابُ وعلّتُه في `trainerFacesOf` (`application/catalog/course-trainers.ts`).

   والمقاسُ ٤٤ لا ٣٢ — قرارُ صاحب المنصّة (٢٧ أكتوبر ٢٠٢٦): «كبّر صور المدرّبين أكثر في الدورات والمسارات».
   فالوجهُ يُعرف من البطاقة لا يُخمَّن. وأربعةٌ و«+N» تسع أضيقَ بطاقة (١٧٢ بكسلا من نحو ٢٢٠). */

import type { TrainerFace } from "@/application/catalog/course-trainers";

export default function TrainerFaces({ faces, total }: { faces: readonly TrainerFace[]; total: number }) {
  if (faces.length === 0) return null;
  const more = total - faces.length;
  const label = faces.map((t) => t.name).join("، ");
  return (
    <span className="flex items-center gap-2.5" aria-label={`المدربون: ${label}`} role="img">
      <span className="flex -space-x-3 rtl:space-x-reverse">
        {faces.map((t) => (
          <img key={t.id || t.name} src={t.photoUrl} alt="" title={t.name} width={44} height={44} loading="lazy" decoding="async"
            className="h-11 w-11 shrink-0 rounded-full bg-paper object-cover object-[50%_25%] ring-2 ring-paper" />
        ))}
        {more > 0 && (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal-deep text-read font-black text-white ring-2 ring-paper" dir="ltr">
            +{more}
          </span>
        )}
      </span>
      {/* مدرّبٌ واحدٌ يُسمّى: وجهٌ بلا اسمٍ في بطاقة دورةٍ يُسأل عنه */}
      {total === 1 && <span className="truncate text-read text-muted-foreground">{faces[0].name}</span>}
    </span>
  );
}

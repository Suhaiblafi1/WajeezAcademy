/* ═══ «شارك دوراتك» — كانت «دعوتي» قسما في «مستحقاتي» (٢٦ أكتوبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «خانة دعوتي يجب أن تكون بالخارج، واسمها شارك دوراتك». فصارت لسانا بنفسها، والمحتوى
   محتواها (`Referral.tsx`). والاتفاقيّةُ الموقّعة تسمّيها «دعوتي» (البندان 4-10 و1-2) — ونصُّ عقدٍ موقَّعٍ لا يُمسّ،
   فيُقال ذلك في الصفحة سطرا ليجد المدرّبُ ما يحيل إليه عقدُه. */

import TrainerLayout from "./TrainerLayout";
import Referral from "./Referral";

export default function Share() {
  return (
    <TrainerLayout title="شارك دوراتك">
      <p className="mb-4 text-read text-muted-foreground">وهي «دعوتي» التي تذكرها الاتفاقية.</p>
      <Referral />
    </TrainerLayout>
  );
}

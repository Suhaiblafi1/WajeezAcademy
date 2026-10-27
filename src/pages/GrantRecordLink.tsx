/* رابطُ ملفّ صاحب المنحة — `/g/<كوده>` (٢٦ أكتوبر ٢٠٢٦).

   يُكتب في رسالة «راسل مستشارك» من صفحة المنحة، فيضغطه من يقرأ واتساب الأكاديميّة فيفتح صفَّ صاحبها في قائمة
   «من عبأ النموذج» — بكوده وتواصله وحالته ومستشاره. قرارُ صاحب المنصّة: «٢ — make the link shorter».

   وهو تحويلٌ لا صفحة، ولا يسأل الخادمَ شيئا: الإدارةُ خلف حارسها (`RequireRole`) والقائمةُ خلف صلاحيّتها في الخادم،
   فمن ليس منها لا يرى شيئا. وما لا يشبه كودا ولا رقمَ طلبٍ يذهب إلى صفحة المنحة. */

import { Navigate, useParams } from "react-router";
import { GRANT_RECORD_KEY_RE } from "@/application/commerce/grant-landing";

/** `influencer`: `/g/i/<كوده>` — صاحبُ منحة المؤثّرين قائمتُه في صفحة منحتهم (٢٧ أكتوبر ٢٠٢٦) */
export default function GrantRecordLink({ influencer = false }: { influencer?: boolean }) {
  const { key = "" } = useParams();
  if (!GRANT_RECORD_KEY_RE.test(key)) return <Navigate replace to="/grant" />;
  const admin = influencer ? "/admin/influencer-grant" : "/admin/member-grant";
  return <Navigate replace to={`${admin}?q=${encodeURIComponent(key)}#grant-registrants`} />;
}

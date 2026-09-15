/* الرابطُ القصير — `/s/<code>` (ط-٣).

   ═══ لمَ هذه الصفحةُ لا تعرض شيئا ═══

   هي تحويلٌ لا وجهة: تسأل الخادمَ عن المسار الداخليّ ثمّ تنتقل إليه. كصفحةِ
   `PathRedirect` تماما، وللسبب نفسِه — بوّاباتُ العرض تسكن في الصفحات التي
   تُعرض، فلا تُنسخ هنا.

   ═══ والوجهةُ تُفحَص هنا أيضا ═══

   فحصها الخادمُ عند الكتابة وعند القراءة. وتُفحَص هنا مرّةً ثالثةً لأنّ هذا
   هو الموضعُ الذي **يقع فيه التحويلُ فعلا**: ما يحمي الزائرَ هو الشرطُ الذي
   يسبق `Navigate` لا الذي سبقه في خادمٍ آخر. وثمنُه سطرٌ واحد.

   و`replace` لا `push`: من ضغط «رجوع» بعد التحويل يعود إلى حيث كان، لا إلى
   عنوانٍ يحوّله ثانيةً فيحبسه. */

import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { Panel } from "@/components/ui/Surface";
import { apiGet } from "@/services/api";
import { isSafeTarget } from "@/application/links/short-link";

interface LinkTarget { target: string }

export default function ShortLink() {
  const { code = "" } = useParams();
  const [loaded, setLoaded] = useState<{ code: string; target: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    apiGet<LinkTarget>(`/api/public/links/${encodeURIComponent(code)}`)
      .then((t) => { if (alive) setLoaded({ code, target: isSafeTarget(t.target) ? t.target : null }); })
      .catch(() => { if (alive) setLoaded({ code, target: null }); });
    return () => { alive = false; };
  }, [code]);

  const current = loaded?.code === code ? loaded : null;

  if (current?.target) return <Navigate replace to={current.target} />;

  if (current) {
    return (
      <SiteShell>
        <SeoHead title="رابطٌ لا يفتح" description="الرابطُ غيرُ صحيحٍ أو أُبطل." path={`/s/${code}`} noindex />
        <div className="mx-auto max-w-3xl px-5 py-16">
          <Panel className="p-8 text-center">
            <h1 className="text-2xl font-black">رابطٌ لا يفتح</h1>
            <p className="mt-3 text-read leading-7 text-muted-foreground">
              تأكّد من نسخه كاملا، أو ابدأ من <Link to="/" className="font-bold underline">صفحة الأكاديمية</Link>.
            </p>
          </Panel>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <SeoHead title="جارٍ فتحُ الرابط" description="تحويلٌ إلى وجهة الرابط." path={`/s/${code}`} noindex />
      <div className="mx-auto max-w-3xl px-5 py-16 text-center text-read text-muted-foreground">جارٍ فتحُ الرابط…</div>
    </SiteShell>
  );
}

/* رابطُ مسارٍ باسمه — `/path/<slug>` (ن-١١).

   ═══ لمَ هذه الصفحةُ لا تعرض شيئا ═══

   `TrainerPath.slug` يُشتقّ ويُحفظ ويخرج في ردودِ «مساراتي» و«الطابور»
   و«الرفّ»، ومكتوبٌ في المخطّط أنّه «عنوانُه العامّ» — **ولم يكن في المنصّة
   عنوانٌ يحلّه**. فمن أراد أن يشارك مسارا بعينه لم يجد ما يشاركه.

   والوجهةُ صفحةُ صاحبه مرساةً عند بطاقته (`#path-<slug>`)، لا صفحةٌ ثانية:
   بوّابةُ النشر — «لا اسمَ مدرّبٍ يُعرض قبل اعتماد نشره» — تسكن في صفحة
   المدرّب وحدَها، وصفحةٌ ثانيةٌ تعرض اسمَه تصير مالكا ثانيا لتلك القاعدة.
   فيصل الزائرُ إلى ما جمعه صاحبُ المسار كلِّه، وعينُه على المسار الذي جاء
   من أجله.

   و`replace` لا `push`: من ضغط «رجوع» بعد التحويل يعود إلى حيث كان، لا إلى
   عنوانٍ يحوّله ثانيةً فيحبسه. */

import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { Panel } from "@/components/ui/Surface";
import { apiGet } from "@/services/api";
import { pathAnchorId } from "@/application/trainer/public-slug";

interface PathTarget { trainerSlug: string; titleAr: string }

export default function PathRedirect() {
  const { slug = "" } = useParams();
  const [loaded, setLoaded] = useState<{ slug: string; target: PathTarget | null } | null>(null);

  useEffect(() => {
    let alive = true;
    apiGet<PathTarget>(`/api/public/paths/${encodeURIComponent(slug)}`)
      .then((t) => { if (alive) setLoaded({ slug, target: t }); })
      .catch(() => { if (alive) setLoaded({ slug, target: null }); });
    return () => { alive = false; };
  }, [slug]);

  const current = loaded?.slug === slug ? loaded : null;

  if (current?.target) {
    return <Navigate replace to={`/t/${encodeURIComponent(current.target.trainerSlug)}#${pathAnchorId(slug)}`} />;
  }

  if (current) {
    return (
      <SiteShell>
        <SeoHead title="لا مسارَ بهذا الرابط" description="الرابطُ غيرُ صحيحٍ أو سُحب المسارُ من الرفّ." path={`/path/${slug}`} noindex />
        <div className="mx-auto max-w-3xl px-5 py-16">
          <Panel className="p-8 text-center">
            <h1 className="text-2xl font-black">لا مسارَ بهذا الرابط</h1>
            <p className="mt-3 text-read leading-7 text-muted-foreground">
              تأكّد من الرابط، أو تصفّح <Link to="/trainers" className="font-bold underline">مدرّبي وجيز</Link>.
            </p>
          </Panel>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <SeoHead title="جارٍ فتحُ المسار" description="تحويلٌ إلى صفحة صاحب المسار." path={`/path/${slug}`} noindex />
      <div className="mx-auto max-w-3xl px-5 py-16 text-center text-read text-muted-foreground">جارٍ فتحُ المسار…</div>
    </SiteShell>
  );
}

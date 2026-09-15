/* صفحةُ المدرّب باسمه — `/t/<slug>`.

   قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): «عند العميل يجب أن يظهر مسارٌ خاصٌّ
   باسم المدرّب للعامّة في الرابط ليقوموا بالتسجيل فيه».

   وهذه بابٌ لا بضاعةٌ جديدة: ما فيها شعبٌ قائمةٌ مفتوحةٌ للتسجيل بأسعارها
   المعلنة نفسِها. ما يتغيّر أنّ من دخل منها يُحسب لصاحبها — فالرمزُ يُحفظ
   في الجلسة عند الدخول، كما يفعل `/build/:courseId` برمز الشعبة تماما،
   لأنّ الشراءَ يقع بعد خطوات وقد يُنشئ الزائرُ حسابا بينها.

   وصفحةٌ لمدرّبٍ لم يُعتمد نشرُ ملفّه **غيرُ موجودة**: الخادمُ يردّ ٤٠٤،
   وهذه تعرض «لا مدرّبَ بهذا المسار» — لا تقرّ بوجوده ثمّ تعتذر عن عرضه. */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { BadgeCheck, CalendarDays, GraduationCap, Star, Users } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import SeoHead from "@/components/SeoHead";
import { Panel, Card } from "@/components/ui/Surface";
import { apiGet } from "@/services/api";
import { pathAnchorId } from "@/application/trainer/public-slug";
import { REFERRAL_KEY } from "@/application/commerce/referral";
import { fmtDate, fmtMoney, fmtNum } from "@/application/text/format-ar";
import { countAr } from "@/application/text/count-ar";

interface PublicCohort {
  id: string; title: string; courseId: string; courseTitle: string;
  startsAt: string | null; price: string | number | null; currency: string;
  seatsLeft: number | null; deliveryMode: string | null;
}

interface TrainerPage {
  slug: string; name: string; headline: string | null; bio: string | null;
  photoUrl: string | null; country: string | null; specialties: string[];
  ratingAvg: number | null; ratingCount: number | null;
  hoursTaught: number | null; graduatesCount: number | null;
  referralCode: string | null;
  /* ن-٨: مساراتُه المنشورةُ باسمه — رابطُ دعوته يشير إلى هنا، فما جمعه
     لمتابعيه يجب أن يبلغَهم منه. */
  paths: {
    slug: string | null; titleAr: string; blurbAr: string | null;
    term: { titleAr: string; season: string; year: number; startsOn: string } | null;
    courseCount: number;
  }[];
  cohorts: PublicCohort[];
}

export default function TrainerPublic() {
  const { slug = "" } = useParams();
  /* المحمولُ يحمل مسارَه معه، والقديمُ يُهمَل بالمقارنة لا بتصفيرٍ في بداية
     الأثر: `setState` متزامنٌ في جسد الأثر يُشعل تصييرا متتاليا (وحاجزُ
     التلويم يردّه). فالانتظارُ مشتقٌّ: ما حُمل لمسارٍ آخر ليس جوابا لهذا. */
  const [loaded, setLoaded] = useState<{ slug: string; page: TrainerPage | null } | null>(null);

  useEffect(() => {
    let alive = true;
    apiGet<TrainerPage>(`/api/public/trainers/${encodeURIComponent(slug)}`)
      .then((p) => { if (alive) setLoaded({ slug, page: p }); })
      .catch(() => { if (alive) setLoaded({ slug, page: null }); });
    return () => { alive = false; };
  }, [slug]);

  const current = loaded?.slug === slug ? loaded : null;
  const page = current?.page ?? null;
  const missing = current !== null && current.page === null;

  /* الرمزُ يُحفظ عند وصول الصفحة لا عند الضغط على شعبة: الزائرُ قد يتصفّح
     ثمّ يعود من طريقٍ آخر، والبابُ الذي دخل منه واحد. */
  useEffect(() => {
    const code = page?.referralCode?.trim();
    if (!code) return;
    try { sessionStorage.setItem(REFERRAL_KEY, code); } catch { /* تخزينٌ معطَّل — يمرّ الشراءُ عامّا */ }
  }, [page?.referralCode]);

  if (missing) {
    return (
      <SiteShell>
        <SeoHead title="لا مدرّبَ بهذا المسار" description="الرابطُ غيرُ صحيحٍ أو لم يُعتمد نشرُ هذا الملفّ بعد." path={`/t/${slug}`} noindex />
        <div className="mx-auto max-w-3xl px-5 py-16">
          <Panel className="p-8 text-center">
            <h1 className="text-2xl font-black">لا مدرّبَ بهذا المسار</h1>
            <p className="mt-3 text-read leading-7 text-muted-foreground">
              تأكّد من الرابط، أو تصفّح <Link to="/trainers" className="font-bold underline">مدرّبي وجيز</Link>.
            </p>
          </Panel>
        </div>
      </SiteShell>
    );
  }

  if (!page) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-5xl px-5 py-16"><p className="text-read text-muted-foreground">جارٍ التحميل…</p></div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <SeoHead
        title={page.name}
        description={page.headline ?? `شعبُ ${page.name} المفتوحةُ للتسجيل في أكاديمية وجيز.`}
        path={`/t/${page.slug}`}
      />
      <div className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
        <Panel className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {page.photoUrl && (
              <img src={page.photoUrl} alt="" className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black sm:text-3xl">
                {page.name}
                <BadgeCheck className="h-5 w-5 text-teal-light-ink" aria-label="مدرّبٌ موثّق" />
              </h1>
              {page.headline && <p className="mt-2 text-read leading-7 text-muted-foreground">{page.headline}</p>}
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-read text-muted-foreground">
                {page.ratingAvg != null && (
                  <li className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 text-teal-light-ink" />
                    {fmtNum(page.ratingAvg, { maximumFractionDigits: 1 })}
                    {page.ratingCount != null && <span>({countAr(page.ratingCount, { one: "تقييم", two: "تقييمان", few: "تقييمات", many: "تقييما" })})</span>}
                  </li>
                )}
                {page.hoursTaught != null && (
                  <li className="flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-teal-light-ink" />{countAr(page.hoursTaught, { one: "ساعة تدريب", two: "ساعتا تدريب", few: "ساعات تدريب", many: "ساعة تدريب" })}</li>
                )}
                {page.graduatesCount != null && (
                  <li className="flex items-center gap-1.5"><Users className="h-4 w-4 text-teal-light-ink" />{countAr(page.graduatesCount, { one: "خرّيج", two: "خرّيجان", few: "خرّيجين", many: "خرّيجا" })}</li>
                )}
              </ul>
            </div>
          </div>
          {page.bio && <p className="mt-6 whitespace-pre-line text-read leading-7">{page.bio}</p>}
          {page.specialties.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {page.specialties.map((s) => (
                <li key={s} className="rounded-full bg-paper px-3 py-1 text-read text-muted-foreground">{s}</li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ═══ ما جمعه هو أوّلا، ثمّ شعبُه المتفرّقة (ن-٨ · تمامُ و-١) ═══

            المسارُ اختيارُه ورأيُه: رتّب دوراتِه وسمّاها باسمه. والشعبُ
            قائمةٌ تعرضها المنصّة. فمن فتح رابطَ دعوته يرى ما أوصى به قبل أن
            يرى ما هو متاحٌ عنده. */}
        {page.paths.length > 0 && (
          <>
            <h2 className="mt-10 text-xl font-black">مساراتٌ أعدّها بنفسه</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {page.paths.map((p) => (
                <Card as="li" key={p.slug ?? p.titleAr} id={p.slug ? pathAnchorId(p.slug) : undefined}>
                  <h3 className="font-black">{p.titleAr}</h3>
                  {p.blurbAr && (
                    <p className="mt-1.5 text-read leading-6 text-muted-foreground">{p.blurbAr}</p>
                  )}
                  <p className="mt-2 text-read leading-6 text-muted-foreground">
                    {p.courseCount} دورة
                    {p.term && <> · {p.term.titleAr}</>}
                  </p>
                </Card>
              ))}
            </ul>
          </>
        )}

        <h2 className="mt-10 text-xl font-black">الشعبُ المفتوحةُ للتسجيل</h2>
        {page.cohorts.length === 0 ? (
          <Card className="mt-4 p-6">
            <p className="text-read leading-7 text-muted-foreground">
              لا شعبةَ مفتوحةً لديه الآن. تصفّح <Link to="/courses" className="font-bold underline">الدورات</Link> أو عُد قريبا.
            </p>
          </Card>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {page.cohorts.map((c) => (
              <li key={c.id}>
                <Card className="flex h-full flex-col p-5">
                  <p className="text-read font-bold text-muted-foreground">{c.courseTitle}</p>
                  <h3 className="mt-1 text-lg font-black">{c.title}</h3>
                  <ul className="mt-3 space-y-1.5 text-read text-muted-foreground">
                    {c.startsAt && (
                      <li className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-teal-light-ink" />تبدأ {fmtDate(c.startsAt)}</li>
                    )}
                    {c.seatsLeft != null && (
                      <li>{c.seatsLeft > 0 ? countAr(c.seatsLeft, { one: "مقعد متبقٍّ", two: "مقعدان متبقّيان", few: "مقاعد متبقّية", many: "مقعدا متبقّيا" }) : "اكتملت المقاعد"}</li>
                    )}
                    {c.price != null && <li className="font-bold text-foreground">{fmtMoney(Number(c.price), c.currency)}</li>}
                  </ul>
                  <Link to={`/build/${c.courseId}`} className="btn-teal mt-5 inline-flex self-start px-5 py-2.5">
                    سجّل في هذه الشعبة
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SiteShell>
  );
}

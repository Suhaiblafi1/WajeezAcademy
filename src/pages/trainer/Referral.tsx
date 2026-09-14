/* دعوتي — رابطُ المدرّب إلى كلّ ما يدرّسه (ب-٥ · ف-١).

   كان الرابطُ بطاقةً في «الرئيسية» بين طابور العمل وجلساتِه القادمة، فيراه
   مرّةً يومَ أُسندت إليه شعبتُه ثمّ لا يعود إليه. وقرارُ صاحب المنصّة (١٣
   سبتمبر ٢٠٢٦): تبويبٌ خاصٌّ به بعد «ما قيل عنّي» مباشرةً.

   والصفحةُ تُفتتح بسؤالٍ لا بشرح (ف-١): ما الذي يريد أن يوصي به من يتابعه؟
   ثمّ تعطيه الرابطَ وتقول له ما يُكسبه — وتحيل الرقمَ إلى «مستحقاتي» حيث
   يُعرض أجرُ الإحالة بعينه لكلّ شعبة، فلا يُخترع هنا رقمٌ ولا يُنسخ فيفترق
   عن مصدره.

   والقسمُ الذي يبني مسارا باسمه من دوراته (وهو تمامُ ف-١) موضعُه هذه الصفحةُ
   حين يصل القسمُ «ن» — فالمكانُ مُعدٌّ له، ولا يُبنى قبله. */
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Link2, Loader2, UserPlus, Wallet } from "lucide-react";
import PortalFrame from "../PortalFrame";
import { apiGet, permissionMessage } from "@/services/api";
import { Panel, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffControlCls } from "@/components/FormKit";
import { countAr } from "@/application/text/count-ar";

interface MyReferral { code: string; slug: string; url: string; publicReady: boolean; registered: number }
const REGISTERED_FORMS = { one: "متعلّمٌ واحد", two: "متعلّمان", few: "متعلّمين", many: "متعلّما" } as const;

export default function Referral() {
  const [referral, setReferral] = useState<MyReferral | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    void apiGet<MyReferral>("/api/trainer/me/referral")
      .then((r) => { if (alive) setReferral(r); })
      .catch((e) => { if (alive) setError(permissionMessage(e, "تعذّر الوصول إلى الخادم")); });
    return () => { alive = false };
  }, []);

  return (
    <PortalFrame title="دعوتي">
      {error && <Inset as="p" tone="danger" className="mb-4 px-4 py-3 text-read leading-6 text-red-200">{error}</Inset>}

      {/* ف-١: تُفتتح بسؤالٍ عمّا يوصي به، لا بشرحِ آليّةِ الرابط */}
      <Panel as="section" className="mb-6">
        <h2 className="text-lg font-black">ما الذي توصي به من يتابعك؟</h2>
        <p className="mt-2 text-read leading-7 text-muted-foreground">
          لك صفحةٌ باسمك تعرض كلَّ شعبك المفتوحة — رابطٌ واحدٌ لها جميعا. انشره حيث تكتب وحيث يسمعك الناس،
          فمن سجّل منه يصلك باسمك لا رقما: تراه بعلامة «عبر رابطك» عند اسمه في طلبتك.
        </p>
      </Panel>

      {!referral && !error && (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" />
        </div>
      )}

      {referral && (
        <>
          <Panel as="section" className="mb-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-black">
                <Link2 className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> رابطي العامّ
              </p>
              <span className="flex items-center gap-1.5 text-read font-bold text-teal-light-ink">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {referral.registered > 0 ? `سجّل عبره ${countAr(referral.registered, REGISTERED_FORMS)}` : "لم يسجّل أحدٌ عبره بعد"}
              </span>
            </div>
            {/* الرابطُ يُعرض كما يُقرأ: `referral.service` لا يرمّز المسارَ،
                فاسمُه العربيُّ يبقى عربيّا في خانة النسخ كما في العنوان. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                readOnly dir="ltr" value={referral.url} aria-label="رابطي العامّ"
                onFocus={(e) => e.currentTarget.select()}
                className={`${staffControlCls} min-w-0 flex-1 text-left`}
              />
              <Button
                tone="secondary"
                onClick={() => { void navigator.clipboard?.writeText(referral.url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
              >
                {copied ? "نُسخ" : "انسخ الرابط"}
              </Button>
              <a href={referral.url} target="_blank" rel="noreferrer" className="text-read font-bold text-teal-light-ink hover:text-foreground">عايِنْها</a>
            </div>
            {/* البوّابةُ تُقال لا تُخفى: من لم يُعتمد نشرُ ملفّه رابطُه لا يفتح
                بعد — فيُقال له لمَ ومَن يرفعه، لا يُعطى رابطا يردّ ٤٠٤. */}
            {!referral.publicReady && (
              <Inset as="p" className="mt-3 px-4 py-3 text-read leading-6 text-muted-foreground">
                صفحتُك لا تفتح للعامّة بعد: لا يُعرض اسمُ مدرّبٍ قبل اعتماد الإدارة نشرَ ملفّه. راجِع الإدارة لاعتماده، ثمّ يعمل الرابطُ نفسُه بلا تغيير.
              </Inset>
            )}
          </Panel>

          {/* ف-١: يُقال إنّ الإحالةَ أعلى، ولا يُكتب رقمُها هنا — مصدرُه
              «مستحقاتي» حيث يُعرض أجرُ الإحالة لكلّ شعبةٍ بعينها. ورقمٌ
              منسوخٌ في صفحتين يفترق عن أصله يوما، ويُقرأ وعدا لا يُوفى. */}
          <Panel as="section">
            <h2 className="flex items-center gap-2 text-sm font-black">
              <Wallet className="h-4 w-4 text-gold-ink" aria-hidden="true" /> ولمَ يعنيك أن يسجّلوا من رابطك
            </h2>
            <p className="mt-2 text-read leading-7 text-muted-foreground">
              أجرُك عن متعلّمٍ جاء عبر رابطك أعلى من أجرك عن متعلّمٍ سجّل عامّا — وهو مكتوبٌ لكلّ شعبةٍ بعينها في
              «مستحقاتي»، فانظره هناك بالرقم لا بالوعد.
            </p>
            <Button as={Link} to="/trainer/earnings" tone="secondary" size="sm" className="mt-3">
              افتح مستحقاتي
            </Button>
          </Panel>
        </>
      )}
    </PortalFrame>
  );
}

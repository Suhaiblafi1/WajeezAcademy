/* دعوتي — رابطُ المدرّب إلى كلّ ما يدرّسه (ب-٥ · ف-١).

   كان الرابطُ بطاقةً في «الرئيسية» بين طابور العمل وجلساتِه القادمة، فيراه
   مرّةً يومَ أُسندت إليه شعبتُه ثمّ لا يعود إليه. وقرارُ صاحب المنصّة (١٣
   سبتمبر ٢٠٢٦): تبويبٌ خاصٌّ به بعد «ما قيل عنّي» مباشرةً.

   والصفحةُ تُفتتح بسؤالٍ لا بشرح (ف-١): ما الذي يريد أن يوصي به من يتابعه؟
   ثمّ تعطيه الرابطَ وتقول له ما يُكسبه — وتحيل الرقمَ إلى «مستحقاتي» حيث
   يُعرض أجرُ الإحالة بعينه لكلّ شعبة، فلا يُخترع هنا رقمٌ ولا يُنسخ فيفترق
   عن مصدره.

   ─────────── وما كان مؤجَّلا صار مبنيّا ───────────

   كُتب هنا: «والقسمُ الذي يبني مسارا باسمه من دوراته موضعُه هذه الصفحةُ حين
   يصل القسمُ ن». وقد وصل القسمُ «ن» وبُني بناءً كاملا في «مساراتي» — بمعالجٍ
   يختار الدوراتِ والموسمَ ويُرسل للاعتماد.

   **فلا يُبنى هنا ثانيةً**: صفحتان تبنيان مسارا تفترقان يوما، والمسارُ عقدٌ
   على متعلّمٍ لا شاشةُ عرض. فهذه الصفحةُ **تعرض ما بناه هناك** وتقول له إن
   لم يبنِ شيئا بعدُ — والرابطُ يبلغه لأنّ صفحتَه العامّة صارت تعرض مساراتِه
   (ن-٨). */
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
/** رابطُ شعبةٍ بعينها — يُنشَر وحدَه لمن يدعو إلى دفعةٍ لا إلى كلّ ما يدرّب */
interface CohortLink {
  cohortId: string; title: string; termTitleAr: string | null; status: string
  registrationOpen: boolean; learners: number; code: string; url: string
}
/** ما يعرضه «مساراتي» — يُقرأ هنا ولا يُبنى */
interface MyPath { id: string; titleAr: string; status: string; courseCount?: number }
const REGISTERED_FORMS = { one: "متعلّمٌ واحد", two: "متعلّمان", few: "متعلّمين", many: "متعلّما" } as const;

export default function Referral() {
  const [referral, setReferral] = useState<MyReferral | null>(null);
  const [paths, setPaths] = useState<MyPath[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cohortLinks, setCohortLinks] = useState<CohortLink[] | null>(null);
  /* المنسوخُ يُعلَّم بمفتاحه لا برايةٍ واحدة: رايةٌ واحدةٌ لروابطَ كثيرةٍ
     تُضيء «نُسخ» تحت كلّ زرٍّ معا، فلا يدري أيَّها نسخ. */
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, url: string) => {
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    });
  };

  useEffect(() => {
    let alive = true;
    void apiGet<MyReferral>("/api/trainer/me/referral")
      .then((r) => { if (alive) setReferral(r); })
      .catch((e) => { if (alive) setError(permissionMessage(e, "تعذّر الوصول إلى الخادم")); });
    /* ومساراتُه: إخفاقُها لا يُعطّل الرابط — فالرابطُ هو البند، والمسارُ زيادة */
    void apiGet<MyPath[]>("/api/trainer/paths")
      .then((r) => { if (alive) setPaths(r); })
      .catch(() => { if (alive) setPaths([]); });
    /* وروابطُ شعبه: إخفاقُها لا يُعطّل الرابطَ العامّ — ذاك هو البند */
    void apiGet<CohortLink[]>("/api/trainer/me/referral-links")
      .then((r) => { if (alive) setCohortLinks(r); })
      .catch(() => { if (alive) setCohortLinks([]); });
    return () => { alive = false };
  }, []);

  return (
    <PortalFrame title="دعوتي">
      {error && <Inset as="p" tone="danger" className="mb-4 px-4 py-3 text-read leading-6 text-red-200">{error}</Inset>}

      {/* ف-١: تُفتتح بسؤالٍ عمّا يوصي به، لا بشرحِ آليّةِ الرابط */}
      <Panel as="section" className="mb-6">
        <h2 className="text-lg font-black">ما الذي توصي به من يتابعك؟</h2>
        <p className="mt-2 text-read leading-7 text-muted-foreground">
          لك صفحةٌ باسمك تعرض كلَّ شعبك المفتوحة — رابطٌ واحدٌ لها جميعا. ولكلّ شعبةٍ مفتوحةٍ رابطٌ منفصلٌ
          يقود إليها وحدَها، أدناه. انشر أيَّهما شئت حيث تكتب وحيث يسمعك الناس، فمن سجّل من أيٍّ منهما
          يصلك باسمك لا رقما: تراه بعلامة «عبر رابطك» عند اسمه في طلبتك، وبأجر الإحالة في «مستحقاتي».
        </p>
      </Panel>

      {/* ═══ ما أوصى به فعلا — تمامُ و-١ ═══

          السؤالُ في الأعلى يسأل «ما الذي توصي به؟»، وكان الجوابُ الوحيدُ
          «صفحتُك تعرض شعبَك». وهذا عرضٌ لا توصية: الشعبُ ما أسندته الإدارةُ
          إليه، والمسارُ ما اختاره هو ورتّبه وسمّاه.

          فيُعرض هنا ما بناه في «مساراتي»، ويُقال له صراحةً إن لم يبنِ شيئا. */}
      {paths !== null && (
        <Panel as="section" className="mb-6">
          <h2 className="text-lg font-black">مساراتُك التي يبلغها رابطُك</h2>
          {paths.filter((p) => p.status === "published").length === 0 ? (
            <>
              <p className="mt-2 text-read leading-7 text-muted-foreground">
                لم تنشر مسارا باسمك بعد. ورابطُك اليومَ يعرض شعبَك المفتوحةَ متفرّقةً —
                وهي ما أُسند إليك، لا ما اخترتَه أنت.
              </p>
              <Button as={Link} to="/trainer/paths" tone="secondary" size="sm" className="mt-3">
                ابنِ مسارا من دوراتك
              </Button>
            </>
          ) : (
            <>
              <p className="mt-2 text-read leading-7 text-muted-foreground">
                هذه تظهر لمن يفتح رابطَك، قبل شعبك المتفرّقة:
              </p>
              <ul className="mt-3 space-y-2">
                {paths.filter((p) => p.status === "published").map((p) => (
                  <Inset as="li" key={p.id} className="px-4 py-2.5">
                    <span className="font-bold">{p.titleAr}</span>
                  </Inset>
                ))}
              </ul>
              <Button as={Link} to="/trainer/paths" tone="ghost" size="sm" className="mt-3">
                أدِر مساراتي
              </Button>
            </>
          )}
        </Panel>
      )}

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
              <Button tone="secondary" onClick={() => copy("wide", referral.url)}>
                {copied === "wide" ? "نُسخ" : "انسخ الرابط"}
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

          {/* ═══ رابطٌ لكلّ شعبةٍ مفتوحة — نُقل إلى هنا (١٥ سبتمبر ٢٠٢٦) ═══

              كان داخلَ الشعبة في «مركز التواصل»: يفتح المدرّبُ شعبةً فيجد
              رابطَها، ولا يجد روابطَ شعبه الأخرى إلّا بفتح كلِّ واحدةٍ على
              حدة. ومن أراد أن يدعو إلى ثلاثِ دفعاتٍ فتح ثلاثَ شاشات.

              وقرارُ صاحب المنصّة: تُجمع في «دعوتي» خارجَ الشعب، إلى جانب
              رابط ملفّه الكامل — «إمّا أن يحصل على رابطٍ لملفّه الكامل كما
              هو موجودٌ حاليّا، أو أن يقوم بدعوة جمهوره لكلّ شعبةٍ مفتوحةٍ
              برابطٍ منفصل».

              والمفتوحةُ وحدَها: رابطٌ إلى مسودّةٍ أو إلى شعبةٍ انتهت يُحرج
              ناشرَه ويردّ من فتحه إلى صفحةٍ لا تقبل تسجيلا. */}
          {cohortLinks !== null && (
            <Panel as="section" className="mb-6">
              <p className="flex items-center gap-2 text-sm font-black">
                <Link2 className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> رابطٌ لكلّ شعبة
              </p>
              {cohortLinks.length === 0 ? (
                <p className="mt-2 text-read leading-7 text-muted-foreground">
                  لا شعبةَ مفتوحةً لك الآن. وحين تُفتح لك شعبةٌ يظهر رابطُها هنا — ورابطُك العامُّ أعلاه
                  يبلغها من يومها بلا أن تنشر شيئا جديدا.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-read leading-7 text-muted-foreground">
                    كلُّ رابطٍ يقود إلى شعبته وحدَها — انشره لمن تدعوه إلى هذه الدفعة بعينها. وحسابُ من سجّل
                    منه حسابُ رابطك العامّ نفسُه: يُحسب لك بأجر الإحالة.
                  </p>
                  <ul className="mt-3 space-y-3">
                    {cohortLinks.map((c) => (
                      <Inset as="li" key={c.cohortId} className="px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-read font-bold text-foreground">{c.title}</span>
                          <span className="text-read text-muted-foreground">
                            {c.termTitleAr ? `${c.termTitleAr} · ` : ""}
                            {c.learners > 0 ? countAr(c.learners, REGISTERED_FORMS) : "لم يسجّل أحدٌ بعد"}
                          </span>
                        </div>
                        {/* وحالةُ التسجيل تُقال: رابطٌ إلى شعبةٍ أُغلق تسجيلُها
                            يعمل ولا يُسجَّل منه أحد، فيُظنُّ الرابطُ عاطلا. */}
                        {!c.registrationOpen && (
                          <p className="mt-1 text-read leading-6 text-gold-ink">
                            تسجيلُ هذه الشعبة مغلقٌ الآن — الرابطُ يعمل، ولا يُسجَّل منه حتّى تفتحه الإدارة.
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            readOnly dir="ltr" value={c.url} aria-label={`رابط دعوتي إلى ${c.title}`}
                            onFocus={(e) => e.currentTarget.select()}
                            className={`${staffControlCls} min-w-0 flex-1 text-left`}
                          />
                          <Button tone="secondary" size="sm" onClick={() => copy(c.cohortId, c.url)}>
                            {copied === c.cohortId ? "نُسخ" : "انسخ الرابط"}
                          </Button>
                        </div>
                      </Inset>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          )}

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

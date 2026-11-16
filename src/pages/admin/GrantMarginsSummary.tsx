/* «الهامش في كل المنح» — لوحٌ واحدٌ في رأس كلّ صفحة منحة (١٦ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «وامنحني معرفة الهامش لكل نوع من المنح». فلكلّ منحةٍ صفٌّ بنسبتها وعمولتها، وتحت حملتَي المؤثّرين صفٌّ
   لكلّ مؤثّرٍ نشطٍ بخصمه وعمولته هو — ما يقع حقّا على من جاء بكوده. والخاسرةُ بلون التنبيه، والأرقامُ من اليسار.
   و«فحص الهامش» في صفحة كلّ منحةٍ تحته يسمّي الشعبَ كما كان. والعلّةُ في `src/application/commerce/grant-margins.ts`. */

import { useEffect, useState } from "react";
import { apiGet } from "@/services/api";
import { fmtMoney } from "@/application/text/format-ar";
import { GRANT_MARGINS_LINE_AR, GRANT_MARGINS_TITLE_AR, GRANT_MARGINS_TOP_AR, type MarginStats } from "@/application/commerce/grant-margins";
import { Card } from "@/components/ui/Surface";
import Chip from "@/components/ui/Chip";

interface InfluencerRow extends MarginStats { id: string; nameAr: string; code: string; percentOff: number; ownPercent: boolean; commissionPercent: number }
interface CampaignRow extends MarginStats {
  slug: string; nameAr: string; group: "campaign" | "partner"; active: boolean; percentOff: number; commissionPercent: number;
  /** حصّةُ الشريك ممّا يُدفع — تُطرح من الهامش (١٦ نوفمبر ٢٠٢٦) */
  sharePercent?: number;
  topCommission: boolean; influencers?: InfluencerRow[];
}
interface Summary { currency: string; campaigns: CampaignRow[] }

/** خلايا الأرقام — واحدةٌ لصفّ المنحة وصفّ المؤثّر */
function StatCells({ s, currency }: { s: MarginStats; currency: string }) {
  const money = (n: number | null) => (n === null ? "—" : fmtMoney(n, currency));
  return (
    <>
      <td className="p-2"><bdi dir="ltr">{s.cohorts}</bdi></td>
      <td className="p-2">{s.losing > 0 ? <Chip tone="warn"><bdi dir="ltr">{s.losing}</bdi></Chip> : <bdi dir="ltr">0</bdi>}</td>
      <td className="p-2"><bdi dir="ltr">{s.noCost}</bdi></td>
      <td className="p-2"><bdi dir="ltr">{money(s.avg)}</bdi></td>
      <td className={`p-2 font-bold ${s.min !== null && s.min < 0 ? "text-danger-ink" : ""}`}><bdi dir="ltr">{money(s.min)}</bdi></td>
    </>
  );
}

export default function GrantMarginsSummary() {
  const [data, setData] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    apiGet<Summary>("/api/admin/grants/margins-summary").then(setData).catch(() => setFailed(true));
  }, []);

  return (
    <section data-testid="grant-margins-summary">
      <h2 className="text-lg font-black">{GRANT_MARGINS_TITLE_AR}</h2>
      <p className="mt-1 text-read text-muted-foreground">{GRANT_MARGINS_LINE_AR} {GRANT_MARGINS_TOP_AR}</p>
      {failed ? (
        <Card as="p" className="mt-3 text-read text-muted-foreground">تعذر حساب الهامش الآن.</Card>
      ) : !data ? null : (
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full text-read">
            <thead>
              <tr className="text-muted-foreground">
                <th className="p-2 text-start">المنحة</th>
                <th className="p-2 text-start">الحال</th>
                <th className="p-2 text-start">الخصم</th>
                <th className="p-2 text-start">العمولة أو حصة الشريك</th>
                <th className="p-2 text-start">الشعب</th>
                <th className="p-2 text-start">تخسر</th>
                <th className="p-2 text-start">بلا أجر مقعد</th>
                <th className="p-2 text-start">متوسط الهامش</th>
                <th className="p-2 text-start">أدنى هامش</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c) => (
                <CampaignRows key={c.slug} c={c} currency={data.currency} />
              ))}
            </tbody>
          </table>
          {data.campaigns.some((c) => c.otherCurrency > 0) && (
            <p className="mt-2 text-read text-muted-foreground">شعب بعملة غير {data.currency} تعد في الخاسرة، ولا تدخل المتوسط والأدنى.</p>
          )}
        </Card>
      )}
    </section>
  );
}

function CampaignRows({ c, currency }: { c: CampaignRow; currency: string }) {
  return (
    <>
      <tr className="border-t border-border">
        <td className="p-2 font-bold">{c.group === "partner" ? `شريك: ${c.nameAr}` : c.nameAr}</td>
        <td className="p-2">{c.active ? "مشغلة" : "موقوفة"}</td>
        <td className="p-2"><bdi dir="ltr">{c.percentOff}%</bdi></td>
        <td className="p-2">
          {c.group === "partner"
            ? (c.sharePercent ? <>حصته <bdi dir="ltr">{c.sharePercent}%</bdi> مما يدفع</> : "بلا حصة")
            : <><bdi dir="ltr">{c.commissionPercent}%</bdi>{c.topCommission ? " (الأعلى)" : ""}</>}
        </td>
        <StatCells s={c} currency={currency} />
      </tr>
      {(c.influencers ?? []).map((x) => (
        <tr key={x.id} className="text-muted-foreground">
          <td className="p-2 ps-6">{x.nameAr} <bdi dir="ltr">{x.code}</bdi></td>
          <td className="p-2" />
          <td className="p-2"><bdi dir="ltr">{x.percentOff}%</bdi>{x.ownPercent ? " (خصمه)" : ""}</td>
          <td className="p-2"><bdi dir="ltr">{x.commissionPercent}%</bdi></td>
          <StatCells s={x} currency={currency} />
        </tr>
      ))}
      {c.influencers && c.influencers.length === 0 && (
        <tr className="text-muted-foreground"><td className="p-2 ps-6" colSpan={9}>لا مؤثر نشط.</td></tr>
      )}
    </>
  );
}

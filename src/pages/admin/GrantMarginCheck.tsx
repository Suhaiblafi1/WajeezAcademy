/* «فحص الهامش» — وفوقه اختيارُ المنحة التي يُرى جدولُها (١٦ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة، وهو في صفحة بلاك فرايدي: «أريد فوق هذا الجدول أن أختار المنحةَ التي أرى جدولَها، خاصّةً للمؤثّرين
   والشركاء لأنّهم كثيرون.. ولا حاجةَ للجدول الذي وضعتَه في رأس الصفحة». فالاختيارُ: المنحُ، ثمّ كلُّ مؤثّرٍ نشطٍ بخصمه
   وعمولته، ثمّ كلُّ شريكٍ بنسبته وحصّته. ويبدأ بمنحة الصفحة، وبالنسبة التي في خانتها — فيرى أثرَها قبل أن يحفظها.
   وما سواها بنسبته المحفوظة. والعلّةُ في `server/services/grant-margins.service.ts`. */

import { useEffect, useState } from "react";
import { apiGet } from "@/services/api";
import { fmtMoney } from "@/application/text/format-ar";
import { staffControlCls } from "@/components/FormKit";
import { Card } from "@/components/ui/Surface";

interface MarginOption {
  key: string; group: "campaign" | "influencer" | "partner"; nameAr: string; slug: string; active: boolean;
  percentOff: number; commissionPercent: number; sharePercent: number; code?: string;
}
interface MarginRow {
  cohortId: string; titleAr: string; currency: string;
  listPrice: number; price: number; ruleType: string | null; ruleRate: number | null;
  seatCost: number | null; commission: number; partnerShare: number; margin: number | null;
}
interface Margins { option: MarginOption; percentOff: number; commissionPercent: number; sharePercent: number; rows: MarginRow[] }

const RULE_AR: Record<string, string> = {
  per_seat: "أجر المقعد",
  revenue_share: "نسبة من سعر الدورة",
  fixed_per_cohort: "مبلغ ثابت للشعبة",
};

const GROUPS: { group: MarginOption["group"]; labelAr: string }[] = [
  { group: "campaign", labelAr: "المنح" },
  { group: "influencer", labelAr: "المؤثرون" },
  { group: "partner", labelAr: "الشركاء" },
];

/** اسمُ الخيار في القائمة — بنسبته، وعمولةُ المؤثّر وحصّةُ الشريك إن كانت، والموقوفُ يقال */
function optionLabel(o: MarginOption): string {
  const extra = o.commissionPercent > 0 ? ` · عمولة ${o.commissionPercent}%` : o.sharePercent > 0 ? ` · حصة ${o.sharePercent}%` : "";
  return `${o.nameAr}${o.code ? ` (${o.code})` : ""} — ${o.percentOff}%${extra}${o.active ? "" : " · موقوفة"}`;
}

export default function GrantMarginCheck({ pageKey, draftPercent }: {
  /** منحةُ الصفحة — بها يبدأ الاختيار. وفي صفحة الشركاء لا منحةَ لها: يبدأ بأوّل شريك */
  pageKey: string | null;
  /** النسبةُ في خانة الصفحة قبل حفظها — تُجرَّب على منحتها وحدَها. و`null` خانةٌ بغير نسبة، وبلا قيمةٍ لا خانة */
  draftPercent?: number | null;
}) {
  const [options, setOptions] = useState<MarginOption[] | null>(null);
  const [key, setKey] = useState(pageKey ?? "");
  const [data, setData] = useState<Margins | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiGet<{ options: MarginOption[] }>("/api/admin/grants/margin-options")
      .then((r) => {
        setOptions(r.options);
        if (!pageKey) setKey((k) => k || (r.options.find((o) => o.group === "partner")?.key ?? r.options[0]?.key ?? ""));
      })
      .catch(() => setFailed(true));
  }, [pageKey]);

  const ownPage = key === pageKey;
  const tryPct = ownPage ? draftPercent ?? null : null;
  const noDraft = ownPage && draftPercent === null;
  useEffect(() => {
    if (!key || noDraft) return;
    const t = setTimeout(() => {
      const q = new URLSearchParams({ key });
      if (tryPct !== null) q.set("percentOff", String(tryPct));
      apiGet<Margins>(`/api/admin/grants/margins?${q}`)
        .then((r) => { setData(r); setFailed(false); })
        .catch(() => { setData(null); setFailed(true); });
    }, 300);
    return () => clearTimeout(t);
  }, [key, noDraft, tryPct]);

  /* وخانةٌ بغير نسبةٍ لا جدولَ لها — يُشتقّ هنا لا يُمحى في الأثر */
  const shown = !key || noDraft ? null : data;
  const rows = shown?.rows ?? null;
  const commission = (shown?.commissionPercent ?? 0) > 0;
  const share = (shown?.sharePercent ?? 0) > 0;
  const losing = (rows ?? []).filter((r) => r.margin !== null && r.margin < 0).length;

  return (
    <>
      <h2 className="mt-6 text-lg font-black">فحص الهامش{shown ? ` بنسبة ${shown.percentOff}%` : ""}</h2>
      <label className="mt-2 block max-w-xl text-read font-bold">
        المنحة
        <select value={key} onChange={(e) => setKey(e.target.value)} className={`mt-1 ${staffControlCls}`} disabled={!options}>
          {!options && <option value={key}>…</option>}
          {GROUPS.map(({ group, labelAr }) => {
            const list = (options ?? []).filter((o) => o.group === group);
            return list.length === 0 ? null : (
              <optgroup key={group} label={labelAr}>
                {list.map((o) => <option key={o.key} value={o.key}>{optionLabel(o)}</option>)}
              </optgroup>
            );
          })}
        </select>
      </label>
      <p className="mt-2 text-read text-muted-foreground">
        سعر كل شعبة مفتوحة بعد المنحة، وما يأخذه المدرب عن كل مقعد
        {commission ? `، وعمولة المؤثر ${shown!.commissionPercent}% من السعر${shown!.option.group === "campaign" ? " (أعلى عمولة لمؤثر نشط)" : ""}` : ""}
        {share ? `، وحصة الشريك ${shown!.sharePercent}% مما يدفعه الطالب` : ""}. الخصم كله من حصة الأكاديمية.
        {losing > 0 ? ` ${losing} شعبة تخسر بهذه النسبة.` : ""}
      </p>
      {failed ? (
        <Card as="p" className="mt-3 text-read text-muted-foreground">تعذر حساب الهامش الآن.</Card>
      ) : rows === null ? (
        <Card as="p" className="mt-3 text-read text-muted-foreground">{noDraft ? "اكتب نسبة من 1 إلى 100." : "…"}</Card>
      ) : rows.length === 0 ? (
        <Card as="p" className="mt-3 text-read text-muted-foreground">لا شعبة مفتوحة بسعر بعد.</Card>
      ) : (
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full text-read">
            <thead>
              <tr className="text-muted-foreground">
                <th className="p-2 text-start">الشعبة</th>
                <th className="p-2 text-start">السعر</th>
                <th className="p-2 text-start">بعد المنحة</th>
                <th className="p-2 text-start">للمدرب عن المقعد</th>
                {commission && <th className="p-2 text-start">للمؤثر</th>}
                {share && <th className="p-2 text-start">للشريك</th>}
                <th className="p-2 text-start">يبقى للأكاديمية</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cohortId} className="border-t border-border">
                  <td className="p-2 font-bold">{r.titleAr}</td>
                  <td className="p-2" dir="ltr">{fmtMoney(r.listPrice, r.currency)}</td>
                  <td className="p-2" dir="ltr">{fmtMoney(r.price, r.currency)}</td>
                  <td className="p-2">
                    {r.seatCost !== null
                      ? <span dir="ltr">{fmtMoney(r.seatCost, r.currency)}</span>
                      : r.ruleType === "fixed_per_cohort" && r.ruleRate !== null
                        ? `${RULE_AR.fixed_per_cohort}: ${fmtMoney(r.ruleRate, r.currency)}`
                        : "لا قاعدة أتعاب"}
                    {r.ruleType === "revenue_share" && r.ruleRate !== null ? ` (${r.ruleRate}% ${RULE_AR.revenue_share})` : ""}
                  </td>
                  {commission && <td className="p-2" dir="ltr">{fmtMoney(r.commission, r.currency)}</td>}
                  {share && <td className="p-2" dir="ltr">{fmtMoney(r.partnerShare, r.currency)}</td>}
                  <td className={`p-2 font-bold ${r.margin !== null && r.margin < 0 ? "text-danger-ink" : ""}`} dir="ltr">
                    {r.margin === null ? "—" : fmtMoney(r.margin, r.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

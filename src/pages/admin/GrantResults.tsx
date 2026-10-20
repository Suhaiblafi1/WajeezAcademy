/* نتائجُ «منحة أعضاء وجيز» — في شاشة المنحة (٢٠ أكتوبر ٢٠٢٦).

   ما يسأله صاحبُ المنصّة بعد كلّ دفعة: كم عبّأ النموذج، وكم أخذ كودا، وكم اشترى، وبكم — وأيُّ قناةٍ
   ودفعةٍ جاءت بهم، ومن أيّ مجالات العمل. والشراءُ يُنسب إلى قناة صاحب الكود، فالمُهدى يُحسب لمن أوصله.
   والحسابُ في `grantResults` (`server/services/grant-landing.service.ts`). */

import { useEffect, useState } from "react";
import { apiGet } from "@/services/api";
import { fmtMoney } from "@/application/text/format-ar";
import { Card } from "@/components/ui/Surface";

interface Row { channel: string | null; wave: string | null; leads: number; codes: number; bought: number; revenue: number }
interface Results {
  totals: { leads: number; codes: number; bought: number; revenue: number; advisorCases: number };
  rows: Row[];
  fields: { workField: string | null; leads: number }[];
}

const CHANNEL_AR: Record<string, string> = { whatsapp: "واتساب", email: "البريد" };
const channelAr = (c: string | null) => (c ? CHANNEL_AR[c] ?? c : "بلا وسم");

export default function GrantResults() {
  const [r, setR] = useState<Results | null>(null);
  useEffect(() => { apiGet<Results>("/api/admin/member-grant/results").then(setR).catch(() => setR(null)); }, []);
  if (!r) return null;
  const t = r.totals;
  return (
    <>
      <h2 className="mt-6 text-lg font-black">نتائج الحملة</h2>
      <Card className="mt-3">
        <p className="text-read font-bold">
          عبأ النموذج {t.leads} · أخذ كودا {t.codes} · اشترى {t.bought} · <span dir="ltr">{fmtMoney(t.revenue, "USD")}</span> · طلب مستشارا {t.advisorCases}
        </p>
      </Card>
      {r.rows.length > 0 && (
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full text-read">
            <thead>
              <tr className="text-muted-foreground">
                <th className="p-2 text-start">القناة</th>
                <th className="p-2 text-start">الدفعة</th>
                <th className="p-2 text-start">عبأ النموذج</th>
                <th className="p-2 text-start">أخذ كودا</th>
                <th className="p-2 text-start">اشترى</th>
                <th className="p-2 text-start">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((x) => (
                <tr key={`${x.channel}|${x.wave}`} className="border-t border-border">
                  <td className="p-2 font-bold">{channelAr(x.channel)}</td>
                  <td className="p-2">{x.wave ?? "—"}</td>
                  <td className="p-2">{x.leads}</td>
                  <td className="p-2">{x.codes}</td>
                  <td className="p-2">{x.bought}{x.leads > 0 ? ` (${Math.round((x.bought / x.leads) * 100)}%)` : ""}</td>
                  <td className="p-2" dir="ltr">{fmtMoney(x.revenue, "USD")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {r.fields.length > 0 && (
        <Card className="mt-3">
          <p className="font-bold">مجالات العمل</p>
          <p className="mt-1 text-read text-muted-foreground">
            {r.fields.map((f) => `${f.workField ?? "بلا مجال"} ${f.leads}`).join(" · ")}
          </p>
        </Card>
      )}
    </>
  );
}

/* كشفُ حصّة الشريك — في لوحة ممثّله (`/partner`) وفي «الشركاء» للمدير سواء (١٦ نوفمبر ٢٠٢٦).

   قال صاحبُ المنصّة: لوحةٌ «audited» يرى فيها الشريكُ من سجّل ومن دفع وكم له قبل أجور المدرّبين. فالأرقامُ هنا كما يحسبها
   الخادم (`partner-revenue.service.ts`)، ولكلّ طلبٍ صفُّه: ما دُفع، وما رُدّ، والنسبةُ، والحصّة — يُطابَق صفّا صفّا، ويُنزَّل
   ملفّا. ومن سجّل باسمه الأوّل وبريده مختصرا، بلا بيانات دفع. */

import { Download } from "lucide-react";
import { Card } from "@/components/ui/Surface";
import { fmtDate, fmtMoney } from "@/application/text/format-ar";
import { partnerShareLineAr } from "@/application/commerce/partner-grant";
import { apiDownload, ApiError } from "@/services/api";
import { toastError } from "@/components/Toast";

export interface PartnerStatement {
  nameAr: string;
  sharePercent: number | null;
  percentOff: number;
  link: string;
  currency: string;
  totals: { signups: number; codes: number; buyers: number; sales: number; earned: number; paidOut: number; balance: number };
  signups: { nameAr: string; email: string; at: string; hasCode: boolean }[];
  rows: { orderId: string; at: string; buyerAr: string; courses: number; paid: number; refunded: number; percent: number; share: number; stateAr: string; currency: string }[];
  payouts: { id: string; amount: number; currency: string; noteAr: string | null; paidAt: string }[];
}

function Stat({ n, label }: { n: string | number; label: string }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-black tabular-nums text-teal-light-ink">{n}</p>
      <p className="mt-1 text-read text-muted-foreground">{label}</p>
    </Card>
  );
}

export default function PartnerRevenueView({ st, csvHref }: { st: PartnerStatement; csvHref: string }) {
  const m = (v: number) => fmtMoney(v, st.currency);
  return (
    <div className="grid gap-6">
      <p className="text-read leading-7 text-muted-foreground">
        حصتكم: {partnerShareLineAr(st.sharePercent)}. والمنحة {st.percentOff}% للمستفيد.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat n={st.totals.signups} label="أكدوا بريدهم" />
        <Stat n={st.totals.buyers} label="اشتروا" />
        <Stat n={m(st.totals.sales)} label="ما دفعوه" />
        <Stat n={m(st.totals.earned)} label="حصتكم" />
        <Stat n={m(st.totals.paidOut)} label="صرف لكم" />
        <Stat n={m(st.totals.balance)} label="الرصيد" />
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black">كل طلب وحصتكم منه</h2>
          <button type="button" className="inline-flex items-center gap-1.5 text-read font-bold text-teal-light-ink underline"
            onClick={() => { apiDownload(csvHref, "partner-revenue.csv").catch((e) => toastError(e instanceof ApiError ? e.message : "تعذر التنزيل")); }}>
            <Download className="h-4 w-4" aria-hidden="true" /> نزل الكشف
          </button>
        </div>
        {st.rows.length === 0 ? (
          <p className="mt-2 text-read text-muted-foreground">لا طلبات مدفوعة بعد.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-read">
              <thead>
                <tr className="border-b border-white/10 text-start text-muted-foreground">
                  <th className="p-2 text-start">التاريخ</th><th className="p-2 text-start">المستفيد</th><th className="p-2 text-start">الدورات</th>
                  <th className="p-2 text-start">المدفوع</th><th className="p-2 text-start">المردود</th><th className="p-2 text-start">النسبة</th>
                  <th className="p-2 text-start">حصتكم</th><th className="p-2 text-start">الحال</th>
                </tr>
              </thead>
              <tbody>
                {st.rows.map((r) => (
                  <tr key={r.orderId} className="border-b border-white/5">
                    <td className="p-2">{fmtDate(r.at)}</td><td className="p-2">{r.buyerAr}</td><td className="p-2 tabular-nums">{r.courses}</td>
                    <td className="p-2 tabular-nums">{fmtMoney(r.paid, r.currency)}</td>
                    <td className="p-2 tabular-nums">{r.refunded > 0 ? fmtMoney(r.refunded, r.currency) : "—"}</td>
                    <td className="p-2 tabular-nums">{r.percent}%</td>
                    <td className="p-2 font-bold tabular-nums">{fmtMoney(r.share, r.currency)}</td>
                    <td className="p-2 text-muted-foreground">{r.stateAr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-black">ما صرف لكم</h2>
        {st.payouts.length === 0 ? (
          <p className="mt-2 text-read text-muted-foreground">لم يصرف شيء بعد.</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-read">
            {st.payouts.map((p) => (
              <li key={p.id}>{fmtDate(p.paidAt)} — <b className="tabular-nums">{fmtMoney(p.amount, p.currency)}</b>{p.noteAr ? ` · ${p.noteAr}` : ""}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-black">من أكد بريده ({st.signups.length})</h2>
        {st.signups.length === 0 ? (
          <p className="mt-2 text-read text-muted-foreground">لم يؤكد أحد بريده بعد. شاركوا الرابط: <span dir="ltr">{st.link}</span></p>
        ) : (
          <ul className="mt-2 grid gap-1 text-read">
            {st.signups.map((s, i) => (
              <li key={i}>{fmtDate(s.at)} — {s.nameAr} · <span dir="ltr">{s.email}</span>{s.hasCode ? "" : " · بلا كود"}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* حسابُ المؤثّر — كودُه ورابطُه، ومن جاء به، وعمولتُه عن كلٍّ منهم (٢٦ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «كيف يدخل لحساب مؤثّرٍ يرى فيه مستحقّاته لكلّ شخصٍ استخدم رابط المنحة الخاصّ به». فهنا شاشةٌ
   واحدة: الكودُ والرابطُ يُنسخان، ثمّ الأرقام (من سجّل، من اشترى، كم له، كم دُفع، كم بقي)، ثمّ كلُّ طلبٍ بعمولته،
   ثمّ ما دُفع له. والمشتري باسمه الأوّل وحدَه. والعلّةُ في `server/services/influencer.service.ts`. */

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Copy, Loader2, Megaphone, ServerOff, Share2 } from "lucide-react";
import { apiGet, ApiError } from "@/services/api";
import { useRealSession } from "@/services/session";
import { toast } from "@/components/Toast";
import ThemeToggle from "@/components/ThemeToggle";
import StaffAccountMenu from "@/components/StaffAccountMenu";
import { Card, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { fmtDate, fmtMoney } from "@/application/text/format-ar";
import { waShare } from "@/application/site/whatsapp";

interface Row { orderId: string; at: string; buyerAr: string; courses: number; listTotal: number; percent: number; commission: number; stateAr: string; refunded: boolean }
interface Me {
  nameAr: string; code: string; active: boolean; commissionPercent: number; link: string; currency: string;
  grant: { nameAr: string; open: boolean; percentOff: number; closesAt: string | null };
  totals: { signups: number; codes: number; buyers: number; sales: number; earned: number; paid: number; balance: number };
  rows: Row[];
  payouts: { id: string; amount: number; currency: string; noteAr: string | null; paidAt: string }[];
}

export default function InfluencerHome() {
  const { user } = useRealSession();
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Me>("/api/influencer/me").then(setMe).catch((e) => setFailed(e instanceof ApiError ? e.message : "تعذر تحميل حسابك"));
  }, []);

  const copy = async (text: string, doneAr: string) => {
    try { await navigator.clipboard.writeText(text); toast(doneAr); } catch { /* المتصفّحُ منعه — النصُّ ظاهرٌ يُنسخ باليد */ }
  };
  const money = (n: number) => fmtMoney(n, me?.currency ?? "USD");

  return (
    <div dir="rtl" className="min-h-screen bg-paper text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-2">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 shrink-0 object-contain" />
            <span className="font-black">وجيز — حساب المؤثر</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <StaffAccountMenu user={user} />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-5 py-8">
        {failed ? (
          <Panel className="grid place-items-center py-16 text-center">
            <ServerOff className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 max-w-md text-read leading-7 text-muted-foreground">{failed}</p>
          </Panel>
        ) : !me ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>
        ) : (
          <>
            <h1 className="text-2xl font-black">مرحبا {me.nameAr}</h1>
            <p className="mt-1 text-read text-muted-foreground">
              {me.grant.nameAr}: متابعوك يحصلون على {me.grant.percentOff}% من سعر الدورات، ولك {me.commissionPercent}% من سعر الدورات عن كل من يشتري بكودك.
            </p>
            {!me.grant.open && <p className="mt-2"><Chip tone="warn">المنحة غير مفتوحة الآن</Chip></p>}
            {!me.active && <p className="mt-2"><Chip tone="warn">كودك موقوف الآن. تواصل مع الأكاديمية</Chip></p>}

            <Card tone="accent" className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-1.5 text-read text-muted-foreground"><Megaphone className="h-4 w-4" aria-hidden="true" /> كودك</p>
                <p className="mt-1 flex items-center gap-2 text-2xl font-black" dir="ltr">
                  {me.code}
                  <button type="button" aria-label="انسخ الكود" onClick={() => void copy(me.code, "نسخ الكود")} className="cursor-pointer"><Copy className="h-5 w-5" /></button>
                </p>
                <p className="mt-0.5 text-read text-muted-foreground">يكتبه متابعك في نموذج المنحة.</p>
              </div>
              <div className="min-w-0">
                <p className="text-read text-muted-foreground">رابطك</p>
                <p className="mt-1 truncate font-bold" dir="ltr">{me.link}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" icon={Copy} onClick={() => void copy(me.link, "نسخ الرابط")}>انسخ الرابط</Button>
                  <Button size="sm" as="a" href={waShare(`${me.grant.nameAr}: دورات مباشرة على Zoom بخصم ${me.grant.percentOff}%.\n${me.link}`)} target="_blank" rel="noreferrer" icon={Share2}>واتساب</Button>
                </div>
              </div>
            </Card>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: "سجلوا بكودك", value: String(me.totals.signups) },
                { label: "اشتروا", value: String(me.totals.buyers) },
                { label: "عمولتك", value: money(me.totals.earned) },
                { label: "دفعنا لك", value: money(me.totals.paid) },
                { label: "لك الآن", value: money(me.totals.balance) },
              ].map((x) => (
                <Card key={x.label} className="text-center">
                  <p className="text-read text-muted-foreground">{x.label}</p>
                  <p className="mt-1 text-xl font-black" dir="ltr">{x.value}</p>
                </Card>
              ))}
            </div>

            <h2 className="mt-8 text-lg font-black">من اشترى بكودك</h2>
            {me.rows.length === 0 ? (
              <Card as="p" className="mt-3 text-read text-muted-foreground">لم يشتر أحد بكودك بعد. انشر رابطك ليصل لمتابعيك.</Card>
            ) : (
              <Card className="mt-3 overflow-x-auto">
                <table className="w-full text-read">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="p-2 text-start">التاريخ</th>
                      <th className="p-2 text-start">المتعلم</th>
                      <th className="p-2 text-start">الدورات</th>
                      <th className="p-2 text-start">سعر الدورات</th>
                      <th className="p-2 text-start">عمولتك</th>
                      <th className="p-2 text-start">الحال</th>
                    </tr>
                  </thead>
                  <tbody>
                    {me.rows.map((r) => (
                      <tr key={r.orderId} className="border-t border-border">
                        <td className="p-2">{fmtDate(new Date(r.at))}</td>
                        <td className="p-2 font-bold">{r.buyerAr}</td>
                        <td className="p-2">{r.courses}</td>
                        <td className="p-2" dir="ltr">{money(r.listTotal)}</td>
                        <td className="p-2 font-bold" dir="ltr">{money(r.commission)}</td>
                        <td className="p-2">{r.stateAr}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
            <p className="mt-2 text-read text-muted-foreground">العمولة {me.commissionPercent}% من سعر الدورات قبل الخصم. وإن رد المبلغ لمتعلم نقصت عمولته بقدر ما رد.</p>

            <h2 className="mt-8 text-lg font-black">ما دفعناه لك</h2>
            {me.payouts.length === 0 ? (
              <Card as="p" className="mt-3 text-read text-muted-foreground">لا دفعات بعد.</Card>
            ) : (
              <Card className="mt-3 space-y-2">
                {me.payouts.map((p) => (
                  <p key={p.id} className="flex flex-wrap justify-between gap-2 text-read">
                    <span>{fmtDate(new Date(p.paidAt))}{p.noteAr ? ` · ${p.noteAr}` : ""}</span>
                    <bdi dir="ltr" className="font-bold">{fmtMoney(p.amount, p.currency)}</bdi>
                  </p>
                ))}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

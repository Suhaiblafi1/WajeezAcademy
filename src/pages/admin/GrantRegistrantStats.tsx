/* إحصاءاتُ من عبّأ نموذج المنحة — فوق القائمة، وبتصفيتها (٣١ أكتوبر ٢٠٢٦).

   طلبُ صاحب المنصّة: «أحتاج full statistics». فالأرقامُ الكبرى في صفّ، ثمّ لكلّ سؤالٍ قائمةٌ بأشرطة: من أين جاؤوا ومن
   اشترى من كلّ مصدر، ومتى عبّؤوا باليوم والساعة، ومجالاتُهم ومستوياتُهم وما يريدون والدوراتُ التي اختاروها، وما وصلهم من
   رسائل. والحسبةُ في `registrantStats` (`src/application/commerce/grant-registrants.ts`)، وهي نفسُها في ورقة Excel. */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { conversionAr, funnelAr, type Count, type GrantFunnel, type RegistrantStats } from "@/application/commerce/grant-registrants";
import { fmtDate } from "@/application/text/format-ar";
import { Card, Inset } from "@/components/ui/Surface";

/** «28/10» من «2026-10-28» — بلا علامات اتّجاه، فالمحورُ يساريّ */
const dayLabel = (day: string) => `${Number(day.slice(8, 10))}/${Number(day.slice(5, 7))}`

function Tile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <Inset className="p-3">
      <p className="text-read text-muted-foreground">{label}</p>
      <p className="text-xl font-black">{value}</p>
      {note && <p className="text-read text-muted-foreground">{note}</p>}
    </Inset>
  );
}

/** قائمةٌ بأشرطة — العددُ والشراءُ منه لكلّ بند */
function Bars({ title, items, max = 8, buy = true }: { title: string; items: Count[]; max?: number; buy?: boolean }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const top = Math.max(...items.map((c) => c.n));
  const shown = all ? items : items.slice(0, max);
  return (
    <div>
      <p className="font-bold">{title}</p>
      <ul className="mt-2 grid gap-1.5">
        {shown.map((c) => (
          <li key={c.key} className="text-read">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate">{c.labelAr}</span>
              <span className="shrink-0 text-muted-foreground">{buy ? conversionAr(c) : c.n}</span>
            </div>
            <div className="mt-0.5 h-1.5 rounded-full bg-border">
              <div className="h-1.5 rounded-full bg-teal" style={{ width: `${Math.max(4, (c.n / top) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {items.length > max && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 text-fine font-bold text-teal-light-ink">
          {all ? "أقل" : `الكل (${items.length})`}
        </button>
      )}
    </div>
  );
}

/* ─────────── من فتح الرابط ← عبّأ ← اشترى — لكلّ الزوار لا للتصفية: من لم يعبّئ لا حالَ له ولا مجال (`grant-visit.service.ts`) ─────────── */
function Funnel({ f }: { f: GrantFunnel }) {
  if (!f.since || f.visitors === 0) {
    return <p className="text-read text-muted-foreground">من فتح الرابط ولم يعبئ يعد من الآن، ويظهر هنا بعد أول زيارة.</p>;
  }
  const steps = [
    { label: "فتح الرابط", n: f.visitors },
    { label: "عبأ النموذج", n: f.filled },
    { label: "اشترى", n: f.bought },
  ];
  return (
    <div>
      <p className="font-bold">من فتح الرابط — منذ {fmtDate(f.since)}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {steps.map((x, i) => (
          <Tile key={x.label} label={x.label} value={x.n} note={i === 0 ? "كل الزوار" : `${f.visitors > 0 ? Math.round((x.n / f.visitors) * 100) : 0}% ممن فتح`} />
        ))}
      </div>
      {f.bySource.length > 0 && (
        <ul className="mt-3 grid gap-1.5 text-read">
          {f.bySource.map((c) => (
            <li key={c.key}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate">{c.labelAr}</span>
                <span className="shrink-0 text-muted-foreground">{funnelAr(c)}</span>
              </div>
              <div className="mt-0.5 flex h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-1.5 bg-teal" style={{ width: `${(c.filled / f.visitors) * 100}%` }} />
                <div className="h-1.5 bg-teal/40" style={{ width: `${((c.visitors - c.filled) / f.visitors) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-read text-muted-foreground">الغامق من عبأ، والفاتح من فتح ولم يعبئ.</p>
    </div>
  );
}

export default function GrantRegistrantStats({ s, filtered, funnel }: { s: RegistrantStats; filtered: boolean; funnel: GrantFunnel }) {
  const [open, setOpen] = useState(true);
  const peakDay = Math.max(1, ...s.byDay.map((d) => d.n));
  const peakHour = Math.max(1, ...s.byHour.map((h) => h.n));
  const days = s.byDay.slice(-21);
  return (
    <Card className="mt-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-start">
        <span className="font-black">الإحصاءات{filtered ? " — بحسب التصفية" : ""}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="mt-3 grid gap-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="عبأ النموذج" value={s.total} />
            <Tile label="أخذ كودا" value={s.withCode} />
            <Tile label="اشترى" value={s.bought} note={`${s.boughtPct}% من الكل`} />
            <Tile label="ينتظر الدفع" value={s.pending} />
            <Tile label="لم يشتر بعد" value={s.none} />
            <Tile label="له مستشار" value={s.withAdvisor} />
            <Tile label="منحة وجيز" value={s.member} note={`ومؤثرين ${s.influencer}`} />
            <Tile
              label="من فتح الرابط إلى التعبئة"
              value={s.openToFormMedianMin === null ? "—" : `${s.openToFormMedianMin} د`}
              note={s.opened > 0 ? `الوسيط، من ${s.opened}` : "يعرف لمن عبأ من الآن"}
            />
          </div>

          <Funnel f={funnel} />

          <div className="grid gap-5 md:grid-cols-2">
            <Bars title="من أين جاؤوا — ومن اشترى" items={s.bySource} />
            <div>
              <p className="font-bold">الرسائل التي وصلتهم</p>
              <p className="mt-2 text-read text-muted-foreground">
                {s.mails.total} رسالة · أرسلت {s.mails.sent} · في الطريق {s.mails.queued}
                {s.mails.failed > 0 && <span className="font-bold text-danger-ink"> · تعذر {s.mails.failed}</span>}
              </p>
              <div className="mt-2"><Bars title="" items={s.mails.byPurpose} buy={false} /></div>
            </div>
          </div>

          {days.length > 0 && (
            <div>
              <p className="font-bold">التعبئة باليوم{s.byDay.length > days.length ? " — آخر ٢١ يوما" : ""}</p>
              <div className="mt-2 flex h-28 items-end gap-1" dir="ltr">
                {days.map((d) => (
                  <div key={d.day} className="flex max-w-12 flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.n}`}>
                    <span className="text-fine text-muted-foreground">{d.n}</span>
                    <div className="w-full rounded-t bg-teal" style={{ height: `${Math.max(4, (d.n / peakDay) * 72)}px` }} />
                    <span className="text-fine text-muted-foreground">{dayLabel(d.day)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="font-bold">التعبئة بالساعة — بتوقيت عمّان</p>
            <div className="mt-2 flex h-20 items-end gap-0.5" dir="ltr">
              {s.byHour.map((h) => (
                <div key={h.hour} className="flex flex-1 flex-col items-center gap-1" title={`${h.hour}:00 — ${h.n}`}>
                  <div className="w-full rounded-t bg-gold" style={{ height: `${h.n === 0 ? 1 : Math.max(4, (h.n / peakHour) * 56)}px` }} />
                  <span className="h-4 text-fine text-muted-foreground">{h.hour % 3 === 0 ? h.hour : ""}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Bars title="مجال العمل" items={s.byField} />
            <Bars title="المستوى" items={s.byLevel} />
            <Bars title="يريد تطوير" items={s.byInterest} />
            <Bars title="الدورات التي اختاروها" items={s.byPick} />
          </div>
        </div>
      )}
    </Card>
  );
}

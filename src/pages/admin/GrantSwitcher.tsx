/* «المنح» — روابطُ المنح الثلاث في مكانٍ واحدٍ من صفحتها (٣ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «ابقِ هذا الشريطَ ثابتا لكلّ الصفحات الداخلية، وضع روابطَ المنح في مكانٍ معيّنٍ في
   صفحة المنح». كانت المنحُ ثلاثةَ ألسنةٍ في شريط «المال» (المنحة · منحة المؤثرين · المنحة العامة) بين
   الفواتير والتقارير. فصارت لسانا واحدا «المنح» (`inTab` في `nav-map.ts`)، والتنقّلُ بينها هنا في رأس الصفحة.

   ولكلّ منحةٍ بطاقةٌ فيها بابان لا يختلطان: اسمُها يفتح إعداداتِها في اللوحة، ورابطُ صفحتها العامّة يُفتح
   ويُنسخ لمن ينشره. ومنحةُ المؤثرين بلا رابطٍ واحد: لكلّ مؤثرٍ رابطُه، وهو في قائمتهم تحتها. */

import { Link } from "react-router";
import { Copy, ExternalLink } from "lucide-react";
import { toast, toastError } from "@/components/Toast";
import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { GRANT_SCREENS, type GrantVariant } from "./grant-screens";

function copy(url: string) {
  if (!navigator.clipboard) { toastError("انسخ الرابط يدويا"); return; }
  navigator.clipboard.writeText(url).then(() => toast("نسخ الرابط"), () => toastError("انسخ الرابط يدويا"));
}

export default function GrantSwitcher({ current }: { current: GrantVariant }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <nav aria-label="المنح" className="mb-6 grid gap-3 md:grid-cols-3">
      {GRANT_SCREENS.map((g) => {
        const on = g.variant === current;
        const url = g.publicPath && `${origin}${g.publicPath}`;
        return (
          <Card key={g.variant} tone={on ? "accent" : "default"} className="grid content-start gap-2">
            <Link
              to={g.to}
              aria-current={on ? "page" : undefined}
              className={`text-read font-black ${on ? "text-teal-light-ink" : "hover:text-teal-light-ink"}`}
            >
              {g.nameAr}
            </Link>
            {url ? (
              <div className="flex min-w-0 items-center gap-2">
                <a href={url} target="_blank" rel="noreferrer" dir="ltr" className="flex min-w-0 items-center gap-1 text-read text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{url}</span>
                </a>
                <Button size="sm" tone="ghost" icon={Copy} className="shrink-0" onClick={() => copy(url)}>انسخ</Button>
              </div>
            ) : (
              <p className="text-read text-muted-foreground">لكل مؤثر رابطه، وهو في قائمة المؤثرين.</p>
            )}
          </Card>
        );
      })}
    </nav>
  );
}

/* رسائلُ «تواصل معنا» — في شاشة الدعم فوق التذاكر (١٩ أكتوبر ٢٠٢٦).

   كان نموذجُ الموقع يحاكي الإرسال فلا يصل أحدا. وصار يحفظ الرسالةَ ويرسلها إلى بريد الأكاديميّة
   (`server/services/contact.service.ts`). وصاحبُها قد لا يكون له حساب، فلا تذكرةَ لها: يُردّ عليه
   بالبريد، ثمّ تُعلَّم «تمّ الرد» هنا — فما ينتظر ردّا يبقى أوّلَ القائمة حتّى يُجاب. */

import { useCallback, useEffect, useState } from "react";
import { Mail, Reply, RotateCcw, Check } from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { toastError } from "@/components/Toast";
import { fmtSession } from "@/application/text/format-ar";
import { Panel, Card } from "@/components/ui/Surface";
import Chip from "@/components/ui/Chip";
import Button from "@/components/ui/Button";

interface SiteMessage {
  id: string; reference: string; name: string; email: string;
  entity: string; organization: string | null; topic: string; message: string;
  handledAt: string | null; createdAt: string;
}

const ENTITY_AR: Record<string, string> = {
  individual: "فرد", company: "شركة", gov: "جهة حكومية", edu: "جهة تعليمية", nonprofit: "منظمة غير ربحية",
};

/** ما رُدّ عليه يبقى قليلا للمرجع — والباقي في بريد الأكاديميّة */
const DONE_SHOWN = 5;

export default function SiteMessages() {
  const [rows, setRows] = useState<SiteMessage[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRows(await apiGet<SiteMessage[]>("/api/admin/contact-messages")); }
    catch { setRows([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const mark = async (m: SiteMessage, handled: boolean) => {
    setBusy(m.id);
    try {
      await apiPost(`/api/admin/contact-messages/${m.id}/handled`, { handled });
      await load();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذّر الحفظ"); }
    finally { setBusy(null); }
  };

  if (!rows || rows.length === 0) return null;
  const waiting = rows.filter((r) => !r.handledAt);
  const shown = [...waiting, ...rows.filter((r) => r.handledAt).slice(0, DONE_SHOWN)];

  return (
    <Panel as="section" className="mb-5" aria-labelledby="site-msgs-h">
      <h2 id="site-msgs-h" className="flex flex-wrap items-center gap-2 text-base font-black">
        <Mail className="h-4 w-4 text-teal-light-ink" aria-hidden="true" /> رسائل الموقع
        {waiting.length > 0 && <Chip tone="warn">{waiting.length} تنتظر ردا</Chip>}
      </h2>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        من نموذج «تواصل معنا». رد عليها بالبريد، ثم علّمها «تم الرد».
      </p>
      <ul className="mt-3 space-y-2">
        {shown.map((m) => (
          <Card as="li" key={m.id} className={m.handledAt ? "opacity-70" : ""}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-black">{m.topic}</p>
              <p className="text-read text-muted-foreground">
                <span dir="ltr" className="font-mono">{m.reference}</span> · {fmtSession(m.createdAt)}
              </p>
            </div>
            <p className="mt-1 text-read text-muted-foreground">
              {m.name}{m.organization ? ` — ${m.organization}` : ""} ({ENTITY_AR[m.entity] ?? m.entity}) ·{" "}
              <span dir="ltr">{m.email}</span>
            </p>
            <p className="mt-2 whitespace-pre-line text-read leading-6">{m.message}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button as="a" tone="secondary" size="sm"
                href={`mailto:${m.email}?subject=${encodeURIComponent(`رد: ${m.topic} (${m.reference})`)}`}>
                <Reply className="h-3.5 w-3.5" /> رد بالبريد
              </Button>
              {m.handledAt ? (
                <Button tone="ghost" size="sm" disabled={busy === m.id} onClick={() => void mark(m, false)}>
                  <RotateCcw className="h-3.5 w-3.5" /> أعد فتحها
                </Button>
              ) : (
                <Button tone="secondary" size="sm" disabled={busy === m.id} onClick={() => void mark(m, true)}>
                  <Check className="h-3.5 w-3.5" /> تم الرد
                </Button>
              )}
            </div>
          </Card>
        ))}
      </ul>
    </Panel>
  );
}

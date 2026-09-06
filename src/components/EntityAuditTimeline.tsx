/* «من غيّر هذا؟» — يُقرأ في موضع الشيء، لا في شاشةِ سجلٍّ أخرى.

   السجلُّ العامّ (`/admin/audit`) يجيب هذا السؤالَ بعد رحلة: تفتح شاشةً
   أخرى، وتعرف نوعَ الكيان ومعرّفَه الطويل من ٣٦ حرفا، وترشّح به. فالجوابُ
   مكتوبٌ ولا يُقرأ حيث يُسأل — والسؤالُ يُسأل في بطاقةِ الشعبة وفي بطاقةِ
   الحساب.

   واللوحُ يُطوى افتراضيّا: أثرُ الشيء سياقٌ يُطلب عند الشكّ، لا محتوًى
   يُزاحم عملَ البطاقة. ومن لا يملك `audit.view` لا يرى شيئا — لا لافتةَ
   منعٍ في وسط بطاقةٍ يعمل عليها. */

import { useCallback, useState } from "react";
import { ChevronDown, ChevronUp, History, Loader2 } from "lucide-react";
import { apiGet, ApiError } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";

import { Inset } from "@/components/ui/Surface";
interface AuditEntityEvent {
  id: string;
  action: string;
  actionAr: string;
  actorAr: string;
  reason: string | null;
  changed: string[];
  createdAt: string;
}

interface AuditEntityView {
  entityTypeAr: string;
  total: number;
  events: AuditEntityEvent[];
}

export default function EntityAuditTimeline({
  entityType, entityId, labelAr = "أثرُ هذا العنصر",
}: { entityType: string; entityId: string; labelAr?: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AuditEntityView | null>(null);
  const [busy, setBusy] = useState(false);
  /* المنعُ يُخفي اللوحَ ولا يُعلنه: من لا صلاحيّةَ له لا شأنَ له بالسؤال */
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await apiGet<AuditEntityView>(`/api/admin/audit/entity/${entityType}/${entityId}`));
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setHidden(true);
      else setError(e instanceof ApiError ? e.message : "تعذّر قراءةُ الأثر");
    } finally {
      setBusy(false);
    }
  }, [entityType, entityId]);

  if (hidden) return null;

  return (
    <div className="mt-3 border-t border-white/8 pt-3">
      <button
        type="button"
        onClick={() => { const next = !open; setOpen(next); if (next && !data) void load(); }}
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-1.5 text-micro font-bold text-muted-foreground transition hover:text-foreground"
      >
        <History className="h-3.5 w-3.5" aria-hidden="true" /> {labelAr}
        {data && <span className="tabular-nums text-muted-foreground">({data.total})</span>}
        {open ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
      </button>

      {open && (
        <div className="mt-2.5">
          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="يُحمَّل" />}
          {error && <p role="alert" className="text-micro font-bold text-red-300">{error}</p>}
          {data && data.events.length === 0 && (
            <p className="text-micro text-muted-foreground">لا أثرَ مسجّلا على هذا العنصر بعد.</p>
          )}
          {data && data.events.length > 0 && (
            <ol className="space-y-2">
              {data.events.map((e) => (
                <Inset as="li" key={e.id} className="px-3 py-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-micro font-black text-foreground">{e.actionAr}</span>
                    <span className="text-micro text-muted-foreground">— {e.actorAr}</span>
                    <span className="text-micro tabular-nums text-muted-foreground">{fmtDateTime(new Date(e.createdAt))}</span>
                  </div>
                  {e.reason && <p className="mt-1 text-micro leading-5 text-muted-foreground">السبب: {e.reason}</p>}
                  {e.changed.length > 0 && (
                    <p className="mt-1 text-micro text-muted-foreground">تغيّر: {e.changed.join("، ")}</p>
                  )}
                </Inset>
              ))}
              {data.total > data.events.length && (
                <li className="text-micro text-muted-foreground">
                  وأقدمُ من ذلك {data.total - data.events.length} حدثا — تُقرأ كاملةً في «سجلّ الأثر».
                </li>
              )}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

/* بريدُ حملات المنح ممسوكٌ حتى يأمر صاحبُ المنصّة — وهذا أمرُه (١٧ نوفمبر ٢٠٢٦).

   قرارُه: «don't let the system send any email until i say we are done with everything .. then i order to send!».
   فلوحٌ في رأس صفحة المنحة يقول هل البريدُ ممسوك، وزرٌّ يطلقه بتأكيد، وآخرُ يمسكه ثانية. والعلّةُ في
   `server/services/grant-mail-hold.service.ts`. */

import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import ConfirmAction from "@/components/ConfirmAction";
import { apiGet, apiPut, ApiError } from "@/services/api";
import { fmtDateTime } from "@/application/text/format-ar";
import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

interface Hold { held: boolean; changedAt: string | null; changedBy: string | null }
const API = "/api/admin/grants/mail-hold";

export default function GrantMailHold() {
  const [h, setH] = useState<Hold | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setH(await apiGet<Hold>(API)); } catch { /* الصفحةُ تعمل بلا اللوح */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const set = async (held: boolean) => {
    setBusy(true);
    try {
      setH(await apiPut<Hold>(API, { held }));
      toast(held ? "أوقفت بريد الحملات" : "بدأ إرسال بريد الحملات");
      setConfirm(false);
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر الحفظ"); }
    finally { setBusy(false); }
  };

  if (!h) return null;
  return (
    <Card className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-read font-bold">{h.held ? "بريد الحملات موقوف" : "بريد الحملات يرسل"}</p>
        <p className="mt-1 text-read leading-7 text-muted-foreground">
          {h.held
            ? "لا يصل أحدا بريد من حملات المنح حتى ترسله أنت: خصم 80%، وتذكير قبل النهاية، وما بقي على الكود."
            : "يرسل النظام بريد الحملات في موعده."}
          {h.changedAt && ` ${h.held ? "أوقفه" : "أرسله"} ${h.changedBy ?? "مدير"} في ${fmtDateTime(h.changedAt)}.`}
        </p>
      </div>
      {h.held
        ? <Button tone="primary" disabled={busy} onClick={() => setConfirm(true)}>أرسل بريد الحملات</Button>
        : <Button tone="secondary" loading={busy} onClick={() => void set(true)}>أوقف بريد الحملات</Button>}
      {confirm && (
        <ConfirmAction
          tone="default" titleAr="إرسال بريد الحملات" confirmLabelAr="أرسل" busy={busy}
          onCancel={() => setConfirm(false)} onConfirm={() => void set(false)}
        >
          <p>يبدأ الإرسال خلال ساعة: بريد «خصمك صار 80%» لمن ارتفع كوده، وتذكير من لم يشتر قبل نهاية كل حملة إن حان موعده.</p>
          <p className="mt-2">ويمكنك إيقافه ثانية من هنا.</p>
        </ConfirmAction>
      )}
    </Card>
  );
}

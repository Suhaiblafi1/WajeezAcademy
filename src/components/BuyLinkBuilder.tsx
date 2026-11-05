/* «جهّز رابط شراء» — نافذةٌ واحدةٌ للسوبر أدمن (صفُّ المنحة) وللمستشار (حالتُه) (٥ نوفمبر ٢٠٢٦، المرحلة الثانية).

   يختار الدورات وشعبها، ويُملأ كودُ المتعلّم وحدَه إن كان، وتظهر معاينةُ السعر — الحسابُ نفسُه الذي يدفع به المتعلّم
   (`useCheckoutPreview` بلا حسابِ مَن يولّد) — ثمّ يُنسخ الرابط. والحكمُ كلُّه في الخادم (`buy-link.service.ts`): من
   يولّد لمن، وأيُّ كودٍ يُقبل، والأثر. والنصوصُ بلا تشكيل (قواعدُ المستودَع). */

import { useEffect, useMemo, useState } from "react";
import { Copy, Link2, Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import Button from "@/components/ui/Button";
import { Card, Inset } from "@/components/ui/Surface";
import BuyLinkPreview from "@/components/BuyLinkPreview";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { useCourseCohorts } from "@/services/cohort-prices";
import { usePublishedContent } from "@/services/public-content";
import { useCheckoutPreview } from "@/services/checkout-preview";
import { courseById } from "@/data/courses";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { MAX_BUILT_COURSES } from "@/application/commerce/discount-policy";
import { staffControlCls, staffSelectCls } from "@/components/FormKit";
import { toast } from "@/components/Toast";

interface Prepared {
  kind: "admin" | "advisor";
  learnerName: string;
  code: string | null;
  canChooseCode: boolean;
  canWhatsapp: boolean;
}

export default function BuyLinkBuilder({ endpoint, onClose }: { endpoint: string; onClose: () => void }) {
  void usePublishedContent();
  const { cohorts, loaded } = useCourseCohorts();
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ courseId: string; cohortId: string }[]>([]);
  const [adding, setAdding] = useState("");
  const [code, setCode] = useState("");
  const [whatsapp, setWhatsapp] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    apiGet<Prepared>(endpoint)
      .then((p) => { if (on) { setPrep(p); setCode(p.code ?? ""); } })
      .catch((e) => { if (on) setError(e instanceof ApiError ? e.message : "تعذر فتح الأداة"); });
    return () => { on = false; };
  }, [endpoint]);

  /* ما يُشترى اليوم وحدَه: دورةٌ لها شعبةٌ مفتوحة — مرتّبةٌ بالاسم */
  const options = useMemo(
    () => [...cohorts.entries()]
      .filter(([, list]) => list.length > 0)
      .map(([id]) => ({ id, name: courseById(id)?.name ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar")),
    [cohorts],
  );
  const cohortIds = picked.map((p) => p.cohortId);
  const usedCode = code.trim().toUpperCase() || null;
  const preview = useCheckoutPreview(cohortIds, usedCode, loaded && picked.length > 0, true);
  const shown = preview.state === "ready" ? preview.preview : preview.state === "loading" ? preview.last : null;

  const add = (courseId: string) => {
    const first = cohorts.get(courseId)?.[0];
    if (!first || picked.some((p) => p.courseId === courseId) || picked.length >= MAX_BUILT_COURSES) return;
    setPicked((p) => [...p, { courseId, cohortId: first.id }]);
    setLink(null);
  };

  const generate = async () => {
    if (picked.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const [first, ...rest] = picked;
      const r = await apiPost<{ path: string }>(endpoint, {
        courseId: first.courseId, cohortId: first.cohortId,
        adds: rest.map((p) => ({ courseId: p.courseId, cohortId: p.cohortId })),
        code: usedCode, ...(whatsapp ? { whatsapp: true } : {}),
      });
      const full = `${window.location.origin}${r.path}`;
      setLink(full);
      try { await navigator.clipboard.writeText(full); toast("نسخنا الرابط"); } catch { /* يُنسخ باليد من الحقل */ }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذر تجهيز الرابط");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} label="جهز رابط شراء" panelClassName="w-full max-w-lg">
      <Inset tone="solid" className="space-y-3 text-foreground" data-testid="buy-link-builder">
        <h2 className="flex items-center gap-2 text-base font-black"><Link2 className="h-4 w-4" /> جهز رابط شراء</h2>
        {error && <p className="text-read text-gold-ink">{error}</p>}
        {!prep ? (
          !error && <p className="text-read text-muted-foreground">جار التحميل…</p>
        ) : (
          <>
            <p className="text-read">للمتعلم: <b>{prep.learnerName}</b></p>

            <div className="space-y-2">
              {picked.map((p, i) => (
                <Card key={p.courseId} className="p-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-read font-bold">{i + 1}. {courseById(p.courseId)?.name ?? p.courseId}</span>
                    <button type="button" aria-label="احذف الدورة" onClick={() => { setPicked((x) => x.filter((y) => y.courseId !== p.courseId)); setLink(null); }}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  <select
                    aria-label="الشعبة" className={`${staffSelectCls} mt-1 w-full`} value={p.cohortId}
                    onChange={(e) => { const v = e.target.value; setPicked((x) => x.map((y) => (y.courseId === p.courseId ? { ...y, cohortId: v } : y))); setLink(null); }}
                  >
                    {(cohorts.get(p.courseId) ?? []).map((o) => (
                      <option key={o.id} value={o.id}>{o.title}{o.startsAt ? ` — ${cohortDayAr(o.startsAt)}` : ""} — {o.amount} {o.currency}</option>
                    ))}
                  </select>
                </Card>
              ))}
              {picked.length < MAX_BUILT_COURSES && (
                <select
                  aria-label="أضف دورة" className={`${staffSelectCls} w-full`} value={adding} disabled={!loaded}
                  onChange={(e) => { add(e.target.value); setAdding(""); }}
                >
                  <option value="">{loaded ? "أضف دورة…" : "جار تحميل الدورات…"}</option>
                  {options.filter((o) => !picked.some((p) => p.courseId === o.id)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              )}
            </div>

            <label className="block text-read">
              الكود
              {prep.canChooseCode ? (
                <input dir="ltr" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setLink(null); }} placeholder="بدون كود" className={`${staffControlCls} mt-1 w-full`} />
              ) : (
                <span className="mt-1 block font-bold" dir="ltr">{prep.code ?? "—"}</span>
              )}
              {!prep.canChooseCode && (
                <span className="mt-1 block text-muted-foreground">
                  {prep.code ? "كود منحة المتعلم نفسه." : "لا كود منحة لهذا المتعلم."} والخصم الإضافي من «طلبات تقررها الإدارة».
                </span>
              )}
            </label>
            {prep.code && !prep.canChooseCode && (
              <label className="flex items-center gap-2 text-read">
                <input type="checkbox" checked={code !== ""} onChange={(e) => { setCode(e.target.checked ? prep.code! : ""); setLink(null); }} />
                ضع الكود في الرابط
              </label>
            )}
            {prep.canWhatsapp && (
              <label className="flex items-center gap-2 text-read">
                <input type="checkbox" checked={whatsapp} onChange={(e) => { setWhatsapp(e.target.checked); setLink(null); }} />
                رابط حملة واتساب (لا عمولة مستشار عليه)
              </label>
            )}

            {shown && <Card className="p-3"><BuyLinkPreview preview={shown} courseName={(id) => courseById(id)?.name ?? id} /></Card>}
            {preview.state === "failed" && <p className="text-read text-gold-ink">{preview.messageAr}</p>}

            <Button tone="confirm" onClick={() => void generate()} disabled={busy || picked.length === 0} className="w-full">
              <Copy className="ml-2 h-4 w-4" /> {busy ? "جار التجهيز…" : "جهز الرابط وانسخه"}
            </Button>
            {link && (
              <input readOnly dir="ltr" value={link} onFocus={(e) => e.currentTarget.select()} className={`${staffControlCls} w-full`} aria-label="الرابط" data-testid="buy-link-url" />
            )}
          </>
        )}
      </Inset>
    </Modal>
  );
}

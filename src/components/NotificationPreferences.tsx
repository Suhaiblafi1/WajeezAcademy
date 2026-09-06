/* تفضيلاتُ الإشعارات — وما لا يُكتَم يُقال ولا يُخفى (المهمّة ٧٢).

   الشاشةُ تُبنى من الخادم بالكامل: الأصنافُ وأسماؤها وما يجوز كتمُه وسببُ
   قفلِ ما لا يجوز. فلا ثابتٌ في المتصفّح يفترق عن الحدّ الذي يُفرَض فعلا،
   ولو أُضيف صنفٌ غدا ظهر بلا نشرِ واجهة.

   وثلاثةُ قراراتٍ في العرض:

   ١) **ما لا يُكتَم يُعرَض مقفلا ومعه سببُه** — لا يُخفى (فيظنّ صاحبُه أنّه
      كتَمَ كلَّ شيء) ولا يُعطى مفتاحا يرتدّ (فيظنّ أنّ المنصّة معطوبة).
   ٢) **لا مفتاحَ بريدٍ اليوم** — البريدُ غيرُ موصول، ومفتاحٌ لا يفعل شيئا هو
      نفسُه العطبُ الذي عالجته المرحلةُ الأولى: زرٌّ يَعِد بما لا يفعل.
   ٣) **الحالةُ تُقرأ من الخادم بعد كلّ تغيير** لا تُفترض في المتصفّح: تفضيلٌ
      ظنَّ صاحبُه أنّه حُفظ ولم يُحفظ أسوأُ من تفضيلٍ لم يُتَح. */

import { useCallback, useEffect, useState } from "react";
import { BellOff, Loader2, Lock } from "lucide-react";
import { toast, toastError } from "@/components/Toast";
import { apiGet, apiPut, ApiError } from "@/services/api";

import { Panel, Card } from "@/components/ui/Surface";
interface Category {
  key: string;
  labelAr: string;
  whatAr: string;
  silenceable: boolean;
  lockedWhyAr: string | null;
  enabled: boolean;
}

interface Prefs {
  channel: string;
  categories: Category[];
  emailNoteAr: string;
}

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try { setPrefs(await apiGet<Prefs>("/api/me/notification-preferences")); setFailed(false); }
    catch { setFailed(true); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (c: Category) => {
    setBusy(c.key);
    try {
      const res = await apiPut<{ ok?: boolean; error?: { message_ar: string } }>(
        "/api/me/notification-preferences", { category: c.key, enabled: !c.enabled },
      );
      if (res?.error) { toastError(res.error.message_ar); return; }
      await load();
      toast(c.enabled ? `كُتم «${c.labelAr}»` : `عاد «${c.labelAr}»`);
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر الحفظ — أعد المحاولة");
    } finally {
      setBusy(null);
    }
  };

  if (failed) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-muted-foreground">
        تعذّر تحميلُ تفضيلات الإشعارات.{" "}
        <button type="button" onClick={() => void load()} className="font-bold text-teal-light-ink underline">أعد المحاولة</button>
      </p>
    );
  }

  if (!prefs) {
    return <div className="grid place-items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" aria-label="جارٍ التحميل" /></div>;
  }

  return (
    <Panel as="section" aria-labelledby="prefs-h">
      <h2 id="prefs-h" className="flex items-center gap-2 text-base font-black">
        <BellOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ما يصلني من إشعارات
      </h2>
      <p className="mt-1 text-micro leading-5 text-muted-foreground">{prefs.emailNoteAr}</p>

      <ul className="mt-4 space-y-2">
        {prefs.categories.map((c) => (
          <Card as="li" key={c.key}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-bold">
                  {!c.silenceable && <Lock className="h-3.5 w-3.5 shrink-0 text-gold-ink" aria-hidden="true" />}
                  {c.labelAr}
                </p>
                <p className="mt-0.5 text-micro leading-5 text-muted-foreground">{c.whatAr}</p>
              </div>

              {c.silenceable ? (
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    disabled={busy === c.key}
                    onChange={() => void toggle(c)}
                    aria-describedby={`what-${c.key}`}
                  />
                  <span>{c.enabled ? "يصلني" : "مكتوم"}</span>
                </label>
              ) : (
                <span className="rounded-full border border-gold/30 bg-gold/[0.06] px-3 py-1 text-micro font-black text-gold-ink">
                  يصلني دائما
                </span>
              )}
            </div>

            {/* سببُ القفل يُقال في موضعه — لا في صفحةِ مساعدةٍ ولا بالسكوت */}
            {!c.silenceable && c.lockedWhyAr && (
              <p id={`what-${c.key}`} className="mt-2 text-micro leading-5 text-muted-foreground">{c.lockedWhyAr}</p>
            )}
          </Card>
        ))}
      </ul>
    </Panel>
  );
}

/* «منحة أعضاء وجيز» — شاشةُ صاحب المنصّة (٢٠ أكتوبر ٢٠٢٦).

   قرارُه: «A ويحقّ لي تغيير الـ٦٠٪ كما أشاء». فهنا نسبةُ المنحة وعددُها وآخرُ يومٍ لها وتشغيلُها،
   وما جرى بها. والحفظُ بتأكيدٍ يقول ما يقع بكلّ تغيير — والقرارُ له.

   ثمّ من عبّأ النموذج بالأسماء وإحصاءاتُه — وفيها نتائجُ الحملة بالقناة والدفعة والمبلغ (`GrantRegistrants`، ٢ نوفمبر ٢٠٢٦)، ثمّ دوراتُ المنحة بفصلها وسعرها بعد المنحة (`GrantCourses`)، وتحتها فحصُ الهامش: كلُّ شعبةٍ مفتوحةٍ بسعرها بعد المنحة مقابل أجر مقعدها للمدرّب، **بالنسبة التي
   في الخانة** لا المحفوظة — فيرى أثرَ النسبة قبل أن يحفظها. والعلّةُ في `server/services/grant.service.ts`.

   ═══ وهي شاشةُ «منحة مؤثرين وجيز» أيضا (٢٦ أكتوبر ٢٠٢٦) ═══

   `variant="influencer"`: إعداداتُ صفّها هي، وتحتها المؤثّرون بأكوادهم وعمولاتهم وما دُفع لهم (`InfluencersPanel`)
   بدل نتائج الأولى ومن عبّأ نموذجها. والهامشُ فيها يطرح عمولةَ المؤثّر أيضا.

   ═══ و«منحة وجيز العامة» (١ نوفمبر ٢٠٢٦) ═══

   `variant="open"`: منحةُ الأولى نفسُها للجميع بصفّها هي — إعداداتُها ونتائجُها، ومن عبّأ نموذجَها في القائمة نفسِها.

   ═══ و«بلاك فرايدي وجيز» (١٥ نوفمبر ٢٠٢٦) ═══

   `variant="blackfriday"`: بصفّها هي — إعداداتُها كأخواتها. وصارت منحةً للجميع بلا مؤثّرين (١٦ نوفمبر ٢٠٢٦،
   `grant-merge.service.ts`)، فلا عمولةَ في هامشها.
   **والمؤثّرون لا يُدارون هنا** (١٦ نوفمبر ٢٠٢٦، قرارُ صاحب المنصّة: «احذف المؤثرين من صفحة منحة بلاك فرايدي لأنّ لهم
   صفحة»): لوحُهم (`InfluencersPanel`) في «منحة مؤثرين وجيز» وحدَها، وفيه رابطُ كلٍّ في الحملتين وخصمُه وكودُه.

   ═══ وكلُّها لسانٌ واحدٌ «المنح»، والتنقّلُ بينها في رأس الصفحة (٣ نوفمبر ٢٠٢٦، `GrantSwitcher`) ═══

   ═══ و«فحص الهامش» أسفلَها لأيّ منحة (١٦ نوفمبر ٢٠٢٦، `GrantMarginCheck`) ═══
   قرارُ صاحب المنصّة: «أريد فوق هذا الجدول أن أختار المنحةَ التي أرى جدولَها.. ولا حاجةَ للجدول الذي وضعتَه في رأس
   الصفحة». فذهب لوحُ «الهامش في كل المنح»، وفوق الفحص اختيارٌ: المنح، ثمّ كلُّ مؤثّر، ثمّ كلُّ شريك. ويبدأ بمنحة الصفحة. */

import { useCallback, useEffect, useState } from "react";
import { Loader2, ServerOff } from "lucide-react";
import AdminLayout from "./AdminLayout";
import GrantCourses from "./GrantCourses";
import GrantRegistrants from "./GrantRegistrants";
import InfluencersPanel from "./InfluencersPanel";
import GrantSwitcher from "./GrantSwitcher";
import GrantMarginCheck from "./GrantMarginCheck";
import type { GrantVariant } from "./grant-screens";
import { toast, toastError } from "@/components/Toast";
import ConfirmAction from "@/components/ConfirmAction";
import { apiGet, apiPut, ApiError } from "@/services/api";
import { fmtDate } from "@/application/text/format-ar";
import { BLACK_FRIDAY_GRANT_NAME_AR, GRANT_KIND_SLUG, grantClosesAt, grantLastDay, INFLUENCER_GRANT_NAME_AR, MEMBER_GRANT_NAME_AR, OPEN_GRANT_NAME_AR, OPEN_GRANT_PATH, type GrantKind } from "@/application/commerce/grant";
import { staffControlCls } from "@/components/FormKit";
import { Panel, Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

interface Settings {
  id: string; nameAr: string; percentOff: number; maxCodes: number | null; maxCourses: number; closesAt: string | null;
  active: boolean; open: boolean; issued: number; used: number; pending: number; left: number | null;
}
export default function AdminMemberGrant({ variant = "members" }: { variant?: GrantVariant }) {
  const forInfluencer = variant === "influencer";
  const forOpen = variant === "open";
  const forBlackFriday = variant === "blackfriday";
  const api = forInfluencer ? "/api/admin/influencer-grant" : forOpen ? "/api/admin/open-grant" : forBlackFriday ? "/api/admin/black-friday-grant" : "/api/admin/member-grant";
  const nameAr = forInfluencer ? INFLUENCER_GRANT_NAME_AR : forOpen ? OPEN_GRANT_NAME_AR : forBlackFriday ? BLACK_FRIDAY_GRANT_NAME_AR : MEMBER_GRANT_NAME_AR;
  /* اسمُ الحملة القصير — لمن عبّأ نموذجَها ولدوراتها (`GrantKind`) */
  const grantKind: GrantKind = forInfluencer ? "influencer" : forOpen ? "open" : forBlackFriday ? "blackfriday" : "member";
  const [s, setS] = useState<Settings | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [pct, setPct] = useState("");
  const [max, setMax] = useState("");
  const [courses, setCourses] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [active, setActive] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const fill = (x: Settings) => {
    setS(x);
    setPct(String(x.percentOff));
    setMax(x.maxCodes === null ? "" : String(x.maxCodes));
    setCourses(String(x.maxCourses));
    setLastDay(x.closesAt ? grantLastDay(x.closesAt) : "");
    setActive(x.active);
  };

  const load = useCallback(async () => {
    try { fill(await apiGet<Settings>(api)); }
    catch (e) { setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل"); }
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  /* والنسبةُ التي في الخانة تُجرَّب في «فحص الهامش» قبل حفظها */
  const pctNum = Number(pct);
  const pctOk = Number.isInteger(pctNum) && pctNum >= 1 && pctNum <= 100;

  const maxNum = max.trim() === "" ? null : Number(max);
  const maxOk = maxNum === null || (Number.isInteger(maxNum) && maxNum >= 1);
  const coursesNum = Number(courses);
  const coursesOk = Number.isInteger(coursesNum) && coursesNum >= 1 && coursesNum <= 20;
  const changed = !!s && (pctNum !== s.percentOff || maxNum !== s.maxCodes || coursesNum !== s.maxCourses
    || (lastDay || null) !== (s.closesAt ? grantLastDay(s.closesAt) : null) || active !== s.active);

  const save = async () => {
    setBusy(true);
    try {
      fill(await apiPut<Settings>(api, {
        percentOff: pctNum, maxCodes: maxNum, maxCourses: coursesNum, closesAt: lastDay ? grantClosesAt(lastDay) : null, active,
      }));
      toast("حفظت إعدادات المنحة");
      setConfirm(false);
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر حفظ الإعدادات"); }
    finally { setBusy(false); }
  };

  if (offline) {
    return (
      <AdminLayout title={nameAr}>
        <GrantSwitcher current={variant} />
        <Panel className="grid place-items-center py-16 text-center">
          <ServerOff className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
        </Panel>
      </AdminLayout>
    );
  }
  if (!s) {
    return (
      <AdminLayout title={nameAr}>
        <GrantSwitcher current={variant} />
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>
      </AdminLayout>
    );
  }


  return (
    <AdminLayout title={nameAr}>
      {/* المنحُ الثلاثُ وروابطُها العامّة — في رأس الصفحة دائما، لا ألسنةٌ في شريط «المال» (`GrantSwitcher`) */}
      <GrantSwitcher current={variant} />
      <Card className="mt-6">
        <p className="text-read font-bold">
          {s.open ? "المنحة مشغلة" : s.active ? "المنحة انتهت" : "المنحة موقوفة"}
          {" · "}أعطي {s.issued} كودا{s.maxCodes !== null ? ` من ${s.maxCodes}` : ""}
          {" · "}استعمل {s.used}
          {s.pending > 0 ? ` · ينتظر الدفع ${s.pending}` : ""}
          {s.left !== null ? ` · بقي ${s.left}` : ""}
          {s.closesAt ? ` · آخر يوم ${fmtDate(new Date(new Date(s.closesAt).getTime() - 1))}` : ""}
        </p>
        <p className="mt-2 text-read leading-7 text-muted-foreground">
          {forInfluencer && "صفحتها برابط كل مؤثر، وكوده لازم في نموذجها. "}
          {forBlackFriday && "منحة للجميع بلا كود مؤثر ولا عمولة. "}
          {forOpen && `للجميع، وصفحتها ${OPEN_GRANT_PATH}. وقواعدها قواعد منحة وجيز، ومنحة واحدة لكل متعلم على المنح كلها. `}
          من يعبئ نموذج الحملة يأخذ كودا شخصيا، ويمكن أن يعطيه لغيره. ويستعمل في أكثر من شراء حتى {s.maxCourses} دورات على الكود كله، ومنحة واحدة لكل متعلم. وصاحبه يدفع نسبة ثابتة من سعر الدورات بدل خصم الباقة، أو سعر الباقة إن كان أقل. ونسبة كل كود هي نسبة يوم إعطائه.
        </p>
      </Card>

      <h2 className="mt-6 text-lg font-black">الإعدادات</h2>
      <Card className="mt-3 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-read">نسبة المنحة %
          <input type="number" min={1} max={100} value={pct} onChange={(e) => setPct(e.target.value)} className={staffControlCls} />
        </label>
        <label className="grid gap-1 text-read">عدد المنح
          <input type="number" min={1} value={max} onChange={(e) => setMax(e.target.value)} placeholder="بلا حد" className={staffControlCls} />
        </label>
        <label className="grid gap-1 text-read">دورات المنحة
          <input type="number" min={1} max={20} value={courses} onChange={(e) => setCourses(e.target.value)} className={staffControlCls} />
        </label>
        <label className="grid gap-1 text-read">آخر يوم
          <input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} className={staffControlCls} />
        </label>
        <label className="flex items-center gap-2 text-read">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          مشغلة
        </label>
        <Button disabled={busy || !changed || !pctOk || !maxOk || !coursesOk} onClick={() => setConfirm(true)}>احفظ</Button>
      </Card>

      {/* ومنحةُ المؤثرين لها إحصاءاتُها ومن عبّأ نموذجَها أيضا، تحت مؤثّريها (٣ نوفمبر ٢٠٢٦) */}
      {forInfluencer && <InfluencersPanel />}
      <GrantRegistrants grant={grantKind} />

      <GrantCourses grant={grantKind} percentOff={pctOk ? pctNum : null} />

      <GrantMarginCheck pageKey={GRANT_KIND_SLUG[grantKind]} draftPercent={pctOk ? pctNum : null} />

      {confirm && (
        <ConfirmAction
          tone="default" titleAr="حفظ إعدادات المنحة" confirmLabelAr="احفظ" busy={busy}
          onCancel={() => setConfirm(false)} onConfirm={() => void save()}
        >
          <ul className="list-disc space-y-1 ps-5">
            {pctNum !== s.percentOff && (
              <li>النسبة الجديدة {pctNum}% على الأكواد التي تعطى بعد الحفظ. والأكواد التي أعطيت قبله ({s.issued}) تبقى بنسبتها.</li>
            )}
            {coursesNum !== s.maxCourses && <li>المنحة على {coursesNum} دورات بحد أقصى لكل متعلم.</li>}
            {maxNum !== s.maxCodes && <li>{maxNum === null ? "لا حد لعدد المنح." : `يعطى ${maxNum} كودا في المجموع.`}</li>}
            {(lastDay || null) !== (s.closesAt ? grantLastDay(s.closesAt) : null) && (
              <li>{lastDay ? `آخر يوم لإعطاء الأكواد واستعمالها: ${fmtDate(new Date(`${lastDay}T00:00:00`))}. ويسري على كل الأكواد.` : "لا آخر يوم للمنحة."}</li>
            )}
            {active !== s.active && (
              <li>{active ? "تشغل المنحة: يعطى الكود لمن يعبئ النموذج، ويستعمل عند الدفع." : "توقف المنحة: لا يعطى كود جديد، ولا يستعمل كود أعطي حتى تشغلها."}</li>
            )}
          </ul>
        </ConfirmAction>
      )}
    </AdminLayout>
  );
}

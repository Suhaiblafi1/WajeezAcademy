/* «منحة أعضاء وجيز» — شاشةُ صاحب المنصّة (٢٠ أكتوبر ٢٠٢٦).

   قرارُه: «A ويحقّ لي تغيير الـ٦٠٪ كما أشاء». فهنا نسبةُ المنحة وعددُها وآخرُ يومٍ لها وتشغيلُها،
   وما جرى بها. والحفظُ بتأكيدٍ يقول ما يقع بكلّ تغيير — والقرارُ له.

   وتحتها فحصُ الهامش: كلُّ شعبةٍ مفتوحةٍ بسعرها بعد المنحة مقابل أجر مقعدها للمدرّب، **بالنسبة التي
   في الخانة** لا المحفوظة — فيرى أثرَ النسبة قبل أن يحفظها. والعلّةُ في `server/services/grant.service.ts`. */

import { useCallback, useEffect, useState } from "react";
import { Loader2, ServerOff } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { toast, toastError } from "@/components/Toast";
import ConfirmAction from "@/components/ConfirmAction";
import { apiGet, apiPut, ApiError } from "@/services/api";
import { fmtDate, fmtMoney } from "@/application/text/format-ar";
import { grantClosesAt, grantLastDay, MEMBER_GRANT_NAME_AR } from "@/application/commerce/grant";
import { staffControlCls } from "@/components/FormKit";
import { Panel, Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

interface Settings {
  id: string; nameAr: string; percentOff: number; maxCodes: number | null; maxCourses: number; closesAt: string | null;
  active: boolean; open: boolean; issued: number; used: number; pending: number; left: number | null;
}
interface MarginRow {
  cohortId: string; titleAr: string; status: string; startsAt: string | null; currency: string;
  listPrice: number; price: number; ruleType: string | null; ruleRate: number | null;
  seatCost: number | null; margin: number | null;
}

const RULE_AR: Record<string, string> = {
  per_seat: "أجر المقعد",
  revenue_share: "نسبة من سعر الدورة",
  fixed_per_cohort: "مبلغ ثابت للشعبة",
};

export default function AdminMemberGrant() {
  const [s, setS] = useState<Settings | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [pct, setPct] = useState("");
  const [max, setMax] = useState("");
  const [courses, setCourses] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [active, setActive] = useState(false);
  const [rows, setRows] = useState<MarginRow[] | null>(null);
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
    try { fill(await apiGet<Settings>("/api/admin/member-grant")); }
    catch (e) { setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  /* الهامشُ بالنسبة التي في الخانة — يتبعها وهي تُكتب */
  const pctNum = Number(pct);
  const pctOk = Number.isInteger(pctNum) && pctNum >= 1 && pctNum <= 100;
  useEffect(() => {
    if (!pctOk) return;
    const t = setTimeout(() => {
      apiGet<{ rows: MarginRow[] }>(`/api/admin/member-grant/margins?percentOff=${pctNum}`)
        .then((r) => setRows(r.rows))
        .catch(() => setRows(null));
    }, 300);
    return () => clearTimeout(t);
  }, [pctNum, pctOk]);

  const maxNum = max.trim() === "" ? null : Number(max);
  const maxOk = maxNum === null || (Number.isInteger(maxNum) && maxNum >= 1);
  const coursesNum = Number(courses);
  const coursesOk = Number.isInteger(coursesNum) && coursesNum >= 1 && coursesNum <= 20;
  const changed = !!s && (pctNum !== s.percentOff || maxNum !== s.maxCodes || coursesNum !== s.maxCourses
    || (lastDay || null) !== (s.closesAt ? grantLastDay(s.closesAt) : null) || active !== s.active);

  const save = async () => {
    setBusy(true);
    try {
      fill(await apiPut<Settings>("/api/admin/member-grant", {
        percentOff: pctNum, maxCodes: maxNum, maxCourses: coursesNum, closesAt: lastDay ? grantClosesAt(lastDay) : null, active,
      }));
      toast("حفظت إعدادات المنحة");
      setConfirm(false);
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر حفظ الإعدادات"); }
    finally { setBusy(false); }
  };

  if (offline) {
    return (
      <AdminLayout title={MEMBER_GRANT_NAME_AR}>
        <Panel className="grid place-items-center py-16 text-center">
          <ServerOff className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
        </Panel>
      </AdminLayout>
    );
  }
  if (!s) {
    return (
      <AdminLayout title={MEMBER_GRANT_NAME_AR}>
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>
      </AdminLayout>
    );
  }

  const losing = (rows ?? []).filter((r) => r.margin !== null && r.margin < 0).length;

  return (
    <AdminLayout title={MEMBER_GRANT_NAME_AR}>
      <Card>
        <p className="text-read font-bold">
          {s.open ? "المنحة مشغلة" : s.active ? "المنحة انتهت" : "المنحة موقوفة"}
          {" · "}أعطي {s.issued} كودا{s.maxCodes !== null ? ` من ${s.maxCodes}` : ""}
          {" · "}استعمل {s.used}
          {s.pending > 0 ? ` · ينتظر الدفع ${s.pending}` : ""}
          {s.left !== null ? ` · بقي ${s.left}` : ""}
          {s.closesAt ? ` · آخر يوم ${fmtDate(new Date(new Date(s.closesAt).getTime() - 1))}` : ""}
        </p>
        <p className="mt-2 text-read leading-7 text-muted-foreground">
          من يعبئ نموذج الحملة يأخذ كودا شخصيا. يستعمل مرة واحدة، ويمكن أن يعطيه لغيره. وصاحبه يدفع نسبة ثابتة من سعر الدورات بدل خصم الباقة، أو سعر الباقة إن كان أقل. والمنحة على {s.maxCourses} دورات بحد أقصى.
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

      <h2 className="mt-6 text-lg font-black">فحص الهامش بنسبة {pctOk ? `${pctNum}%` : "—"}</h2>
      <p className="mt-1 text-read text-muted-foreground">
        سعر كل شعبة مفتوحة بعد المنحة، وما يأخذه المدرب عن كل مقعد. الخصم كله من حصة الأكاديمية.
        {losing > 0 ? ` ${losing} شعبة تخسر بهذه النسبة.` : ""}
      </p>
      {rows === null ? (
        <Card as="p" className="mt-3 text-read text-muted-foreground">اكتب نسبة من 1 إلى 100.</Card>
      ) : rows.length === 0 ? (
        <Card as="p" className="mt-3 text-read text-muted-foreground">لا شعبة مفتوحة بسعر بعد.</Card>
      ) : (
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full text-read">
            <thead>
              <tr className="text-muted-foreground">
                <th className="p-2 text-start">الشعبة</th>
                <th className="p-2 text-start">السعر</th>
                <th className="p-2 text-start">بعد المنحة</th>
                <th className="p-2 text-start">للمدرب عن المقعد</th>
                <th className="p-2 text-start">يبقى للأكاديمية</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cohortId} className="border-t border-border">
                  <td className="p-2 font-bold">{r.titleAr}</td>
                  <td className="p-2" dir="ltr">{fmtMoney(r.listPrice, r.currency)}</td>
                  <td className="p-2" dir="ltr">{fmtMoney(r.price, r.currency)}</td>
                  <td className="p-2">
                    {r.seatCost !== null
                      ? <span dir="ltr">{fmtMoney(r.seatCost, r.currency)}</span>
                      : r.ruleType === "fixed_per_cohort" && r.ruleRate !== null
                        ? `${RULE_AR.fixed_per_cohort}: ${fmtMoney(r.ruleRate, r.currency)}`
                        : "لا قاعدة أتعاب"}
                    {r.ruleType === "revenue_share" && r.ruleRate !== null ? ` (${r.ruleRate}% ${RULE_AR.revenue_share})` : ""}
                  </td>
                  <td className={`p-2 font-bold ${r.margin !== null && r.margin < 0 ? "text-danger-ink" : ""}`} dir="ltr">
                    {r.margin === null ? "—" : fmtMoney(r.margin, r.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

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

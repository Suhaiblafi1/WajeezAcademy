/* حالاتٌ بلا مستشار — API حقيقي: حالات المستشارين غير المسندة + إسناد.
   الإسناد يتطلب صلاحية advisor.assign؛ قائمة المستشارين من صلاحية admin.users.manage
   وإن لم تتوفر يُدخل المعرف يدويا.

   وكان اسمُها «الاستثناءات» في القائمة والشاشة — اسمٌ لا يدلّ على محتواه،
   ومحروسٌ بصلاحيةِ مراجعةِ طلبات التسجيل التي لا تفتح شيئا هنا. */
import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import { Loader2, RefreshCw, ServerOff, ShieldAlert, UserPlus } from "lucide-react";
import AdminLayout from "./AdminLayout";
import FlowSteps from "@/components/FlowSteps";
import { apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";
import { fmtDate } from "@/application/text/format-ar";

import { Panel, Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { staffSelectCls } from "@/components/FormKit";
const CASE_STATUS_AR: Record<string, string> = {
  new: "جديدة", contacted: "تم التواصل", qualified: "مؤهلة", follow_up: "متابعة",
  enrolled: "سجلت", not_interested: "غير مهتمة", closed: "مغلقة", converted: "تحولت",
};

interface UnassignedCase {
  id: string; status: string; createdAt: string;
  lead: { id: string; name?: string | null; email?: string | null } | null;
  client: { displayName: string; email: string } | null;
}
/** مستشارٌ متاحٌ للإسناد — الخادمُ يرشّح بالدور، فلا تُقرأ الأدوارُ هنا */
interface AdvisorOption { id: string; displayName: string; email: string }

export default function Exceptions() {
  const [rows, setRows] = useState<UnassignedCase[]>([]);
  const [advisors, setAdvisors] = useState<AdvisorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setOffline(null);
    try { setRows(await apiGet<UnassignedCase[]>("/api/admin/advisor-cases/unassigned")); }
    catch (e) { setOffline(permissionMessage(e, "الخادم غير متصل")); }
    /* ── لماذا لا تُقرأ من `/api/admin/users` ──

       كانت تُقرأ منه وتُرشَّح بدور المستشار، وذاك محروسٌ بـ`admin.users.view`.
       فمن مُنح إسنادَ الحالات ولم يُمنح إدارةَ المستخدمين تسقط عنه القائمةُ
       صامتةً وتنكشف تحتها خانةُ «معرف المستشار (UUID)» — قيمةٌ لا تعرضها
       شاشةٌ يملكها. فحقلُ اللصق لم يكن خيارَ تصميم بل أثرَ حارسٍ لا يطابق
       الفعل. والمسارُ الآن محروسٌ بـ`advisor.assign` نفسِها. */
    try {
      setAdvisors(await apiGet<AdvisorOption[]>("/api/admin/advisor-cases/assignable-advisors"));
    } catch { setAdvisors([]); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const assign = async (caseId: string) => {
    const advisorId = (pick[caseId] ?? "").trim();
    if (!advisorId || busy) return;
    setBusy(true);
    try {
      await apiPost(`/api/admin/advisor-cases/${caseId}/assign`, { advisorId });
      toast("أُسندت الحالة — تاريخ الإسناد محفوظ");
      await load();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "فشل الإسناد"); }
    finally { setBusy(false); }
  };

  if (offline) {
    return (
      <AdminLayout title="حالات بلا مستشار">
        <Panel className="grid place-items-center py-20 text-center">
          <ServerOff className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 max-w-md text-sm text-muted-foreground">{offline}</p>
          <Button tone="secondary" onClick={() => void load()} className="mt-5">
            <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
          </Button>
        </Panel>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="حالات بلا مستشار">
      <FlowSteps steps={[
        { label: "حالة تصل بلا مستشار", actor: "النظام يرصدها" },
        { label: "مراجعة وإسناد", actor: "أنت هنا" },
        { label: "المستشار يستلمها", actor: "تظهر في بوابته فوراً" },
      ]} />
      <div className="mb-5 flex items-center gap-3">
        <Button tone="secondary" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </Button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      ) : rows.length === 0 ? (
        <Panel className="grid place-items-center py-20 text-center">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-black">لا حالةَ بلا مستشار</h2>
          <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">كل حالات المستشارين النشطة مسندة — الحالات الجديدة من التشخيص تظهر هنا فور وصولها.</p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black">{c.client?.displayName ?? c.lead?.name ?? "—"}</p>
                <p className="mt-1 text-read text-muted-foreground" dir="ltr">{c.client?.email ?? c.lead?.email ?? ""}</p>
                <p className="mt-1 text-read text-muted-foreground">
                  الحالة: {CASE_STATUS_AR[c.status] ?? c.status} · منذ {fmtDate(new Date(c.createdAt))}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* والفراغُ يُقال ولا يُلتفّ عليه بحقلِ لصق: قائمةٌ فارغةٌ
                    تعني أن لا مستشارَ نشطا، ومعرّفٌ يُكتب يدا لا يُنشئ واحدا. */}
                <label className="sr-only" htmlFor={`advisor-${c.id}`}>المستشارُ المسنَد إليه</label>
                <select id={`advisor-${c.id}`} value={pick[c.id] ?? ""} disabled={advisors.length === 0}
                  onChange={(e) => setPick({ ...pick, [c.id]: e.target.value })} className={`${staffSelectCls} max-w-64`}>
                  <option value="">{advisors.length === 0 ? "لا مستشارين نشطين" : "اختر مستشارا…"}</option>
                  {advisors.map((a) => <option key={a.id} value={a.id}>{a.displayName} ({a.email})</option>)}
                </select>
                <Button tone="confirm" disabled={busy || !(pick[c.id] ?? "").trim()} onClick={() => void assign(c.id)}>
                  <UserPlus className="h-3.5 w-3.5" /> إسناد
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

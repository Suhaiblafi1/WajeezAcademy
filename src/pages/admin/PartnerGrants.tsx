/* «منح الشركاء» — شاشةُ صاحب المنصّة لكلّ جامعةٍ أو شركةٍ شريكة (١٥ نوفمبر ٢٠٢٦).

   القراراتُ في رأس `src/application/commerce/partner-grant.ts`، والخادمُ `server/services/partner-grant.service.ts`.
   فهنا: الشركاءُ بقائمة، وإضافةُ شريك، وتعديلُه — الاسمان والنوعُ ونطاقاتُ البريد والنسبةُ وحدُّ الدورات وعددُ المنح وآخرُ يومٍ
   (اختياريّ) والتشغيل — **والرابطُ يُكتب عند الإنشاء ولا يتغيّر بعده**، فهو في كلّ رابطٍ نُشر. وشعارُه يُرفع صورةً، وحتّى
   يُرفع يُكتب اسمُه في صفحته. ودوراتُ صفحته باختيار دورات المنح نفسِه (`GrantCourseChoice`)، ومن أكّد بريدَه بقائمةٍ وملفّ
   Excel. والحفظُ بتأكيدٍ يقول ما يقع بكلّ تغيير — والقرارُ له. وكلُّ تغييرٍ يُكتب أثرُه بمن غيّر وما كان وما صار. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, ExternalLink, ImageUp, Loader2, Plus, ServerOff, Trash2 } from "lucide-react";
import AdminLayout from "./AdminLayout";
import GrantSwitcher from "./GrantSwitcher";
import GrantCourseChoice from "./GrantCourseChoice";
import { toast, toastError } from "@/components/Toast";
import ConfirmAction from "@/components/ConfirmAction";
import { apiDelete, apiDownload, apiGet, apiPost, apiPut, ApiError } from "@/services/api";
import { mediaSrc, putSigned } from "@/services/signed-upload";
import { fmtDate } from "@/application/text/format-ar";
import { grantClosesAt, grantLastDay } from "@/application/commerce/grant";
import { normalizeDomain, normalizePartnerSlug, PARTNER_DEFAULTS, PARTNER_TYPE_AR, type PartnerType } from "@/application/commerce/partner-grant";
import { staffControlCls } from "@/components/FormKit";
import ListToolbar from "@/components/admin/ListToolbar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { Card, Inset, Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

interface Partner {
  id: string; slug: string; nameAr: string; nameEn: string | null; type: PartnerType; domains: string[];
  percentOff: number; maxCourses: number; maxCodes: number | null; closesAt: string | null; active: boolean; open: boolean;
  issued: number; used: number; pending: number; claims: number; hasLogo: boolean; publicPath: string; updatedAt: string;
}
interface Claim {
  id: string; fullName: string; email: string | null; phone: string | null; verifiedAt: string; code: string | null;
  courses: number; pending: boolean; paidTotal: number;
}
interface Draft {
  slug: string; nameAr: string; nameEn: string; type: PartnerType; domains: string; percentOff: string; maxCourses: string;
  maxCodes: string; lastDay: string; active: boolean;
}

const EMPTY: Draft = {
  slug: "", nameAr: "", nameEn: "", type: "university", domains: "", percentOff: String(PARTNER_DEFAULTS.percentOff),
  maxCourses: String(PARTNER_DEFAULTS.maxCourses), maxCodes: "", lastDay: "", active: false,
};
const draftOf = (p: Partner): Draft => ({
  slug: p.slug, nameAr: p.nameAr, nameEn: p.nameEn ?? "", type: p.type, domains: p.domains.join("\n"),
  percentOff: String(p.percentOff), maxCourses: String(p.maxCourses), maxCodes: p.maxCodes === null ? "" : String(p.maxCodes),
  lastDay: p.closesAt ? grantLastDay(p.closesAt) : "", active: p.active,
});
const domainsOf = (raw: string) => raw.split(/[\s,،]+/).map((d) => d.trim()).filter(Boolean);

function copy(url: string) {
  if (!navigator.clipboard) { toastError("انسخ الرابط يدويا"); return; }
  navigator.clipboard.writeText(url).then(() => toast("نسخ الرابط"), () => toastError("انسخ الرابط يدويا"));
}

export default function AdminPartnerGrants() {
  const [list, setList] = useState<Partner[] | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  /* المعروضُ للتعديل — معرّفُه، أو «جديد» */
  const [openId, setOpenId] = useState<string | "new" | null>(null);

  /* يُعاد التحميلُ بزيادة العدّاد — والطلبُ في المؤثّر نفسِه لا في دالّةٍ تُنادى منه */
  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    let on = true;
    apiGet<Partner[]>("/api/admin/partners")
      .then((r) => { if (on) setList(r); })
      .catch((e) => { if (on) setOffline(e instanceof ApiError ? e.message : "الخادم غير متصل"); });
    return () => { on = false; };
  }, [tick]);

  if (offline) {
    return (
      <AdminLayout title="منح الشركاء">
        <GrantSwitcher current="partners" />
        <Panel className="grid place-items-center py-16 text-center">
          <ServerOff className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">{offline}</p>
        </Panel>
      </AdminLayout>
    );
  }
  if (!list) {
    return (
      <AdminLayout title="منح الشركاء">
        <GrantSwitcher current="partners" />
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-light-ink" /></div>
      </AdminLayout>
    );
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const current = openId && openId !== "new" ? list.find((p) => p.id === openId) ?? null : null;

  return (
    <AdminLayout title="منح الشركاء">
      <GrantSwitcher current="partners" />
      <Card>
        <p className="text-read leading-7 text-muted-foreground">
          لكل جامعة أو شركة منحتها وصفحتها. يكتب الطالب بريده الجامعي فيصله رابط، وإذا فتحه أخذ كوده. والكود يعمل على أي دورة حتى حد دوراته،
          ومنحة واحدة لكل متعلم على المنح كلها، وبلا عمولة.
        </p>
      </Card>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">الشركاء</h2>
        <Button size="sm" icon={Plus} onClick={() => setOpenId("new")}>أضف شريكا</Button>
      </div>
      {list.length === 0 ? (
        <Card as="p" className="mt-3 text-read text-muted-foreground">لا شريك بعد.</Card>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {list.map((p) => {
            const url = `${origin}${p.publicPath}`;
            return (
              <Card as="li" key={p.id} tone={p.id === openId ? "accent" : "default"} className="grid content-start gap-2">
                <button type="button" className="text-start text-read font-black hover:text-teal-light-ink" onClick={() => setOpenId(p.id)}>
                  {p.nameAr}{p.nameEn ? <span dir="ltr" className="ms-2 font-normal text-muted-foreground">{p.nameEn}</span> : null}
                </button>
                <p className="text-read text-muted-foreground">
                  {p.open ? "مشغلة" : p.active ? "انتهت" : "موقوفة"} · {p.percentOff}% على {p.maxCourses} دورات
                  {" · "}أكد {p.claims} · أعطي {p.issued} كودا · استعمل {p.used}
                  {p.hasLogo ? "" : " · بلا شعار"}
                </p>
                <div className="flex min-w-0 items-center gap-2">
                  <a href={url} target="_blank" rel="noreferrer" dir="ltr" className="flex min-w-0 items-center gap-1 text-read text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{url}</span>
                  </a>
                  <Button size="sm" tone="ghost" icon={Copy} className="shrink-0" onClick={() => copy(url)}>انسخ</Button>
                </div>
              </Card>
            );
          })}
        </ul>
      )}

      {openId === "new" && (
        <PartnerEditor key="new" partner={null} onSaved={(p) => { void load(); setOpenId(p.id); }} onClose={() => setOpenId(null)} />
      )}
      {current && (
        <>
          <PartnerEditor key={current.id} partner={current} onSaved={() => void load()} onClose={() => setOpenId(null)} />
          <PartnerLogo partner={current} onChanged={() => void load()} />
          <h2 className="mt-6 text-lg font-black">دورات صفحة {current.nameAr}</h2>
          <GrantCourseChoice endpoint={`/api/admin/partners/${current.id}/courses`} />
          <PartnerClaims partner={current} />
        </>
      )}
    </AdminLayout>
  );
}

/** إضافةُ شريكٍ أو تعديلُه — والحفظُ بتأكيدٍ يقول ما يتغيّر */
function PartnerEditor({ partner, onSaved, onClose }: { partner: Partner | null; onSaved: (p: Partner) => void; onClose: () => void }) {
  const [d, setD] = useState<Draft>(partner ? draftOf(partner) : EMPTY);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  const pct = Number(d.percentOff);
  const courses = Number(d.maxCourses);
  const maxCodes = d.maxCodes.trim() === "" ? null : Number(d.maxCodes);
  const domains = domainsOf(d.domains);
  const badDomain = domains.find((x) => normalizeDomain(x) === null) ?? null;
  const slugOk = partner !== null || normalizePartnerSlug(d.slug) !== null;
  const ok = d.nameAr.trim().length >= 2 && slugOk && domains.length > 0 && !badDomain
    && Number.isInteger(pct) && pct >= 1 && pct <= 100 && Number.isInteger(courses) && courses >= 1 && courses <= 20
    && (maxCodes === null || (Number.isInteger(maxCodes) && maxCodes >= 1));
  const was = partner ? draftOf(partner) : null;
  const changed = !was || (Object.keys(d) as (keyof Draft)[]).some((k) => d[k] !== was[k]);

  const save = async () => {
    setBusy(true);
    const body = {
      nameAr: d.nameAr.trim(), nameEn: d.nameEn.trim() || null, type: d.type, domains, percentOff: pct, maxCourses: courses,
      maxCodes, closesAt: d.lastDay ? grantClosesAt(d.lastDay) : null, active: d.active,
    };
    try {
      const out = partner
        ? await apiPut<Partner>(`/api/admin/partners/${partner.id}`, body)
        : await apiPost<Partner>("/api/admin/partners", { ...body, slug: d.slug.trim().toLowerCase() });
      toast(partner ? "حفظ الشريك" : "أضيف الشريك");
      setConfirm(false);
      onSaved(out);
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر الحفظ"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <h2 className="mt-6 text-lg font-black">{partner ? `إعدادات ${partner.nameAr}` : "شريك جديد"}</h2>
      <Card className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-read">الاسم بالعربية
          <input value={d.nameAr} onChange={(e) => set({ nameAr: e.target.value })} className={staffControlCls} maxLength={120} placeholder="الجامعة الهاشمية" />
        </label>
        <label className="grid gap-1 text-read">الاسم بالإنجليزية
          <input value={d.nameEn} onChange={(e) => set({ nameEn: e.target.value })} className={staffControlCls} dir="ltr" maxLength={120} placeholder="The Hashemite University" />
        </label>
        <label className="grid gap-1 text-read">الرابط
          <input value={d.slug} onChange={(e) => set({ slug: e.target.value })} className={staffControlCls} dir="ltr" disabled={partner !== null} maxLength={30} placeholder="hu" />
          <span className="text-muted-foreground">{partner ? "لا يتغير بعد الإنشاء." : `حروف إنجليزية صغيرة وأرقام. الصفحة /grant/p/${normalizePartnerSlug(d.slug) ?? "…"}`}</span>
        </label>
        <label className="grid gap-1 text-read">النوع
          <select value={d.type} onChange={(e) => set({ type: e.target.value as PartnerType })} className={staffControlCls}>
            <option value="university">{PARTNER_TYPE_AR.university.label} — {PARTNER_TYPE_AR.university.audience}</option>
            <option value="company">{PARTNER_TYPE_AR.company.label} — {PARTNER_TYPE_AR.company.audience}</option>
          </select>
        </label>
        <label className="grid gap-1 text-read md:col-span-2">نطاقات البريد المقبولة
          <textarea value={d.domains} onChange={(e) => set({ domains: e.target.value })} className={staffControlCls} dir="ltr" rows={2} placeholder="hu.edu.jo" />
          <span className={badDomain ? "text-danger-ink" : "text-muted-foreground"}>
            {badDomain ? `النطاق ${badDomain} غير صحيح.` : "نطاق في كل سطر. يقبل النطاق نفسه وكل ما تحته، مثل std.hu.edu.jo."}
          </span>
        </label>
        <label className="grid gap-1 text-read">نسبة المنحة %
          <input type="number" min={1} max={100} value={d.percentOff} onChange={(e) => set({ percentOff: e.target.value })} className={staffControlCls} />
        </label>
        <label className="grid gap-1 text-read">دورات المنحة
          <input type="number" min={1} max={20} value={d.maxCourses} onChange={(e) => set({ maxCourses: e.target.value })} className={staffControlCls} />
        </label>
        <label className="grid gap-1 text-read">عدد المنح
          <input type="number" min={1} value={d.maxCodes} onChange={(e) => set({ maxCodes: e.target.value })} placeholder="بلا حد" className={staffControlCls} />
        </label>
        <label className="grid gap-1 text-read">آخر يوم
          <input type="date" value={d.lastDay} onChange={(e) => set({ lastDay: e.target.value })} className={staffControlCls} />
          <span className="text-muted-foreground">اتركه فارغا لمنحة بلا نهاية.</span>
        </label>
        <label className="flex items-center gap-2 text-read">
          <input type="checkbox" checked={d.active} onChange={(e) => set({ active: e.target.checked })} />
          مشغلة — تظهر صفحتها ويعطى الكود
        </label>
        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          <Button tone="confirm" disabled={busy || !ok || !changed} onClick={() => setConfirm(true)}>{partner ? "احفظ" : "أضف الشريك"}</Button>
          <Button tone="ghost" onClick={onClose}>أغلق</Button>
        </div>
      </Card>

      {confirm && (
        <ConfirmAction
          tone="default" titleAr={partner ? "حفظ الشريك" : "إضافة شريك"} confirmLabelAr={partner ? "احفظ" : "أضف"} busy={busy}
          onCancel={() => setConfirm(false)} onConfirm={() => void save()}
        >
          <ul className="list-disc space-y-1 ps-5">
            {!partner && <li>الصفحة /grant/p/{normalizePartnerSlug(d.slug)}، ولا يتغير رابطها بعد الإضافة.</li>}
            {(!was || was.percentOff !== d.percentOff) && <li>النسبة {pct}% على الأكواد التي تعطى بعد الحفظ. وما أعطي قبله يبقى بنسبته.</li>}
            {(!was || was.maxCourses !== d.maxCourses) && <li>حتى {courses} دورات على الكود كله.</li>}
            {(!was || was.domains !== d.domains) && <li>يقبل البريد على: <bdi dir="ltr">{domains.join("، ")}</bdi> وما تحتها.</li>}
            {(!was || was.maxCodes !== d.maxCodes) && <li>{maxCodes === null ? "لا حد لعدد المنح." : `يعطى ${maxCodes} كودا في المجموع.`}</li>}
            {(!was || was.lastDay !== d.lastDay) && <li>{d.lastDay ? `آخر يوم ${fmtDate(new Date(`${d.lastDay}T00:00:00`))}، ويسري على كل الأكواد.` : "بلا آخر يوم."}</li>}
            {(!was || was.active !== d.active) && (
              <li>{d.active ? "تشغل: تظهر الصفحة، ويعطى الكود لمن يؤكد بريده." : "توقف: تختفي الصفحة، ولا يعطى كود جديد، ولا يستعمل كود أعطي حتى تشغلها."}</li>
            )}
            {was && (was.nameAr !== d.nameAr || was.nameEn !== d.nameEn || was.type !== d.type) && <li>يتغير الاسم أو النوع في الصفحة والرسائل.</li>}
          </ul>
        </ConfirmAction>
      )}
    </>
  );
}

/** شعارُ الشريك — صورةٌ تُرفع، وحتّى تُرفع يُكتب اسمُه في صفحته */
function PartnerLogo({ partner, onChanged }: { partner: Partner; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [stamp, setStamp] = useState(() => Date.now());
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await apiPost<{ uploadUrl: string; maxBytes: number }>(`/api/admin/partners/${partner.id}/logo`, { mime: file.type, sizeBytes: file.size });
      await putSigned(r.uploadUrl, file, r.maxBytes);
      await apiPost(`/api/admin/partners/${partner.id}/logo/commit`);
      toast("رفع الشعار");
      setStamp(Date.now());
      onChanged();
    } catch (e) { toastError(e instanceof Error ? e.message : "تعذر رفع الشعار"); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await apiDelete(`/api/admin/partners/${partner.id}/logo`);
      toast("أزيل الشعار");
      setConfirmRemove(false);
      onChanged();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر إزالة الشعار"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <h2 className="mt-6 text-lg font-black">الشعار</h2>
      <Card className="mt-3 flex flex-wrap items-center gap-4">
        <span className="grid h-24 w-44 place-items-center rounded-2xl bg-white p-2 ring-1 ring-black/10">
          {partner.hasLogo
            ? <img src={mediaSrc(`/api/admin/partners/${partner.id}/logo?v=${stamp}`)} alt={`شعار ${partner.nameAr}`} className="max-h-20 w-auto object-contain" />
            : <span className="text-center text-sm font-black text-teal-deep">{partner.nameAr}</span>}
        </span>
        <div className="grid gap-2 text-read">
          <span className="text-muted-foreground">
            {partner.hasLogo ? "يظهر في صفحته بجانب شعار وجيز ما دامت مشغلة." : "بلا شعار يكتب اسمه في صفحته."} صورة PNG أو JPEG أو WebP حتى 1MB.
          </span>
          <span className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true"
              onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
            <Button size="sm" icon={ImageUp} loading={busy} onClick={() => fileRef.current?.click()}>{partner.hasLogo ? "بدل الشعار" : "ارفع الشعار"}</Button>
            {partner.hasLogo && <Button size="sm" tone="danger" icon={Trash2} disabled={busy} onClick={() => setConfirmRemove(true)}>أزل الشعار</Button>}
          </span>
        </div>
      </Card>
      {confirmRemove && (
        <ConfirmAction tone="danger" titleAr="إزالة الشعار" confirmLabelAr="أزل" busy={busy} onCancel={() => setConfirmRemove(false)} onConfirm={() => void remove()}>
          <p>يكتب اسم {partner.nameAr} مكان الشعار في صفحته. ويمكنك رفع شعار جديد متى شئت.</p>
        </ConfirmAction>
      )}
    </>
  );
}

/** من أكّد بريدَه — متى، وكودُه، وما اشترى — وملفُّ Excel */
function PartnerClaims({ partner }: { partner: Partner }) {
  const [rows, setRows] = useState<Claim[] | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const shown = useMemo(
    () => paginate((rows ?? []).filter((r) => matchesQuery(q, [r.fullName, r.email ?? "", r.code ?? "", r.phone ?? ""])), page, 25),
    [rows, q, page],
  );
  useEffect(() => {
    let on = true;
    apiGet<Claim[]>(`/api/admin/partners/${partner.id}/claims`)
      .then((r) => { if (on) setRows(r); })
      .catch(() => { if (on) setRows([]); });
    return () => { on = false; };
  }, [partner.id]);
  const download = async () => {
    try { await apiDownload(`/api/admin/partners/${partner.id}/claims.xlsx`, "partner-claims.xlsx"); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر التنزيل"); }
  };

  return (
    <>
      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">من أكد بريده{rows ? ` (${rows.length})` : ""}</h2>
        <Button size="sm" icon={Download} onClick={() => void download()} disabled={!rows || rows.length === 0}>Excel</Button>
      </div>
      {!rows ? (
        <div className="grid place-items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-teal-light-ink" /></div>
      ) : rows.length === 0 ? (
        <Card as="p" className="mt-3 text-read text-muted-foreground">لم يؤكد أحد بريده بعد.</Card>
      ) : (
        <Card className="mt-3 overflow-x-auto">
          <ListToolbar q={q} onQ={setQ} onPage={setPage} view={shown} placeholder="ابحث بالاسم أو البريد أو الكود" unit="شخصا" />
          <table className="w-full text-read">
            <thead>
              <tr className="text-muted-foreground">
                <th className="p-2 text-start">الاسم</th>
                <th className="p-2 text-start">البريد</th>
                <th className="p-2 text-start">أكد بريده</th>
                <th className="p-2 text-start">الكود</th>
                <th className="p-2 text-start">اشترى</th>
              </tr>
            </thead>
            <tbody>
              {shown.rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2 font-bold">{r.fullName}{r.phone && <bdi dir="ltr" className="block font-normal text-muted-foreground">{r.phone}</bdi>}</td>
                  <td className="p-2" dir="ltr">{r.email}</td>
                  <td className="p-2">{fmtDate(new Date(r.verifiedAt))}</td>
                  <td className="p-2 font-mono" dir="ltr">{r.code ?? "—"}</td>
                  <td className="p-2">{r.courses > 0 ? `${r.courses} دورات` : r.pending ? "ينتظر الدفع" : "لم يشتر بعد"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Inset as="p" className="mt-3 text-read text-muted-foreground">
        يظهر هنا من فتح رابط التأكيد. ومن لم يشتر بعد ساعة تفتح له حالة عند مستشار.
      </Inset>
    </>
  );
}

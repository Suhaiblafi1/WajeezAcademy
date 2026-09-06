/* المهامّ والإشعارات — تكليفٌ يعلم به صاحبُه.

   قرارُ صاحب المنصّة: «يحقّ للسوبر إعطاء مهام للمستخدمين وإرسال إشعارات
   لهم». ولم يكن في القاعدة نموذجُ «مهمّة» إطلاقا.

   وثلاثةُ ألواحٍ في شاشةٍ واحدة لأنّها ثلاثةُ أسئلةٍ متجاورة: ماذا عليّ؟ وما
   كلّفتُ به غيري؟ وماذا أبثّ؟ وفصلُها في ثلاث شاشاتٍ يجعل المتابعةَ تنقّلا. */

import { useCallback, useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import { Bell, CheckCircle2, ClipboardList, Loader2, Send } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { apiGet, apiPost, ApiError, permissionMessage } from "@/services/api";
import { useRealSession } from "@/services/session";
import { fmtDate } from "@/application/text/format-ar";

import { Panel } from "@/components/ui/Surface";
interface Task {
  id: string; title: string; bodyAr: string | null;
  dueAt: string | null; priority: string; status: string;
  doneAt: string | null; doneNoteAr: string | null;
  assignee?: { id: string; displayName: string; email: string };
}

interface StaffUser { id: string; displayName: string; email: string; roles: { nameAr: string }[] }

const PRIORITY_AR: Record<string, string> = { normal: "عادية", high: "عاجلة" };

export default function AdminTasks() {
  const { user } = useRealSession();
  const canAssign = user?.permissions.includes("staff.task.assign") ?? false;
  const canNotify = user?.permissions.includes("staff.notify") ?? false;

  const [mine, setMine] = useState<Task[]>([]);
  const [assigned, setAssigned] = useState<Task[]>([]);
  const [people, setPeople] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ assigneeId: "", title: "", bodyAr: "", dueAt: "", priority: "normal" });
  const [announce, setAnnounce] = useState({ title: "", bodyAr: "", to: [] as string[] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMine(await apiGet<Task[]>("/api/staff/tasks/mine"));
      if (canAssign) setAssigned(await apiGet<Task[]>("/api/staff/tasks/assigned"));
      if (canAssign || canNotify) {
        setPeople(await apiGet<StaffUser[]>("/api/admin/users").catch(() => []));
      }
    } catch (e) {
      toastError(permissionMessage(e, "تعذّر قراءة المهامّ"));
    } finally { setLoading(false); }
  }, [canAssign, canNotify]);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); toast(msg); await load(); }
    catch (e) { toastError(e instanceof ApiError ? e.message : "تعذّر الإجراء"); }
    finally { setBusy(false); }
  };

  const field = "w-full rounded-xl border border-white/12 bg-paper/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/75 focus:border-teal focus:outline-none";

  const row = (t: Task, showAssignee: boolean) => (
    <li key={t.id} className={`rounded-2xl border p-4 ${
      t.status === "done" ? "border-white/8 bg-white/[0.02]" : "border-white/12 bg-white/[0.04]"
    }`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-sm font-black ${t.status === "done" ? "text-muted-foreground line-through" : ""}`}>
            {t.title}
            {t.priority === "high" && t.status !== "done" && (
              <span className="mr-2 rounded-full border border-red-400/40 px-2 py-0.5 text-micro font-bold text-red-300">عاجلة</span>
            )}
          </p>
          {t.bodyAr && <p className="mt-1 text-[11.5px] leading-6 text-muted-foreground">{t.bodyAr}</p>}
          <p className="mt-1 text-micro text-muted-foreground">
            {showAssignee && t.assignee ? `${t.assignee.displayName} · ` : ""}
            {t.dueAt ? `الموعد ${fmtDate(new Date(t.dueAt))}` : "بلا موعد"}
            {t.status === "done" && t.doneAt ? ` · أُنجزت ${fmtDate(new Date(t.doneAt))}` : ""}
          </p>
          {t.doneNoteAr && <p className="mt-1 text-micro text-teal-light-ink">{t.doneNoteAr}</p>}
        </div>
        {t.status !== "done" && (
          <button
            disabled={busy}
            onClick={() => act(() => apiPost(`/api/staff/tasks/${t.id}/complete`, {}), "أُغلقت المهمّة")}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-teal/45 px-3 py-1 text-[11px] font-bold text-teal-light-ink transition hover:bg-teal/10 disabled:opacity-40"
          >
            <CheckCircle2 className="h-3 w-3" /> أنجزتُها
          </button>
        )}
      </div>
    </li>
  );

  return (
    <AdminLayout title="المهامّ والتكليفات">
      <div className="mx-auto max-w-4xl space-y-5">

        {loading ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-7 w-7 animate-spin text-teal-ink" /></div>
        ) : (
          <>
            <Panel as="section">
              <h2 className="flex items-center gap-2 text-sm font-black">
                <ClipboardList className="h-4 w-4 text-teal-light-ink" /> مهامّي ({mine.filter((t) => t.status !== "done").length} مفتوحة)
              </h2>
              {mine.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">لا مهامَّ مكلَّفا بها.</p>
              ) : (
                <ul className="mt-3 space-y-2">{mine.map((t) => row(t, false))}</ul>
              )}
            </Panel>

            {canAssign && (
              <section className="rounded-3xl border border-gold/25 bg-gold/[0.04] p-5">
                <h2 className="text-sm font-black text-gold-ink">كلّف موظّفا بمهمّة</h2>
                {/* التكليفُ يُشعِر مكلَّفَه في الفعل نفسِه — لا خطوةَ إشعارٍ بعده */}
                <p className="mt-1 text-[11px] text-muted-foreground">يصله إشعارٌ بها فورا، ولا يُكلَّف من هو أعلى رتبةً منك.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                    aria-label="المكلَّف" className={`${field} cursor-pointer [&>option]:bg-surface`}>
                    <option value="">اختر الموظّف…</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>{p.displayName} — {p.roles.map((r) => r.nameAr).join("، ") || "بلا دور"}</option>
                    ))}
                  </select>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="عنوان المهمّة" aria-label="عنوان المهمّة" className={field} />
                  <textarea value={form.bodyAr} onChange={(e) => setForm({ ...form, bodyAr: e.target.value })}
                    rows={2} placeholder="تفصيلها (اختياري)" aria-label="تفصيل المهمّة" className={`${field} sm:col-span-2`} />
                  <input type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
                    aria-label="موعد التسليم" className={`${field} cursor-pointer`} />
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    aria-label="الأولوية" className={`${field} cursor-pointer [&>option]:bg-surface`}>
                    {Object.entries(PRIORITY_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <button
                  disabled={busy || !form.assigneeId || form.title.trim().length < 3}
                  onClick={() => act(
                    () => apiPost("/api/staff/tasks", {
                      assigneeId: form.assigneeId, title: form.title.trim(),
                      ...(form.bodyAr.trim() ? { bodyAr: form.bodyAr.trim() } : {}),
                      ...(form.dueAt ? { dueAt: new Date(`${form.dueAt}T12:00:00Z`).toISOString() } : {}),
                      priority: form.priority,
                    }).then(() => setForm({ assigneeId: "", title: "", bodyAr: "", dueAt: "", priority: "normal" })),
                    "كُلّف الموظّف — ووصله إشعارٌ بها",
                  )}
                  className="mt-3 cursor-pointer rounded-full bg-gold px-5 py-2 text-xs font-black text-on-gold transition hover:bg-gold/90 disabled:opacity-40"
                >
                  كلّفه
                </button>
              </section>
            )}

            {canAssign && (
              <Panel as="section">
                <h2 className="text-sm font-black">ما كلّفتُ به غيري ({assigned.filter((t) => t.status !== "done").length} مفتوحة)</h2>
                {assigned.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">لم تكلّف أحدا بعد.</p>
                ) : (
                  <ul className="mt-3 space-y-2">{assigned.map((t) => row(t, true))}</ul>
                )}
              </Panel>
            )}

            {canNotify && (
              <Panel as="section">
                <h2 className="flex items-center gap-2 text-sm font-black">
                  <Bell className="h-4 w-4 text-teal-light-ink" /> إشعارٌ بلا مهمّة
                </h2>
                {/* إعلانٌ يصل ولا يُتابَع ولا يُغلَق — وحبّتُه منفصلة عن التكليف */}
                <p className="mt-1 text-[11px] text-muted-foreground">يصل ولا يُتابَع ولا يُغلَق. للتكليف الذي يُتابَع استعمل اللوح أعلاه.</p>
                <div className="mt-3 space-y-2">
                  <input value={announce.title} onChange={(e) => setAnnounce({ ...announce, title: e.target.value })}
                    placeholder="عنوان الإشعار" aria-label="عنوان الإشعار" className={field} />
                  <textarea value={announce.bodyAr} onChange={(e) => setAnnounce({ ...announce, bodyAr: e.target.value })}
                    rows={2} placeholder="نصّ الإشعار" aria-label="نص الإشعار" className={field} />
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-2">
                    {people.map((p) => (
                      <label key={p.id} className="flex cursor-pointer items-center gap-2 text-[11px] text-foreground">
                        <input
                          type="checkbox" className="accent-teal"
                          checked={announce.to.includes(p.id)}
                          onChange={(e) => setAnnounce({
                            ...announce,
                            to: e.target.checked ? [...announce.to, p.id] : announce.to.filter((x) => x !== p.id),
                          })}
                        />
                        {p.displayName} <span className="text-muted-foreground" dir="ltr">{p.email}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  disabled={busy || announce.to.length === 0 || announce.title.trim().length < 3 || announce.bodyAr.trim().length < 3}
                  onClick={() => act(
                    () => apiPost("/api/staff/notify", {
                      userIds: announce.to, title: announce.title.trim(), bodyAr: announce.bodyAr.trim(),
                    }).then(() => setAnnounce({ title: "", bodyAr: "", to: [] })),
                    `أُرسل الإشعار إلى ${announce.to.length}`,
                  )}
                  className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-full border border-teal/50 px-5 py-2 text-xs font-black text-teal-light-ink transition hover:bg-teal/10 disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" /> أرسِل
                </button>
              </Panel>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

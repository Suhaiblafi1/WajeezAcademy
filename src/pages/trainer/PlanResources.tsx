/* ═══ لسانُ «المصادر» — قائمةٌ مضغوطةٌ ومنطقةُ رفعٍ واحدة (١١ أكتوبر ٢٠٢٦) ═══

   من ملفّ صاحب المنصّة «تحسينات بوابة مدرّب وجيز» — ومن أوّلويّاته الثلاث: «صفحةُ
   مصادرَ مضغوطةٌ برفعٍ متعدّد: أكثرُ صفحةٍ استهلكت وقتا ونقرات». فصار:

   · **خانةٌ واحدةٌ** تقبل إفلاتَ ملفّاتٍ كثيرةٍ معا أو لصقَ رابط، وتعرف النوعَ وحدَها —
     بدلَ «ارفع ملفّا / أضِف رابطا» يُختار قبل الرفع، وبدلَ أربع نقراتٍ لكلّ ملفّ.
   · **صفٌّ لكلّ مصدر** لا بطاقةٌ من خمسة صفوف: شارةُ نوعه واسمُه ووصفُه، ومحورُه شارةٌ
     تتبدّل في الصفّ نفسِه، وزرُّ حذفٍ واحدٌ بأيقونة (كانا «احذفه» و«أزل» بمعنيين متقاربين).
     والضغطُ على الصفّ يفتح تعديلَ الاسم والوصف والرابط في مكانه.
   · **مجمّعةً بالمحور**: للشعبة كلّها أوّلا، ثمّ محورا محورا (`resource-list.ts`).
   · وجملةُ «PDF وصورةٌ يُقرآن في الصفحة…» تُقال مرّةً فوق الخانة، لا تحت كلّ ملفّ.

   وما بقي من أحكام اللوحة القديمة باقٍ كما هو، وحرّاسُه في
   `plan-resources-draft.test.ts`: لا يدخل الخطّةَ صفٌّ ناقص (الصفُّ يُكتب بعد أن يُرفع
   ملفُّه أو يُلصق رابطُه، كاملا باسمٍ أوّل)، والنوعُ يُعاد اشتقاقُه مع كلّ تعديل (في
   `onPatch` عند الأمّ)، والحذفُ يُقيّد الملفَّ ليُحذف بعد الحفظ لا قبله (`onRemove`). */

import { useRef, useState, type DragEvent } from "react";
import { FileUp, Link2, Loader2, Trash2, X } from "lucide-react";
import { apiPost, ApiError, permissionMessage } from "@/services/api";
import { controlCls } from "@/components/FormKit";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { MAX_BODY_FILE_BYTES, RESOURCE_FILE_MIMES, fileBlockerAr, resourceHasSource } from "@/application/trainer/module-body";
import {
  groupResources, isResourceUrl, resourceBadge, rowFromFile, rowFromUrl, type ListResource,
} from "@/application/trainer/resource-list";

const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

/** ما يُقال مرّةً فوق الخانة — كان يُكرَّر تحت كلّ ملفّ */
export const RESOURCE_DROP_HINT_AR =
  `عدّةُ ملفّاتٍ معا · PDF والصورُ تُقرأ في الصفحة، وغيرُها يُنزَّل · حتّى ${Math.round(MAX_BODY_FILE_BYTES / (1024 * 1024))} ميغابايت للملفّ`;

interface Pending { id: number; name: string; error: string | null }

export default function PlanResources({
  cohortId, resources, modules, locked, onAdd, onPatch, onRemove,
}: {
  cohortId: string;
  resources: readonly ListResource[];
  modules: readonly { moduleId: string; titleAr: string }[];
  locked: boolean;
  /** يُضاف الصفُّ كاملا — والأمُّ تكتبه بمُحدِّثٍ دالّيّ: رفعٌ متعدّدٌ يُنهي ملفّاتِه تباعا */
  onAdd: (row: ListResource) => void;
  onPatch: (i: number, patch: Partial<ListResource>) => void;
  onRemove: (i: number) => void;
}) {
  const pick = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [over, setOver] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const seq = useRef(0);
  const groups = groupResources(resources, modules);

  const uploadOne = async (file: File) => {
    const id = ++seq.current;
    const blocker = fileBlockerAr("plan_resource", file.type, file.size);
    if (blocker) { setPending((p) => [...p, { id, name: file.name, error: blocker }]); return; }
    setPending((p) => [...p, { id, name: file.name, error: null }]);
    try {
      const res = await apiPost<{ storageKey: string; uploadUrl: string }>(
        `/api/trainer/cohorts/${cohortId}/files`,
        { purpose: "plan_resource", refId: `res-${Date.now()}-${id}`, mime: file.type, originalName: file.name },
      );
      const put = await fetch(`${API_BASE}${res.uploadUrl}`, {
        method: "PUT", credentials: "include",
        headers: { "content-type": "application/octet-stream" }, body: file,
      });
      if (!put.ok) throw new ApiError("upload_failed", "تعذّر رفعُ الملفّ", put.status);
      onAdd(rowFromFile({ key: res.storageKey, name: file.name, mime: file.type }));
      setPending((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      const msg = permissionMessage(e, "تعذّر رفعُه الآن — أعد المحاولة بعد قليل.");
      setPending((p) => p.map((x) => (x.id === id ? { ...x, error: msg } : x)));
    }
  };
  /* تباعا لا معا: تسعةُ ملفّاتٍ معا تتنازع الشبكةَ فيسقط أبطؤها بانتهاء مهلته */
  const uploadAll = async (files: readonly File[]) => {
    for (const f of files) await uploadOne(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (locked) return;
    const files = [...e.dataTransfer.files];
    if (files.length) { void uploadAll(files); return; }
    const text = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (isResourceUrl(text)) onAdd(rowFromUrl(text));
  };
  const addLink = () => {
    if (!isResourceUrl(link)) return;
    onAdd(rowFromUrl(link));
    setLink("");
  };

  return (
    <div className="grid gap-4">
      {/* ── الخانةُ الواحدة: أفلِت ملفّاتٍ أو الصق رابطا ── */}
      <Inset
        tone={over ? "accent" : "default"}
        data-dropzone
        onDragOver={(e: DragEvent) => { e.preventDefault(); if (!locked) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className="grid gap-3 border-2 border-dashed border-teal/40 text-center"
      >
        <p className="text-read font-black text-teal-light-ink">أفلِت الملفّاتِ هنا، أو الصق رابطا</p>
        <p className="text-read leading-6 text-muted-foreground">{RESOURCE_DROP_HINT_AR}</p>
        <input ref={pick} type="file" multiple accept={RESOURCE_FILE_MIMES.join(",")} className="sr-only"
          aria-label="اختر ملفّاتِ المصادر"
          onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; if (fs.length) void uploadAll(fs); }} />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button tone="secondary" icon={FileUp} disabled={locked} onClick={() => pick.current?.click()}>اختر ملفّات</Button>
          <span className="text-read text-muted-foreground">أو</span>
          <input dir="ltr" value={link} disabled={locked} placeholder="https://…" aria-label="الصق رابطَ مصدر"
            onChange={(e) => setLink(e.target.value)}
            onPaste={(e) => {
              /* اللصقُ يُضيف حالا إن كان رابطا تامّا — بلا نقرةٍ ثانية */
              const text = e.clipboardData.getData("text");
              if (isResourceUrl(text) && !link.trim()) { e.preventDefault(); onAdd(rowFromUrl(text)); }
            }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
            className={`${controlCls} w-full max-w-xs text-left`} />
          <Button tone="secondary" icon={Link2} disabled={locked || !isResourceUrl(link)} onClick={addLink}>أضف الرابط</Button>
        </div>
      </Inset>

      {pending.length > 0 && (
        <ul className="grid gap-1.5" aria-label="ملفّاتٌ تُرفع">
          {pending.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-read leading-6">
              {p.error
                ? <X className="h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />
                : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal-light-ink" aria-hidden="true" />}
              <bdi className="min-w-0 truncate">{p.name}</bdi>
              <span className={p.error ? "text-gold-ink" : "text-muted-foreground"}>{p.error ? `— ${p.error}` : "— يُرفع…"}</span>
              {p.error && (
                <Button tone="ghost" size="sm" aria-label={`أخفِ «${p.name}»`} onClick={() => setPending((x) => x.filter((y) => y.id !== p.id))}>أخفِ</Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {groups.length === 0 ? (
        <p className="text-read leading-6 text-muted-foreground">لا مصادرَ بعد — يكفي مصدرٌ واحد، وربطُه بمحورٍ اختياريّ.</p>
      ) : groups.map((g) => (
        <section key={g.key} aria-label={g.labelAr} className="grid gap-1">
          <h4 className={`px-1 text-read font-black ${g.moduleId === "orphan" ? "text-gold-ink" : "text-muted-foreground"}`}>{g.labelAr}</h4>
          <ul className="grid gap-1">
            {g.rows.map(({ r, i }) => {
              const editing = open === i;
              const name = r.title.trim() || "بلا اسم";
              return (
                <Card as="li" key={i} tone={editing ? "accent" : "default"} className="grid gap-2 px-3 py-2">
                  <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto_auto] items-center gap-x-2.5 gap-y-1">
                    <span aria-hidden="true" className="row-span-2 grid h-9 w-8 place-items-center rounded-md bg-white/[0.06] text-fine font-black text-muted-foreground">
                      {resourceBadge(r)}
                    </span>
                    <button type="button" onClick={() => setOpen(editing ? null : i)} aria-expanded={editing}
                      className="min-w-0 truncate text-start text-read font-bold text-foreground hover:text-teal-light-ink">
                      {name}
                    </button>
                    {/* المحورُ شارةٌ تتبدّل في الصفّ نفسِه — بدلَ قائمةٍ بفقرة شرحٍ تحت كلّ مصدر */}
                    <select value={r.moduleId && modules.some((m) => m.moduleId === r.moduleId) ? r.moduleId : r.moduleId ? "__lost" : ""}
                      disabled={locked} aria-label={`محورُ «${name}»`}
                      onChange={(e) => e.target.value !== "__lost" && onPatch(i, { moduleId: e.target.value || null, ...(e.target.value ? {} : { preReading: null }) })}
                      className={`row-span-2 h-8 max-w-[9rem] rounded-full border-0 px-3 text-fine font-black [&>option]:bg-surface ${r.moduleId && !modules.some((m) => m.moduleId === r.moduleId) ? "bg-gold/15 text-gold-ink" : "bg-teal/15 text-teal-light-ink"}`}>
                      <option value="">الشعبة كلّها</option>
                      {modules.map((m, k) => <option key={m.moduleId} value={m.moduleId}>المحور {k + 1}</option>)}
                      {r.moduleId && !modules.some((m) => m.moduleId === r.moduleId) && <option value="__lost" disabled>اختر المحور</option>}
                    </select>
                    <Button tone="ghost" size="sm" icon={Trash2} disabled={locked} aria-label={`احذف «${name}»`}
                      className="row-span-2 min-h-9" onClick={() => { if (open === i) setOpen(null); onRemove(i); }} />
                    <span className={`col-start-2 min-w-0 truncate text-fine leading-5 ${(r.noteAr ?? "").trim() ? "text-muted-foreground" : "text-gold-ink"}`}>
                      {(r.noteAr ?? "").trim() || "أضف سطرا: لماذا يقرؤه المتعلّم؟"}
                    </span>
                  </div>
                  {!resourceHasSource(r) && (
                    <p className="text-read leading-6 text-gold-ink">ينقصه رابطٌ أو ملفّ.</p>
                  )}
                  {editing && (
                    <div className="grid gap-2 border-t border-white/[0.06] pt-2">
                      <input value={r.title} disabled={locked} maxLength={200} aria-label={`اسمُ المصدر «${name}»`}
                        placeholder="اسمُ المحتوى — «كرّاسة التحرير»"
                        onChange={(e) => onPatch(i, { title: e.target.value })} className={controlCls} />
                      <input value={r.noteAr ?? ""} disabled={locked} maxLength={500} aria-label={`وصفُ المصدر «${name}»`}
                        placeholder="ما فيه، ومتى يقرؤه"
                        onChange={(e) => onPatch(i, { noteAr: e.target.value })} className={controlCls} />
                      {!(r.bodyFileKey ?? "").trim() && (
                        <input dir="ltr" value={r.url ?? ""} disabled={locked} placeholder="https://…" aria-label={`رابطُ المصدر «${name}»`}
                          onChange={(e) => onPatch(i, { url: e.target.value })} className={`${controlCls} text-left`} />
                      )}
                      {(r.bodyFileKey ?? "").trim() && (
                        <p className="text-read leading-6 text-muted-foreground">الملفّ: <bdi>{r.bodyFileName || "ملفّ"}</bdi></p>
                      )}
                      {r.moduleId && modules.some((m) => m.moduleId === r.moduleId) && (
                        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-read leading-6">
                          <input type="checkbox" checked={Boolean(r.preReading)} disabled={locked}
                            onChange={(e) => onPatch(i, { preReading: e.target.checked || null })}
                            className="h-4 w-4 shrink-0 accent-teal" />
                          قراءةٌ مسبقة — قبل اللقاء
                        </label>
                      )}
                      <div><Button tone="secondary" size="sm" onClick={() => setOpen(null)}>تمّ</Button></div>
                    </div>
                  )}
                </Card>
              );
            })}
          </ul>
        </section>
      ))}
      {groups.length > 0 && <p className="text-read leading-6 text-muted-foreground">اضغط الاسمَ لتعدّله.</p>}
    </div>
  );
}

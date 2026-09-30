/* موادُّ دوراتك — لوحُ الإعداد في «مؤهّلاتي» أثناء طور العرض المشروط.

   قرارُ صاحب المنصّة (٣٠ سبتمبر ٢٠٢٦): العقدُ يَعِد بخمسة أيّامٍ يضع فيها
   المدرّبُ محاورَ دوراته ومواردَها وواجباتها في بوّابته، ولم يكن لذلك موضع.
   فصار لكلّ دورةٍ اخترناها له لوحٌ هنا — لا تبويبٌ جديد.

   · المحاورُ تبدأ من الكتالوج: يعدّلها ولا يكتبها من فراغ.
   · وما ينقص يُقال بالنصّ نفسِه الذي يردّ به الخادمُ «أعلنتُ اكتمالها»
     (`course-materials.ts`) — فلا تقول الشاشةُ «كاملة» ويردّ الإعلانُ.
   · وما اعتُمد يُقرأ ولا يُعدَّل هنا: تعديلُه بعدها في مساحة الشعبة. */

import { useState } from "react";
import { CalendarPlus, ChevronDown, FileStack, Plus, Trash2 } from "lucide-react";
import { Card, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { staffControlCls, StaffField } from "@/components/FormKit";
import { toast, toastError } from "@/components/Toast";
import { apiPut, ApiError } from "@/services/api";
import {
  MATERIALS_LINE, MATERIALS_MAX_MODULES, MATERIALS_TEXT, MATERIALS_URL,
  cleanMaterialsUrl, materialsMissingAr, type CourseMaterials,
} from "@/application/trainer/course-materials";
import {
  ORIENTATION_BOOKING_URL, ORIENTATION_CTA_AR, ORIENTATION_INVITE_AR,
} from "@/application/trainer/orientation-session";

export interface MaterialsRow {
  courseId: string;
  titleAr: string;
  status: string;
  catalogModules: { titleAr: string; outcomeAr: string }[];
  materials: CourseMaterials | null;
  materialsAt: string | null;
  missingAr: string[];
}

/** ما يُفتح به المحرّر: المحفوظ، وإلّا محاورُ الكتالوج */
function startFrom(r: MaterialsRow): CourseMaterials {
  return r.materials ?? {
    modules: r.catalogModules.length ? r.catalogModules.map((m) => ({ ...m })) : [{ titleAr: "", outcomeAr: "" }],
    materialsUrl: null, taskAr: "", sourcesAr: "", noteAr: "",
  };
}

export default function CourseMaterialsPanel({ rows, underReview, onSaved }: {
  rows: MaterialsRow[];
  /** أعلن اكتمالَها والمهلةُ متجمّدة — فتُقرأ ولا تُعدَّل */
  underReview: boolean;
  onSaved: () => void;
}) {
  const pending = rows.filter((r) => r.status === "pending");
  const [openId, setOpenId] = useState<string | null>(pending.find((r) => r.missingAr.length > 0)?.courseId ?? null);
  if (pending.length === 0) return null;
  const ready = pending.filter((r) => r.missingAr.length === 0).length;

  return (
    <section aria-labelledby="materials-h" className="mb-8">
      <h2 id="materials-h" className="flex items-center gap-2 text-lg font-black">
        <FileStack className="h-5 w-5 text-teal-light-ink" aria-hidden="true" /> موادُّ دوراتك
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-7 text-muted-foreground">
        لكلّ دورةٍ اخترناها لك: محاورُها ومخرجاتُها، ورابطُ موادّها، ومهمّةٌ يسلّمها المتعلّم، ومصادرُه.
        احفظ كلَّ دورةٍ حين تكتبها، ثمّ اضغط «أعلنتُ اكتمالها» في الشريط أعلى الصفحة حين تكتمل كلُّها.
        {" "}<span className="font-bold text-foreground">اكتملت {ready} من {pending.length}.</span>
      </p>
      {/* ═══ وجلسةُ التهيئة حيث يُكتب ما تُعين عليه (٣٠ سبتمبر ٢٠٢٦) ═══
          كان رابطُ حجزها في رسالة اعتماد التوقيع وفي الدليل وحدَهما — فمن حذف
          الرسالةَ ولم يفتح الدليلَ لا يجده. وقرارُ صاحب المنصّة: «أضِفه في موادّ
          دوراتك». ويغيب بعد إعلان الاكتمال: الموادُّ عندنا، ولا ما يُعان عليه. */}
      {!underReview && (
        <Inset tone="accent" className="mt-3 flex flex-wrap items-center justify-between gap-3 p-3.5">
          <p className="min-w-0 flex-1 text-sm leading-7">{ORIENTATION_INVITE_AR}</p>
          <Button as="a" href={ORIENTATION_BOOKING_URL} target="_blank" rel="noreferrer noopener" size="sm" icon={CalendarPlus}>
            {ORIENTATION_CTA_AR}
          </Button>
        </Inset>
      )}
      {underReview && (
        <Inset tone="default" className="mt-3 p-3 text-sm leading-6">
          أعلنتَ اكتمالَ موادّك، فهي عندنا للتقييم — تُقرأ هنا ولا تُعدَّل حتّى يصلك جوابُنا.
        </Inset>
      )}
      <ul className="mt-4 grid gap-2.5">
        {pending.map((r) => (
          <CourseCard
            key={r.courseId} row={r} open={openId === r.courseId} locked={underReview}
            onToggle={() => setOpenId(openId === r.courseId ? null : r.courseId)}
            onSaved={onSaved}
          />
        ))}
      </ul>
    </section>
  );
}

function CourseCard({ row: r, open, locked, onToggle, onSaved }: {
  row: MaterialsRow; open: boolean; locked: boolean; onToggle: () => void; onSaved: () => void;
}) {
  const [draft, setDraft] = useState<CourseMaterials>(() => startFrom(r));
  const [busy, setBusy] = useState(false);
  const missing = materialsMissingAr(r.materials);
  const urlBad = Boolean(draft.materialsUrl) && !cleanMaterialsUrl(draft.materialsUrl);

  const setModule = (i: number, patch: Partial<CourseMaterials["modules"][number]>) =>
    setDraft((d) => ({ ...d, modules: d.modules.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));

  async function save() {
    setBusy(true);
    try {
      const out = await apiPut<{ missingAr: string[] }>(`/api/trainer/materials/${encodeURIComponent(r.courseId)}`, draft);
      toast(out.missingAr.length ? `حُفظت — وبقي: ${out.missingAr.join("، ")}` : "حُفظت — وموادُّ هذه الدورة كاملة");
      onSaved();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر الحفظ — أعد المحاولة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="li" className="p-4">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-start">
        <span className="min-w-0 flex-1 text-read font-bold leading-6">{r.titleAr}</span>
        <span className="flex items-center gap-2">
          {missing.length === 0
            ? <Chip tone="positive" srPrefixAr="الحال">كاملة</Chip>
            : <Chip tone="warn" srPrefixAr="الحال">{r.materials ? "ناقصة" : "لم تبدأ"}</Chip>}
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </span>
      </button>
      {missing.length > 0 && (
        <p className="mt-1 text-sm leading-6 text-muted-foreground">ينقصها: {missing.join("، ")}</p>
      )}

      {open && (
        <fieldset disabled={locked || busy} className="mt-4 grid gap-4">
          <div>
            <p className="text-sm font-bold">المحاور ومخرجاتُها</p>
            <p className="text-sm leading-6 text-muted-foreground">
              بدأت من محاور الدورة في الكتالوج — عدّلها كما تدرّسها. والمخرجُ ما يستطيعه المتعلّمُ بعد المحور ولم يكن يستطيعه قبله.
            </p>
            <ol className="mt-2 grid gap-3">
              {draft.modules.map((m, i) => (
                <li key={i}>
                  <Inset tone="default" className="grid gap-2 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                      <input className={staffControlCls} aria-label={`عنوانُ المحور ${i + 1}`} maxLength={MATERIALS_LINE}
                        value={m.titleAr} onChange={(e) => setModule(i, { titleAr: e.target.value })} placeholder="عنوانُ المحور" />
                      <Button tone="ghost" size="sm" icon={Trash2} aria-label={`احذف المحور ${i + 1}`}
                        onClick={() => setDraft((d) => ({ ...d, modules: d.modules.filter((_, j) => j !== i) }))} />
                    </div>
                    <textarea className={staffControlCls} rows={2} aria-label={`مخرجُ المحور ${i + 1}`} maxLength={MATERIALS_TEXT}
                      value={m.outcomeAr} onChange={(e) => setModule(i, { outcomeAr: e.target.value })}
                      placeholder="يستطيع المتعلّمُ بعده أن…" />
                  </Inset>
                </li>
              ))}
            </ol>
            {draft.modules.length < MATERIALS_MAX_MODULES && (
              <Button tone="ghost" size="sm" icon={Plus} className="mt-2"
                onClick={() => setDraft((d) => ({ ...d, modules: [...d.modules, { titleAr: "", outcomeAr: "" }] }))}>
                محور
              </Button>
            )}
          </div>

          <StaffField label="رابطُ الموادّ" hint="مجلّدٌ فيه كرّاساتُ المحاور وعروضُها — Google Drive أو OneDrive بمشاركةٍ مفتوحة لنا. يبدأ بـ https://">
            <input className={staffControlCls} dir="ltr" maxLength={MATERIALS_URL} placeholder="https://…"
              value={draft.materialsUrl ?? ""} onChange={(e) => setDraft((d) => ({ ...d, materialsUrl: e.target.value }))} />
            {urlBad && <span className="text-sm text-danger-ink">رابطٌ يبدأ بـ https:// — والرابطُ الناقص لا يُحفظ.</span>}
          </StaffField>

          <StaffField label="مهمّةٌ يسلّمها المتعلّم" hint="واجبٌ أو مشروعٌ يُقيَّم: ما يفعله، وما يسلّمه، وكيف تقيّمه.">
            <textarea className={staffControlCls} rows={3} maxLength={MATERIALS_TEXT}
              value={draft.taskAr} onChange={(e) => setDraft((d) => ({ ...d, taskAr: e.target.value }))} />
          </StaffField>

          <StaffField label="المصادر" hint="كتبٌ أو مقالاتٌ أو فيديوهات — سطرٌ لكلّ مصدر، ومعه رابطُه إن كان.">
            <textarea className={staffControlCls} rows={3} maxLength={MATERIALS_TEXT}
              value={draft.sourcesAr} onChange={(e) => setDraft((d) => ({ ...d, sourcesAr: e.target.value }))} />
          </StaffField>

          <StaffField label="ملحوظةٌ لمن يراجع (اختياريّ)" hint="ما تريد أن نعرفه عن هذه الدورة قبل أن نقيّمها.">
            <textarea className={staffControlCls} rows={2} maxLength={MATERIALS_TEXT}
              value={draft.noteAr} onChange={(e) => setDraft((d) => ({ ...d, noteAr: e.target.value }))} />
          </StaffField>

          {!locked && (
            <div className="flex justify-end">
              <Button tone="confirm" loading={busy} onClick={() => void save()}>احفظ موادَّ هذه الدورة</Button>
            </div>
          )}
        </fieldset>
      )}
    </Card>
  );
}

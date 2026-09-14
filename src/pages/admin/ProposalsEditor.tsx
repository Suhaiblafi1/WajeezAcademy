/* اقتراحاتُ الدورات — يقرؤها الأدمن ويصحّحها ويربطها.

   ═══ العطبُ الذي كُتبت له ═══

   الطلباتُ التي سبقت أ-٣ (١٣ سبتمبر) تحمل **فقرةً حرّةً واحدة** لا صفوفا.
   وأوّلُ مدرّبةٍ حقيقيّةٍ في المنصّة منها: ثماني دوراتٍ في فقرةٍ واحدة، فلا
   صفَّ يُربط بالكتالوج ولا اسمَ يُصحَّح.

   وقرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «أعطني المجال في ملفّها أن أضع اسمَ
   الدورة المقترحة بنفسي لغايات الربط… لأنّي كأدمن قد أقوم بتغيير اسم الدورة
   أو تصحيحٍ إملائيّ — فهذا الخيار ليس فقط لحلّ مشكلة اليوم بل تفادٍ
   مستقبليّ».

   ═══ والفقرةُ القديمةُ تبقى كما كتبها صاحبُها ═══

   لا تُمحى ولا تُقسَّم أسطرا تخمينا: التخمينُ يبتر جملةً كتبها إنسانٌ عن
   نفسه. تُعرض تحت الصفوف مرجعا يُقارَن به — ومنها ينسخ الأدمنُ ما يسمّيه.

   ═══ ولا يُحفظ بلا نقرة ═══

   الحفظُ التلقائيُّ عند كلّ حرفٍ يعني عشرين نداءً في اسمٍ واحد، وأسوأ: من
   مسح سطرا ليعيد كتابتَه وجده محفوظا ممسوحا. فالزرُّ يظهر حين يتغيّر شيء. */

import { useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { toast, toastError } from "@/components/Toast";
import Button from "@/components/ui/Button";
import { Inset } from "@/components/ui/Surface";
import { staffControlCls as controlCls } from "@/components/FormKit";
import { apiPut, ApiError } from "@/services/api";
import {
  MAX_PROPOSALS, emptyProposal, proposalLine, readProposals,
  type TeachableProposal,
} from "@/application/trainer/teachable-proposals";

export default function ProposalsEditor({
  applicationId, raw, teachableOther, onLink, onSaved,
}: {
  applicationId: string
  /** العمودُ كما هو في القاعدة — يُقرأ بالدالّة المشتركة لا بفكٍّ يدويّ */
  raw: unknown
  /** فقرةُ الطلبات التي سبقت السجلّات — تُعرض مرجعا ولا تُمحى */
  teachableOther: string | null
  /** يفتح نافذةَ الربط لصفٍّ بعينه */
  onLink: (index: number, line: string) => void
  onSaved: () => Promise<void> | void
}) {
  const saved = readProposals(raw);
  const [rows, setRows] = useState<TeachableProposal[]>(saved);
  const [busy, setBusy] = useState(false);

  /* «تغيَّر شيء؟» تُقاس على ما حُفظ لا على طول المصفوفة: من أضاف صفّا فارغا
     ثمّ حذفه لم يغيّر شيئا، ولا يُعرض له زرُّ حفظٍ يوهم أنّ عنده عملا. */
  const dirty = JSON.stringify(rows.filter((r) => r.titleAr.trim()))
    !== JSON.stringify(saved);

  const set = (i: number, patch: Partial<TeachableProposal>) =>
    setRows((cur) => cur.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiPut(`/api/admin/trainer-applications/${applicationId}/teachable-proposals`, {
        proposals: rows.map((r) => ({ titleAr: r.titleAr, audienceAr: r.audienceAr })),
      });
      toast("حُفظت الاقتراحات");
      await onSaved();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر الحفظ");
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <p className="text-read font-black text-muted-foreground">
        دوراتٌ اقترحها وليست في كتالوجنا — سمِّ كلَّ واحدةٍ ثمّ اربِطها
      </p>
      <p className="mt-1 text-read leading-5 text-muted-foreground">
        اكتبها كما تريدها أن تُقرأ: لك أن تصحّح إملاءها أو تغيّر اسمها. والفقرةُ التي كتبها هو تبقى أدناه كما هي.
      </p>

      {rows.length === 0 ? (
        <p className="mt-2 text-read leading-6 text-muted-foreground">لا صفوفَ بعد — أضِف واحدا.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((r, i) => {
            /* الربطُ لا يُفتح لصفٍّ لم يُحفظ بعد: الخادمُ يقرأ الاقتراحَ من
               القاعدة بترتيبه، فصفٌّ في الشاشة وحدَها يُربط بغيره أو بفراغ. */
            const persisted = i < saved.length
              && saved[i].titleAr === r.titleAr.trim()
              && saved[i].audienceAr === r.audienceAr.trim();
            return (
              <li key={i} className="flex flex-wrap items-start gap-2">
                <BookOpen className="mt-2.5 h-3.5 w-3.5 shrink-0 text-teal-ink" />
                <input
                  value={r.titleAr} onChange={(e) => set(i, { titleAr: e.target.value })}
                  placeholder="اسمُ الدورة كما تريده"
                  aria-label={`اسمُ الاقتراح ${i + 1}`}
                  className={`${controlCls} min-w-0 flex-[2]`}
                />
                <input
                  value={r.audienceAr} onChange={(e) => set(i, { audienceAr: e.target.value })}
                  placeholder="لمن هي — اختياريّ"
                  aria-label={`جمهورُ الاقتراح ${i + 1}`}
                  className={`${controlCls} min-w-0 flex-1`}
                />
                <Button
                  tone="secondary" size="sm" disabled={!persisted}
                  onClick={() => onLink(i, proposalLine(saved[i]))}
                >
                  اربِطها
                </Button>
                <Button tone="ghost" size="sm" icon={Trash2} aria-label={`احذف الاقتراح ${i + 1}`}
                  onClick={() => setRows((cur) => cur.filter((_, k) => k !== i))} />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button tone="secondary" size="sm" icon={Plus} disabled={rows.length >= MAX_PROPOSALS}
          onClick={() => setRows((cur) => [...cur, emptyProposal()])}>
          أضِف دورة
        </Button>
        {dirty && (
          <Button tone="confirm" size="sm" disabled={busy} onClick={() => void save()}>
            احفظ الاقتراحات
          </Button>
        )}
        {dirty && (
          <span className="text-read leading-5 text-gold-ink">احفِظ أوّلا ليُفتح «اربِطها».</span>
        )}
      </div>

      {teachableOther && (
        <Inset as="div" className="mt-3 px-3 py-2">
          <p className="text-read font-bold text-muted-foreground">وما كتبه هو بقلمه — يبقى كما هو</p>
          <p className="mt-1 whitespace-pre-line text-read leading-6">{teachableOther}</p>
        </Inset>
      )}

      <p className="mt-2 text-read leading-5 text-muted-foreground">
        و«اربِطها» تجعلها نسخةً من دورةٍ قريبة، أو دورةً جديدةً بمهاراتها — فتصير طلبَ تغييرٍ في طابور الكتالوج.
      </p>
    </div>
  );
}

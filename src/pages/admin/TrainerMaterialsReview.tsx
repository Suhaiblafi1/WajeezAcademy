/* موادُّ دورات المدرّب — تُقرأ حيث يُقرَّر فيها (٣٠ سبتمبر ٢٠٢٦).

   كان «أعلن اكتمالَ موادّه» خبرا بلا موادّ: لا شيءَ في المنصّة يُقرأ قبل
   أن يُعتمَد. فصار المدرّبُ يكتبها في «مؤهّلاتي»، وتُقرأ هنا دورةً دورة،
   و«اعتمِدْ موادَّ هذه الدورة» يؤهّله لها — وهو ما يعدّه قرارُ التفعيل. */

import { useState } from "react";
import { CheckCircle2, FileStack, Loader2 } from "lucide-react";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { toast, toastError } from "@/components/Toast";
import { apiGet, apiPost, permissionMessage } from "@/services/api";
import type { CourseMaterials } from "@/application/trainer/course-materials";

interface Row {
  courseId: string;
  titleAr: string;
  status: string;
  materials: CourseMaterials | null;
  materialsAt: string | null;
  missingAr: string[];
}

export default function MaterialsReview({ profileId }: { profileId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try { setRows(await apiGet<Row[]>(`/api/admin/trainers/${profileId}/materials`)); }
    catch (e) { toastError(permissionMessage(e, "تعذّرت قراءةُ موادّه")); }
  };

  const approve = async (courseId: string) => {
    setBusy(courseId);
    try {
      await apiPost(`/api/admin/trainers/${profileId}/qualifications`, { courseId, note: "اعتُمدت موادُّها" });
      toast("اعتُمدت موادُّ الدورة — وأُهِّل لها");
      await load();
    } catch (e) {
      toastError(permissionMessage(e, "تعذّر الاعتماد"));
    } finally {
      setBusy(null);
    }
  };

  if (!open) {
    return (
      <Button size="sm" className="mt-2" icon={FileStack} onClick={() => { setOpen(true); void load(); }}>
        اعرض موادَّ دوراته
      </Button>
    );
  }
  if (!rows) return <Loader2 className="mt-2 h-5 w-5 animate-spin text-muted-foreground/60" aria-label="جارٍ التحميل" />;
  if (rows.length === 0) {
    return <p className="mt-2 text-read text-muted-foreground">لا دورةَ قيد الإعداد ولا معتمدة لهذا المدرّب.</p>;
  }

  return (
    <ul className="mt-3 grid gap-2">
      {rows.map((r) => (
        <li key={r.courseId}>
          <Inset tone="default" className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 flex-1 text-read font-bold">{r.titleAr}</p>
              {r.status === "qualified"
                ? <Chip tone="positive" srPrefixAr="الحال">معتمَدة</Chip>
                : r.missingAr.length === 0
                  ? <Chip tone="accent" srPrefixAr="الحال">كاملة — تنتظر قرارك</Chip>
                  : <Chip tone="warn" srPrefixAr="الحال">ناقصة</Chip>}
            </div>
            {r.missingAr.length > 0 && r.status !== "qualified" && (
              <p className="mt-1 text-read text-muted-foreground">ينقصها: {r.missingAr.join("، ")}</p>
            )}
            {r.materials && (
              <div className="mt-2 grid gap-1.5 text-read leading-7">
                <ol className="list-decimal ps-5">
                  {r.materials.modules.map((m, i) => (
                    <li key={i}><b>{m.titleAr}</b>{m.outcomeAr ? ` — ${m.outcomeAr}` : ""}</li>
                  ))}
                </ol>
                {r.materials.materialsUrl && (
                  <p>الموادّ: <a className="text-teal-light-ink underline" href={r.materials.materialsUrl} target="_blank" rel="noreferrer noopener" dir="ltr">{r.materials.materialsUrl}</a></p>
                )}
                {r.materials.taskAr && <p className="whitespace-pre-line">المهمّة: {r.materials.taskAr}</p>}
                {r.materials.sourcesAr && <p className="whitespace-pre-line">المصادر: {r.materials.sourcesAr}</p>}
                {r.materials.noteAr && <p className="whitespace-pre-line text-muted-foreground">ملحوظتُه: {r.materials.noteAr}</p>}
              </div>
            )}
            {r.status === "pending" && (
              <Button size="sm" tone="confirm" className="mt-2" icon={CheckCircle2}
                loading={busy === r.courseId} disabled={r.missingAr.length > 0}
                onClick={() => void approve(r.courseId)}>
                اعتمِدْ موادَّ هذه الدورة
              </Button>
            )}
          </Inset>
        </li>
      ))}
    </ul>
  );
}

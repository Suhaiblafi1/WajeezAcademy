/* دوراتُ المدرّب في طور الإعداد — تُقرأ حيث يُقرَّر فيها.

   ═══ ومنذ ٢ أكتوبر ٢٠٢٦ تُقرأ في شعبها ═══

   كانت هنا موادُّ كلِّ دورةٍ كما كتبها المدرّبُ في «مؤهّلاتي»، وزرُّ «اعتمِدْ
   موادَّ هذه الدورة». ثمّ صار الطورُ كلُّه في «شعبي» (`trainer-prep.service.ts`):
   يقبل الدورةَ فتُنشأ لها شعبةُ إعداد، يعبّئها ويرسلها، و**اعتمادُ خطّتها
   يعتمد الدورة** — واعتمادُ آخرها يفعّله. فهذا اللوحُ يقول حالَ كلِّ دورة،
   ويفتح خطّتَها حيث تُعتمَد (`/admin/cohorts?cohort=…`)، لا يكرّرها.

   ويبقى لمن كتب موادَّه في اللوح القديم قبل هذا اليوم ولم يقبل شعبةً بعد
   ما كان له: تُقرأ موادُّه ويُعتمَد بها — فلا يُطالَب بكتابتها ثانية. */

import { useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, ExternalLink, FileStack, Loader2 } from "lucide-react";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { toast, toastError } from "@/components/Toast";
import { apiGet, apiPost, permissionMessage } from "@/services/api";
import type { CourseMaterials } from "@/application/trainer/course-materials";

type PrepState = "to_decide" | "preparing" | "submitted" | "returned" | "approved" | "declined";

interface PrepRow {
  courseId: string;
  titleAr: string;
  state: PrepState;
  cohortId: string | null;
  cohortTitle: string | null;
  declineReasonAr: string | null;
  approved?: boolean;
}

interface MaterialsRow {
  courseId: string;
  titleAr: string;
  status: string;
  materials: CourseMaterials | null;
  missingAr: string[];
}

const STATE_AR: Record<PrepState, { label: string; tone: "warn" | "info" | "positive" | "neutral" | "accent" }> = {
  to_decide: { label: "لم يقرّر بعد", tone: "neutral" },
  preparing: { label: "يُعِدّها في «شعبي»", tone: "info" },
  returned: { label: "رُدّت إليه بملاحظات", tone: "warn" },
  submitted: { label: "أُرسلت — تنتظر قرارك", tone: "accent" },
  approved: { label: "معتمَدة", tone: "positive" },
  declined: { label: "اعتذر عنها", tone: "neutral" },
};

export default function MaterialsReview({ profileId }: { profileId: string }) {
  const [prep, setPrep] = useState<PrepRow[] | null>(null);
  const [legacy, setLegacy] = useState<MaterialsRow[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const [p, m] = await Promise.all([
        apiGet<PrepRow[]>(`/api/admin/trainers/${profileId}/prep`),
        apiGet<MaterialsRow[]>(`/api/admin/trainers/${profileId}/materials`).catch(() => [] as MaterialsRow[]),
      ]);
      setPrep(p); setLegacy(m);
    } catch (e) { toastError(permissionMessage(e, "تعذّرت قراءةُ دوراته")); }
  };

  /* اعتمادٌ بموادّ اللوح القديم — لمن كتبها قبل ٢ أكتوبر ٢٠٢٦ ولم يقبل شعبة */
  const approveLegacy = async (courseId: string) => {
    setBusy(courseId);
    try {
      await apiPost(`/api/admin/trainers/${profileId}/qualifications`, { courseId, note: "اعتُمدت موادُّها" });
      toast("اعتُمدت الدورة — وأُهِّل لها");
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
        اعرض دوراتِه وشعبَ إعدادها
      </Button>
    );
  }
  if (!prep) return <Loader2 className="mt-2 h-5 w-5 animate-spin text-muted-foreground/60" aria-label="جارٍ التحميل" />;
  /* والمعتمَدةُ بلا شعبةٍ تأتي في قائمة الإعداد منذ ٣ أكتوبر ٢٠٢٦ — فتُعرض مرّةً:
     ما لم يقبله بعدُ يُقرأ «معتمَدة» تحت، وما قبِله يُقرأ بحال شعبته فوق */
  const shown = prep.filter((r) => !(r.approved && r.state === "to_decide"));
  const inPrep = new Set(shown.map((r) => r.courseId));
  const qualified = legacy.filter((r) => r.status === "qualified" && !inPrep.has(r.courseId));
  if (shown.length === 0 && qualified.length === 0) {
    return <p className="mt-2 text-read text-muted-foreground">لا دورةَ قيد الإعداد ولا معتمدة لهذا المدرّب.</p>;
  }

  return (
    <ul className="mt-3 grid gap-2">
      {shown.map((r) => {
        const s = STATE_AR[r.state];
        const old = legacy.find((x) => x.courseId === r.courseId && x.status === "pending");
        const oldReady = !r.cohortId && old?.materials && old.missingAr.length === 0;
        return (
          <li key={r.courseId}>
            <Inset tone="default" className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 flex-1 text-read font-bold">{r.titleAr}</p>
                <Chip tone={s.tone} srPrefixAr="الحال">{s.label}</Chip>
              </div>
              {r.declineReasonAr && <p className="mt-1 text-read text-muted-foreground">سببُه: {r.declineReasonAr}</p>}
              {r.cohortId && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button as={Link} to={`/admin/cohorts?cohort=${r.cohortId}`} size="sm" icon={ExternalLink}>
                    {r.state === "submitted" ? "افتح خطّتَها واعتمدها" : "افتح شعبتَها"}
                  </Button>
                  {r.cohortTitle && <span className="text-read text-muted-foreground">{r.cohortTitle}</span>}
                </div>
              )}
              {oldReady && old?.materials && (
                <div className="mt-2 grid gap-1.5 text-read leading-7">
                  <p className="text-muted-foreground">كتب موادَّها في اللوح القديم قبل ٢ أكتوبر ٢٠٢٦ — تُعتمَد بها، أو ينقلها بقبول الدورة إلى شعبتها.</p>
                  <ol className="list-decimal ps-5">
                    {old.materials.modules.map((m, i) => (
                      <li key={i}><b>{m.titleAr}</b>{m.outcomeAr ? ` — ${m.outcomeAr}` : ""}</li>
                    ))}
                  </ol>
                  {old.materials.materialsUrl && (
                    <p>الموادّ: <a className="text-teal-light-ink underline" href={old.materials.materialsUrl} target="_blank" rel="noreferrer noopener" dir="ltr">{old.materials.materialsUrl}</a></p>
                  )}
                  <div>
                    <Button size="sm" tone="confirm" icon={CheckCircle2} loading={busy === r.courseId}
                      onClick={() => void approveLegacy(r.courseId)}>
                      اعتمِدْ هذه الدورة بموادّها
                    </Button>
                  </div>
                </div>
              )}
            </Inset>
          </li>
        );
      })}
      {qualified.map((r) => (
        <li key={r.courseId}>
          <Inset tone="default" className="flex flex-wrap items-center justify-between gap-2 p-3">
            <p className="min-w-0 flex-1 text-read font-bold">{r.titleAr}</p>
            <Chip tone="positive" srPrefixAr="الحال">معتمَدة</Chip>
          </Inset>
        </li>
      ))}
    </ul>
  );
}

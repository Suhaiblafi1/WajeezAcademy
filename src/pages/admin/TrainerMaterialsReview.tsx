/* دوراتُ المدرّب في طور الإعداد — تُقرأ حيث يُقرَّر فيها.

   ═══ ومنذ ٢ أكتوبر ٢٠٢٦ تُقرأ في شعبها ═══

   كانت هنا موادُّ كلِّ دورةٍ كما كتبها المدرّبُ في «مؤهّلاتي»، وزرُّ «اعتمِدْ
   موادَّ هذه الدورة». ثمّ صار الطورُ كلُّه في «شعبي» (`trainer-prep.service.ts`):
   يقبل الدورةَ فتُنشأ لها شعبةُ إعداد، يعبّئها ويرسلها، و**اعتمادُ خطّتها
   يعتمد الدورة** — واعتمادُ آخرها يفعّله. فهذا اللوحُ يقول حالَ كلِّ دورة،
   ويفتح خطّتَها حيث تُعتمَد، لا يكرّرها: المرسَلةُ في «خططٌ تنتظر اعتمادك»
   مرشَّحةً بخططه (`/admin/pending-plans?trainer=…`)، وما سواها في بطاقة شعبتها.

   وكان يبقى لمن كتب موادَّه في اللوح القديم قبله ولم يقبل شعبةً زرُّ «اعتمد هذه الدورة بموادّها». وذهب (٢٧ أكتوبر
   ٢٠٢٦، المرحلة الثامنة): كان يؤهّله ويقول «اعتمدت» — و«معتمدة» لا تُقال إلّا لما اعتمدناه نحن (٢٤ أكتوبر)، ودورةٌ
   معتمدةٌ خطّةُ شعبةٍ اعتمدناها لا تأهيلٌ وحدَه (٢٠ أكتوبر). فطريقُه اليومَ طريقُ غيره: يقبلها فتُنشأ شعبتُها. */

import { useState } from "react";
import { Link } from "react-router";
import { ExternalLink, FileStack, Loader2 } from "lucide-react";
import { Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { toastError } from "@/components/Toast";
import { apiGet, permissionMessage } from "@/services/api";
import { countAr } from "@/application/text/count-ar";
import { fmtDate } from "@/application/text/format-ar";
import { postponedLineAr } from "@/application/trainer/plan-postpone";

type PrepState = "to_decide" | "preparing" | "submitted" | "returned" | "approved" | "declined";

interface PrepRow {
  courseId: string;
  titleAr: string;
  state: PrepState;
  cohortId: string | null;
  cohortTitle: string | null;
  declineReasonAr: string | null;
  approved?: boolean;
  /** أُجّلت خطّتُها إلى موسمٍ قادم — فتُقرأ مؤجّلةً لا مردودة (١٨ أكتوبر ٢٠٢٦) */
  postponedTo?: string | null;
}

interface MaterialsRow {
  courseId: string;
  titleAr: string;
  status: string;
  /** كيف اعتُمدت — شعبتُها أو تأهيلٌ مباشر، ومن ومتى (١٧ أكتوبر ٢٠٢٦، `approvalsOf`) */
  approval?: { cohortId: string | null; cohortTitle: string | null; byAr: string | null; at: string | null } | null;
}

/* ═══ «هل قام بإعداد الشعب؟ هل اعتمدتُها أنا؟» (صاحب المنصّة، ١٧ أكتوبر ٢٠٢٦) ═══
   وسمُ «معتمدة» وحدَه لا يفرّق بين خطّة شعبةٍ اعتُمدت وتأهيلٍ مباشرٍ بلا شعبة. فيُقال تحته
   أيُّهما، ومن أهّله ومتى — نصٌّ قصيرٌ بلا تشكيل. */
function approvalLineAr(a: NonNullable<MaterialsRow["approval"]>): string {
  const how = a.cohortId ? `اعتمدت خطة شعبتها${a.cohortTitle ? ` «${a.cohortTitle}»` : ""}` : "اعتمدت له مباشرة — بلا شعبة ولا خطة";
  const who = [a.byAr, a.at ? fmtDate(a.at) : null].filter(Boolean).join(" · ");
  return who ? `${how} · ${who}` : how;
}

const STATE_AR: Record<PrepState, { label: string; tone: "warn" | "info" | "positive" | "neutral" | "accent" }> = {
  to_decide: { label: "مؤهل لها — لم يوافق بعد", tone: "neutral" },
  preparing: { label: "وافق — يكتب خطتها", tone: "info" },
  returned: { label: "ردّت إليه بملاحظات", tone: "warn" },
  submitted: { label: "أرسلت — تنتظر قرارك", tone: "accent" },
  approved: { label: "اعتمدت خطتها", tone: "positive" },
  declined: { label: "اعتذر عنها", tone: "neutral" },
};

export default function MaterialsReview({ profileId }: { profileId: string }) {
  const [prep, setPrep] = useState<PrepRow[] | null>(null);
  const [materials, setMaterials] = useState<MaterialsRow[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      const [p, m] = await Promise.all([
        apiGet<PrepRow[]>(`/api/admin/trainers/${profileId}/prep`),
        apiGet<MaterialsRow[]>(`/api/admin/trainers/${profileId}/materials`).catch(() => [] as MaterialsRow[]),
      ]);
      setPrep(p); setMaterials(m);
    } catch (e) { toastError(permissionMessage(e, "تعذّرت قراءة دوراته")); }
  };

  if (!open) {
    return (
      <Button size="sm" className="mt-2" icon={FileStack} onClick={() => { setOpen(true); void load(); }}>
        اعرض دوراته وشعب إعدادها
      </Button>
    );
  }
  if (!prep) return <Loader2 className="mt-2 h-5 w-5 animate-spin text-muted-foreground/60" aria-label="جار التحميل" />;
  /* والمعتمَدةُ بلا شعبةٍ تأتي في قائمة الإعداد منذ ٣ أكتوبر ٢٠٢٦ — فتُعرض مرّةً:
     ما لم يقبله بعدُ يُقرأ «معتمَدة» تحت، وما قبِله يُقرأ بحال شعبته فوق */
  const shown = prep.filter((r) => !(r.approved && r.state === "to_decide"));
  const inPrep = new Set(shown.map((r) => r.courseId));
  const qualified = materials.filter((r) => r.status === "qualified" && !inPrep.has(r.courseId));
  if (shown.length === 0 && qualified.length === 0) {
    return <p className="mt-2 text-read text-muted-foreground">هذا المدرب غير مؤهل لأي دورة بعد.</p>;
  }

  /* ═══ وخططُه المرسَلةُ معا (٣ أكتوبر ٢٠٢٦) ═══
     «كيف أعتمد كلَّ شعبةٍ أنهاها؟» — بابٌ واحدٌ لها كلِّها، مرشَّحٌ به وحدَه */
  const sent = shown.filter((r) => r.state === "submitted" && r.cohortId).length;

  return (
    <>
      {sent > 1 && (
        <p className="mt-3 text-read leading-6 text-muted-foreground">
          {sent === 2 ? "خطّتان تنتظران قرارك" : `${countAr(sent, { one: "خطّة تنتظر", two: "خطّتان تنتظران", few: "خطط تنتظر", many: "خطّة تنتظر" })} قرارك`} —{" "}
          <Link to={`/admin/pending-plans?trainer=${profileId}`} className="font-bold text-teal-light-ink underline">
            اقرأها واعتمدها معا في «خطط تنتظر اعتمادك»
          </Link>
        </p>
      )}
      <ul className="mt-3 grid gap-2">
        {shown.map((r) => {
          const s = r.postponedTo ? { label: postponedLineAr(r.postponedTo), tone: "neutral" as const } : STATE_AR[r.state];
          return (
            <li key={r.courseId}>
              <Inset tone="default" className="p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 text-read font-bold">{r.titleAr}</p>
                  <Chip tone={s.tone} srPrefixAr="الحال">{s.label}</Chip>
                </div>
                {r.declineReasonAr && <p className="mt-1 text-read text-muted-foreground">سببه: {r.declineReasonAr}</p>}
                {r.cohortId && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {/* المرسَلةُ تُفتح في «خططٌ تنتظر اعتمادك» مع أخواتها من خططه —
                        وما سواها في بطاقة شعبتها حيث تُدار */}
                    <Button as={Link}
                      to={r.state === "submitted"
                        ? `/admin/pending-plans?trainer=${profileId}&cohort=${r.cohortId}`
                        : `/admin/cohorts?cohort=${r.cohortId}`}
                      size="sm" icon={ExternalLink}>
                      {r.state === "submitted" ? "افتح خطّتها واعتمدها" : "افتح شعبتها"}
                    </Button>
                    {r.cohortTitle && <span className="text-read text-muted-foreground">{r.cohortTitle}</span>}
                  </div>
                )}
              </Inset>
            </li>
          );
        })}
        {qualified.map((r) => (
          <li key={r.courseId}>
            <Inset tone="default" className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 flex-1 text-read font-bold">{r.titleAr}</p>
                <Chip tone="positive" srPrefixAr="الحال">مؤهل لها</Chip>
              </div>
              {r.approval && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-read text-muted-foreground">{approvalLineAr(r.approval)}</p>
                  {r.approval.cohortId && (
                    <Button as={Link} to={`/admin/cohorts?cohort=${r.approval.cohortId}`} size="sm" icon={ExternalLink}>
                      افتح شعبتها
                    </Button>
                  )}
                </div>
              )}
            </Inset>
          </li>
        ))}
      </ul>
    </>
  );
}

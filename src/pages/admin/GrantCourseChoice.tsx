/* اختيارُ دورات المنحة — لكلّ حملةٍ في شاشتها، ولكلّ مؤثّرٍ في صفّه (١٥ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: يختار المديرُ دوراتِ كلّ منحة، فلا تُعرض في صفحتها إلّا هي. **والكودُ يخصم على أيّ دورةٍ حتى حدّه**
   — «Discount all courses»: القائمةُ للصفحة وحدَها. والافتراضيُّ «تلقائي»: كلُّ دورةٍ متاحة كما كان. وللمؤثّر بعضُ دورات
   حملته، وإن لم يبقَ له منها شيءٌ فقائمتُها كلُّها («Full grant list»).

   فهنا خياران ظاهران — «تلقائي» و«أختار الدورات» — وقائمةٌ بعلامات، ثمّ الحفظُ بتأكيدٍ يقول ما يقع: ما يظهر في الصفحة،
   وأنّ الكودَ يعمل على أيّ دورةٍ حتى حدّه، وأنّ الدورةَ الجديدة لا تظهر حتى تُضاف. والعودةُ إلى التلقائيّ
   خيارٌ لا يُخفى. والعلّةُ في `server/services/grant-scope.service.ts`.

   ═══ وما لا شعبةَ له لا يُعرض (١٥ نوفمبر ٢٠٢٦) ═══

   «اجعلني أرى الدورات التي لها شعب فقط، واجعلني أرى اسم المدرب ومتى تبدأ أول شعبة». فالقائمةُ ما له شعبةٌ تُشترى الآن،
   وتحت كلّ دورةٍ مدرّبُ أقرب شعبةٍ ويومُ بدئها. وما اختير قبلُ ولا شعبةَ له الآن يبقى مختارا ولا يُعرض. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPut, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import ConfirmAction from "@/components/ConfirmAction";
import ListToolbar from "@/components/admin/ListToolbar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { countAr } from "@/application/text/count-ar";
import { cohortDayAr } from "@/application/learning/cohort-gate";
import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

interface Choice {
  auto: boolean;
  courseIds: string[];
  courses: { courseId: string; titleAr: string; shown: boolean; trainerName: string | null; startsAt: string | null }[];
}

/** «3 دورات» و«دورتان» — بصيغة العدد */
const coursesCountAr = (n: number) => (n === 2 ? "دورتان" : countAr(n, { one: "دورة", two: "دورتان", few: "دورات", many: "دورة" }));

export default function GrantCourseChoice({ endpoint, forInfluencer = false, onSaved }: {
  /** بابُ القراءة والحفظ نفسُه — `GET` و`PUT` */
  endpoint: string;
  forInfluencer?: boolean;
  onSaved?: () => void;
}) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [auto, setAuto] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const fill = (c: Choice) => {
    setChoice(c);
    setAuto(c.auto);
    setPicked(new Set(c.courseIds));
  };
  const load = useCallback(async () => {
    try { fill(await apiGet<Choice>(endpoint)); } catch { setChoice(null); }
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(
    () => paginate((choice?.courses ?? []).filter((c) => matchesQuery(q, [c.titleAr])), page, 25),
    [choice, q, page],
  );

  if (!choice) return null;

  const ids = [...picked];
  const changed = auto !== choice.auto || (!auto && (ids.length !== choice.courseIds.length || ids.some((id) => !choice.courseIds.includes(id))));
  const canSave = changed && (auto || ids.length > 0);

  /* «أختار الدورات» يبدأ بما يظهر الآن — فلا يتغيّر شيءٌ حتى يرفع علامةً أو يضعها */
  const choose = () => {
    setAuto(false);
    if (picked.size === 0) setPicked(new Set(choice.courses.filter((c) => c.shown).map((c) => c.courseId)));
  };
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
  };

  const save = async () => {
    setBusy(true);
    try {
      fill(await apiPut<Choice>(endpoint, { courseIds: auto ? [] : ids }));
      toast("حفظت الدورات");
      setConfirm(false);
      onSaved?.();
    } catch (e) { toastError(e instanceof ApiError ? e.message : "تعذر حفظ الدورات"); }
    finally { setBusy(false); }
  };

  const where = forInfluencer ? "في صفحته" : "في صفحة المنحة";

  return (
    <Card className="mt-3">
      <p className="text-read font-bold">
        {choice.auto
          ? (forInfluencer ? "دوراته: كل دورات منحة المؤثرين" : "الدورات: تلقائي")
          : `${forInfluencer ? "دوراته" : "الدورات"}: اخترت ${coursesCountAr(choice.courseIds.length)}`}
      </p>
      <p className="mt-1 text-read leading-7 text-muted-foreground">
        {forInfluencer
          ? "تختار الدورات التي تظهر في صفحته من دورات منحة المؤثرين. والكود يعمل على أي دورة حتى حده."
          : "هذه القائمة تختار الدورات التي تظهر في صفحة المنحة. والكود يعمل على أي دورة حتى حده."}
      </p>

      <div className="mt-3 flex flex-wrap gap-4 text-read">
        <label className="flex items-center gap-2">
          <input type="radio" name={`${endpoint}-mode`} checked={auto} onChange={() => setAuto(true)} />
          {forInfluencer ? "كل دورات منحة المؤثرين" : "تلقائي: كل الدورات المتاحة"}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name={`${endpoint}-mode`} checked={!auto} onChange={choose} />
          أختار الدورات
        </label>
      </div>

      {!auto && (
        <div className="mt-3">
          {choice.courses.length === 0 ? (
            <p className="text-read text-muted-foreground">{forInfluencer ? "لا دورة لها شعبة في منحة المؤثرين الآن." : "لا دورة لها شعبة تشترى الآن."}</p>
          ) : (
            <>
              <ListToolbar q={q} onQ={setQ} onPage={setPage} view={shown} placeholder="ابحث باسم الدورة" unit="دورة" />
              <ul className="divide-y divide-border">
                {shown.rows.map((c) => (
                  <li key={c.courseId} className="py-2 text-read">
                    <label className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1.5" checked={picked.has(c.courseId)} onChange={() => toggle(c.courseId)} />
                      <span>
                        <span className="block font-bold">{c.titleAr}</span>
                        <span className="block text-muted-foreground">
                          {c.trainerName ? `المدرب: ${c.trainerName}` : "بلا مدرب منشور"}
                          {c.startsAt && ` · تبدأ أول شعبة ${cohortDayAr(c.startsAt)}`}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-read text-muted-foreground">
                {ids.length === 0 ? "اختر دورة واحدة على الأقل، أو اختر التلقائي." : `اخترت ${coursesCountAr(ids.length)}.`}
              </p>
            </>
          )}
        </div>
      )}

      <div className="mt-3">
        <Button size="sm" disabled={busy || !canSave} onClick={() => setConfirm(true)}>احفظ الدورات</Button>
      </div>

      {confirm && (
        <ConfirmAction
          tone="default" titleAr={forInfluencer ? "حفظ دورات المؤثر" : "حفظ دورات المنحة"} confirmLabelAr="احفظ" busy={busy}
          onCancel={() => setConfirm(false)} onConfirm={() => void save()}
        >
          <ul className="list-disc space-y-1 ps-5">
            {auto ? (
              forInfluencer
                ? <li>تعود دوراته كل دورات منحة المؤثرين.</li>
                : <li>تعود تلقائية: تظهر كل دورة متاحة، والدورة الجديدة تظهر وحدها.</li>
            ) : (
              <>
                <li>تظهر {where} {coursesCountAr(ids.length)} وحدها.</li>
                <li>الدورة الجديدة لا تظهر حتى تضيفها.</li>
              </>
            )}
            <li>والكود يعمل على أي دورة حتى حده، ظهرت في الصفحة أو لم تظهر.</li>
          </ul>
        </ConfirmAction>
      )}
    </Card>
  );
}

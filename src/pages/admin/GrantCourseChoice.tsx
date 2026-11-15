/* اختيارُ دورات المنحة — لكلّ حملةٍ في شاشتها، ولكلّ مؤثّرٍ في صفّه (١٥ نوفمبر ٢٠٢٦).

   قرارُ صاحب المنصّة: يختار المديرُ دوراتِ كلّ منحة، فلا تُعرض في صفحتها ولا يخصم كودُها إلّا عليها، وما سواها في
   السلّة بسعره كاملا. والافتراضيُّ «تلقائي»: كلُّ دورةٍ متاحة كما كان. وللمؤثّر بعضُ دورات حملته وحدَها.

   فهنا خياران ظاهران — «تلقائي» و«أختار الدورات» — وقائمةٌ بعلامات، ثمّ الحفظُ بتأكيدٍ يقول ما يقع: ما يظهر، وما يخصم
   عليه الكود، وأنّ الدورةَ الجديدة لا تظهر حتى تُضاف، وأنّ كودا اشتُري به يبقى بدوراته يومها. والعودةُ إلى التلقائيّ
   خيارٌ لا يُخفى. ومن الدورات ما لا يظهر الآن (بلا شعبةٍ تُشترى) — يُقال بجانبه. والعلّةُ في
   `server/services/grant-scope.service.ts`. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPut, ApiError } from "@/services/api";
import { toast, toastError } from "@/components/Toast";
import ConfirmAction from "@/components/ConfirmAction";
import ListToolbar from "@/components/admin/ListToolbar";
import { matchesQuery } from "@/application/text/search-ar";
import { paginate } from "@/application/admin/paginate";
import { countAr } from "@/application/text/count-ar";
import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

interface Choice {
  auto: boolean;
  courseIds: string[];
  courses: { courseId: string; titleAr: string; shown: boolean }[];
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
  const whose = forInfluencer ? "كود من جاء به" : "كودها";

  return (
    <Card className="mt-3">
      <p className="text-read font-bold">
        {choice.auto
          ? (forInfluencer ? "دوراته: كل دورات منحة المؤثرين" : "الدورات: تلقائي")
          : `${forInfluencer ? "دوراته" : "الدورات"}: اخترت ${coursesCountAr(choice.courseIds.length)}`}
      </p>
      <p className="mt-1 text-read leading-7 text-muted-foreground">
        {forInfluencer
          ? "تختار له من دورات منحة المؤثرين. تظهر في صفحته، ويخصم عليها كود من جاء به وحدها."
          : "تلقائي: كل دورة متاحة تظهر، ويخصم الكود على أي دورة. وإن اخترت: تظهر الدورات التي اخترتها وحدها، ويخصم الكود عليها وحدها، وما سواها في السلة بسعره كاملا."}
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
            <p className="text-read text-muted-foreground">{forInfluencer ? "لا دورة في منحة المؤثرين الآن." : "لا دورة منشورة بعد."}</p>
          ) : (
            <>
              <ListToolbar q={q} onQ={setQ} onPage={setPage} view={shown} placeholder="ابحث باسم الدورة" unit="دورة" />
              <ul className="divide-y divide-border">
                {shown.rows.map((c) => (
                  <li key={c.courseId} className="py-2 text-read">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={picked.has(c.courseId)} onChange={() => toggle(c.courseId)} />
                      <span className="font-bold">{c.titleAr}</span>
                      {!c.shown && <span className="text-muted-foreground">· لا شعبة تشترى الآن، فلا تظهر</span>}
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
                : <li>تعود تلقائية: تظهر كل دورة متاحة، ويخصم الكود على أي دورة. والدورة الجديدة تظهر وحدها.</li>
            ) : (
              <>
                <li>تظهر {where} {coursesCountAr(ids.length)} وحدها، ويخصم عليها {whose}. وما سواها في السلة بسعره كاملا.</li>
                <li>الدورة الجديدة لا تظهر حتى تضيفها.</li>
              </>
            )}
            <li>الكود الذي لم يشتر به أحد يتبع هذه القائمة. والكود الذي اشتري به يبقى بدوراته يوم أول شراء.</li>
          </ul>
        </ConfirmAction>
      )}
    </Card>
  );
}

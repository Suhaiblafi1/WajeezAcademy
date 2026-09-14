/* «دوراتٌ ليست في كتالوجنا» — من نصٍّ يُقرأ مرّةً إلى بندٍ في طابور.

   ═══ العطبُ الذي كُتب له ═══

   نموذجُ الانضمام يسأل المتقدّمَ عن دوراتٍ يقدر عليها وليست عندنا، ويحفظ
   جوابَه نصّا حرّا. ويُعرض في ملفّه، ثمّ **يموت هناك**: لا زرَّ يمسّه ولا
   طابورَ يصل إليه. فأثمنُ ما في الطلب — ما يعرفه هو ولا نعرفه — يُنسى.

   وقرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «لا يجب أن تكون فقط ملاحظات، وإنّما
   خانةٌ تُعامل وكأنّها نسخةٌ جديدةٌ من دورةٍ تُربط بها، أو دورةٌ جديدةٌ تُربط
   بمهاراتٍ معيّنة».

   ═══ ولماذا نافذةٌ هنا لا حقلٌ في الملفّ ═══

   `ApplicationDossier` تعرضه **صفحةُ المراجعة الخارجيّةُ** أيضا (`/r/:token`)
   لمراجعٍ بلا حساب. فزرٌّ يُنشئ طلبَ تغييرٍ على الكتالوج لا يسكن هناك — هذا
   عملُ الإدارة وحدَها. */

import { useEffect, useState } from "react";
import { toast, toastError } from "@/components/Toast";
import Modal from "@/components/Modal";
import Button from "@/components/ui/Button";
import { Card, Inset } from "@/components/ui/Surface";
import { staffControlCls as controlCls } from "@/components/FormKit";
import { apiGet, apiPost, ApiError } from "@/services/api";
import { matchesQuery } from "@/application/text/search-ar";
import { courses } from "@/data/courses";

interface SkillOpt { id: string; nameAr?: string; slug?: string }

export default function CourseSuggestionDialog({
  applicationId, trainerWordsAr, proposalIndex, onClose,
}: {
  applicationId: string
  /** كلامُ المتقدّم بنصّه — يبقى أمام عين من يربط، فلا يُربط من ذاكرة */
  trainerWordsAr: string | null
  /** ترتيبُ الاقتراح المقصود — يغيب في الطلبات التي سبقت السجلّات */
  proposalIndex?: number
  onClose: () => void
}) {
  const [kind, setKind] = useState<"variant" | "new_course">("variant");
  const [courseId, setCourseId] = useState("");
  /* عنوانُه هو عنوانُ السجلّ — من ربط اقتراحا لا يعيد كتابةَ ما كتبه صاحبُه */
  const [titleAr, setTitleAr] = useState(trainerWordsAr?.split(" — ")[0] ?? "");
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [noteAr, setNoteAr] = useState("");
  const [skills, setSkills] = useState<SkillOpt[]>([]);
  /* المهاراتُ مئاتٌ في كتالوجٍ ناضج — وقائمةٌ تطول بلا بحثٍ تُختار منها الأولى */
  const [skillQ, setSkillQ] = useState("");
  const [busy, setBusy] = useState(false);

  /* المهاراتُ تُجلب عند الفتح لا عند تحميل الشاشة: أكثرُ من يفتح ملفّا لا
     يربط مقترحا، فلا يُحمَّل ما لا يُستعمل. */
  useEffect(() => {
    if (kind !== "new_course" || skills.length) return;
    void apiGet<SkillOpt[]>("/api/admin/catalog/skills")
      .then(setSkills)
      .catch(() => { /* يبقى الربطُ ممكنا بلا مهارات — وهي اختياريّة */ });
  }, [kind, skills.length]);

  const ready = kind === "variant" ? Boolean(courseId) : titleAr.trim().length >= 3;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await apiPost("/api/admin/catalog/course-suggestions", {
        applicationId,
        noteAr: noteAr.trim() || undefined,
        ...(proposalIndex === undefined ? {} : { proposalIndex }),
        ...(kind === "variant"
          ? { kind: "variant", courseId }
          : { kind: "new_course", titleAr: titleAr.trim(), skillIds }),
      });
      toast("أُضيف المقترحُ إلى طابور طلبات التغيير");
      onClose();
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : "تعذّر إضافةُ المقترح");
    } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} label="ربطُ مقترحِ دورة" panelClassName="w-full max-w-xl">
      <Card className="max-h-[85vh] overflow-y-auto p-5">
        <h2 className="text-base font-black">اربِط ما كتبه بالكتالوج</h2>
        <p className="mt-1 text-read leading-6 text-muted-foreground">
          يصير طلبَ تغييرٍ في الطابور القائم — يُراجَع كسائرِ ما يُقترح على الكتالوج، ولا يُطبَّق بلا اعتماد.
        </p>

        {trainerWordsAr && (
          <Inset as="p" className="mt-3 whitespace-pre-line px-3 py-2 text-read leading-6">
            <span className="font-bold text-muted-foreground">بقلمه: </span>{trainerWordsAr}
          </Inset>
        )}

        <fieldset className="mt-4">
          <legend className="text-fine font-bold text-muted-foreground">ما هو هذا المقترح؟</legend>
          <div className="mt-2 space-y-2">
            <label className="flex cursor-pointer items-start gap-2 text-read leading-6">
              <input type="radio" name="kind" checked={kind === "variant"} onChange={() => setKind("variant")} className="mt-1 accent-gold" />
              <span>
                <span className="font-bold text-foreground">نسخةٌ من دورةٍ عندنا</span>
                <span className="block text-muted-foreground">قريبةٌ من دورةٍ في الكتالوج — يُقرأ المقترحُ مع تلك الدورة حيث يعمل مؤلّفُها.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-read leading-6">
              <input type="radio" name="kind" checked={kind === "new_course"} onChange={() => setKind("new_course")} className="mt-1 accent-gold" />
              <span>
                <span className="font-bold text-foreground">دورةٌ جديدةٌ بمهاراتها</span>
                <span className="block text-muted-foreground">لا شبيهَ لها عندنا — يُفتح لها مقترحٌ باسمه ومهاراته.</span>
              </span>
            </label>
          </div>
        </fieldset>

        {kind === "variant" ? (
          <div className="mt-4">
            <label className="block text-fine font-bold text-muted-foreground" htmlFor="sug-course">الدورةُ القريبة</label>
            <select id="sug-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} className={`${controlCls} mt-1 w-full`}>
              <option value="">اختر دورة…</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        ) : (
          <>
            <div className="mt-4">
              <label className="block text-fine font-bold text-muted-foreground" htmlFor="sug-title">عنوانُ الدورة المقترحة</label>
              <input id="sug-title" value={titleAr} onChange={(e) => setTitleAr(e.target.value)}
                placeholder="مثال: تحليلُ البيانات بـPython للمبتدئين" className={`${controlCls} mt-1 w-full`} />
            </div>
            <div className="mt-3">
              <label className="block text-fine font-bold text-muted-foreground" htmlFor="sug-skills">
                المهاراتُ التي تبنيها — اختياريّة، وتُفيد من يؤلّفها
              </label>
              <input
                value={skillQ} onChange={(e) => setSkillQ(e.target.value)}
                placeholder="ابحث في المهارات…" aria-label="ابحث في المهارات"
                className={`${controlCls} mt-1 w-full`}
              />
              <select
                id="sug-skills" multiple size={5} value={skillIds}
                onChange={(e) => setSkillIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                className={`${controlCls} mt-1.5 w-full`}
              >
                {/* المختارُ يبقى معروضا ولو خرج من نتيجة البحث — وإلّا رآه
                    المستعمِلُ يختفي فظنّ أنّه أُلغي، فأعاد اختيارَه ثانية. */}
                {skills
                  .filter((s) => skillIds.includes(s.id) || matchesQuery(skillQ, [s.nameAr, s.slug, s.id]))
                  .map((s) => <option key={s.id} value={s.id}>{s.nameAr ?? s.slug ?? s.id}</option>)}
              </select>
              {skills.length === 0 && (
                <p className="mt-1 text-read leading-5 text-muted-foreground">لا مهاراتٍ تُقرأ الآن — والمقترحُ يُضاف بلا مهارات.</p>
              )}
            </div>
          </>
        )}

        <div className="mt-3">
          <label className="block text-fine font-bold text-muted-foreground" htmlFor="sug-note">ملاحظتُك للمؤلّف</label>
          <textarea id="sug-note" rows={2} value={noteAr} onChange={(e) => setNoteAr(e.target.value)} className={`${controlCls} mt-1 w-full`} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button tone="confirm" disabled={!ready || busy} onClick={() => void submit()}>أضِفه إلى الطابور</Button>
          <Button tone="ghost" onClick={onClose}>إلغاء</Button>
        </div>
      </Card>
    </Modal>
  );
}

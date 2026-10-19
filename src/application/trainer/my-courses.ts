/* ═══ «دوراتي» — قائمةٌ واحدةٌ لكلّ دوراته، ولكلٍّ حالٌ واحدة (الخطوة F · ١٩ أكتوبر ٢٠٢٦) ═══

   درس صاحبُ المنصّة جانبَ المدرّب واختار («All, in order»): كانت الدورةُ تصل المدرّبَ من ثلاثة أبواب —
   دوراتُ طلبه (`/api/trainer/prep`)، وعروضُ الشعب (`/api/trainer/offers`)، وما أُسند إليه في «شعبي» —
   ولكلّ بابٍ أزرارُه وكلماتُ حاله. وما أُسند إليه مباشرةً لم يكن يُرى في «دوراتي» أصلا: الدورةُ التي
   له فيها شعبةٌ قائمةٌ تخرج من دورات الإعداد، ولا عرضَ لها فلا صفَّ لها — فيقرأ المدرّبُ النشطُ
   «لا دورة بعد» وهو يدرّس.

   فصار هنا **صفٌّ لكلّ دورة** من الأبواب كلّها، وحالُها كلمةٌ واحدة. والأبوابُ نفسُها باقيةٌ في
   الخادم كما هي — لا جدولَ جديدٌ ولا معادلة: هذا جمعٌ لما يُقرأ، وأفعالُ كلّ بابٍ تبقى أفعالَه.

   ═══ ومن أين تُقرأ الحال — الأولى فالأولى ═══

     ١. عرضٌ مفتوحٌ لم تنقضِ مهلتُه ← «تنتظر قرارك».
     ٢. دورةُ إعدادٍ لم يعتذر عنها ← حالُها هناك (قرارُه · يعدّها · رُدّت · أُرسلت).
     ٣. شعبُه فيها في «شعبي» ← تدرّسها (قائمةٌ أو معتمدةٌ خطّتُها) · يعدّها · رُدّت · أُرسلت · درّستها.
     ٤. آخرُ عرضٍ بُتّ فيه ← قبلتَه (تدرّسها) · سُحبت · اعتذرتَ · انقضت.
     ٥. دورةُ إعدادٍ اعتذر عنها ← اعتذرتَ.
     ٦. وما أُهِّل له ولا شيءَ ممّا سبق ← «معتمدة لك».

   ولا أصلَ اقتراحٍ يُقال (قرارُ ٣ أكتوبر ٢٠٢٦: «لا تُرِ المدرّبَ ما لا يحتاج قراءتَه»): الدورةُ
   دورتُه، اقترحها أم اخترناها له. */

export type MyCourseState = "decide" | "returned" | "preparing" | "submitted" | "teaching" | "ready" | "taught" | "closed";

export type MyCourseTone = "warn" | "info" | "positive" | "neutral" | "danger";

/** كلمةُ كلّ حال — و«سابقة» تُقال بسببها (`closedLabelAr`) */
export const MY_COURSE_STATE: Record<MyCourseState, { label: string; tone: MyCourseTone }> = {
  decide: { label: "تنتظر قرارك", tone: "warn" },
  returned: { label: "ردّت بملاحظات", tone: "warn" },
  preparing: { label: "تعدّها في «شعبي»", tone: "info" },
  submitted: { label: "أرسلت — تنتظر اعتمادنا", tone: "info" },
  teaching: { label: "تدرّسها", tone: "positive" },
  ready: { label: "معتمدة لك", tone: "positive" },
  taught: { label: "درّستها", tone: "neutral" },
  closed: { label: "سابقة", tone: "neutral" },
};

/** ترتيبُ الصفوف: ما ينتظره أوّلا، ثمّ ما يعدّه، ثمّ ما يدرّسه، والسابقةُ آخرا */
const ORDER: Record<MyCourseState, number> = {
  decide: 0, returned: 1, preparing: 2, submitted: 3, teaching: 4, ready: 5, taught: 6, closed: 7,
};

export type MyCourseFilter = "all" | "waiting" | "preparing" | "teaching" | "closed";

export const MY_COURSE_FILTERS: { id: MyCourseFilter; label: string; states: MyCourseState[] }[] = [
  { id: "all", label: "الكل", states: [] },
  { id: "waiting", label: "تنتظرك", states: ["decide", "returned"] },
  { id: "preparing", label: "تعدّها", states: ["preparing", "submitted"] },
  { id: "teaching", label: "تدرّسها", states: ["teaching", "ready", "taught"] },
  { id: "closed", label: "سابقة", states: ["closed"] },
];

export interface MyCourseQual { courseId: string; title: string; currentVersion: number; qualifiedAt: string }

export interface MyCourseOffer {
  id: string;
  status: string;
  courseId: string;
  courseTitleAr: string;
  expiresAt: string;
  offeredAt: string;
}

export interface MyCoursePrep {
  courseId: string;
  titleAr: string;
  state: "to_decide" | "preparing" | "submitted" | "returned" | "approved" | "declined";
  cohortId: string | null;
}

/** شعبتُه كما تقرؤها «شعبي» (`/api/trainer/cohorts/summary`) — وما يلزم منها هنا */
export interface MyCourseCohort {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  status: string;
  planStatus: string;
}

export interface MyCourse<O extends MyCourseOffer = MyCourseOffer, P extends MyCoursePrep = MyCoursePrep> {
  courseId: string;
  title: string;
  state: MyCourseState;
  /** كلمةُ الحال كما تُرى — وللسابقة سببُها */
  labelAr: string;
  tone: MyCourseTone;
  qual: MyCourseQual | null;
  /** الأحدثُ أوّلا */
  offers: O[];
  /** العرضُ المفتوحُ الذي ينتظر جوابَه — إن كان */
  openOffer: O | null;
  /** دورةُ الإعداد — إن كانت من بابها */
  prep: P | null;
  /** شعبُه فيها غيرُ الملغاة — تُفتح من الصفّ */
  cohorts: MyCourseCohort[];
}

const LIVE_COHORT = new Set(["open", "full", "active"]);
const APPROVED_PLAN = new Set(["approved", "published"]);

function fromPrep(s: Exclude<MyCoursePrep["state"], "declined">): MyCourseState {
  if (s === "to_decide") return "decide";
  if (s === "approved") return "teaching";
  return s;
}

/** حالُ الدورة من شعبه فيها — أو `null` حين لا شعبةَ له */
function fromCohorts(cs: MyCourseCohort[]): MyCourseState | null {
  if (cs.length === 0) return null;
  if (cs.some((c) => LIVE_COHORT.has(c.status) || (c.status === "draft" && APPROVED_PLAN.has(c.planStatus)))) return "teaching";
  if (cs.some((c) => c.status === "draft" && c.planStatus === "changes_requested")) return "returned";
  if (cs.some((c) => c.status === "draft" && c.planStatus === "submitted")) return "submitted";
  if (cs.some((c) => c.status === "draft")) return "preparing";
  return "taught";
}

function closedOfOffer(status: string): string {
  if (status === "withdrawn") return "سحبت";
  if (status === "declined") return "اعتذرت عنها";
  return "انقضت مهلتها";
}

export function buildMyCourses<O extends MyCourseOffer, P extends MyCoursePrep>(input: {
  quals: MyCourseQual[];
  offers: O[];
  prep: P[];
  cohorts: MyCourseCohort[];
  now: number;
}): MyCourse<O, P>[] {
  const { quals, offers, prep, cohorts, now } = input;
  const byCourse = new Map<string, { title: string; qual: MyCourseQual | null; offers: O[]; prep: P | null; cohorts: MyCourseCohort[] }>();
  const touch = (courseId: string, title: string) => {
    const r = byCourse.get(courseId) ?? { title: "", qual: null, offers: [], prep: null, cohorts: [] };
    if (!r.title && title) r.title = title;
    byCourse.set(courseId, r);
    return r;
  };
  for (const p of prep) touch(p.courseId, p.titleAr).prep = p;
  for (const o of offers) touch(o.courseId, o.courseTitleAr).offers.push(o);
  for (const c of cohorts) if (c.status !== "cancelled") touch(c.courseId, c.courseTitle).cohorts.push(c);
  for (const q of quals) touch(q.courseId, q.title).qual = q;

  const out: MyCourse<O, P>[] = [];
  for (const [courseId, r] of byCourse) {
    r.offers.sort((a, b) => b.offeredAt.localeCompare(a.offeredAt));
    const openOffer = r.offers.find((o) => o.status === "offered" && new Date(o.expiresAt).getTime() > now) ?? null;
    const lead = r.offers[0];
    const livePrep = r.prep && r.prep.state !== "declined" ? r.prep : null;
    const fromCohort = fromCohorts(r.cohorts);

    let state: MyCourseState;
    let labelAr: string | null = null;
    if (openOffer) state = "decide";
    else if (livePrep && livePrep.state !== "declined") state = fromPrep(livePrep.state);
    else if (fromCohort) state = fromCohort;
    else if (lead && lead.status === "accepted") state = "teaching";
    else if (lead) { state = "closed"; labelAr = closedOfOffer(lead.status === "offered" ? "lapsed" : lead.status); }
    else if (r.prep) { state = "closed"; labelAr = "اعتذرت عنها"; }
    else state = "ready";

    out.push({
      courseId, title: r.title, state, labelAr: labelAr ?? MY_COURSE_STATE[state].label,
      /* وما سحبته الإدارةُ يُرى بلونه — ليس اعتذارا منه */
      tone: labelAr === "سحبت" ? "danger" : MY_COURSE_STATE[state].tone,
      qual: r.qual, offers: r.offers, openOffer, prep: r.prep, cohorts: r.cohorts,
    });
  }
  return out.sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.title.localeCompare(b.title, "ar"));
}

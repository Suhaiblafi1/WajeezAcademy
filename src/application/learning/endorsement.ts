/* خطابُ توصيةٍ من الأكاديمية — يُستحقّ ولا يُعطى لكلّ متخرّج (٢٢ أكتوبر ٢٠٢٦).

   ═══ القرار ═══

   سأل صاحبُ المنصّة: «لماذا سيشتري الطالب الدورات؟ الخصمُ وحدَه لا يكفي»، وقصد من أفكاره «خطاباتِ توصيةٍ بعد
   التخرّج ميزةً لهم». وخُيّر بين ثلاثة: خطابٍ من الأكاديمية يُستحقّ، وخطابٍ باسم المدرّب يقبله أو يرفضه، وخطابٍ
   واحدٍ لكلّ متخرّج — فاختار **خطابَ الأكاديمية المستحَقّ**: يقول لصاحب العمل شيئا لأنّه لا يُعطى للجميع، ولا
   يطلب من المدرّب عملا.

   ═══ ما يقع ═══

   · **يُستحقّ** بحضور ٨٠٪ فأكثر من اللقاءات التي أُخذ فيها الحضور، وبإنجاز المهامّ كلِّها: كلُّ تكليفٍ قُبل،
     وكلُّ اختبارٍ اجتيز. والأرقامُ هي التي فُحصت بها الشهادة نفسُها (`CourseProgress.evidence`) لا حسابٌ ثانٍ.
     وحضورٌ لم يُؤخذ في أيّ لقاءٍ يُقرأ صفرا — فلا يُشهد لمن لم يُرَ حضورُه.
   · **ويقول أرقامَه الحقيقيّة** ومهاراتِ الدورة — لا مدحا مرسلا. ونصُّه هنا وحدَه (`endorsementBodyAr`)، تقرؤه
     صفحتُه ويحرسه اختبارُه.
   · **ويوقَّع باسم الأكاديمية** — لا اسمَ مدرّبٍ فيه، فلا ينتظر أحدا ولا يمرّ ببوّابة نشر الأسماء.

   والخادمُ في `server/services/endorsement.service.ts`، والحارس `server/tests/learning/endorsement.test.ts`. */

/** أدنى حضورٍ يُستحقّ به الخطاب — بالمئة */
export const ENDORSEMENT_MIN_ATTENDANCE = 80
/** كم مهارةً يذكر الخطاب — الأولى في ترتيب الدورة */
export const ENDORSEMENT_MAX_SKILLS = 5

/** ما يُقرأ من دليل التقدّم — والغائبُ صفر */
export interface EndorsementEvidence {
  attendancePct?: number | null
  assignmentsAccepted?: number | null
  assignmentsTotal?: number | null
  assessmentsPassed?: number | null
  assessmentsTotal?: number | null
}

/** الحضورُ والمهامّ كما يقولها الخطاب: التكاليفُ المقبولة والاختباراتُ المجتازة معا */
export function endorsementTally(e: EndorsementEvidence): { attendancePct: number; tasksDone: number; tasksTotal: number } {
  const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    attendancePct: Math.round(n(e.attendancePct)),
    tasksDone: n(e.assignmentsAccepted) + n(e.assessmentsPassed),
    tasksTotal: n(e.assignmentsTotal) + n(e.assessmentsTotal),
  }
}

/** أيستحقّ الخطاب؟ حضورٌ ٨٠٪ فأكثر، ومهامُّه كلُّها */
export function endorsementEarned(e: EndorsementEvidence): boolean {
  const t = endorsementTally(e)
  return t.attendancePct >= ENDORSEMENT_MIN_ATTENDANCE && t.tasksDone >= t.tasksTotal
}

/** ما يحتاجه نصُّ الخطاب — لقطةُ يوم الإصدار */
export interface EndorsementFacts {
  learnerName: string
  courseTitle: string
  attendancePct: number
  tasksDone: number
  tasksTotal: number
  skills: readonly string[]
  totalHours: number | null
}

/** فقراتُ الخطاب — جملٌ قصيرةٌ بأرقامه الحقيقيّة. والمهاراتُ تُعرض قائمةً تحتها */
export function endorsementBodyAr(f: EndorsementFacts): string[] {
  /* بلا فعلٍ يُذكَّر أو يُؤنَّث: لا نعرف جنسَ صاحبه، وخطابٌ يقول «أتمّ» لسارة يُقرأ خطأً في أوّل سطر.
     واسمُ الدورة يبدأ غالبا بـ«دورة» فلا تُكرَّر قبله */
  const course = f.courseTitle.replace(/^دورة\s+/, '')
  const hours = f.totalHours ? ` (${f.totalHours} ساعة)` : ''
  const tasks = f.tasksTotal > 0 ? `، وتم إنجاز المهام كلها (${f.tasksDone} من ${f.tasksTotal}) وقبلها المدرب.` : '.'
  return [
    `تشهد أكاديمية وجيز بإتمام ${f.learnerName} دورة «${course}»${hours}، وهي دورة مباشرة على Zoom بإشراف مدرب.`,
    `بلغت نسبة الحضور ${f.attendancePct}% من اللقاءات${tasks}`,
    `ولا تمنح الأكاديمية هذا الخطاب إلا لمن حضر 80% على الأقل وأنجز المهام كلها. ونوصي بـ${f.learnerName} لما يدل عليه هذا السجل من التزام وجدية.`,
  ]
}

/** رقمُ الخطاب — عشوائيٌّ لا متسلسل، فلا يُعدَّد بالتخمين. والحروفُ بلا ما يشتبه (O/0 وI/1) */
export function endorsementNumber(random: () => number = Math.random): string {
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part = () => Array.from({ length: 4 }, () => ABC[Math.floor(random() * ABC.length)]).join('')
  return `WJ-REC-${part()}-${part()}`
}

/** رابطُ الخطاب العامّ — يفتحه صاحبُ العمل ويطبعه صاحبُه */
export function endorsementPath(number: string): string {
  return `/letter/${encodeURIComponent(number)}`
}

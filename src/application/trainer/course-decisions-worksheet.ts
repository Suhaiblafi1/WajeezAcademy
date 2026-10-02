/* ورقةُ القرارات — الطابورُ المفتوحُ بصيغة ملفّ القرارات نفسِها، يُملأ ثمّ يُرفع.

   ═══ لماذا (٢ أكتوبر ٢٠٢٦) ═══

   وصلت اقتراحاتُ دوراتٍ جديدة، وطلب صاحبُ المنصّة أن يُقرَّر فيها خارجَ الشاشة —
   ربطٌ برمزٍ قائمٍ أو دورةٌ جديدة — ثمّ يُطبَّق القرارُ دفعةً واحدة. وملفُّ القرارات
   (`course-decisions.ts`) يطبّق؛ لكنّ من يُعِدّه لا يرى الطابورَ الحيّ، وما يلزمه منه
   لا تقوله البطاقة: مرجعُ الطلب (`WJ-TR-…`) ومعرّفُ الاقتراح. فكانت البطاقاتُ تُنقل
   صورةً صورة، ثمّ يُسأل عن مرجع كلّ صاحب.

   فالورقةُ تُخرج الطابورَ المفتوحَ كلَّه بنقرة، **بصيغة الملفّ نفسِها**: لكلّ مدرّبٍ
   مرجعُه واسمُه، ولكلّ اقتراحٍ معرّفُه وخاناتُ قراره فارغة. فمن ملأها رفعها كما هي.

   ═══ وما يُقرأ منفصلٌ عمّا يُقرَّر ═══

   نصُّ الاقتراح وأجوبتُه وأقربُ رموزنا إليه تحت `context` — ولا شيءَ منها في خانات
   القرار. فلو وُضع العنوانُ في `titleAr` لقرأه المنفِّذُ تصحيحا، ورسم لكلّ بندٍ خطوةَ
   «تصحيح عنوان» لا تصحّح شيئا. و`context` لا يقرؤه المنفِّذ أصلا.

   ═══ ولا تُطبَّق قبل أن تُملأ ═══

   خاناتُ القرار فارغة، والمنفِّذُ يردّ بندا لا يطلب شيئا ومدرّبا لا قرارَ له. فمن رفع
   الورقةَ قبل أن يملأها قيل له ذلك، ولم يقع شيء.

   ═══ وما لا يلزم لا يخرج ═══

   لا بريدَ ولا هاتف: المرجعُ والاسمُ يكفيان المنفِّذَ، وبهما يطابق. والورقةُ تُنسخ
   وتُرسَل، فلا يُحمَّل فيها ما لا يُقرَّر به. */

import { DECISIONS_KIND, DECISIONS_VERSION } from './course-decisions'
import { OPEN_PROPOSAL_STATUSES, PROPOSAL_STATUS_LABELS } from './accepted-courses'

/** صاحبُ الاقتراح — مرجعُه واسمُه، وحالُه ليُعرف أيُؤهَّل وما أُهِّل له */
export interface WorksheetTrainer {
  reference: string
  fullName: string
  applicationStatus: string
  suspended: boolean
  /** رموزُ الدورات المؤهَّل لها — فلا يُكتب في الورقة تأهيلٌ قائم */
  qualified: readonly string[]
}

/** اقتراحٌ في الطابور كما يقرؤه الخادم — ومعه صاحبُه */
export interface WorksheetRow {
  proposalId: string
  status: string
  titleAr: string
  summaryAr: string | null
  /** ISO — وبه تُرتَّب الورقةُ ترتيبَ الطابور */
  createdAt: string
  questionAr: string | null
  answerAr: string | null
  /** أجوبةُ أسئلة الفورم بألفاظ شاشة التصنيف (`proposalDetailRows`) */
  detailsAr: readonly { labelAr: string; valueAr: string }[]
  /** أقربُ رموز الكتالوج إليه — من المرشِّح نفسِه الذي يرشّح في الشاشة */
  suggested: readonly { courseId: string; titleAr: string; sharedAr: readonly string[] }[]
  trainer: WorksheetTrainer
}

/** كيف تُملأ — مكتوبةٌ في الورقة نفسِها، فلا يحتاج من يملؤها شاشةً أخرى */
export const WORKSHEET_HOW_TO_AR: readonly string[] = [
  'لكلّ اقتراحٍ قرارٌ واحدٌ في «verdict»، وما يلزمه بجانبه:',
  '«link» مع «courseId» — نسخةٌ من رمزٍ قائم.',
  '«became_course» مع «courseId» — صار دورةً في الكتالوج، والرمزُ يكون قد نُشر قبلها.',
  '«ask» مع «questionAr» — سؤالٌ لصاحبه، خمسةُ أحرفٍ فأكثر.',
  '«reject» مع «noteAr» — ردٌّ بسببٍ يقرؤه صاحبه، خمسةُ أحرفٍ فأكثر.',
  '«titleAr» و«summaryAr» في البند تصحيحٌ للنصّ إن أُريد — والنصُّ الحاليّ في «context».',
  '«qualify» لكلّ مدرّب: رموزٌ يُؤهَّل لها — وما في «context.qualified» مؤهَّلٌ له من قبل.',
  'وما لا قرارَ فيه يُحذف بندُه، ومن لا قرارَ له يُحذف كلُّه. و«context» يُقرأ ولا يُطبَّق.',
  'ثمّ تُرفع في «دوراتٌ مقترحة» ← «طبّق قراراتٍ من ملفّ»: تُعرض خطواتُها قبل أن تُطبَّق.',
]

const isOpen = (status: string) => OPEN_PROPOSAL_STATUSES.includes(status)

/** يُخرج الطابورَ المفتوحَ بصيغة ملفّ القرارات — المبتوتُ لا يخرج، ولا قرارَ مكتوبٌ سلفا */
export function buildDecisionsWorksheet(rows: readonly WorksheetRow[], now: Date) {
  const open = rows
    .filter((r) => isOpen(r.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.proposalId.localeCompare(b.proposalId))

  /* والمدرّبون بترتيب أقدمِ ما ينتظر منهم — ترتيبُ الطابور نفسُه */
  const byRef = new Map<string, { trainer: WorksheetTrainer; rows: WorksheetRow[] }>()
  for (const r of open) {
    const at = byRef.get(r.trainer.reference)
    if (at) at.rows.push(r)
    else byRef.set(r.trainer.reference, { trainer: r.trainer, rows: [r] })
  }

  return {
    kind: DECISIONS_KIND,
    version: DECISIONS_VERSION,
    titleAr: `قراراتُ الدورات المقترحة — ${now.toISOString().slice(0, 10)}`,
    context: {
      exportedAt: now.toISOString(),
      openProposals: open.length,
      trainers: byRef.size,
      howToAr: WORKSHEET_HOW_TO_AR,
    },
    trainers: [...byRef.values()].map(({ trainer, rows: mine }) => ({
      reference: trainer.reference,
      fullName: trainer.fullName,
      proposals: mine.map((r) => ({
        proposalId: r.proposalId,
        verdict: null,
        courseId: null,
        questionAr: null,
        noteAr: null,
        context: {
          titleAr: r.titleAr,
          summaryAr: r.summaryAr,
          statusAr: PROPOSAL_STATUS_LABELS[r.status] ?? r.status,
          receivedAt: r.createdAt,
          details: r.detailsAr,
          askedAr: r.questionAr,
          answerAr: r.answerAr,
          suggested: r.suggested.map((s) => ({ courseId: s.courseId, titleAr: s.titleAr, sharedAr: s.sharedAr })),
        },
      })),
      qualify: [] as string[],
      status: null,
      statusNoteAr: null,
      context: {
        applicationStatus: trainer.applicationStatus,
        suspended: trainer.suspended,
        qualified: trainer.qualified,
      },
    })),
  }
}

export type DecisionsWorksheet = ReturnType<typeof buildDecisionsWorksheet>

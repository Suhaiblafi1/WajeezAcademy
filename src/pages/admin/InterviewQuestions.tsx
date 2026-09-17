/* أسئلةُ المقابلة — مرتّبةٌ بمحاور الروبرك، ومنها ما يخصُّ هذا الطلبَ وحدَه.

   ═══ لماذا استُخرجت من `InterviewSheet` ═══

   كانت جزءا منها، وصار لها قارئان: شاشةُ الأدمن، والصفحةُ المشتركةُ التي
   يفتحها قارئٌ برابطه (١٣ سبتمبر ٢٠٢٦). ونسخُها للثاني يُنشئ نسختَين
   تتفقان اليومَ ولا تتفقان غدا — وهو العطبُ نفسُه الذي جُمع لأجله
   `rubric.ts` أصلا.

   ولا يُسأل عمّا لا يُقاس: المحورُ بلا أسئلةٍ لا يُعرض له عنوانٌ فارغ.

   ═══ ولماذا تُطوى في شاشة الأدمن وتُفتح في رابط القارئ ═══

   ستّةَ عشرَ سؤالا بمحاورها وما يخصُّ الطلبَ وحدَه: قائمةٌ طويلةٌ مفيدةٌ في
   موضعها، ثقيلةٌ في غيره. وشكا صاحبُ المنصّة منها في شاشة الطلب (١٧ سبتمبر
   ٢٠٢٦): «يجب أن تكون مطويّةً ولا تظهر هكذا — تُعبّي الصفحة».

   وشاشةُ الطلب تُقرأ للقرار: مستنداتٌ وحالةٌ وسجلٌّ وأتعاب، والأسئلةُ فيها
   شيءٌ يُراجَع قبل الغرفة لا يُقرأ كلَّ مرّة. أمّا **رابطُ القارئ** فلا
   يُفتح إلّا في الغرفة وهذه الأسئلةُ سببُ فتحه — فطيُّها هناك يُخفي المقصودَ
   خلف نقرة.

   فالطيُّ افتراضُ الشاشة، والفتحُ افتراضُ الرابط، والقرارُ عند المُنادي
   (`defaultOpen`) لا في نسختَين من الملفّ. والعددُ يُقرأ على الغلاف مطويّا:
   من لم يفتح يعرف ما خلفه. */

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { RUBRIC_AXES } from '@/application/trainer/rubric'
import { courseById } from '@/data/courses'
import { readProposals } from '@/application/trainer/teachable-proposals'
import { Panel } from '@/components/ui/Surface'
import type { Dossier } from './ApplicationDossier'

function Ask({ children }: { children: ReactNode }) {
  return <li className="text-read leading-6 marker:text-muted-foreground">{children}</li>
}

/* ═══ وما يخصُّ هذا المتقدّمَ وحدَه ═══

   سؤالٌ عامٌّ يُسأل لكلّ أحد، وهذه تُشتقّ من طلبه هو: ادّعاءٌ لم يُوثَّق،
   أو دورةٌ اختارها، أو خبرةُ تدريبٍ قصيرة. وهي أنفعُ ما في الورقة، لأنّها
   تُغلق الثغرةَ التي يتركها الملفُّ نفسُه. */
function personalAsks(a: Dossier): string[] {
  const asks: string[] = []

  if (a.hasAccreditation && !a.accreditationDetails?.trim()) {
    asks.push('قال إنّ لديه اعتمادا رسميّا ولم يذكر الجهة — من مَنحه؟ ومتى؟ وهل هو سارٍ؟ اطلب صورةَ الشهادة.')
  }

  const teachable = a.teachableCourseIds ?? []
  if (teachable.length > 0) {
    const one = courseById(teachable[0])?.name ?? teachable[0]
    asks.push(`اختار «${one}» ضمن ما يستطيع تدريسه — كيف يبدأ أوّلَ جلسةٍ فيها، وما أوّلُ ما يخرج به المتدرّب؟`)
  }
  /* السجلّاتُ أو الفقرةُ القديمة — السؤالُ واحدٌ في الحالتين */
  if (teachable.length === 0 && (readProposals(a.teachableProposals).length > 0 || a.teachableOther?.trim())) {
    asks.push('لم يختر شيئا من كتالوجنا وكتب بديلا — أيُّ دوراتنا أقربُ إلى ما يُتقنه فعلا؟')
  }

  if (['none', 'under_1'].includes(a.trainingYears ?? '')) {
    asks.push('خبرةُ تدريبه أقلُّ من سنة — من درّب فعلا؟ وكم مرّة؟ وأمام كم متدرّبا؟')
  }

  if (!a.youtubeUrl?.trim() && !a.linkedinUrl?.trim()) {
    asks.push('لا رابطَ في طلبه يُظهره وهو يدرّب — اطلب تسجيلا قصيرا أو اسمَ من يشهد له.')
  }

  if (a.demoConsent === false) {
    asks.push('لم يوافق على الدرس التجريبيّ وهو شرطُ الاعتماد — اسأله عن سببه قبل المضيّ.')
  }

  return asks
}

export interface InterviewQuestionsProps {
  a: Dossier
  /** مفتوحةً من أوّلها — لرابط القارئ حيث الأسئلةُ سببُ فتح الصفحة */
  defaultOpen?: boolean
}

export default function InterviewQuestions({ a, defaultOpen = false }: InterviewQuestionsProps) {
  const personal = personalAsks(a)
  const axes = RUBRIC_AXES.filter((x) => x.questions.length > 0)
  const total = personal.length + axes.reduce((n, x) => n + x.questions.length, 0)

  return (
    <Panel as="article" id="sec-questions" className="scroll-mt-28">
      <details open={defaultOpen} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black transition hover:text-teal-light-ink [&::-webkit-details-marker]:hidden">
          <ChevronDown className="h-4 w-4 shrink-0 text-teal-light-ink transition-transform group-open:rotate-180" aria-hidden="true" />
          <h4 className="text-sm font-black">أسئلةٌ مقترحةٌ للمقابلة</h4>
          {/* والعددُ على الغلاف: من لم يفتح يعرف ما خلفه */}
          <span className="mr-auto text-fine font-bold text-muted-foreground">{total} سؤالا</span>
        </summary>

        <p className="mt-2 text-read leading-6 text-muted-foreground">
          مرتّبةٌ بمحاور التقييم نفسِها — فما سُئل عنه يُقيَّم في سطره.
        </p>

        {personal.length > 0 && (
          <div className="mt-4">
            <h5 className="text-fine font-black text-gold-ink">يخصُّ هذا الطلبَ وحدَه</h5>
            <ul className="mt-2 list-disc space-y-1.5 pr-5">
              {personal.map((q) => <Ask key={q}>{q}</Ask>)}
            </ul>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {axes.map((axis) => (
            <div key={axis.key}>
              <h5 className="text-fine font-black text-teal-light-ink">{axis.label}</h5>
              <ul className="mt-1.5 list-disc space-y-1.5 pr-5">
                {axis.questions.map((q) => <Ask key={q}>{q}</Ask>)}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </Panel>
  )
}

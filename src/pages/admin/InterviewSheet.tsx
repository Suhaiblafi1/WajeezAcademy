/* ورقةُ المقابلة: أسئلةٌ تُسأل، ونموذجٌ يُملأ باليد، ثمّ يُنقل إلى الشاشة.

   ═══ لماذا وُجدت ═══

   قرارُ صاحب المنصّة (١٣ سبتمبر ٢٠٢٦): «أضف أسئلةً مقترحةً يجب أن نسألها في
   المقابلة، وضع هناك نموذجَ التقييم لكي يُنقل لملفّه لاحقا».

   فالمطبوعُ لم يعد ملفّا يُقرأ فحسب، بل **أداةَ عملٍ تُحمل إلى اللقاء**: على
   يمينها من هو، وفي وسطها ما يُسأل، وفي آخرها ما يُكتب. ومن جلس بلا ورقةٍ
   سأل ما يخطر له، فاختلفت المقابلاتُ ولم تُقارَن.

   ═══ وثلاثةُ قيودٍ في تصميمها ═══

   ١) **الأسئلةُ مرتّبةٌ بمحاور الروبرك نفسِها** — فمن سأل محورا قيّمه في
      سطره، ولا يُترك التقييمُ إلى ما بعد اللقاء حين يذوب في الانطباع العامّ.

   ٢) **ولا حقلَ إدخالٍ في النموذج**: قاعدةُ الطباعة تُخفي `input` و`button`
      و`select` و`textarea` كلَّها (ولها سببُها: مربّعٌ خاوٍ على الورق يُقرأ
      بيانا ناقصا). فما يُملأ باليد يُرسَم بحدودٍ ونقاطٍ لا بحقولٍ معطَّلة.

   ٣) **والمحاورُ تُقرأ من مصدرها الواحد** في `application/trainer/rubric.ts`
      — فلو انحرفت الورقةُ عن الشاشة تعذّر نقلُ الدرجات، وهو أسوأُ من ألّا
      تُطبع ورقةٌ أصلا. */

import type { ReactNode } from 'react'
import { INTERVIEW_VERDICTS, RUBRIC_AXES } from '@/application/trainer/rubric'
import { courseById } from '@/data/courses'
import { Panel } from '@/components/ui/Surface'
import type { Dossier } from './ApplicationDossier'

/** سطرٌ منقّطٌ يُكتب عليه باليد — لا حقلٌ مُعطَّل */
function Ruled({ lines = 1 }: { lines?: number }) {
  return (
    <span aria-hidden="true" className="mt-1 block space-y-3">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="block border-b border-dotted border-white/25" />
      ))}
    </span>
  )
}

/** خمسُ خاناتٍ تُدوَّر إحداها بالقلم */
function Scale() {
  return (
    <span className="flex shrink-0 gap-1" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n}
          className="grid h-6 w-6 place-items-center rounded-md border border-white/25 text-fine font-bold">
          {n}
        </span>
      ))}
    </span>
  )
}

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
  if (teachable.length === 0 && a.teachableOther?.trim()) {
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

export default function InterviewSheet({ a }: { a: Dossier }) {
  const personal = personalAsks(a)

  return (
    <>
      {/* ═══ الأسئلة — تُقرأ على الشاشة وتُطبع معا ═══

          تُرى على الشاشة كذلك: من يقابل عن بُعدٍ يقرؤها من أمامه بلا ورق. */}
      <Panel as="article" id="sec-questions" className="scroll-mt-28">
        <h4 className="text-sm font-black">أسئلةٌ مقترحةٌ للمقابلة</h4>
        <p className="mt-1 text-read leading-6 text-muted-foreground">
          مرتّبةٌ بمحاور التقييم نفسِها — فما سُئل عنه يُقيَّم في سطره أدناه.
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
          {RUBRIC_AXES.filter((x) => x.questions.length > 0).map((axis) => (
            <div key={axis.key}>
              <h5 className="text-fine font-black text-teal-light-ink">{axis.label}</h5>
              <ul className="mt-1.5 list-disc space-y-1.5 pr-5">
                {axis.questions.map((q) => <Ask key={q}>{q}</Ask>)}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      {/* ═══ النموذج — للورق وحدَه ═══

          على الشاشة يُملأ الروبركُ الحقيقيُّ في ذيل الصفحة، فنموذجٌ مرسومٌ
          بجانبه ازدواجٌ يُربك. وعلى الورق هو كلُّ ما يُكتب فيه. */}
      <div className="hidden print:block">
        <h4>نموذجُ تقييم المقابلة — يُملأ باليد ثمّ يُنقل إلى ملفّه</h4>
        <p className="text-read leading-6 text-muted-foreground">
          دوِّر الدرجةَ في كلّ محور (١ أضعف · ٥ أقوى)، ثمّ أدخِلها في الشاشة تحت «الروبرك» ليبقى الأثر.
        </p>

        <dl className="mt-3">
          {RUBRIC_AXES.map((axis) => (
            <div key={axis.key} className="flex items-start justify-between gap-4 border-b border-white/15 py-2">
              <dt className="min-w-0">
                <span className="text-read font-bold">{axis.label}</span>
                {axis.laterAr && (
                  <span className="block text-fine leading-5 text-muted-foreground">{axis.laterAr}</span>
                )}
              </dt>
              <dd><Scale /></dd>
            </div>
          ))}
        </dl>

        <div className="mt-4">
          <p className="text-read font-bold">ملاحظةُ المقابِل</p>
          <Ruled lines={4} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-read font-bold">القرار:</span>
          {INTERVIEW_VERDICTS.map((v) => (
            <span key={v} className="flex items-center gap-2 text-read">
              <span aria-hidden="true" className="inline-block h-4 w-4 border border-white/40" />
              {v}
            </span>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-8">
          <div>
            <p className="text-read font-bold">اسمُ المقابِل</p>
            <Ruled />
          </div>
          <div>
            <p className="text-read font-bold">التاريخ والتوقيع</p>
            <Ruled />
          </div>
        </div>
      </div>
    </>
  )
}

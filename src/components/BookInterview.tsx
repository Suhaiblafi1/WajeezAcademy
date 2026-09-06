/* بطاقةُ حجز المقابلة — تُعرض للمتقدّم قبل القرار، في موضعَين.

   لماذا مكوّنٌ لا نصٌّ في كلّ شاشة: يراها المتقدّم أوّلَ مرّةٍ في «وصل طلبك»،
   ثمّ يعود إليها من صفحة حالته بعد يومٍ أو ثلاثة. ولو كُتبت مرّتين لافترقتا
   عند أوّل تعديل — فيقرأ في شاشةٍ مدّةً وفي أخرى غيرَها.

   ورابطٌ خارجيٌّ صريح: يُفتح في لسانٍ جديدٍ بـ`rel="noopener noreferrer"`،
   ويُقال للمستخدم أنّه يغادر إلى أداة حجز — فمن ينتقل إلى نطاقٍ آخرَ بلا
   إنذارٍ يظنّه تصيّدا، وهذا متقدّمٌ لم يتعامل معنا بعد. */

import { CalendarClock, ExternalLink, Video } from 'lucide-react'
import { TRAINER_INTERVIEW, trainerInterviewUrl } from '@/application/trainer/application-options'

export interface BookInterviewProps {
  /** يُعبَّأ بها نموذجُ الحجز فلا يكتبها المتقدّم مرّةً ثالثة */
  name?: string
  email?: string
  reference?: string
  className?: string
}

export default function BookInterview({ name, email, reference, className = '' }: BookInterviewProps) {
  return (
    <div className={`rounded-2xl border border-teal/30 bg-teal/[0.05] p-5 ${className}`}>
      <p className="flex items-center gap-2 text-sm font-black text-teal-light-ink">
        <CalendarClock className="h-4 w-4" /> احجز مقابلتك — اختر الوقت الذي يناسبك
      </p>

      <p className="mt-2 text-sm leading-8 text-foreground">
        الخطوةُ التالية اجتماعٌ تعريفيٌّ قصير: نعرّفك بمنهجيّة الأكاديميّة ونسمع منك.
        ولا تنتظر مكالمةً منّا — <b className="text-foreground">اختر موعدك بنفسك الآن</b>،
        وتصلك دعوةُ الاجتماع على بريدك فورَ الحجز.
      </p>

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" /> {TRAINER_INTERVIEW.minutes} دقيقة
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5" /> عن بُعد عبر {TRAINER_INTERVIEW.platformAr}
        </span>
      </p>

      <a
        href={trainerInterviewUrl({ name, email, reference })}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-teal px-6 py-3 text-sm font-black text-on-teal transition hover:bg-teal-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      >
        احجز موعدك الآن
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>

      <p className="mt-3 text-[11px] leading-6 text-muted-foreground">
        يفتح صفحةَ حجزٍ خارجيّة في لسانٍ جديد
        {reference && <> — ورقمُ طلبك <b className="font-mono text-foreground" dir="ltr">{reference}</b> مذكورٌ فيها</>}.
        ولو لم يناسبك أيُّ وقتٍ معروض، راسِلنا وسنرتّب غيرَه.
      </p>
    </div>
  )
}

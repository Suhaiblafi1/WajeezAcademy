/* بطاقةُ حجز المقابلة — تُعرض للمتقدّم قبل القرار، في موضعَين.

   لماذا مكوّنٌ لا نصٌّ في كلّ شاشة: يراها المتقدّم أوّلَ مرّةٍ في «وصل طلبك»،
   ثمّ يعود إليها من صفحة حالته بعد يومٍ أو ثلاثة. ولو كُتبت مرّتين لافترقتا
   عند أوّل تعديل — فيقرأ في شاشةٍ مدّةً وفي أخرى غيرَها.

   ═══ ولماذا صارت تُضمَّن بعد أن كانت رابطا ═══

   كانت تُخرج المتقدّمَ إلى لسانٍ جديد. وسببُ ذلك مكتوبٌ في
   `application-options.ts`: سياسةُ المحتوى `default-src 'self'` تحجب إطارَ
   Calendly حجبا تامّا، فالتضمينُ كان يُنتج **مستطيلا أبيضَ بلا خطأٍ ظاهر** —
   وهو أسوأُ من رابطٍ صريح.

   وقرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦) أن يُحجَز داخلَ الموقع. فوُسّعت
   السياسةُ في `deploy/Caddyfile` بسطرٍ واحدٍ لا أكثر: `frame-src
   https://calendly.com`. **ولا سكربتَ لهم يُحمَّل عندنا** — لا
   `assets.calendly.com` ولا `script-src` يُفتح: إطارٌ عاريٌّ بـ
   `embed_type=Inline`، فيبقى ما يُنفَّذ في نطاقنا شيفرتَنا وحدَها.

   وثمنُ ترك سكربتهم أنّ الإطارَ لا يقيس ارتفاعَه بنفسه — فارتفاعٌ ثابتٌ سخيّ
   يسع أطولَ حالاته (اختيارُ الشهر ثمّ اليوم ثمّ تعبئةُ النموذج).

   ═══ والحجزُ يُلتقَط لا يُنسى ═══

   Calendly يبثّ `postMessage` عند إتمام الحجز حتّى في الإطار العاري. نلتقطه
   لنؤكّد النجاح في الشاشة فحسب؛ أمّا صفُّ المقابلة ووقتُه الحقيقيُّ فيأتيان
   من webhook موقّع، لأنّ رسالةَ المتصفّح لا تحمل الوقت ولا تصلح دليلا للكتابة.
   ومصدرُ الرسالة يُفحَص مع ذلك: نافذةٌ أخرى تستطيع أن تبثّ ما تشاء. */

import { useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, ExternalLink, Loader2, Video } from 'lucide-react'
import { TRAINER_INTERVIEW, trainerInterviewUrl } from '@/application/trainer/application-options'
import { Inset } from '@/components/ui/Surface'
import { usePlatformConfig } from '@/hooks/usePlatformConfig'

export interface BookInterviewProps {
  /** يُعبَّأ بها نموذجُ الحجز فلا يكتبها المتقدّم مرّةً ثالثة */
  name?: string
  email?: string
  reference?: string
  className?: string
}

/** أصلُ Calendly — يُقارَن به مصدرُ كلّ رسالة، فلا تُصدَّق نافذةٌ غيرُه */
const CALENDLY_ORIGIN = 'https://calendly.com'

/** هل هذه رسالةُ Calendly تقول إنّ الموعدَ حُجز؟ */
function isScheduledEvent(e: MessageEvent): boolean {
  if (e.origin !== CALENDLY_ORIGIN) return false
  const data: unknown = e.data
  if (typeof data !== 'object' || data === null) return false
  const event = (data as { event?: unknown }).event
  return event === 'calendly.event_scheduled'
}

export default function BookInterview({ name, email, reference, className = '' }: BookInterviewProps) {
  const [done, setDone] = useState(false)
  /* ═══ ولماذا لوحٌ يُرى قبل التقويم ═══

     كان الإطارُ `loading="lazy"` بلا شيءٍ خلفه: فلا يبدأ تحميلُه أصلا حتّى
     يقترب من الشاشة، ثمّ يبقى مستطيلا فارغا حتّى يجيب Calendly. فيرى
     المتقدّمُ فراغا ويظنّ العطبَ — وهو أوّلُ ما يراه في هذه البطاقة. */
  const [frameReady, setFrameReady] = useState(false)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isScheduledEvent(e)) return
      setDone(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  /* الأصلُ من الخادم إن ضُبط، وإلّا المضمَّن — بلا حالةِ تحميلٍ ظاهرة:
     تُرسم البطاقةُ بالمضمَّن ثمّ تُبدَّل إن جاء بديل. */
  const { interviewBookingUrl } = usePlatformConfig()
  const url = trainerInterviewUrl({ name, email, reference }, interviewBookingUrl ?? undefined)
  /* `embed_domain` شرطُ Calendly لبثّ الأحداث، و`embed_type` يُخفي رأسَ صفحتهم */
  const embedUrl = `${url}${url.includes('?') ? '&' : '?'}embed_domain=${encodeURIComponent(window.location.hostname)}&embed_type=Inline`

  return (
    <div className={`rounded-2xl border border-teal/30 bg-teal/[0.05] p-5 ${className}`}>
      <p className="flex items-center gap-2 text-sm font-black text-teal-light-ink">
        <CalendarClock className="h-4 w-4" /> احجز مقابلتك — اختر الوقت الذي يناسبك
      </p>

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-read leading-5 text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" /> {TRAINER_INTERVIEW.minutes} دقيقة
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5" /> عن بُعد عبر {TRAINER_INTERVIEW.platformAr}
        </span>
      </p>

      {done ? (
        <Inset as="p" tone="positive" className="mt-4 flex items-start gap-2 text-read leading-6 text-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
          حُجز موعدك — تصلك رسالةُ تأكيدٍ بدعوة التقويم، ويظهر في صفحة حالتك بعد لحظات.
        </Inset>
      ) : (
        <>
          {/* الحجزُ داخل الصفحة. والارتفاعُ ثابتٌ لأنّنا لا نحمّل سكربتَهم */}
          {/* الانحناءُ على الحاضن لا على الإطار: `rounded-*` مع كلمة `border`
              في صيغةٍ واحدةٍ سطحٌ مكتوبٌ بيده، وسقفُها محروس. */}
          <div className="mt-4 overflow-hidden rounded-xl bg-white">
            <div className="relative h-[680px] w-full sm:h-[720px]">
              {/* اللوحُ خلفَ الإطار لا مكانَه: يُغطّى حين يجيب Calendly، فلا
                  وميضَ ولا قفزةٌ في الارتفاع. */}
              {!frameReady && (
                <div className="absolute inset-0 grid place-items-center gap-3 bg-white text-center">
                  <div>
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-teal-ink" aria-hidden="true" />
                    <p className="mt-3 text-read leading-6 text-slate-600">يُحمَّل تقويمُ المواعيد…</p>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-read text-teal-ink underline decoration-dotted underline-offset-4"
                    >
                      أو افتحه في لسانٍ جديد
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              )}
              <iframe
                src={embedUrl}
                title="اختيار موعد المقابلة"
                /* ولا `lazy`: البطاقةُ لا تُعرض إلّا لمن جاء ليحجز، فتأخيرُ
                   البدء حتّى يقترب من الشاشة تأخيرٌ بلا مقابل. */
                onLoad={() => setFrameReady(true)}
                style={{ border: 'none' }}
                className="relative block h-full w-full"
              />
            </div>
          </div>
          <p className="mt-3 text-read leading-6 text-muted-foreground">
            {reference && <>ورقمُ طلبك <b className="font-mono text-foreground" dir="ltr">{reference}</b> مرفقٌ بالحجز. </>}
            ولو لم يناسبك أيُّ وقتٍ معروض، راسِلنا وسنرتّب غيرَه.{' '}
            {/* ومخرجٌ لمن حجب الأطرَ أو ضاقت شاشتُه — لا يُترك بلا طريق */}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-teal-light-ink underline decoration-dotted underline-offset-4"
            >
              أو افتح صفحة الحجز في لسانٍ جديد
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </p>
        </>
      )}
    </div>
  )
}

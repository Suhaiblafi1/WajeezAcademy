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

   وثمنُ ترك سكربتهم أنّ الإطارَ لا يقيس ارتفاعَه بنفسه — فيُقاس من رسالة
   `page_height` ويُعطى الإطارُ طولَه كاملا، ويبقى **الصندوقُ المرئيُّ قصيرا
   ثابتا** يُمرَّر رأسيّا وحدَه. ومكتوبٌ تحتُ لماذا هذه القسمة.

   ═══ والحجزُ يُلتقَط لا يُنسى ═══

   Calendly يبثّ `postMessage` عند إتمام الحجز حتّى في الإطار العاري. نلتقطه
   لنؤكّد النجاح في الشاشة فحسب؛ أمّا صفُّ المقابلة ووقتُه الحقيقيُّ فيأتيان
   من webhook موقّع، لأنّ رسالةَ المتصفّح لا تحمل الوقت ولا تصلح دليلا للكتابة.
   ومصدرُ الرسالة يُفحَص مع ذلك: نافذةٌ أخرى تستطيع أن تبثّ ما تشاء. */

import { useEffect, useRef, useState } from 'react'
import { CalendarClock, CalendarOff, CheckCircle2, ExternalLink, Loader2, MailCheck, Video } from 'lucide-react'
import {
  INTERVIEW_BOOKING_PAUSE, TRAINER_INTERVIEW, trainerInterviewUrl,
} from '@/application/trainer/application-options'
import { INTERVIEW_INVITATION } from '@/application/trainer/interview-invitation'
import { nextFrameHeight } from '@/lib/calendly-embed'
import { Card, Inset } from '@/components/ui/Surface'
import { usePlatformConfig } from '@/hooks/usePlatformConfig'

export interface BookInterviewProps {
  /** يُعبَّأ بها نموذجُ الحجز فلا يكتبها المتقدّم مرّةً ثالثة */
  name?: string
  email?: string
  reference?: string
  className?: string
  /* ═══ الدعوةُ — لمن نظرنا في ملفّه ونرغب بلقائه (٢٢ سبتمبر ٢٠٢٦) ═══

     البطاقةُ نفسُها تُركَّب في موضعَين: شاشةُ ما بعد الإرسال، وصفحةُ الحالة.
     وفي الأولى لم يُقرأ ملفُّه بعد — فلا يُقال له «اهتممنا بملفّك» وهو لم
     يبرد بعدُ في الطابور. فالدعوةُ معامَلٌ يُمرَّر، ومن يُدعى مكتوبٌ في
     `interview-invitation.ts` ويُقرأ من صفحة الحالة وحدَها.

     ولا يُحكَم هنا: لو قرأت البطاقةُ الحالةَ بنفسها لَصار للحكم موضعان. */
  invited?: boolean
}

/* ═══ ارتفاعُ الصندوق المرئيّ — قصيرٌ ثابت ═══

   `min(70vh,560px)`: قصيرٌ في الصفحة على الحاسوب، ولا يبتلع شاشةَ الهاتف
   الصغيرة. و`h-` لا `max-h-`: ارتفاعٌ واحدٌ في كلّ خطوةٍ من خطوات الحجز،
   فلا يرتجّ ما تحت البطاقة حين تطول خطوةٌ وتقصر أختُها. */
const BOX_HEIGHT = 'h-[min(70vh,560px)]'

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

export default function BookInterview({ name, email, reference, invited = false, className = '' }: BookInterviewProps) {
  const [done, setDone] = useState(false)
  /* ═══ ولماذا لوحٌ يُرى قبل التقويم ═══

     كان الإطارُ `loading="lazy"` بلا شيءٍ خلفه: فلا يبدأ تحميلُه أصلا حتّى
     يقترب من الشاشة، ثمّ يبقى مستطيلا فارغا حتّى يجيب Calendly. فيرى
     المتقدّمُ فراغا ويظنّ العطبَ — وهو أوّلُ ما يراه في هذه البطاقة. */
  const [frameReady, setFrameReady] = useState(false)
  /* ═══ صندوقٌ قصيرٌ ثابت، وإطارٌ بطول محتواه ═══

     كان الصندوقُ يأخذ ارتفاعَ المحتوى كلَّه (أرضيّةٌ ١١٨٠ بكسلا): تقويمُ
     Calendly في عمودٍ ضيّقٍ طويلٌ بطبعه، فصارت البطاقةُ تمتدّ شاشةً ونصفا
     تحت إصبع من يقرأ. وشكا صاحبُ المنصّة منه (١٧ سبتمبر ٢٠٢٦): «البوكس
     طويل جدا للأسفل — اجعله قصيرا، وللشخص أن ينزل سكرولا إن احتاج، ولا
     يتحرّك ما بداخله يمينا ويسارا».

     فالقسمةُ صارت طبقتَين:

     ① **الصندوقُ المرئيُّ** ارتفاعُه مقطوعٌ قصيرٌ ثابت (`BOX_HEIGHT`)، لا
        يتبع محتوى Calendly ولا يقفز معه، ويُمرَّر **رأسيّا وحدَه**:
        `overflow-x-hidden` تمنع الزحفَ يمينا ويسارا الذي شُكي منه.
     ② **والإطارُ داخله يأخذ طولَ محتواه كاملا** كما يقيسه Calendly — فلا
        تمريرَ داخلَ الإطار نفسِه ولا شريطَ ثانٍ فيه، وما يُمرَّر هو صندوقُنا
        لا صفحتُهم. ولهذا يبقى القياسُ لازما بعد أن قصُر الصندوق.

     ═══ والمقيسُ يكبر ولا يصغر ═══

     Calendly يبثّ `calendly.page_height` متى ضُبط `embed_domain`. ورحلةُ
     الحجز ثلاثُ خطواتٍ مختلفةِ الطول: تقويمٌ، ثمّ أوقاتٌ أقصر، ثمّ نموذجٌ
     أطول. فلو تبع الإطارُ كلَّ رسالةٍ نزولا لقُصّ ما لا يسعه في خطوةٍ ثمّ
     عاد — فالقاعدةُ «يكبر ولا يصغر»، وموضعُها `lib/calendly-embed.ts`
     لتُفحَص دالّةً لا شرطا في JSX. وثمنُها فراغٌ أبيضُ أسفلَ الخطوة الأقصر،
     لا يراه إلّا من مرّر إليه. */
  const [frameHeight, setFrameHeight] = useState<number | null>(null)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== CALENDLY_ORIGIN) return
      const data = e.data as { event?: unknown; payload?: { height?: unknown } } | null
      if (data && typeof data === 'object' && data.event === 'calendly.page_height') {
        /* القرارُ في `lib/calendly-embed.ts` — يكبر ولا يصغر، وهناك يُفحص */
        setFrameHeight((prev) => nextFrameHeight(prev, data.payload?.height))
        return
      }
      if (!isScheduledEvent(e)) return
      setDone(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  /* ═══ ولماذا تُردّ الصفحةُ إلى البطاقة بعد الحجز ═══

     الصندوقُ يأخذ أكثرَ الشاشة وهو مفتوح، فمن بلغ زرَّ التأكيد في آخر
     خطوةٍ صار في أسفل الصفحة. فإذا حُجز الموعدُ اختفى الصندوقُ كلُّه وحلّ
     محلَّه سطرٌ واحد — فيهبط ما تحته مئاتِ البكسلات، ويبقى المتقدّمُ حيث
     كان: أمام تذييلِ الصفحة، والتأكيدُ فوقه بعيدا عن عينه. فيظنّ أنّ شيئا
     لم يحدث. وشكا صاحبُ المنصّة منه صراحةً (١٣ سبتمبر ٢٠٢٦).

     والمردُّ إلى **البطاقة** لا إلى رأس الصفحة: هذه البطاقةُ تُركَّب داخلَ
     نموذجِ الانضمام وداخلَ صفحةِ الحالة، فرأسُ الصفحة ليس موضعَها — ومن
     رُدّ إليه فقد موضعَه من النموذج بلا ذنب.

     والمردُّ معلَّقٌ بـ`done` وحدَه لا داخلَ مستمعِ الرسائل: فذاك يُنادى مرارا
     بـ`page_height` ما دام المتقدّمُ يقلّب المواعيد، ولو كان المردُّ فيه
     لانتزع الصفحةَ من تحته وهو يختار. */
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!done) return
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [done])

  /* الأصلُ من الخادم إن ضُبط، وإلّا المضمَّن — بلا حالةِ تحميلٍ ظاهرة:
     تُرسم البطاقةُ بالمضمَّن ثمّ تُبدَّل إن جاء بديل. */
  const { interviewBookingUrl, interviewGuests } = usePlatformConfig()

  /* ═══ وقفُ الحجز — إشعارٌ يحلّ محلَّ التقويم، والتقويمُ باقٍ تحته ═══

     القرارُ ولماذا مكتوبان في `application-options.ts`. وموضعُ الخروج هنا —
     بعد آخر خطّافٍ وقبل بناء الرابط — مقصودٌ من وجهَين: ترتيبُ الخطّافات لا
     يتغيّر بين حالٍ وحال (شرطُ React)، ولا تُقرأ `window.location` ولا يُفتح
     إطارٌ لتقويمٍ لن يُعرض.

     ═══ وأربعةُ أشياءَ تُقال معا — سكوتُ أيِّها يُنتج سؤالا ═══

     ① **طلبُه وصل، وشكرا له.** فمن فتح الصفحةَ ليحجز فوجد بابا مغلقا قرأ
        الإغلاقَ ردّا على طلبه — وهو أوّلُ ما يتبادر، وأبعدُ ما يكون عن الحقّ.
     ② **ولماذا وُقف:** امتلاءُ المواعيد لا عطبٌ فينا. والتقويمُ حين تنفد
        أوقاتُه يعرض شهرا فارغا بلا كلمة، فيقلّب الأسابيعَ ويظنّ العطب.
     ③ **ومتى يعود** — بشهرٍ مسمّى. و«قريبا» ليست موعدا: من قرأها عاد غدا
        يقلّب التقويمَ نفسَه.
     ④ **ولا يُعيد التقديم.** وهو أوّلُ ما يفعله من وجد بابا مغلقا، فيزدحم
        الطابورُ بنسخٍ من طلبٍ واحد — وهي الشكوى التي وُقف الحجزُ لأجلها. */
  if (INTERVIEW_BOOKING_PAUSE.active) {
    return (
      <Card tone="warn" className={className}>
        <p className="flex items-center gap-2 text-sm font-black text-gold-ink">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          وصلنا طلبك — شكرا لك
        </p>
        <p className="mt-3 text-read leading-7 text-foreground">
          طلبك كاملٌ ومحفوظٌ عند فريقنا
          {reference && <> برقم <b className="font-mono text-foreground" dir="ltr">{reference}</b></>}
          ، ولا ينقصه منك شيءٌ الآن.
        </p>

        {/* ═══ والاهتمامُ يُقال وإن وُقف الحجز (٢٢ سبتمبر ٢٠٢٦) ═══

            الوقفُ يُغلق التقويمَ ولا يُسقط سببَ الدعوة: من نظرنا في ملفّه
            ورغبنا بلقائه فهو كذلك في سبتمبر كما في أكتوبر. وهو أنفعُ ما
            يُقال لمن سيُطلب منه أن ينتظر شهرا — فإن سكتنا عنه قرأ الوقفَ
            ردّا على ملفّه لا امتلاءَ مواعيدَ عندنا.

            **ولا يُطلب منه حجزٌ هنا**: ما يُطلب مكتوبٌ تحته في إشعار الوقف
            (يصلك الرابطُ في شهرٍ مسمّى)، وسطرُ «احجز» فوقَ بابٍ مغلقٍ هو
            عينُ التناقض الذي وُضع الإشعارُ ليزيله. */}
        {invited && (
          <div className="mt-4">
            <p className="flex items-start gap-2 text-sm font-black text-foreground">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />
              <span>{INTERVIEW_INVITATION.headingAr}</span>
            </p>
            <p className="mt-2 pr-6 text-read leading-7 text-muted-foreground">
              {INTERVIEW_INVITATION.interestAr}
            </p>
          </div>
        )}

        <Inset className="mt-4 text-read leading-7 text-muted-foreground">
          <p className="flex items-start gap-2 font-black text-foreground">
            <CalendarOff className="mt-1 h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />
            <span>حجزُ المواعيد متوقّفٌ مؤقّتا</span>
          </p>
          <p className="mt-2 pr-6">
            امتلأت أوقاتُ اجتماعاتنا لكثرة المتقدّمين، فلا يوجد وقتٌ متاحٌ لحجز{' '}
            {TRAINER_INTERVIEW.labelAr} هذا الشهر ({INTERVIEW_BOOKING_PAUSE.monthAr}).
          </p>
          <p className="mt-2 pr-6">
            <b className="text-foreground">
              ونعود إليك برابط حجز الموعد مجدّدا خلال الشهر القادم — {INTERVIEW_BOOKING_PAUSE.resumeMonthAr}.
            </b>
          </p>
        </Inset>

        <p className="mt-4 flex items-start gap-2 text-read leading-7 text-muted-foreground">
          <MailCheck className="mt-1 h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />
          <span>
            ولا يلزمك شيءٌ الآن: يصلك رابطُ الحجز على بريدك حين تُفتح المواعيد،
            و<b className="text-foreground">لا حاجةَ إلى إعادة تقديم طلبك</b> — طلبٌ واحدٌ يكفي،
            ومكانُك في الطابور محفوظٌ بتاريخ وصوله.
          </span>
        </p>
      </Card>
    )
  }

  const url = trainerInterviewUrl(
    { name, email, reference, guests: interviewGuests ?? undefined },
    interviewBookingUrl ?? undefined,
  )
  /* `embed_domain` شرطُ Calendly لبثّ الأحداث، و`embed_type` يُخفي رأسَ صفحتهم */
  const embedUrl = `${url}${url.includes('?') ? '&' : '?'}embed_domain=${encodeURIComponent(window.location.hostname)}&embed_type=Inline`

  return (
    <div ref={cardRef} className={`rounded-2xl border border-teal/30 bg-teal/[0.05] p-5 ${className}`}>
      {/* ═══ عنوانان: دعوةٌ لمن دُعي، وتقويمٌ محيَّدٌ لمن لم يُدعَ ═══

          «مهتمّون بملفّك» خبرٌ عن فعلٍ وقع عندنا، فلا يُقال لمن لم يُنظر في
          ملفّه بعد — ومن يُدعى مكتوبٌ في `interview-invitation.ts`. ومن لم
          يُدعَ يبقى له التقويمُ كما كان: يحجز متى شاء بلا دعوى نقولها له. */}
      <p className="flex items-center gap-2 text-sm font-black text-teal-light-ink">
        <CalendarClock className="h-4 w-4" />
        {invited
          ? INTERVIEW_INVITATION.headingAr
          : <>احجز {TRAINER_INTERVIEW.labelAr} — اختر الوقت الذي يناسبك</>}
      </p>
      {/* وسببُ الدعوة ثمّ ما نطلبه — سطران لا سطرٌ واحد: الأوّلُ يقول لماذا
          كتبنا إليه، والثاني ما يفعله الآن. وجملةٌ واحدةٌ تحملهما تُقرأ
          نصفَها ويُهمَل نصفُها. */}
      {invited && (
        <>
          <p className="mt-3 text-read leading-7 text-foreground">{INTERVIEW_INVITATION.interestAr}</p>
          <p className="mt-1.5 text-read leading-7 text-foreground">{INTERVIEW_INVITATION.askAr}</p>
        </>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-read leading-5 text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" /> {TRAINER_INTERVIEW.minutes} دقيقة
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5" /> عن بُعد عبر {TRAINER_INTERVIEW.platformAr}
        </span>
      </p>

      {done ? (
        /* ═══ وحقُّ التغيير يُقال عند الحجز لا يُترك ليُكتشف ═══

           رسالةُ Calendly تحمل «Reschedule» و«Cancel»، ومن لم يُقَل له ذلك
           لا يفتح رسالةَ تأكيدٍ ليبحث عن زرّ — بل يراسلنا أو يتغيّب. وطلبُ
           صاحب المنصّة صريح (١٥ سبتمبر ٢٠٢٦): «اذكر له أنّه يحقّ له تغييرُ
           الموعد من دعوة البريد نفسِها التي وصلت». */
        <Inset tone="positive" className="mt-4 text-read leading-6 text-foreground">
          <p className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
            <span>حُجز موعدك — تصلك رسالةُ تأكيدٍ بدعوة التقويم، ويظهر في صفحة حالتك بعد لحظات.</span>
          </p>
          <p className="mt-2 pr-6">
            <b className="text-foreground">ولك أن تغيّر موعدك أو تلغيه من الدعوة نفسِها</b> — في رسالة
            Calendly زرّا «إعادة الجدولة» و«الإلغاء»، يعملان حتّى قبل الموعد بساعات. فلا تحجز موعدا ثانيا.
          </p>
        </Inset>
      ) : (
        <>
          {/* الحجزُ داخل الصفحة، في صندوقٍ قصيرٍ لا يتبع طولَ التقويم */}
          {/* الانحناءُ على الحاضن لا على الإطار: `rounded-*` مع كلمة `border`
              في صيغةٍ واحدةٍ سطحٌ مكتوبٌ بيده، وسقفُها محروس. */}
          <div className="relative mt-4 overflow-hidden rounded-xl bg-white">
            {/* الصندوقُ المرئيّ: ارتفاعٌ مقطوعٌ ثابت، وتمريرٌ رأسيٌّ وحدَه.
                و`overflow-x-hidden` هي التي تمنع الزحفَ يمينا ويسارا — ولو
                تُركت `overflow-auto` عادت الشكوى من بابها. */}
            <div className={`${BOX_HEIGHT} overflow-y-auto overflow-x-hidden`}>
              {/* والإطارُ بطول محتواه: `min-h-full` قبل أن يصل قياسٌ فيملأ
                  الصندوقَ، ثمّ الطولُ المقيسُ فيُمرَّر إليه ما زاد. */}
              <div
                className="relative min-h-full w-full"
                style={{ height: frameHeight ?? undefined }}
              >
                <iframe
                  src={embedUrl}
                  title="اختيار موعد لقاء التعارف"
                  /* ولا `lazy`: البطاقةُ لا تُعرض إلّا لمن جاء ليحجز، فتأخيرُ
                     البدء حتّى يقترب من الشاشة تأخيرٌ بلا مقابل. */
                  onLoad={() => setFrameReady(true)}
                  style={{ border: 'none' }}
                  className="absolute inset-0 block h-full w-full"
                />
              </div>
            </div>
            {/* ═══ واللوحُ فوقَ الصندوق لا داخلَ الإطار ═══

                كان `absolute inset-0` داخلَ حاضن الإطار، فلمّا صار ذاك أطولَ
                من الصندوق بمرّات صار وسطُه — حيث الدوّارةُ — تحت القطع: يرى
                الجائي بياضا ويظنّ العطب. فموضعُه الصندوقُ نفسُه: يُغطّيه
                كلَّه ويُرى وسطُه، ويُكشف حين يجيب Calendly. */}
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
                    أو افتحه في تبويبٍ جديد
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </div>
              </div>
            )}
          </div>
          {/* ═══ ولماذا يُطلب منه أن يتحقّق بنفسه ═══

              وجيز لا تعرف بالحجز إلّا بعد أن تُزامَن مواعيدُ Calendly. وحتّى
              يُضبط ذلك، من حجز ثمّ عاد إلى هذه الصفحة يراها كأنّه لم يحجز —
              فيحجز ثانيا ويجد المُقابِلُ موعدَين لشخصٍ واحد.

              فيُقال له صراحةً أن يتحقّق من بريده: رسالةُ تأكيد Calendly هي
              الدليلُ الذي بيده الآن. وهذا سطرٌ يُحذف يومَ تعمل المزامنة —
              وبقاؤه بعدها لا يضرّ، فالتحقّقُ قبل الحجز الثاني صوابٌ دائما. */}
          <Inset as="p" className="mt-3 text-read leading-6 text-muted-foreground">
            حجزتَ موعدا سابقا؟ تحقّق من بريدك أوّلا — يصلك من Calendly تأكيدٌ فيه موعدُك،
            و<b className="text-foreground">منه وحدَه تغيّر الموعدَ أو تلغيه</b> بزرّي «إعادة الجدولة»
            و«الإلغاء». ولا تحجز موعدا ثانيا قبل أن تُلغي الأوّل.
          </Inset>
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
              أو افتح صفحة الحجز في تبويبٍ جديد
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </p>
        </>
      )}
    </div>
  )
}

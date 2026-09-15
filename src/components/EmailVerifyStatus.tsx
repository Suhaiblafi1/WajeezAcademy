/* حالةُ توثيق البريد — حيّةً في الشاشة، لا وعدا يُقال مرّةً ثمّ يُنسى.

   ═══ العطبُ الذي كُتبت له ═══

   شاشةُ «وصل طلبك» كانت تقول: «أرسلنا بريد تأكيد إلى فلان… فيه رابطٌ افتحه
   مرّةً واحدة ليُوثَّق بريدك». ثمّ لا تقول شيئا بعدها أبدا. فمن فتح الرابطَ
   في لسانٍ آخرَ وعاد يجد الجملةَ نفسَها بحرفها — فلا يدري: أوصلت نقرتُه أم
   ضاعت؟ ومن لم تصله الرسالةُ أصلا لا يعرف أنّه لم يصله شيء، فيمضي ظانّا أنّ
   طلبَه تامّ. **والتوثيقُ شرطُ اعتماده.**

   وطلبُ صاحب المنصّة صريح (١٥ سبتمبر ٢٠٢٦): «تأكّد أنّ التوثيق وصل للإيميل،
   وأن يُخبر المتقدّمَ أن يتأكّد من إيميله، وإعطاؤه الحالة **غير موثّق** حتّى
   يوثّقه، ومن ثمّ تظهر **تمّ التوثيق** إذا وثّق».

   ═══ ولماذا لا تُستفتى الحالةُ كلَّ ثانية ═══

   `/status` محدودُ المعدّل: عشرُ مرّاتٍ في عشر دقائق (وهو صوابٌ — البريدُ
   وحدَه يكفي للسؤال، فلا يُسأل عن ألف بريدٍ في دقيقة). فمؤقّتٌ كلَّ ثانيتين
   يحرق النصيبَ في نصف دقيقةٍ ثمّ يبقى المتقدّمُ أمام ٤٢٩ لا أمام حالة.

   واللحظةُ التي تهمّ معروفةٌ بلا مؤقّت: **عودتُه إلى هذا اللسان.** من يوثّق
   يغادر إلى بريده ويفتح الرابطَ ثمّ يعود — فالسؤالُ عند العودة يُصيب أوّلَ
   مرّة. ومعه زرٌّ يسأل بيده لمن وثّق على هاتفه والشاشةُ مفتوحةٌ أمامه.

   ═══ والنصيبُ يُقسَم لا يُحرَق ═══

   ومهلةٌ بين سؤالَين، وسقفٌ لعدد ما يُسأل تلقائيّا. **والسقفُ هو الذي يحمي
   النصيبَ لا طولُ المهلة** — وأوّلُ صياغةٍ عكست الاثنين فجعلت المهلةَ ثلاثين
   ثانية. وجُرّبت الرحلةُ كاملةً في متصفّحٍ حقيقيّ: العودةُ من لسان التوثيق
   وقعت بعد تسعِ ثوانٍ، فابتلعتها المهلةُ وبقيت البطاقةُ تقول «غير موثَّق»
   لمن وثّق قبل ثانية — وهو العطبُ الذي كُتبت له هذه البطاقة أصلا.

   فعملُ المهلة أضيقُ من ذلك: `focus` و`visibilitychange` يصلان معا عند
   العودة الواحدة، فتمنع المهلةُ سؤالَين لعودةٍ واحدة لا غير. وأربعُ ثوانٍ
   تسعهما، ولا يفتح إنسانٌ بريدَه وينقر رابطَه في أقلَّ منها.

   وستُّ أسئلةٍ تلقائيّة (أوّلُها عند الفتح) تُبقي أربعةً لزرّ اليد. ومتى
   وُثّق توقّف السؤالُ كلُّه — لا شيءَ بعده يُنتظر. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, MailWarning, RefreshCcw } from 'lucide-react'
import { apiGet, apiPost, ApiError } from '@/services/api'
import { Card } from '@/components/ui/Surface'

/** أقلُّ ما بين سؤالَين — تمنع سؤالَين لعودةٍ واحدة، لا أكثر */
export const VERIFY_POLL_GAP_MS = 4_000

/** سقفُ ما يُسأل تلقائيّا في فتحةٍ واحدة — وما بعده بيد صاحبه وحدَه */
export const VERIFY_MAX_AUTO_ASKS = 6

export interface EmailVerifyStatusProps {
  /** بريدُ الطلب — هو مفتاحُ السؤال ومحلُّ الرسالة */
  email: string
  /** الرقمُ المرجعيّ إن عُرف — يُطابَق عند الخادم فيُقصّ الجوابُ على طلبٍ بعينه */
  reference?: string
  /* ما قاله الخادمُ عن إرسال الرسالة عند إكمال الطلب. وهو غيرُ التوثيق:
     رسالةٌ لم تُرسَل أصلا ≠ رسالةٌ وصلت ولم تُفتح — والنصُّ الواحدُ لهما
     يُرسل المتقدّمَ يفتّش في بريدٍ لا شيءَ فيه. */
  delivery?: 'sent' | 'not_configured' | 'failed' | null
  className?: string
}

type Verified = 'unknown' | 'pending' | 'done'

export default function EmailVerifyStatus({
  email, reference, delivery, className = '',
}: EmailVerifyStatusProps) {
  const [verified, setVerified] = useState<Verified>('unknown')
  const [busy, setBusy] = useState(false)
  /* تعذُّرُ السؤال يُقال ولا يُقلب «غير موثّق»: من وثّق فعلا ثمّ ردّ الخادمُ
     ٤٢٩ لا يُقال له إنّه لم يوثّق — ذاك خبرٌ كاذبٌ عن حالته. */
  const [stale, setStale] = useState(false)
  const [resent, setResent] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const lastAsked = useRef(0)
  const autoAsks = useRef(0)
  /* الانتهاءُ في مرجعٍ لا في الحالة وحدَها: لو عُلّق السؤالُ على `verified`
     لأعاد أثرُه نداءَ نفسِه عند كلّ جوابٍ يغيّرها — حلقةٌ لا تقف. */
  const doneRef = useRef(false)

  const ask = useCallback(async (force: boolean) => {
    if (!email || doneRef.current) return
    const now = Date.now()
    if (!force) {
      if (now - lastAsked.current < VERIFY_POLL_GAP_MS) return
      if (autoAsks.current >= VERIFY_MAX_AUTO_ASKS) return
      autoAsks.current += 1
    }
    lastAsked.current = now
    setBusy(true)
    try {
      const q = new URLSearchParams({ email: email.trim().toLowerCase() })
      if (reference) q.set('reference', reference)
      const res = await apiGet<{ emailVerified: boolean }>(
        `/api/v1/trainer-applications/status?${q.toString()}`,
      )
      setStale(false)
      if (res.emailVerified) doneRef.current = true
      setVerified(res.emailVerified ? 'done' : 'pending')
    } catch (err) {
      /* ٤٠٤ ليس عطبا في السؤال: طلبٌ لم يُكتب بعد أو بريدٌ غيرُه. أمّا ٤٢٩
         وانقطاعُ الشبكة فيُقالان — وتبقى الحالةُ على آخر ما عُرف. */
      if (err instanceof ApiError && err.status === 404) setVerified('pending')
      else setStale(true)
    } finally {
      setBusy(false)
    }
  }, [email, reference])

  /* أوّلُ سؤالٍ عند الفتح، ثمّ عند كلّ عودةٍ إلى هذا اللسان. والأثران
     معلَّقان بـ`ask` وحدَها — وهي لا تتبدّل إلّا بتبدّل البريد أو الرقم. */
  useEffect(() => {
    autoAsks.current += 1
    void ask(true)
  }, [ask])

  useEffect(() => {
    const onBack = () => {
      if (document.visibilityState === 'visible') void ask(false)
    }
    window.addEventListener('focus', onBack)
    document.addEventListener('visibilitychange', onBack)
    return () => {
      window.removeEventListener('focus', onBack)
      document.removeEventListener('visibilitychange', onBack)
    }
  }, [ask])

  const resend = async () => {
    if (resent === 'busy') return
    setResent('busy')
    try {
      await apiPost('/api/v1/trainer-applications/resend-verification', { email: email.trim().toLowerCase() })
      setResent('done')
    } catch {
      setResent('error')
    }
  }

  if (verified === 'done') {
    return (
      <Card tone="positive" className={className}>
        <p className="flex items-center gap-2 text-sm font-black text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> تمّ التوثيق — بريدك موثَّق
        </p>
        <p className="mt-2 text-read leading-7 text-foreground">
          <b dir="ltr" className="font-mono text-foreground">{email}</b> صار موثَّقا، ولا يبقى عليك شيءٌ فيه.
          وعلى هذا البريد تصلك أخبارُ طلبك ودعوةُ المقابلة.
        </p>
      </Card>
    )
  }

  /* ═══ ثلاثُ حالاتٍ لا اثنتان — والدوّارُ لا يدور إلى الأبد ═══

     قبل أن يصل الجوابُ الأوّل لا يُقال «غير موثّق»: الشاشةُ فُتحت للتوّ،
     واتّهامُه بما لم يُقَس أسوأُ من سطرٍ يقول إنّنا نسأل.

     **لكنّ السؤالَ قد لا يُجاب أصلا.** جُرّبت البطاقةُ بعد أن نفد نصيبُ
     `‎/status` (٤٢٩)، فبقيت تقول «نتحقّق من حالة بريدك…» ودوّارُها يدور بلا
     نهاية: لا حالةَ ولا سببَ ولا شيءَ يفعله صاحبُها. وهو أسوأُ من الوعد الذي
     كُتبت هذه البطاقةُ لتنقضه.

     فالحالةُ الثالثةُ تُقال باسمها: «تعذّر التحقّق». والإرشادُ تحتها كما هو —
     من لم نستطع قياسَ حالته يُدَلُّ على ما يفعل، ولا يُقال له إنّه غير موثَّق
     (فقد يكون وثّق ونحن لم نبلغ الخادم). */
  const asking = verified === 'unknown' && !stale
  const unknown = verified === 'unknown'
  /* `undefined` تعني «لم يُسأل عن الإرسال» (صفحةُ متابعةٍ مثلا) — فلا يُدّعى
     إخفاقٌ ولا نجاح. والإخفاقُ وحدَه هو `sent` المنفيّة صراحةً. */
  const notSent = delivery !== undefined && delivery !== null && delivery !== 'sent'

  return (
    <Card tone="warn" className={className}>
      <p className="flex flex-wrap items-center gap-2 text-sm font-black text-gold-ink">
        {asking
          ? <><Loader2 className="h-4 w-4 animate-spin" /> نتحقّق من حالة بريدك…</>
          : unknown
            ? <><MailWarning className="h-4 w-4" /> تعذّر التحقّق من حالة بريدك الآن</>
            : <><MailWarning className="h-4 w-4" /> حالة بريدك: غير موثَّق</>}
      </p>
      {notSent ? (
        <p className="mt-2 text-read leading-7 text-foreground">
          تعذّر إرسالُ رسالة التأكيد إلى <b dir="ltr" className="font-mono text-foreground">{email}</b> الآن.
          <b className="text-foreground"> وطلبك محفوظٌ ومقدَّمٌ على أيّ حال</b> — اطلب الرسالةَ من الزرّ
          أدناه، أو من صفحة حالتك بعد الدخول.
        </p>
      ) : (
        <p className="mt-2 text-read leading-7 text-foreground">
          افتح بريد <b dir="ltr" className="font-mono text-foreground">{email}</b> الآن، وانقر رابطَ التأكيد
          في رسالتنا — نقرةٌ واحدة تكفي. وإن لم تجدها خلال دقائق فراجع مجلّد
          الرسائل غير المرغوبة (Spam) قبل أن تطلبها ثانية.
        </p>
      )}
      <p className="mt-2 text-read leading-7 text-muted-foreground">
        تتحدّث هذه البطاقةُ وحدَها حين تعود إلى هذه الصفحة بعد النقر — فلا تُعد تعبئةَ شيء.
      </p>
      {stale && (
        <p className="mt-2 text-read leading-6 text-muted-foreground">
          {unknown
            ? "لم نستطع قراءةَ حالة بريدك من خادمنا الآن — وطلبك محفوظ. وثّق بريدك كما فوق، ثمّ حدّث الحالة من الزرّ."
            : "تعذّر التحقّقُ الآن — حالتُك عندنا سليمةٌ على أيّ حال، وسنحدّثها بعد قليل."}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <button
          type="button" onClick={() => void ask(true)} disabled={busy}
          className="inline-flex cursor-pointer items-center gap-1.5 text-read font-bold text-teal-light-ink underline decoration-dotted underline-offset-4 disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
          وثّقتُ بريدي — حدّث الحالة
        </button>
        <button
          type="button" onClick={() => void resend()} disabled={resent === 'busy' || resent === 'done'}
          className="cursor-pointer text-read font-bold text-teal-light-ink underline decoration-dotted underline-offset-4 disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
        >
          {resent === 'done' ? 'أُعيد الإرسال — راجع بريدك'
            : resent === 'error' ? 'تعذّر — حاول بعد قليل'
            : resent === 'busy' ? 'نُعيد الإرسال…'
            : 'لم تصلك الرسالة؟ أعد الإرسال'}
        </button>
      </div>
    </Card>
  )
}

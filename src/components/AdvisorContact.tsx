import { Mail, MessageCircle } from 'lucide-react'
import { CONTACT } from '@/data/stories'
import { useWhatsAppNumbers } from '@/services/whatsapp'
import { waHref } from '@/application/site/whatsapp'

/** زر مراسلة المستشار — واتساب عند ضبط الرقم الرسمي في CONTACT.whatsapp
    (عند الربط الفعلي)، وبريد إلكتروني معبأ مسبقا قبلها. لا رقم مؤقت مختلق */
export default function AdvisorContact({
  text,
  label,
  className,
  icon,
  onNavigate,
}: {
  text: string
  label: string
  className?: string
  icon?: React.ReactNode
  /** يعترض النقرة قبل مغادرة الصفحة — لنافذةٍ تُجهّز شيئا يُرفق في المحادثة.

      ويبقى `href` موضوعا على أيّ حال: الرابطُ يُفتح بالزرّ الأوسط وبقائمة
      السياق و«انسخ الرابط»، ويعمل لو سقطت جافاسكربت. فالاعتراضُ تحسينٌ فوق
      رابطٍ صحيح لا بديلٌ عنه. */
  onNavigate?: () => void
}) {
  /* الرقمُ من الإدارة، و`CONTACT.whatsapp` رجوعٌ حتّى يُضبط أوّلُ رقم */
  const numbers = useWhatsAppNumbers()
  const wa = waHref(numbers, 'advisor', CONTACT.whatsapp, text)
  const hasWhatsApp = Boolean(wa)
  const href = wa
    ?? `mailto:${CONTACT.email}?subject=${encodeURIComponent('أكاديمية وجيز — مراسلة مستشار')}&body=${encodeURIComponent(text)}`
  return (
    <a
      href={href}
      target={hasWhatsApp ? '_blank' : undefined}
      rel={hasWhatsApp ? 'noreferrer' : undefined}
      onClick={
        onNavigate
          ? (e) => {
              /* نقرةٌ بمِفتاحٍ أو بزرٍّ غيرِ الأيسر تعني «افتحه كما هو» —
                 فلا تُعترَض، وإلّا سُلب المستخدمُ فتحَه في لسانٍ جديد. */
              if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
              e.preventDefault()
              onNavigate()
            }
          : undefined
      }
      className={className}
    >
      {icon ?? (hasWhatsApp ? <MessageCircle className="h-4 w-4" /> : <Mail className="h-4 w-4" />)}
      {label}
    </a>
  )
}

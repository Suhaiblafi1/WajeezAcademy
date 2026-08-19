import { Mail, MessageCircle } from 'lucide-react'
import { CONTACT } from '@/data/stories'

/** زر مراسلة المستشار — واتساب عند ضبط الرقم الرسمي في CONTACT.whatsapp
    (عند الربط الفعلي)، وبريد إلكتروني معبأ مسبقا قبلها. لا رقم مؤقت مختلق */
export default function AdvisorContact({
  text,
  label,
  className,
  icon,
}: {
  text: string
  label: string
  className?: string
  icon?: React.ReactNode
}) {
  const hasWhatsApp = Boolean(CONTACT.whatsapp)
  const href = hasWhatsApp
    ? `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`
    : `mailto:${CONTACT.email}?subject=${encodeURIComponent('أكاديمية وجيز — مراسلة مستشار')}&body=${encodeURIComponent(text)}`
  return (
    <a
      href={href}
      target={hasWhatsApp ? '_blank' : undefined}
      rel={hasWhatsApp ? 'noreferrer' : undefined}
      className={className}
    >
      {icon ?? (hasWhatsApp ? <MessageCircle className="h-4 w-4" /> : <Mail className="h-4 w-4" />)}
      {label}
    </a>
  )
}

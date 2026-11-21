/* «من خارج الأردن؟ راسلنا على واتساب» — في النموذج وخطوة الدفع (٢١ نوفمبر ٢٠٢٦).
   CliQ داخل الأردن وحدَه والبطاقةُ مخفيّة، فمن رقمُه خارجَه يُدعى إلى واتساب برسالةٍ جاهزة: بلدُه ورقمُ مرجعه إن حجز.
   والنصُّ والرسالةُ في `ai-jobs.ts` — يقرؤهما بريدُ التذكير أيضا فلا يفترقان. */

import { ABROAD_PAY_LINE, AI_JOBS, abroadPayMessage } from '@/application/private-course/ai-jobs'
import { whatsappLink } from '@/application/private-course/phone'
import { trackPixel } from './meta-pixel'

export default function AbroadPay({ country, reference }: { country?: string; reference?: string }) {
  return (
    <a className="aij-abroad" href={whatsappLink(AI_JOBS.whatsapp, abroadPayMessage({ country, reference }))}
      target="_blank" rel="noopener noreferrer" onClick={() => trackPixel('Contact', { content_name: 'abroad_pay' })}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.5c-.1.2-.3.3-.1.6.2.3.8 1.4 1.8 2.2 1.2 1.1 2.3 1.4 2.6 1.6.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.8-.1 1.4Z" /></svg>
      <span>{ABROAD_PAY_LINE}</span>
    </a>
  )
}

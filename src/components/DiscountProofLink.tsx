/* رابطُ إثبات أهليّة خصم الفئة — جملةٌ واحدةٌ كانت مكتوبةً مرّتين.

   ═══ لماذا مكوّنٌ لا نسختان ═══

   النصُّ نفسُه والرابطُ نفسُه كانا في `Pathway.tsx` و`CoursePath.tsx`
   حرفا بحرف. فلمّا خرج الرقمُ من الشيفرة إلى الإدارة، كان لا بدّ من
   `useWhatsAppNumbers()` في كلّ صفحةٍ منهما — أو من موضعٍ واحدٍ يقرؤه.

   والموضعُ الواحدُ أصدق: من غيّر الجملةَ غيّرها حيث تُقرأ، ولا تبقى
   نسخةٌ قديمةٌ في صفحةٍ نسيها.

   ═══ ولا رابطَ ميّت ═══

   إن لم يُحلَّ رقمٌ (لا من الإدارة ولا من `CONTACT.whatsapp`) بقيت الجملةُ
   نصّا بلا رابط. فجملةٌ تقول «راسلنا» خيرٌ من رابطٍ يفتح `wa.me/` فارغا. */

import { CONTACT } from '@/data/stories'
import { waHref } from '@/application/site/whatsapp'
import { useWhatsAppNumbers } from '@/services/whatsapp'

const PROOF_MSG_AR = 'أرغب بالتحقق من أهليتي لخصم فئة — وسأرفق ما يثبت ذلك.'
const LINK_LABEL_AR = 'راسلنا على واتساب بصورة الإثبات'
const TAIL_AR = ' لمعرفة الكود للطلبة وموظفي الحكومة.'

export default function DiscountProofLink({ className }: { className?: string }) {
  const numbers = useWhatsAppNumbers()
  const href = waHref(numbers, 'discount_proof', CONTACT.whatsapp, PROOF_MSG_AR)
  return (
    <p className={className ?? 'mt-2 text-read leading-5 text-muted-foreground'}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-bold text-teal-light-ink underline underline-offset-4 transition hover:text-teal-ink"
        >
          {LINK_LABEL_AR}
        </a>
      ) : (
        <span className="font-bold text-foreground">{LINK_LABEL_AR}</span>
      )}
      {TAIL_AR}
    </p>
  )
}

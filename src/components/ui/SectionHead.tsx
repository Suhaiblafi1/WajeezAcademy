/* رأسُ قسمٍ في صفحة — أيقونةٌ في مربّعٍ هادئ، وعنوانٌ، وسطرُ شرحٍ إن لزم.

   كُتب لصفحة «إعدادات الحساب» (٢١ أكتوبر ٢٠٢٦) حين قال صاحبُ المنصّة إنّها «ليست
   احترافيّةً ولا تمثّل أكاديميّةً عريقة»: كانت رؤوسُ أقسامها بثلاث هيئات — عنوانٌ
   بأيقونةٍ صغيرةٍ ملاصقة، وعنوانٌ بلا أيقونة، وعنوانٌ تحته فقرةٌ طويلة. فصار رأسا
   واحدا يحمله كلُّ قسم، والعينُ تجد بدايةَ كلِّ قسمٍ في الموضع نفسِه.

   و`action` لما يجلس في طرف الرأس — حالةٌ أو رابط — لا زرِّ فعلٍ رئيسيّ. */

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export default function SectionHead({
  icon: Icon, title, desc, id, action,
}: {
  icon: LucideIcon
  title: ReactNode
  desc?: ReactNode
  /** معرّفُ العنوان — ليصله القسمُ بـ`aria-labelledby` */
  id?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal-light-ink" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-base font-black leading-7">{title}</h2>
        {desc && <p className="mt-0.5 max-w-2xl text-read leading-6 text-muted-foreground">{desc}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* رأسُ الشاشة يبدأ بالعمل لا بالعدد.
 *
 * ── العطبُ الذي وُلد منه، مقيسا ──
 *
 * «تأليف المتون» كانت تفتح بثلاث بطاقاتِ عددٍ متساويةِ الوزن: «٤٠٤ وحدات
 * الكتالوج» و«١٢٨ لها متن» و«٢٧٦ بلا متن». و«الكتالوج» بستٍّ منها. والرقمُ
 * الذي يعني عملا يُعرض بالحجم نفسِه الذي يُعرض به مجموعٌ لا يفعل به أحدٌ
 * شيئا — فالشاشةُ تقول «هذه أرقامُك» ولا تقول «ابدأ من هنا».
 *
 * ── والعلاجُ ليس رقما أكبر ──
 *
 * الرقمُ الضخمُ وحدَه قالبٌ معروف: عددٌ كبيرٌ ولصيقةٌ صغيرةٌ وإحصاءاتٌ تحته.
 * وهو زينةٌ أيضا، لأنّه لا يقول ماذا يُفعل به.
 *
 * فالرأسُ هنا **جملةٌ لا رقم**: فعلٌ يقول ما ينتظر («تنتظر متنَها»)، وعددٌ
 * داخلَ الجملة لا معلَّقٌ فوقها، وزرٌّ واحدٌ يدخل إلى العمل نفسِه. والمجاميعُ
 * تحتها سطرا واحدا — تبقى لمن أرادها ولا تنازع ما يُعمل.
 *
 * ── ثلاثُ حالاتٍ لا واحدة ──
 *
 *   تُقرأ   · هيكلٌ ساكن، لا دوّامةٌ تدور في منتصف المحتوى
 *   عملٌ    · الجملةُ والزرّ
 *   تمّ     · يُقال صراحةً، ولا يُترك صفرٌ يستنتجه القارئ
 *
 * وحالُ «تمّ» تعلّم الشاشة: تقول ما اكتمل وأين يُرى، لا «لا شيء هنا».
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { countAr, type CountForms } from '@/application/text/count-ar'
import { Card } from '@/components/ui/Surface'
import Button from '@/components/ui/Button'

export interface WorkHeaderProps {
  /** ما ينتظر — العددُ يدخل الجملةَ ولا يُعلَّق فوقها */
  count: number
  /** صيغُ المعدود: «وحدةٌ · وحدتان · وحدات · وحدةً» */
  forms: CountForms
  /** الفعلُ الذي يجعله عملا: «تنتظر متنَها» لا «بلا متن» */
  waitingAr: string
  /** المجاميعُ — كلُّ واحدةٍ صندوقُها، لا يفصلها حرف.
   *
   *  ولماذا مصفوفةٌ لا نصٌّ واحد: كُتبت أوّلا نصًّا فيه «·» بين الأعداد،
   *  فأظهرت المعاينةُ أنّ **الفاصلَ يلتحم بالرقم**: «١٢٨ · اكتملت» تُقرأ
   *  «١٢٨٠»، و«٢٠٦ ·» تُقرأ «٢٠٦٠». والنقطةُ الوسطى محايدةُ الاتّجاه، فتقع
   *  بين عددين في فقرةٍ من اليمين فتُرى رقما لاحقا.
   *
   *  وليس هذا عطبَ شكل: **يغيّر العددَ الذي يقرؤه الإنسان**. فصار كلُّ
   *  مقطعٍ عنصرَ `flex` قائما بذاته تفصله مسافةٌ لا حرف — فلا شيءَ يُجاور
   *  الرقمَ ليلتحم به. */
  stats?: readonly string[]
  /** الفعلُ الأوّل: نصُّه يسمّي ما يقع، لا «اذهب» */
  actionAr: string
  /** إمّا انتقالٌ إلى مسار، وإمّا تنفيذٌ في المكان */
  to?: string
  onAction?: () => void
  /** يُعطَّل الزرُّ بسببٍ يُقال — لا بهتانٌ صامت */
  disabledReasonAr?: string
  /** حالُ الاكتمال — تقول ما تمّ، لا «لا شيء» */
  doneAr: ReactNode
  loading?: boolean
  icon?: LucideIcon
}

export default function WorkHeader({
  count, forms, waitingAr, stats, actionAr, to, onAction,
  disabledReasonAr, doneAr, loading = false, icon: Icon,
}: WorkHeaderProps) {
  /* ــ تُقرأ: هيكلٌ بقياس ما سيحلّ محلَّه، فلا تقفز الصفحةُ عند وصوله ــ */
  if (loading) {
    return (
      <Card className="mb-5 flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" aria-busy="true">
        <div className="min-w-0 space-y-2.5 sm:flex-1">
          <div className="h-6 w-64 max-w-full animate-pulse rounded-lg bg-white/10" />
          <div className="h-4 w-44 max-w-full animate-pulse rounded bg-white/[0.06]" />
        </div>
        <div className="h-11 w-full animate-pulse rounded-full bg-white/[0.06] sm:w-32" />
        <span className="sr-only">يُقرأ ما ينتظر…</span>
      </Card>
    )
  }

  /* ــ تمّ: الصفرُ يُقال ولا يُستنتَج ــ */
  if (count <= 0) {
    return (
      <Card tone="positive" as="p" className="mb-5 text-read leading-7 text-emerald-200">
        {doneAr}
      </Card>
    )
  }

  const blocked = Boolean(disabledReasonAr)

  /* ــ ولماذا السطحُ محايدٌ لا `warn` ــ
     كُتب أوّلا بنبرة التحذير، فبدا لوحا ذهبيّا يفتتح خمسَ شاشات. والعملُ
     المنتظرُ ليس إنذارا: مئتان وستٌّ وسبعون وحدةً تنتظر متنَها تشغيلٌ عاديّ.
     ومن صرف نبرةَ الإنذار في العاديّ لم يبقَ له نبرةٌ حين يقع الخطأ فعلا.
     فالسطحُ عاديّ، والذهبيُّ يبقى في موضعَين يعنيان شيئا: العددُ حالةٌ،
     والزرُّ فعلُ الصفحة. */
  return (
    /* ــ والعمودُ على الضيّق ــ
       كُتب أوّلا صفًّا واحدا يلتفّ، فأظهرت المعاينةُ على ٣٩٠ بكسل أنّ الزرَّ
       يحتفظ بعرضه والجملةَ تُعصر في ثلاثة أسطرٍ إلى جانبه. فعلى الضيّق
       عمودٌ: الجملةُ سطرا كاملا ثمّ الزرُّ تحتها بعرض الشاشة. */
    <Card className="mb-5 flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6 sm:gap-y-3">
      <div className="min-w-0 sm:flex-1">
        {/* الجملةُ هي الرأس: الفعلُ يقول أنّه عمل، والعددُ داخلَه لا فوقه.
            و`tabular-nums` كي لا يرقص الرقمُ حين يتغيّر.

            ولماذا ليست `flex`: كانت كذلك، فصار العددُ عنصرا مستقلًّا عن
            بقيّة الجملة — فانكسر السطرُ بينهما على الضيّق فقُرئ «٢٧٦ تنتظر»
            سطرا و«وحدةً متنَها» سطرا، والعددُ منفصلٌ عن معدوده. فهي الآن
            نصٌّ متّصلٌ يلتفّ كما يلتفّ الكلامُ، والأيقونةُ داخلَه لا بجانبه. */}
        <p className="text-xl font-black leading-8 text-foreground">
          {Icon && <Icon className="me-2 inline-block h-5 w-5 align-[-0.15em] text-gold-ink" aria-hidden="true" />}
          <span className="tabular-nums text-gold-ink">{countAr(count, forms)}</span> {waitingAr}
        </p>
        {blocked && (
          <p className="mt-1.5 text-read leading-6 text-gold-ink">{disabledReasonAr}</p>
        )}
        {!blocked && stats && stats.length > 0 && (
          <p className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-read leading-6 text-muted-foreground">
            {stats.map((s2) => <span key={s2} className="tabular-nums">{s2}</span>)}
          </p>
        )}
      </div>

      {/* السببُ يقع مع الجملة لا تحت الزرّ: من قرأ «مُعطَّل» نظر إلى ما
          يفسّره، لا إلى حاشيةٍ في الطرف الآخر من السطر. */}
      <Button
        tone="primary" size="lg" className="w-full shrink-0 sm:w-auto"
        disabled={blocked}
        {...(to && !blocked ? { as: Link, to } : { onClick: onAction })}
      >
        {actionAr}
      </Button>
    </Card>
  )
}

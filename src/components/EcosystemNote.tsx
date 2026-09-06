import { ECOSYSTEM_NOTE, ECOSYSTEM_URL } from '@/data/siteContent'

/* تعريف بصري ثابت وهادئ بانتماء الأكاديمية إلى منظومة وجيز.
   - النص من مصدر مركزي واحد (siteContent) — لا نسخ حرفي في الصفحات.
   - مصمم ليبقى ثانويا: خط صغير خافت لا ينافس الـHero ولا عناوين الصفحات.
   - الرابط يفتح موقع وجيز الأم في تبويب جديد دون أي ادعاء أن المنتجات منتج واحد. */
export default function EcosystemNote({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-fine leading-relaxed text-muted-foreground ${className}`.trim()}>
      <a
        href={ECOSYSTEM_URL}
        target="_blank"
        rel="noreferrer"
        /* رابطٌ ارتفاعُه ثلاثةَ عشرَ بكسلا هدفٌ يُخطئه الإصبع — قِيس على
           هاتفٍ عرضُه ٣٩٠ بكسلا في ستّ شاشات. والحدُّ اثنان وثلاثون، ويبقى
           النصُّ بحجمه فلا يعلو الهامشُ على ما فوقه. */
        className="inline-flex min-h-8 items-center px-2 transition hover:text-foreground"
      >
        {ECOSYSTEM_NOTE}
      </a>
    </p>
  )
}

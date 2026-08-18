import { ECOSYSTEM_NOTE, ECOSYSTEM_URL } from '@/data/siteContent'

/* تعريف بصري ثابت وهادئ بانتماء الأكاديمية إلى منظومة وجيز.
   - النص من مصدر مركزي واحد (siteContent) — لا نسخ حرفي في الصفحات.
   - مصمم ليبقى ثانويا: خط صغير خافت لا ينافس الـHero ولا عناوين الصفحات.
   - الرابط يفتح موقع وجيز الأم في تبويب جديد دون أي ادعاء أن المنتجات منتج واحد. */
export default function EcosystemNote({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-[11px] leading-relaxed text-white/35 ${className}`.trim()}>
      <a
        href={ECOSYSTEM_URL}
        target="_blank"
        rel="noreferrer"
        className="transition hover:text-white/60"
      >
        {ECOSYSTEM_NOTE}
      </a>
    </p>
  )
}
